/**
 * 拼音的规则：声母、韵母、整体认读音节、标调、拼写。
 * 程序里 ü 一律写成 v（和输入法一样），显示时再换回 ü。声调 5 表示轻声。
 */
import { SYLLABLES } from './syllables'

export type Tone = 1 | 2 | 3 | 4 | 5

export const INITIAL_ROWS = [
  ['b', 'p', 'm', 'f'],
  ['d', 't', 'n', 'l'],
  ['g', 'k', 'h'],
  ['j', 'q', 'x'],
  ['zh', 'ch', 'sh', 'r'],
  ['z', 'c', 's'],
  ['y', 'w'],
] as const
export const INITIALS: string[] = INITIAL_ROWS.flat()

/** 声母单独念时的呼读音 */
export const INITIAL_SOUND: Record<string, string> = {
  b: 'bo1', p: 'po1', m: 'mo1', f: 'fo1', d: 'de1', t: 'te1', n: 'ne1', l: 'le1', g: 'ge1', k: 'ke1', h: 'he1',
  j: 'ji1', q: 'qi1', x: 'xi1', zh: 'zhi1', ch: 'chi1', sh: 'shi1', r: 'ri4', z: 'zi1', c: 'ci1', s: 'si1', y: 'yi1', w: 'wu1',
}

/** 送气音：念的时候嘴前有一股气，能把纸条吹起来 */
export const ASPIRATED = new Set(['p', 't', 'k', 'q', 'c', 'ch'])
/** 翘舌音和平舌音 */
export const CURLED = new Set(['zh', 'ch', 'sh', 'r'])
export const FLAT = new Set(['z', 'c', 's'])
/** b d p q 都是「一个半圆加一根竖」，只是方向不同 */
export const MIRROR_LETTERS = ['b', 'd', 'p', 'q'] as const

export type FinalGroup = 'single' | 'compound' | 'front' | 'back'
export const FINAL_GROUPS: Array<{ id: FinalGroup; finals: string[] }> = [
  { id: 'single', finals: ['a', 'o', 'e', 'i', 'u', 'v'] },
  { id: 'compound', finals: ['ai', 'ei', 'ui', 'ao', 'ou', 'iu', 'ie', 've', 'er'] },
  { id: 'front', finals: ['an', 'en', 'in', 'un', 'vn'] },
  { id: 'back', finals: ['ang', 'eng', 'ing', 'ong'] },
]
export const FINALS: string[] = FINAL_GROUPS.flatMap((group) => group.finals)

/** 韵母单独念时用的音节 */
export const FINAL_SOUND: Record<string, string> = {
  a: 'a1', o: 'o1', e: 'e1', i: 'yi1', u: 'wu1', v: 'yu1',
  ai: 'ai1', ei: 'ei1', ui: 'wei1', ao: 'ao1', ou: 'ou1', iu: 'you1', ie: 'ye1', ve: 'yue1', er: 'er2',
  an: 'an1', en: 'en1', in: 'yin1', un: 'wen1', vn: 'yun1', ang: 'ang1', eng: 'eng1', ing: 'ying1', ong: 'ong1',
}

/** 前鼻音和后鼻音一一对应的几对 */
export const NASAL_PAIRS: Array<[string, string]> = [['an', 'ang'], ['en', 'eng'], ['in', 'ing'], ['un', 'ong']]

/** 复韵母从第一个音滑到第二个音 */
export function glide(final: string) {
  if (final === 'er' || final.length < 2) return null
  return [display(final[0]), display(final.slice(1))]
}

export const WHOLE = ['zhi', 'chi', 'shi', 'ri', 'zi', 'ci', 'si', 'yi', 'wu', 'yu', 'ye', 'yue', 'yuan', 'yin', 'yun', 'ying']
export const WHOLE_SET = new Set(WHOLE)

/** 拼一拼里可以选的韵母：24 个基本韵母，加上三拼音节里用到的 */
export const LAB_FINALS = [
  'a', 'o', 'e', 'i', 'u', 'v', 'ai', 'ei', 'ui', 'ao', 'ou', 'iu', 'ie', 've', 'er',
  'an', 'en', 'in', 'un', 'vn', 'ang', 'eng', 'ing', 'ong',
  'ia', 'ua', 'uo', 'uai', 'iao', 'ian', 'uan', 'van', 'iang', 'uang', 'iong',
]
/** 三拼音节：声母 + 介母（i u ü）+ 韵母 */
/** 三拼音节拆成介母 + 韵母。iu、ui、un 是省写，拆开是 ou、ei、en。 */
export const THREE_PART: Record<string, [string, string]> = {
  ia: ['i', 'a'], iao: ['i', 'ao'], iu: ['i', 'ou'], ian: ['i', 'an'], iang: ['i', 'ang'], iong: ['i', 'ong'],
  ua: ['u', 'a'], uo: ['u', 'o'], uai: ['u', 'ai'], ui: ['u', 'ei'], uan: ['u', 'an'], un: ['u', 'en'], uang: ['u', 'ang'],
  van: ['v', 'an'],
}

export function display(text: string) {
  return text.replace(/v/g, 'ü')
}

