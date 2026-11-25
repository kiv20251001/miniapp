/**
 * 小测验出题：听一听（听音选拼音）、标一标（声调标在哪）、认一认（分清声母韵母和音节类别）、读一读（看字选拼音）。
 */
import { GRADE_CHARS } from './grades'
import { readingsOf } from './convert'
import {
  ASPIRATED,
  CURLED,
  FINAL_GROUPS,
  INITIALS,
  WHOLE,
  display,
  isSyllable,
  mark,
  markPlace,
  parse,
  soundKey,
  split,
  type Tone,
} from './pinyin'
import { MARK_RULES, type Text } from './lessons'

export type Level = 'easy' | 'medium' | 'hard'
export type QuizMode = 'listen' | 'mark' | 'kind' | 'char'

export type Question = {
  mode: QuizMode
  /** 题干，例如「哪个是整体认读音节？」 */
  ask: Text
  /** 题干下面的大字：汉字、不带调的音节等 */
  show: string
  /** 标一标时显示第几声 */
  tone?: Tone
  /** 要读出来的音节 */
  sound?: string
  options: string[]
  answer: number
  rule: Text
  /** 防止连着出同一道 */
  id: string
}

const rand = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]
function shuffle<T>(list: T[]) {
  const out = [...list]
  for (let index = out.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1))
    ;[out[index], out[other]] = [out[other], out[index]]
  }
  return out
}
const randomTone = () => (1 + Math.floor(Math.random() * 4)) as Tone

function finish(question: Omit<Question, 'options' | 'answer'>, right: string, wrong: string[]): Question {
  const others = shuffle([...new Set(wrong.filter((item) => item && item !== right))]).slice(0, 3)
  const options = shuffle([right, ...others])
  return { ...question, options, answer: options.indexOf(right) }
}

// ---- 听一听 ----

const EASY_BASES = ['ma', 'ba', 'pa', 'da', 'ta', 'la', 'ha', 'mi', 'bi', 'di', 'li', 'mu', 'bu', 'hu', 'yi', 'wu', 'yu', 'shu', 'tu', 'gu']
const MEDIUM_BASES = ['zhi', 'chi', 'shi', 'zi', 'ci', 'si', 'zhu', 'zu', 'chu', 'cu', 'shan', 'san', 'zhang', 'zang', 'lan', 'nan', 'fu', 'hu', 'xin', 'xing', 'jin', 'jing', 'chen', 'cheng', 'pen', 'peng', 'yin', 'ying', 'fan', 'fang', 'lin', 'ling']
const HARD_BASES = [...MEDIUM_BASES, 'guang', 'huan', 'xiong', 'jiao', 'qiang', 'zhuang', 'shuai', 'lve', 'nv', 'jun', 'quan', 'xue', 'liu', 'gui', 'dui', 'niu']

const SWAPS: Array<[RegExp, string]> = [
  [/^zh/, 'z'], [/^ch/, 'c'], [/^sh/, 's'], [/^z(?!h)/, 'zh'], [/^c(?!h)/, 'ch'], [/^s(?!h)/, 'sh'],
  [/^n/, 'l'], [/^l/, 'n'], [/^f/, 'h'], [/^h/, 'f'],
  [/ang$/, 'an'], [/eng$/, 'en'], [/ing$/, 'in'], [/an$/, 'ang'], [/en$/, 'eng'], [/in$/, 'ing'],
  [/^j/, 'q'], [/^q/, 'x'], [/^x/, 'j'],
]

/** 容易听混、读混的音节：平翘舌、n/l、f/h、前后鼻音 */
function confusable(base: string) {
  const out: string[] = []
  for (const [pattern, swap] of SWAPS) {
    if (!pattern.test(base)) continue
    const next = base.replace(pattern, swap)
    if (next !== base && isSyllable(next)) out.push(next)
  }
  return [...new Set(out)]
}

