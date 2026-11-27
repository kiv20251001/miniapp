/**
 * 「拼音听写」的讲解：声母口诀、韵母口型、标调口诀、听写示例词语和引导。讲解文字原创编写。
 * 中英文写在一起，页面按语言取，不走 i18n 词表。
 */
import type { FinalGroup, MarkRule } from './pinyin'

export type Text = { zh: string; en: string }
export const pick = (text: Text, en: boolean) => (en ? text.en : text.zh)

export type Mode = 'initial' | 'final' | 'whole' | 'spell' | 'tone'
export const MODES: Array<{ value: Mode; label: Text }> = [
  { value: 'initial', label: { zh: '声母', en: 'Initials' } },
  { value: 'final', label: { zh: '韵母', en: 'Finals' } },
  { value: 'whole', label: { zh: '整体认读', en: 'Whole' } },
  { value: 'spell', label: { zh: '拼一拼', en: 'Spell' } },
  { value: 'tone', label: { zh: '声调', en: 'Tones' } },
]

export const HINTS: Record<Mode, Text> = {
  initial: { zh: '点一个声母，听它怎么念', en: 'Tap an initial to hear it' },
  final: { zh: '点一个韵母，看嘴巴怎么动', en: 'Tap a final and watch the mouth' },
  whole: { zh: '这 16 个音节不用拼，直接读', en: 'Read these 16 as a whole' },
  spell: { zh: '选声母、韵母和声调，拼出音节', en: 'Pick parts to build a syllable' },
  tone: { zh: '点声调，小球沿着音高走', en: 'Tap a tone and follow the ball' },
}

/** 声母的样子，念的时候配着记 */
export const INITIAL_RHYME: Record<string, Text> = {
  b: { zh: '右下半圆 b b b', en: 'Bump at the bottom right' },
  p: { zh: '右上半圆 p p p', en: 'Bump at the top right' },
  m: { zh: '两个门洞 m m m', en: 'Two arches' },
  f: { zh: '一根拐杖 f f f', en: 'A walking stick' },
  d: { zh: '左下半圆 d d d', en: 'Bump at the bottom left' },
  t: { zh: '像把雨伞 t t t', en: 'An umbrella handle' },
  n: { zh: '一个门洞 n n n', en: 'One arch' },
  l: { zh: '一根小棍 l l l', en: 'A straight stick' },
  g: { zh: '像个 9 字 g g g', en: 'Looks like a 9' },
  k: { zh: '树枝分叉 k k k', en: 'A forked branch' },
  h: { zh: '一把椅子 h h h', en: 'A chair' },
  j: { zh: '竖弯加点 j j j', en: 'A hook with a dot' },
  q: { zh: '左上半圆 q q q', en: 'Bump at the top left' },
  x: { zh: '打个叉叉 x x x', en: 'A cross' },
  zh: { zh: 'z 加 h，舌尖翘起来', en: 'z + h, curl your tongue' },
  ch: { zh: 'c 加 h，舌尖翘起来', en: 'c + h, curl your tongue' },
  sh: { zh: 's 加 h，舌尖翘起来', en: 's + h, curl your tongue' },
  r: { zh: '小苗发芽 r r r', en: 'A little sprout' },
  z: { zh: '像个 2 字 z z z', en: 'Looks like a 2' },
  c: { zh: '半个圆圈 c c c', en: 'Half a circle' },
  s: { zh: '像条小蛇 s s s', en: 'A little snake' },
  y: { zh: '像个树杈 y y y', en: 'A tree fork' },
  w: { zh: '两座尖顶 w w w', en: 'Two pointy roofs' },
}

export const INITIAL_TAGS = {
  aspirated: { zh: '送气音', en: 'Puff of air' },
  plain: { zh: '不送气', en: 'No puff' },
  curled: { zh: '翘舌音', en: 'Curled tongue' },
  flat: { zh: '平舌音', en: 'Flat tongue' },
  yw: { zh: '不是真正的声母，帮 i u ü 开头的音节', en: 'Helper letters for syllables starting with i, u, ü' },
}

/** 单韵母的口型 */
export const MOUTH_TIP: Record<string, Text> = {
  a: { zh: '嘴巴张大 a a a', en: 'Open wide' },
  o: { zh: '嘴巴圆圆 o o o', en: 'Round lips' },
  e: { zh: '嘴巴扁扁 e e e', en: 'Flat lips' },
  i: { zh: '牙齿对齐 i i i', en: 'Teeth together, smile' },
  u: { zh: '嘴巴突出 u u u', en: 'Push lips forward' },
  v: { zh: '嘴吹口哨 ü ü ü', en: 'Lips like a whistle' },
}

