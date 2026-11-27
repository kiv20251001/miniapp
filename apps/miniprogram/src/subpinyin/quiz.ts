/**
 * 小测验出题：听一听（听音选拼音）、标一标（声调标在哪）、认一认（分清声母韵母和音节类别）、读一读（看字选拼音）。
 */
import { GRADE_CHARS } from './grades'
import { GRADE_WORDS } from './grade-words'
import { readingsOf, toPinyin } from './convert'
import {
  CURLED,
  INITIALS,
  WHOLE_SET,
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
  /** 这道题对应的年级词语里的字 */
  from?: string
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
export type QuizScope = Level | 'all'

type BankItem = { char: string; base: string; tone: Tone; grade: string; initial: string; final: string }
let bank: BankItem[] | null = null

function gradeBank() {
  if (bank) return bank
  const seen = new Set<string>()
  const out: BankItem[] = []
  for (const [grade, words] of Object.entries(GRADE_WORDS)) {
    for (const glyph of toPinyin(words)) {
      const parsed = parse(glyph.py)
      if (!parsed || parsed.tone === 5 || !isSyllable(parsed.base)) continue
      const key = `${glyph.char}${parsed.base}${parsed.tone}`
      if (seen.has(key)) continue
      seen.add(key)
      const parts = split(parsed.base)
      out.push({ char: glyph.char, base: parsed.base, tone: parsed.tone, grade, initial: parts.initial, final: parts.final })
    }
  }
  bank = out
  return out
}

function pool(scope: QuizScope) {
  const all = gradeBank()
  if (scope === 'all') return all
  const filtered = all.filter((item) => {
    const year = Number(item.grade[0])
    if (scope === 'easy') return year === 1
    if (scope === 'medium') return year === 2 || year === 3
    return year >= 4
  })
  return filtered.length > 12 ? filtered : all
}

function finish(question: Omit<Question, 'options' | 'answer'>, right: string, wrong: string[]): Question {
  const others = shuffle([...new Set(wrong.filter((item) => item && item !== right))]).slice(0, 3)
  const options = shuffle([right, ...others])
  return { ...question, options, answer: options.indexOf(right) }
}

// ---- 听一听 ----

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

function listen(scope: QuizScope): Question {
  const item = rand(pool(scope))
  const { base, tone } = item
  const right = mark(base, tone)
  const tones = ([1, 2, 3, 4] as Tone[]).filter((value) => value !== tone).map((value) => mark(base, value))
  const near = confusable(base).map((value) => mark(value, tone))
  const wrong = scope === 'easy' ? tones : scope === 'medium' ? [...near, ...tones] : [...shuffle(near).slice(0, 2), ...near.map((value) => mark(parse(value)!.base, randomTone())), ...tones]
  return finish(
    {
      mode: 'listen',
      ask: { zh: '听一听，读的是哪个？', en: 'Listen. Which one did you hear?' },
      show: '',
      sound: soundKey(base, tone),
      rule: scope === 'easy' ? { zh: '仔细听声调：平、扬、拐弯、降', en: 'Listen for the tone: flat, rising, dip, falling' } : { zh: '注意平舌翘舌、前鼻后鼻，还有声调', en: 'Watch for flat vs curled, front vs back nasal, and the tone' },
      id: `l-${item.char}${base}${tone}`,
    },
    right,
    wrong,
  )
}

// ---- 标一标 ----

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

function markQuestion(scope: QuizScope): Question {
  const candidates = pool(scope).filter((item) => vowelIndexes(item.base).length >= 2)
  const source = candidates.length ? candidates : gradeBank().filter((entry) => vowelIndexes(entry.base).length >= 2)
  if (!source.length) return listen(scope)
  const item = rand(source)
  const { base, tone } = item
  const right = mark(base, tone)
  const place = markPlace(base).index
  const wrongPlaces = vowelIndexes(base).filter((index) => index !== place).map((index) => markAt(base, index, tone))
  const wrongTones = ([1, 2, 3, 4] as Tone[]).filter((value) => value !== tone).map((value) => mark(base, value))
  return finish(
    {
      mode: 'mark',
      ask: { zh: '声调标对了的是哪个？', en: 'Which one has the mark in the right place?' },
      show: display(base),
      from: item.char,
      tone,
      sound: soundKey(base, tone),
      rule: ruleText(base),
      id: `m-${item.char}${base}${tone}`,
    },
    right,
    [...wrongPlaces, ...shuffle(wrongTones)],
  )
}

// ---- 认一认 ----

function kindFromBank(scope: QuizScope): Question {
  const list = pool(scope)
  const item = rand(list)
  if (WHOLE_SET.has(item.base)) {
    const right = mark(item.base, item.tone)
    const wrong = shuffle(list.filter((entry) => !WHOLE_SET.has(entry.base))).slice(0, 8).map((entry) => mark(entry.base, entry.tone))
    return finish(
      {
        mode: 'kind',
        ask: { zh: '这个字要整体认读，读的是哪个？', en: 'This character is read as a whole. Which one?' },
        show: item.char,
        sound: soundKey(item.base, item.tone),
        rule: { zh: '整体认读音节不用拼，直接读', en: 'Whole syllables are read without spelling' },
        id: `k-w-${item.char}${item.base}${item.tone}`,
      },
      right,
      wrong,
    )
  }
  if (item.initial && Math.random() < 0.5) {
    const right = item.initial
    const wrong = shuffle(INITIALS.filter((value) => value !== right && value !== 'y' && value !== 'w'))
    return finish(
      {
        mode: 'kind',
        ask: { zh: '这个字的声母是哪个？', en: 'Which initial does this character use?' },
        show: item.char,
        sound: soundKey(item.base, item.tone),
        rule: { zh: '声母在音节前面，一共 23 个', en: 'Initials start a syllable; there are 23' },
        id: `k-i-${item.char}${right}`,
      },
      right,
      wrong,
    )
  }
  const right = display(item.final)
  const wrong = shuffle(list.map((entry) => display(entry.final)).filter((value) => value && value !== right))
  return finish(
    {
      mode: 'kind',
      ask: { zh: '这个字的韵母是哪个？', en: 'Which final does this character use?' },
      show: item.char,
      sound: soundKey(item.base, item.tone),
      rule: /ng$/.test(item.final) || /n$/.test(item.final)
        ? { zh: '先分清前鼻音还是后鼻音', en: 'First decide front or back nasal' }
        : { zh: '韵母是声母后面的部分', en: 'The final is the part after the initial' },
      id: `k-f-${item.char}${item.final}`,
    },
    right,
    wrong,
  )
}

function kindQuestion(scope: QuizScope, last?: Question): Question {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const question = kindFromBank(scope)
    if (question.id !== last?.id && question.options.length >= 2) return question
  }
  return kindFromBank(scope)
}