function listen(level: Level): Question {
  const base = rand(level === 'easy' ? EASY_BASES : level === 'medium' ? MEDIUM_BASES : HARD_BASES)
  const tone = randomTone()
  const right = mark(base, tone)
  const tones = ([1, 2, 3, 4] as Tone[]).filter((item) => item !== tone).map((item) => mark(base, item))
  const near = confusable(base).map((item) => mark(item, tone))
  const wrong = level === 'easy' ? tones : level === 'medium' ? [...near, ...tones] : [...shuffle(near).slice(0, 2), ...near.map((item) => mark(parse(item)!.base, randomTone())), ...tones]
  return finish(
    {
      mode: 'listen',
      ask: { zh: '听一听，读的是哪个？', en: 'Listen. Which one did you hear?' },
      show: '',
      sound: soundKey(base, tone),
      rule: level === 'easy' ? { zh: '仔细听声调：平、扬、拐弯、降', en: 'Listen for the tone: flat, rising, dip, falling' } : { zh: '注意平舌翘舌、前鼻后鼻，还有声调', en: 'Watch for flat vs curled, front vs back nasal, and the tone' },
      id: `l-${base}${tone}`,
    },
    right,
    wrong,
  )
}

// ---- 标一标 ----

const MARK_EASY = ['ba', 'ma', 'hao', 'mao', 'tai', 'jia', 'gua', 'xian', 'kuai', 'liang', 'bao', 'nan']
const MARK_MEDIUM = ['dou', 'xie', 'lei', 'gou', 'duo', 'tou', 'xue', 'mei', 'huo', 'hou', 'jie', 'zou', 'bei']
const MARK_HARD = ['liu', 'gui', 'jiu', 'dui', 'niu', 'shui', 'qiu', 'hui', 'xiu', 'zui', 'diu', 'tui']

const MARKS: Record<string, string[]> = { a: ['ā', 'á', 'ǎ', 'à'], o: ['ō', 'ó', 'ǒ', 'ò'], e: ['ē', 'é', 'ě', 'è'], i: ['ī', 'í', 'ǐ', 'ì'], u: ['ū', 'ú', 'ǔ', 'ù'], v: ['ǖ', 'ǘ', 'ǚ', 'ǜ'] }

/** 把声调硬标在第 index 个字母上，用来出错误选项 */
export function markAt(base: string, index: number, tone: Tone) {
  if (tone === 5 || !MARKS[base[index]]) return display(base)
  return display(base.slice(0, index)) + MARKS[base[index]][tone - 1] + display(base.slice(index + 1))
}

export function vowelIndexes(base: string) {
  return [...base].map((char, index) => ('aoeiuv'.includes(char) ? index : -1)).filter((index) => index >= 0)
}

export function ruleText(base: string) {
  const { rule } = markPlace(base)
  return MARK_RULES.find((item) => item.rule === rule)?.text ?? MARK_RULES[3].text
}

function markQuestion(level: Level): Question {
  const base = rand(level === 'easy' ? MARK_EASY : level === 'medium' ? MARK_MEDIUM : MARK_HARD)
  const tone = randomTone()
  const right = mark(base, tone)
  const place = markPlace(base).index
  const wrongPlaces = vowelIndexes(base).filter((index) => index !== place).map((index) => markAt(base, index, tone))
  const wrongTones = ([1, 2, 3, 4] as Tone[]).filter((item) => item !== tone).map((item) => mark(base, item))
  return finish(
    {
      mode: 'mark',
      ask: { zh: '声调标对了的是哪个？', en: 'Which one has the mark in the right place?' },
      show: display(base),
      tone,
      sound: soundKey(base, tone),
      rule: ruleText(base),
      id: `m-${base}${tone}`,
    },
    right,
    [...wrongPlaces, ...shuffle(wrongTones)],
  )
}

// ---- 认一认 ----

