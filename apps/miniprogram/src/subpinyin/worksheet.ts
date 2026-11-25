import { isHan, splitItems, toPinyin } from './convert'
import { isSyllable, mark, parse } from './pinyin'

/** mixed：随机，把看拼音写词语、给汉字注音、标声调混在一张卷子里。 */
export type PinyinSheetKind = 'mixed' | 'write' | 'note' | 'tone' | 'nasal'
export type PieceKind = Exclude<PinyinSheetKind, 'mixed'>

export const SHEET_KINDS: Array<{ value: PinyinSheetKind; label: string }> = [
  { value: 'mixed', label: '随机' },
  { value: 'write', label: '看拼音写词语' },
  { value: 'note', label: '给汉字注音' },
  { value: 'tone', label: '标声调' },
  { value: 'nasal', label: '前后鼻音' },
]

export const MAX_WORD_CHARS = 8

/** 一个词：每个字和它带调的拼音，以及不带调的写法。 */
export type SheetWord = { chars: string[]; marked: string[]; bare: string[] }
/** 前后鼻音题：一个字，两个读音选一个。 */
export type NasalItem = { char: string; options: [string, string]; answer: number }

export function parseWords(text: string): SheetWord[] {
  return splitItems(text)
    .map((word) => toPinyin(word).filter((glyph) => isHan(glyph.char)).slice(0, MAX_WORD_CHARS))
    .filter((glyphs) => glyphs.length)
    .map((glyphs) => ({
      chars: glyphs.map((glyph) => glyph.char),
      marked: glyphs.map((glyph) => glyph.py),
      bare: glyphs.map((glyph) => {
        const parsed = parse(glyph.py)
        return parsed ? mark(parsed.base, 5) : glyph.py
      }),
    }))
}

function nasalTwin(base: string) {
  if (base.endsWith('ng')) return base.slice(0, -1)
  if (base.endsWith('n')) return `${base}g`
  return ''
}

/** 从词语里挑出带 n / ng 的字，配上另一个鼻音做干扰项。 */
export function nasalItems(words: SheetWord[]): NasalItem[] {
  const seen = new Set<string>()
  const out: NasalItem[] = []
  for (const word of words) {
    word.chars.forEach((char, index) => {
      const parsed = parse(word.marked[index])
      if (!parsed || seen.has(char)) return
      const twin = nasalTwin(parsed.base)
      if (!twin || !isSyllable(twin)) return
      seen.add(char)
      const right = mark(parsed.base, parsed.tone)
      const wrong = mark(twin, parsed.tone)
      const front = !parsed.base.endsWith('ng')
      out.push(front ? { char, options: [right, wrong], answer: 0 } : { char, options: [wrong, right], answer: 1 })
    })
  }
  return out
}
