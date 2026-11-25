/**
 * 汉字转拼音：先按词语表找多音字和轻声（最长匹配），找不到就用单字默认读音，再处理「一」「不」的变调。
 * 读音表很大，第一次用到时才拆开。
 */
import { readingOfChar } from './readings'
import { parse } from './pinyin'
import { POLY_RAW, WORD_RAW } from './words'

export type Glyph = { char: string; py: string }

let words: Map<string, string[]> | undefined
let longest = 1
let poly: Map<string, string[]> | undefined

function wordTable() {
  if (!words) {
    words = new Map()
    for (const line of WORD_RAW.split('\n')) {
      const at = line.search(/[a-zāáǎàēéěèīíǐìōóǒòūúǔùüǖǘǚǜ]/)
      if (at < 2) continue
      words.set(line.slice(0, at), line.slice(at).split(' '))
      longest = Math.max(longest, at)
    }
  }
  return words
}

/** 这个字所有的读音，第一项是默认读音 */
export function readingsOf(char: string) {
  if (!poly) {
    poly = new Map()
    for (const line of POLY_RAW.split('\n')) poly.set(line[0], line.slice(1).split(','))
  }
  const own = readingOfChar(char)
  const list = poly.get(char) ?? []
  return [...new Set([own, ...list].filter(Boolean))]
}

export function isHan(char: string) {
  return /[\u3400-\u9fff]/.test(char)
}

const toneOf = (py: string) => parse(py)?.tone ?? 5
const NUMBER = new Set([...'零一二三四五六七八九十百千万第'])

/** 「一」「不」按后一个字变调；词语表里已经写好的不再改。 */
function sandhi(glyphs: Glyph[], fixed: boolean[]) {
  glyphs.forEach((glyph, index) => {
    if (fixed[index] || (glyph.char !== '一' && glyph.char !== '不')) return
    const next = glyphs[index + 1]
    if (!next || !isHan(next.char)) return
    const tone = toneOf(next.py)
    if (glyph.char === '不') {
      glyph.py = tone === 4 ? 'bú' : 'bù'
      return
    }
    const prev = glyphs[index - 1]
    // 数数、序数里的「一」读原调：十一、第一、一一
    if ((prev && NUMBER.has(prev.char)) || NUMBER.has(next.char)) return
    glyph.py = tone === 4 || tone === 5 ? 'yí' : 'yì'
  })
}

/** 一段文字转成「字 + 拼音」。不是汉字的字符原样保留，拼音为空。 */
export function toPinyin(text: string): Glyph[] {
  const table = wordTable()
  const chars = Array.from(text)
  const glyphs: Glyph[] = []
  const fixed: boolean[] = []
  let index = 0
  while (index < chars.length) {
    let matched = false
    for (let size = Math.min(longest, chars.length - index); size >= 2; size -= 1) {
      const hit = table.get(chars.slice(index, index + size).join(''))
      if (!hit) continue
      hit.forEach((py, at) => {
        glyphs.push({ char: chars[index + at], py })
        fixed.push(true)
      })
      index += size
      matched = true
      break
    }
    if (matched) continue
    const char = chars[index]
    glyphs.push({ char, py: isHan(char) ? readingOfChar(char) : '' })
    fixed.push(false)
    index += 1
  }
  sandhi(glyphs, fixed)
  return glyphs
}

/** 把一段题目拆成一个个听写条目：换行、空格和常见标点都算分隔。 */
export function splitItems(text: string) {
  return text
    .split(/[\s,，、;；。.!！?？/|]+/)
    .map((item) => item.trim())
    .filter((item) => Array.from(item).some(isHan))
}