const NOT_WHOLE = ['zha', 'zhe', 'cha', 'sha', 'za', 'ca', 'sa', 'ji', 'qi', 'xi', 'ya', 'wa', 'yao', 'wo', 'yan', 'wang', 'you', 'li', 'ni', 'lu', 'nü']
const THREE = ['guā', 'huā', 'jiā', 'xiǎo', 'kuài', 'liáng', 'zhuāng', 'duō', 'tiān', 'qióng', 'shuō', 'guāng']
const TWO = ['bā', 'mā', 'dé', 'zhī', 'yún', 'hǎo', 'lǜ', 'gē', 'shū', 'wǒ', 'yǔ', 'tā']

type KindAsk = { ask: Text; right: string[]; wrong: string[]; rule: Text; level: Level[] }

const finalsOf = (id: string) => FINAL_GROUPS.find((group) => group.id === id)!.finals.map(display)
const KIND_ASKS: KindAsk[] = [
  {
    ask: { zh: '哪个是整体认读音节？', en: 'Which is a whole syllable?' },
    right: WHOLE,
    wrong: NOT_WHOLE.map(display),
    rule: { zh: '整体认读音节有 16 个，不用拼，直接读', en: 'There are 16 whole syllables, read without spelling' },
    level: ['easy', 'medium', 'hard'],
  },
  {
    ask: { zh: '哪个是声母？', en: 'Which is an initial?' },
    right: INITIALS.filter((item) => item !== 'y' && item !== 'w'),
    wrong: ['a', 'o', 'e', 'ai', 'ou', 'an', 'ing', 'er', 'ui'],
    rule: { zh: '声母在音节前面，一共 23 个', en: 'Initials start a syllable; there are 23' },
    level: ['easy'],
  },
  {
    ask: { zh: '哪个是单韵母？', en: 'Which is a single final?' },
    right: finalsOf('single'),
    wrong: [...finalsOf('compound'), ...finalsOf('front'), 'b', 'm'],
    rule: { zh: '单韵母只有 6 个：a o e i u ü', en: 'Only 6 single finals: a o e i u ü' },
    level: ['easy'],
  },
  {
    ask: { zh: '哪个是复韵母？', en: 'Which is a compound final?' },
    right: finalsOf('compound'),
    wrong: [...finalsOf('single'), ...finalsOf('front'), ...finalsOf('back')],
    rule: { zh: '复韵母由两个音滑在一起：ai ei ui ao ou iu ie üe er', en: 'Compound finals glide two sounds: ai ei ui ao ou iu ie üe er' },
    level: ['medium'],
  },
  {
    ask: { zh: '哪个是后鼻韵母？', en: 'Which is a back nasal final?' },
    right: finalsOf('back'),
    wrong: finalsOf('front'),
    rule: { zh: '后鼻韵母带 ng：ang eng ing ong', en: 'Back nasals end in ng: ang eng ing ong' },
    level: ['medium', 'hard'],
  },
  {
    ask: { zh: '哪个是前鼻韵母？', en: 'Which is a front nasal final?' },
    right: finalsOf('front'),
    wrong: finalsOf('back'),
    rule: { zh: '前鼻韵母带 n：an en in un ün', en: 'Front nasals end in n: an en in un ün' },
    level: ['medium', 'hard'],
  },
  {
    ask: { zh: '哪个是翘舌音？', en: 'Which has a curled tongue?' },
    right: [...CURLED],
    wrong: ['z', 'c', 's', 'j', 'q', 'x', 'l'],
    rule: { zh: '翘舌音有 zh ch sh r，平舌音是 z c s', en: 'Curled: zh ch sh r. Flat: z c s' },
    level: ['medium', 'hard'],
  },
  {
    ask: { zh: '哪个是送气音？', en: 'Which has a puff of air?' },
    right: [...ASPIRATED],
    wrong: ['b', 'd', 'g', 'j', 'z', 'zh'],
    rule: { zh: '送气音念的时候能吹动纸条：p t k q c ch', en: 'Puff-of-air sounds move a paper strip: p t k q c ch' },
    level: ['hard'],
  },
  {
    ask: { zh: '哪个是三拼音节？', en: 'Which is a three-part syllable?' },
    right: THREE,
    wrong: TWO,
    rule: { zh: '三拼音节是声母 + 介母（i u ü）+ 韵母', en: 'Three-part: initial + glide (i u ü) + final' },
    level: ['hard'],
  },
  {
    ask: { zh: '哪个写法是对的？', en: 'Which spelling is right?' },
    right: ['ju', 'qu', 'xu', 'yu', 'nü', 'lü', 'jue', 'xue', 'yue', 'lüe'],
    wrong: ['jü', 'qü', 'xü', 'yü', 'jüe', 'xüe', 'yüe'],
    rule: { zh: '小 ü 见到 j q x y，去掉两点；和 n l 拼要留着', en: 'ü drops its dots after j q x y, but keeps them after n and l' },
    level: ['hard'],
  },
]