export const GROUP_NAMES: Record<FinalGroup, Text> = {
  single: { zh: '单韵母', en: 'Single' },
  compound: { zh: '复韵母', en: 'Compound' },
  front: { zh: '前鼻韵母', en: 'Front nasal' },
  back: { zh: '后鼻韵母', en: 'Back nasal' },
}

export const FINAL_NOTES = {
  glide: { zh: '从前一个音滑到后一个音', en: 'Slide from the first sound to the second' },
  er: { zh: '特殊韵母：卷起舌头，不和声母拼', en: 'Special: curl the tongue, never joins an initial' },
  ehat: { zh: 'ie、üe 里的 e 念「ê」', en: 'The e in ie and üe sounds like “eh”' },
  front: { zh: '舌尖顶住上牙床', en: 'Tongue tip touches behind the top teeth' },
  back: { zh: '舌根往后缩，声音从鼻子出来', en: 'Back of the tongue rises, sound goes through the nose' },
}

export const DOT_RULE: Text = { zh: '小 ü 见到 j q x y，去掉两点还念 ü', en: 'After j, q, x, y, ü drops its dots but still sounds like ü' }
export const DOT_KEEP: Text = { zh: '和 n、l 拼时两点要留着', en: 'With n and l the dots stay' }

export const WHOLE_NOTE: Text = { zh: '整体认读，不用拼', en: 'Read it whole, no spelling' }
export const FIND_WHOLE: Text = { zh: '把整体认读音节都找出来', en: 'Find all the whole syllables' }
export const FIND_DONE: Text = { zh: '全找到啦！', en: 'Found them all!' }

export const SPELL_RHYME: Text = { zh: '前音轻短后音重，两音相连猛一碰', en: 'First sound short and light, then bump into the next' }
export const THREE_RHYME: Text = { zh: '声短介快韵母响，三音连读很顺当', en: 'Short initial, quick glide, loud final, then say them together' }
export const SPELL_NOTES = {
  none: { zh: '普通话里没有这个音，换一个试试', en: 'No such syllable in Mandarin. Try another.' },
  dots: DOT_RULE,
  yw: { zh: '没有声母时，i 开头写 y，u 开头写 w，ü 开头写 yu', en: 'With no initial, i becomes y, u becomes w, ü becomes yu' },
  short: { zh: 'iou、uei、uen 和声母拼时写成 iu、ui、un', en: 'iou, uei and uen shorten to iu, ui and un after an initial' },
  er: { zh: 'er 不和声母拼', en: 'er never joins an initial' },
}

export const TONE_NAMES: Text[] = [
  { zh: '一声平', en: '1st: flat' },
  { zh: '二声扬', en: '2nd: rising' },
  { zh: '三声拐弯', en: '3rd: dip' },
  { zh: '四声降', en: '4th: falling' },
]
export const TONE_STORY: Text[] = [
  { zh: '小汽车开在平路上', en: 'A car on a flat road' },
  { zh: '小汽车爬上坡', en: 'Driving up a hill' },
  { zh: '先下坡再上坡', en: 'Down a dip, then up' },
  { zh: '从坡顶冲下来', en: 'Racing down the hill' },
]

export const MARK_RULES: Array<{ rule: MarkRule; text: Text }> = [
  { rule: 'a', text: { zh: '有 a 不放过', en: 'If there is an a, mark the a' } },
  { rule: 'oe', text: { zh: '没 a 找 o、e', en: 'No a? Look for o or e' } },
  { rule: 'iu', text: { zh: 'i、u 并列标在后', en: 'i and u together: mark the second' } },
  { rule: 'single', text: { zh: '只有一个就标它', en: 'Only one vowel: mark it' } },
]
export const MARK_ASK: Text = { zh: '声调该标在哪个字母上？点一点', en: 'Which letter gets the tone mark? Tap it' }
export const DOT_OFF: Text = { zh: 'i 上标调，点要去掉', en: 'Mark on i? Drop its dot' }
/** 标调练习用的音节，覆盖每一句口诀 */
export const MARK_SAMPLES: Array<[string, 1 | 2 | 3 | 4]> = [
  ['hao', 3], ['mao', 1], ['jia', 1], ['guai', 1], ['xian', 1], ['huang', 2], ['tou', 2], ['duo', 1], ['xie', 4], ['xue', 2],
  ['lei', 4], ['gou', 3], ['liu', 2], ['gui', 4], ['jiu', 3], ['dui', 4], ['niu', 2], ['shui', 3], ['mi', 3], ['lv', 4],
  ['hu', 2], ['ju', 2], ['xin', 1], ['ting', 1], ['yun', 2], ['qiong', 2],
]