// ---- 读一读 ----

const CHAR_POOLS: Record<Level, string> = {
  easy: GRADE_CHARS['1a'] + GRADE_CHARS['1b'],
  medium: GRADE_CHARS['2a'] + GRADE_CHARS['2b'],
  hard: Object.entries(GRADE_CHARS).filter(([id]) => !id.startsWith('1') && !id.startsWith('2')).map(([, chars]) => chars).join(''),
}

function charsOf(scope: QuizScope) {
  if (scope === 'all') return Object.values(GRADE_CHARS).join('')
  return CHAR_POOLS[scope]
}

function charQuestion(scope: QuizScope): Question {
  const poolChars = Array.from(charsOf(scope))
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const char = rand(poolChars)
    const readings = readingsOf(char)
    if (readings.length !== 1) continue
    const parsed = parse(readings[0])
    if (!parsed || parsed.tone === 5 || !isSyllable(parsed.base)) continue
    const { base, tone } = parsed
    const right = mark(base, tone)
    const tones = ([1, 2, 3, 4] as Tone[]).filter((item) => item !== tone).map((item) => mark(base, item))
    const near = confusable(base).map((item) => mark(item, tone))
    const wrong = scope === 'easy' ? tones : scope === 'medium' ? [...near, ...tones] : [...near, ...near.map((item) => mark(parse(item)!.base, randomTone())), ...tones]
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
        id: `c-${char}${base}${tone}`,
      },
      right,
      wrong,
    )
  }
  return listen(scope)
}

export function makeQuestion(mode: QuizMode, scope: QuizScope, last?: Question): Question {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const question = mode === 'listen' ? listen(scope) : mode === 'mark' ? markQuestion(scope) : mode === 'kind' ? kindQuestion(scope, last) : charQuestion(scope)
    if (question.options.length >= 2 && question.id !== last?.id) return question
  }
  return listen(scope)
}