function kindQuestion(level: Level, last?: Question): Question {
  const asks = KIND_ASKS.filter((item) => item.level.includes(level))
  let ask = rand(asks)
  if (last && asks.length > 1) while (ask.ask.zh === last.ask.zh) ask = rand(asks)
  const right = rand(ask.right)
  return finish({ mode: 'kind', ask: ask.ask, show: '', rule: ask.rule, id: `k-${ask.ask.en}-${right}` }, right, ask.wrong)
}

// ---- 读一读 ----

const CHAR_POOLS: Record<Level, string> = {
  easy: GRADE_CHARS['1a'] + GRADE_CHARS['1b'],
  medium: GRADE_CHARS['2a'] + GRADE_CHARS['2b'],
  hard: Object.entries(GRADE_CHARS).filter(([id]) => !id.startsWith('1') && !id.startsWith('2')).map(([, chars]) => chars).join(''),
}

function charQuestion(level: Level): Question {
  const pool = Array.from(CHAR_POOLS[level])
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const char = rand(pool)
    const readings = readingsOf(char)
    // 多音字不出，免得孩子按另一个读音答也算错
    if (readings.length !== 1) continue
    const parsed = parse(readings[0])
    if (!parsed || parsed.tone === 5 || !isSyllable(parsed.base)) continue
    const { base, tone } = parsed
    const right = mark(base, tone)
    const tones = ([1, 2, 3, 4] as Tone[]).filter((item) => item !== tone).map((item) => mark(base, item))
    const near = confusable(base).map((item) => mark(item, tone))
    const wrong = level === 'easy' ? tones : level === 'medium' ? [...near, ...tones] : [...near, ...near.map((item) => mark(parse(item)!.base, randomTone())), ...tones]
    const { initial } = split(base)
    return finish(
      {
        mode: 'char',
        ask: { zh: '这个字怎么读？', en: 'How do you read this character?' },
        show: char,
        sound: soundKey(base, tone),
        rule: CURLED.has(initial) || ['z', 'c', 's'].includes(initial)
          ? { zh: '先分清平舌还是翘舌，再看声调', en: 'First decide flat or curled, then the tone' }
          : /ng$/.test(base) || /n$/.test(base)
            ? { zh: '先分清前鼻音还是后鼻音，再看声调', en: 'First decide front or back nasal, then the tone' }
            : { zh: '先拼声母和韵母，再定声调', en: 'Blend the initial and final, then add the tone' },
        id: `c-${char}`,
      },
      right,
      wrong,
    )
  }
  return listen(level)
}

export function makeQuestion(mode: QuizMode, level: Level, last?: Question): Question {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const question = mode === 'listen' ? listen(level) : mode === 'mark' ? markQuestion(level) : mode === 'kind' ? kindQuestion(level, last) : charQuestion(level)
    if (question.options.length >= 2 && question.id !== last?.id) return question
  }
  return listen(level)
}