// ---- 听写 ----


// ---- 引导 ----

export type GuideAction = 'tap' | 'mirror' | 'pair' | 'dots' | 'find' | 'pickFinal' | 'tone' | 'mark'
export type GuideStep = { target: string; title: Text; text: Text; action?: GuideAction; done?: Text }

const QUIZ_STEP: GuideStep = {
  target: 'guide-quiz',
  title: { zh: '学会了就去测一测', en: 'Ready for a quiz?' },
  text: { zh: '右上角的「?」可以再看引导。还能去「听写」自己报词，或者打印练习。', en: 'Tap “?” to replay this guide. Try Dictation or print a worksheet too.' },
}

export const GUIDES: Record<Mode, GuideStep[]> = {
  initial: [
    {
      target: 'guide-grid',
      title: { zh: '点一点，听一听', en: 'Tap and listen' },
      text: { zh: '点任意一个声母，它会念出来，上面还有记字形的口诀。', en: 'Tap any initial to hear it. A little rhyme helps you remember its shape.' },
      action: 'tap',
      done: { zh: '纸条飘起来的是送气音，念的时候嘴里有股气。', en: 'If the paper strip flies, it is a puff-of-air sound.' },
    },
    {
      target: 'guide-mirror',
      title: { zh: 'b d p q 分清楚', en: 'Tell b, d, p, q apart' },
      text: { zh: '换竖线的位置和方向，看看半圆和竖线拼出哪个字母。', en: 'Move the stick left or right, up or down, and see which letter you make.' },
      action: 'mirror',
    },
    QUIZ_STEP,
  ],
  final: [
    {
      target: 'guide-grid',
      title: { zh: '看嘴巴怎么动', en: 'Watch the mouth' },
      text: { zh: '点一个韵母。单韵母看口型，复韵母看从哪个音滑到哪个音。', en: 'Tap a final. Single finals show the mouth shape; compound ones show the slide.' },
      action: 'tap',
    },
    {
      target: 'guide-nasal',
      title: { zh: '前鼻音和后鼻音', en: 'Front and back nasals' },
      text: { zh: '点一对，先听前鼻音再听后鼻音，看舌头放在哪。', en: 'Tap a pair to hear front then back nasal, and see where the tongue goes.' },
      action: 'pair',
    },
    {
      target: 'guide-dots',
      title: { zh: 'ü 的两点去哪了', en: 'Where do ü’s dots go?' },
      text: { zh: '点一个声母和 ü 拼，看两点是留着还是去掉。', en: 'Tap an initial to join it with ü and watch the dots.' },
      action: 'dots',
    },
    QUIZ_STEP,
  ],
  whole: [
    {
      target: 'guide-grid',
      title: { zh: '直接读出来', en: 'Read it whole' },
      text: { zh: '点一个音节，它会整个念出来，不用拆开拼。', en: 'Tap a syllable to hear it read as a whole.' },
      action: 'tap',
    },
    {
      target: 'guide-find',
      title: { zh: '找一找', en: 'Find them' },
      text: { zh: '下面混着别的音节，把整体认读音节都点出来。', en: 'Other syllables are mixed in. Tap all the whole syllables.' },
      action: 'find',
    },
    QUIZ_STEP,
  ],
  spell: [
    {
      target: 'guide-finals',
      title: { zh: '换个韵母', en: 'Pick a final' },
      text: { zh: '点一个韵母，上面会拼出新的音节并读出来。', en: 'Tap a final. A new syllable is built and read aloud.' },
      action: 'pickFinal',
    },
    {
      target: 'guide-formula',
      title: { zh: '听拼读过程', en: 'Hear the blend' },
      text: { zh: '点算式。两拼先念声母再念韵母；三拼按声母、介母、韵母分开念，最后连起来。', en: 'Tap the formula. Two parts: initial then final. Three parts: initial, glide, then final, and then the whole syllable.' },
    },
    QUIZ_STEP,
  ],
  tone: [
    {
      target: 'guide-tones',
      title: { zh: '四个声调', en: 'Four tones' },
      text: { zh: '点一个声调，小球沿着音高走一遍，同时读出来。', en: 'Tap a tone. The ball follows the pitch while it is read.' },
      action: 'tone',
    },
    {
      target: 'guide-mark',
      title: { zh: '声调标在哪', en: 'Where does the mark go?' },
      text: { zh: '点你觉得该标调的字母。标对了，下面会亮出用的是哪句口诀。', en: 'Tap the letter you think gets the mark. The matching rule lights up.' },
      action: 'mark',
    },
    QUIZ_STEP,
  ],
}