const MARKS: Record<string, string[]> = {
  a: ['ā', 'á', 'ǎ', 'à'],
  o: ['ō', 'ó', 'ǒ', 'ò'],
  e: ['ē', 'é', 'ě', 'è'],
  i: ['ī', 'í', 'ǐ', 'ì'],
  u: ['ū', 'ú', 'ǔ', 'ù'],
  v: ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
}
const UNMARK = new Map<string, [string, Tone]>()
for (const [vowel, list] of Object.entries(MARKS)) list.forEach((mark, index) => UNMARK.set(mark, [vowel, (index + 1) as Tone]))
UNMARK.set('ü', ['v', 5])

export type MarkRule = 'a' | 'oe' | 'iu' | 'single' | 'none'

/**
 * 声调标在哪个字母上：有 a 标 a；没有 a 找 o、e；i、u 并列标在后；只有一个元音就标它。
 * 返回字母下标和用的是哪一句口诀。
 */
export function markPlace(base: string): { index: number; rule: MarkRule } {
  const a = base.indexOf('a')
  if (a >= 0) return { index: a, rule: 'a' }
  const o = base.indexOf('o')
  if (o >= 0) return { index: o, rule: 'oe' }
  const e = base.indexOf('e')
  if (e >= 0) return { index: e, rule: 'oe' }
  if (base.includes('iu')) return { index: base.indexOf('iu') + 1, rule: 'iu' }
  if (base.includes('ui')) return { index: base.indexOf('ui') + 1, rule: 'iu' }
  const index = base.search(/[iuv]/)
  return index >= 0 ? { index, rule: 'single' } : { index: -1, rule: 'none' }
}

/** 'nv' + 3 → 'nǚ'。轻声不标调。 */
export function mark(base: string, tone: Tone) {
  if (tone === 5) return display(base)
  const { index } = markPlace(base)
  if (index < 0) return display(base)
  return display(base.slice(0, index)) + MARKS[base[index]][tone - 1] + display(base.slice(index + 1))
}

/** 'nǚ' → { base: 'nv', tone: 3 }。没有调号的算轻声。 */
export function parse(text: string): { base: string; tone: Tone } | null {
  let base = ''
  let tone: Tone = 5
  for (const char of text.trim().toLowerCase()) {
    const hit = UNMARK.get(char)
    if (hit) {
      base += hit[0]
      if (hit[1] !== 5) tone = hit[1]
    } else if (/[a-z]/.test(char)) base += char
    else return null
  }
  return base ? { base, tone } : null
}

/** 读音文件里的名字，例如 'ma3' */
export function soundKey(base: string, tone: Tone) {
  return `${base}${tone}`
}

export function isSyllable(base: string) {
  return SYLLABLES.has(base)
}

/** 拆成声母和韵母（韵母写法还原：ju 里的 u 其实是 ü，yi 的韵母是 i） */
export function split(base: string): { initial: string; final: string } {
  const initial = INITIALS.find((item) => item.length === 2 && base.startsWith(item)) ?? INITIALS.find((item) => item.length === 1 && base.startsWith(item)) ?? ''
  let final = base.slice(initial.length)
  if ('jqxy'.includes(initial) && initial && final.startsWith('u')) final = `v${final.slice(1)}`
  return { initial, final }
}

const ALONE: Record<string, string> = {
  i: 'yi', u: 'wu', v: 'yu', ia: 'ya', ie: 'ye', iao: 'yao', iu: 'you', ian: 'yan', in: 'yin', iang: 'yang', ing: 'ying', iong: 'yong',
  ua: 'wa', uo: 'wo', uai: 'wai', ui: 'wei', uan: 'wan', un: 'wen', uang: 'wang', ve: 'yue', van: 'yuan', vn: 'yun',
}

export type Spell = {
  /** 拼好的音节（不带调） */
  base: string
  /** ü 碰到 j q x 去掉了两点 */
  dropDots: boolean
  /** 没有声母，按规则加了 y 或 w */
  yw: boolean
}

/** 声母加韵母拼成音节；普通话里没有这个音就返回 null。initial 为空表示零声母。 */
export function spell(initial: string, final: string): Spell | null {
  if (!initial) {
    const alone = ALONE[final] ?? final
    return isSyllable(alone) ? { base: alone, dropDots: false, yw: alone !== final } : null
  }
  if (final === 'er') return null
  if (initial === 'y' || initial === 'w') return null
  let tail = final
  let dropDots = false
  if ('jqx'.includes(initial) && final.startsWith('v')) {
    tail = `u${final.slice(1)}`
    dropDots = true
  }
  const base = initial + tail
  return isSyllable(base) ? { base, dropDots, yw: false } : null
}

export type Kind = 'initial' | 'final' | 'whole'
export function kindOf(text: string): Kind | null {
  if (WHOLE_SET.has(text)) return 'whole'
  if (INITIALS.includes(text)) return 'initial'
  if (FINALS.includes(text)) return 'final'
  return null
}

export function groupOf(final: string): FinalGroup | null {
  return FINAL_GROUPS.find((group) => group.finals.includes(final))?.id ?? null
}
