/** 分数小工具的计算：份数、化简、出题和干扰项。 */
export type Fraction = { num: number; den: number }
export type Level = 'easy' | 'medium' | 'hard'

/** 探索里可以选的份数。 */
export const PARTS = [2, 3, 4, 5, 6, 8, 10, 12]

const LEVEL_PARTS: Record<Level, number[]> = {
  easy: [2, 3, 4],
  medium: [2, 3, 4, 6, 8],
  hard: PARTS,
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const next = x % y
    x = y
    y = next
  }
  return x || 1
}

export function simplify(fraction: Fraction): Fraction {
  const divisor = gcd(fraction.num, fraction.den)
  return { num: fraction.num / divisor, den: fraction.den / divisor }
}

export function sameFraction(a: Fraction, b: Fraction) {
  return a.num === b.num && a.den === b.den
}

export function fractionKey(fraction: Fraction) {
  return `${fraction.num}/${fraction.den}`
}

/** 随机一道分数，分子至少 1、最多比分母少 1，尽量不和上一题重复。 */
export function randomFraction(level: Level, prev?: Fraction): Fraction {
  const dens = LEVEL_PARTS[level]
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const den = dens[Math.floor(Math.random() * dens.length)]
    const num = 1 + Math.floor(Math.random() * (den - 1))
    if (!prev || num !== prev.num || den !== prev.den) return { num, den }
  }
  return { num: 1, den: dens[0] }
}

export const MAX_PARTS = 12

const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二']

/** 课本上的读法用汉字：4 分之 3 读作「四分之三」。 */
export function cnNumber(value: number) {
  return CN[value] ?? String(value)
}

/** 中文读法，只在中文界面用；英文界面直接写 3 / 4。 */
export function cnFraction(num: number, den: number) {
  return `${cnNumber(den)}分之${cnNumber(num)}`
}

export type Sign = '>' | '<' | '='
/** den：分母相同比分子；num：分子相同比分母；equal：看起来不同其实一样大。 */
export type CompareRule = 'den' | 'num' | 'equal'
export type ComparePair = { left: Fraction; right: Fraction; answer: Sign; rule: CompareRule }

function pickOne<T>(list: T[]) {
  return list[Math.floor(Math.random() * list.length)]
}

function signOf(left: Fraction, right: Fraction): Sign {
  const a = left.num * right.den
  const b = right.num * left.den
  return a === b ? '=' : a > b ? '>' : '<'
}

/** 三年级「比较分数大小」的两类题：同分母、同分子；困难再加等值分数。 */
export function comparePair(level: Level, prev?: ComparePair): ComparePair {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const roll = Math.random()
    let left: Fraction
    let right: Fraction
    let rule: CompareRule
    if (level === 'hard' && roll < 0.2) {
      const base = pickOne([{ num: 1, den: 2 }, { num: 1, den: 3 }, { num: 2, den: 3 }, { num: 1, den: 4 }, { num: 3, den: 4 }])
      const times = pickOne([2, 3].filter((k) => base.den * k <= MAX_PARTS))
      left = base
      right = { num: base.num * times, den: base.den * times }
      rule = 'equal'
    } else if (level !== 'easy' && roll < 0.55) {
      const dens = LEVEL_PARTS[level].filter((den) => den >= 3)
      const a = pickOne(dens)
      let b = pickOne(dens)
      while (b === a) b = pickOne(dens)
      const num = 1 + Math.floor(Math.random() * (Math.min(a, b) - 1))
      left = { num, den: a }
      right = { num, den: b }
      rule = 'num'
    } else {
      const den = pickOne(LEVEL_PARTS[level].filter((value) => value >= 3))
      left = { num: 1 + Math.floor(Math.random() * (den - 1)), den }
      right = { num: 1 + Math.floor(Math.random() * (den - 1)), den }
      rule = 'den'
    }
    if (Math.random() < 0.5) [left, right] = [right, left]
    const pair = { left, right, answer: signOf(left, right), rule }
    const same = prev && sameFraction(prev.left, pair.left) && sameFraction(prev.right, pair.right)
    if (!same) return pair
  }
  return { left: { num: 1, den: 4 }, right: { num: 3, den: 4 }, answer: '<', rule: 'den' }
}

/** 四个选项，包含正确答案。分母只有 2 时补其他份数的分数，保证凑得齐。 */
export function fractionOptions(answer: Fraction): Fraction[] {
  const found = new Map<string, Fraction>()
  const add = (fraction: Fraction) => {
    if (fraction.num < 1 || fraction.num >= fraction.den) return
    found.set(fractionKey(fraction), fraction)
  }
  add(answer)
  add({ num: answer.num + 1, den: answer.den })
  add({ num: answer.num - 1, den: answer.den })
  const pool: Fraction[] = []
  for (const den of PARTS) for (let num = 1; num < den; num += 1) pool.push({ num, den })
  while (found.size < 4) add(pool[Math.floor(Math.random() * pool.length)])
  return [...found.values()].sort(() => Math.random() - 0.5)
}
