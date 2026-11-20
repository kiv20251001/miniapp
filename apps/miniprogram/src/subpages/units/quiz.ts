/**
 * 单位换算出题：换一换（填空）、比一比（> = <）、填单位、称一称（看平衡的天平说重量）。
 * 题目只给结构化数据，文案由页面和打印按语言拼。
 */
import { MASS_SCALES, UNIT_FACTS, type MassObject, type UnitFact } from './lessons'
import { CATEGORY_UNITS, LEVEL_PAIRS, UNITS, randInt, rateOf, sample, shuffle, split, type Pair, type Part, type UnitId } from './units'

export type Level = 'easy' | 'medium' | 'hard'
export type QuizMode = 'convert' | 'compare' | 'unit' | 'weigh'
export type Sign = '>' | '=' | '<'

/** 换一换：given = (  ) target。target 有两个单位时是「( ) 千克 ( ) 克」 */
export type ConvertQuestion = { mode: 'convert'; given: Part[]; target: UnitId[]; answer: Part[]; options: Part[][] }
export type CompareQuestion = { mode: 'compare'; left: Part[]; right: Part[]; answer: Sign }
export type UnitQuestion = { mode: 'unit'; fact: UnitFact; options: UnitId[] }
export type WeighQuestion = { mode: 'weigh'; object: MassObject; big: UnitId; small: UnitId; weights: number[]; weight: number; answer: Part[]; options: Part[][] }
export type Question = ConvertQuestion | CompareQuestion | UnitQuestion | WeighQuestion

function amountOf(parts: Part[]) {
  return parts.reduce((sum, part) => sum + part.value * UNITS[part.unit].base, 0)
}

export function sameParts(a: Part[], b: Part[]) {
  return a.length === b.length && a.every((part, index) => part.value === b[index].value && part.unit === b[index].unit)
}

/** 余数挑整齐一点的数，进率大时更常出现「中间要补 0」的数，例如 2 千克 50 克 */
function remainder(rate: number, level: Level) {
  if (rate === 10) return randInt(1, 9)
  if (rate === 100) return sample(level === 'hard' ? [5, 8, 30, 45, 60, 75] : [20, 30, 50, 60, 80, 5])
  if (rate === 1000) return sample(level === 'hard' ? [5, 50, 80, 250, 400, 750] : [100, 200, 300, 500, 600, 800, 50])
  return sample([5, 50, 100, 500, 2000, 3500])
}

function wholeOf(level: Level, rate: number) {
  if (level === 'easy') return randInt(1, 9)
  if (rate >= 1000) return randInt(1, 9)
  return randInt(2, level === 'hard' ? 30 : 12)
}

function pairFor(level: Level, previous?: Pair) {
  const pool = LEVEL_PAIRS[level].filter((pair) => !previous || pair.big !== previous.big || pair.small !== previous.small)
  return sample(pool.length ? pool : LEVEL_PAIRS[level])
}

/** 一个数的几种常见错法：进率用错（多/少一个 0），或者复名数直接拼起来没补 0 */
function wrongNumbers(right: number, whole: number, rest: number, rate: number) {
  const list = [right * 10, Math.round(right / 10), whole * (rate / 10) + rest, whole * rate * 10 + rest]
  if (rest) list.push(Number(`${whole}${rest}`))
  list.push(right + rate, Math.max(1, right - rate))
  return list.filter((value) => value > 0 && Number.isInteger(value) && value !== right)
}

function uniqueOptions(right: Part[], wrong: Part[][], fill: () => Part[]) {
  const options: Part[][] = [right]
  for (const item of [...shuffle(wrong)]) {
    if (options.length >= 4) break
    if (!options.some((option) => sameParts(option, item))) options.push(item)
  }
  let guard = 0
  while (options.length < 4 && guard < 30) {
    guard += 1
    const item = fill()
    if (!options.some((option) => sameParts(option, item))) options.push(item)
  }
  return shuffle(options)
}

export function convertQuestion(level: Level, previous?: ConvertQuestion): ConvertQuestion {
  const pair = pairFor(level, previous ? { big: previous.given[0].unit, small: previous.target[previous.target.length - 1] } : undefined)
  const rate = rateOf(pair.big, pair.small)
  const whole = wholeOf(level, rate)
  const kinds = level === 'easy' ? ['down', 'up'] : level === 'medium' ? ['down', 'up', 'mixDown'] : ['down', 'up', 'mixDown', 'mixUp']
  const kind = sample(kinds)
  const rest = kind.startsWith('mix') ? remainder(rate, level) : 0
  const total = whole * rate + rest
  if (kind === 'down' || kind === 'mixDown') {
    const given: Part[] = rest ? [{ value: whole, unit: pair.big }, { value: rest, unit: pair.small }] : [{ value: whole, unit: pair.big }]
    const answer: Part[] = [{ value: total, unit: pair.small }]
    const wrong = wrongNumbers(total, whole, rest, rate).map((value): Part[] => [{ value, unit: pair.small }])
    return { mode: 'convert', given, target: [pair.small], answer, options: uniqueOptions(answer, wrong, () => [{ value: total + randInt(1, 9) * (rate / 10 || 1), unit: pair.small }]) }
  }
  if (kind === 'up') {
    const given: Part[] = [{ value: total, unit: pair.small }]
    const answer: Part[] = [{ value: whole, unit: pair.big }]
    const wrong = [whole * 10, whole * 100, Math.round(total / 10), whole + 1, whole + 10].filter((value) => value !== whole).map((value): Part[] => [{ value, unit: pair.big }])
    return { mode: 'convert', given, target: [pair.big], answer, options: uniqueOptions(answer, wrong, () => [{ value: whole + randInt(2, 9), unit: pair.big }]) }
  }
  const given: Part[] = [{ value: total, unit: pair.small }]
  const answer = split(total, pair.big, pair.small)
  const build = (w: number, r: number): Part[] => [{ value: w, unit: pair.big }, { value: r, unit: pair.small }]
  const wrong = [build(whole, rest * 10), build(whole * 10, rest), build(whole + 1, rest), build(whole, Math.max(1, Math.round(rest / 10)))]
    .filter((item) => item[1].value < rate * 10 && item[1].value > 0)
  return { mode: 'convert', given, target: [pair.big, pair.small], answer, options: uniqueOptions(answer, wrong, () => build(whole + randInt(2, 5), rest)) }
}

export function compareQuestion(level: Level, previous?: CompareQuestion): CompareQuestion {
  const pair = pairFor(level, previous ? { big: previous.left[0].unit, small: previous.right[previous.right.length - 1].unit } : undefined)
  const rate = rateOf(pair.big, pair.small)
  const whole = wholeOf(level, rate)
  const rest = level !== 'easy' && Math.random() < 0.5 ? remainder(rate, level) : 0
  const leftParts: Part[] = rest ? [{ value: whole, unit: pair.big }, { value: rest, unit: pair.small }] : [{ value: whole, unit: pair.big }]
  const base = whole * rate + rest
  const roll = Math.random()
  // 三分之一相等；不等时差一点点，或者是常见的「少一个 0」
  let other = base
  if (roll > 0.34) {
    const near = sample([base + rate / 10 || base + 1, base - (rate / 10 || 1), whole * (rate / 10) + rest, whole * rate * 10])
    other = Math.max(1, Math.round(near))
    if (other === base) other = base + 1
  }
  const rightParts: Part[] = [{ value: other, unit: pair.small }]
  const swap = Math.random() < 0.4
  const left = swap ? rightParts : leftParts
  const right = swap ? leftParts : rightParts
  const a = amountOf(left)
  const b = amountOf(right)
  return { mode: 'compare', left, right, answer: a > b ? '>' : a < b ? '<' : '=' }
}

const FACT_LEVELS: Record<Level, Array<UnitFact['level']>> = {
  easy: ['easy'],
  medium: ['easy', 'medium'],
  hard: ['medium', 'hard'],
}

export function unitQuestion(level: Level, previous?: UnitQuestion): UnitQuestion {
  const pool = UNIT_FACTS.filter((fact) => FACT_LEVELS[level].includes(fact.level) && fact !== previous?.fact)
  const fact = sample(pool)
  const family = CATEGORY_UNITS[UNITS[fact.unit].cat].filter((unit) => unit !== fact.unit && !(fact.unit === 'ml' && unit === 'cm3') && !(fact.unit === 'cm3' && unit === 'ml') && !(fact.unit === 'l' && unit === 'dm3') && !(fact.unit === 'dm3' && unit === 'l'))
  // 挑离正确单位近的两个，太离谱的（例如毫米和千米）一眼就能排除
  const order = CATEGORY_UNITS[UNITS[fact.unit].cat]
  const near = [...family].sort((a, b) => Math.abs(order.indexOf(a) - order.indexOf(fact.unit)) - Math.abs(order.indexOf(b) - order.indexOf(fact.unit)) || Math.random() - 0.5)
  const options = [...near.slice(0, 2), fact.unit].sort((a, b) => UNITS[a].base - UNITS[b].base)
  return { mode: 'unit', fact, options }
}

/** 天平右盘的砝码，从大到小凑出重量 */
export function weightsFor(weight: number, available: number[]) {
  const out: number[] = []
  let rest = weight
  for (const value of available) {
    while (rest >= value) {
      out.push(value)
      rest -= value
    }
  }
  return out
}

export function weighQuestion(level: Level, previous?: WeighQuestion): WeighQuestion {
  const scale = level === 'hard' && Math.random() < 0.5 ? MASS_SCALES[1] : MASS_SCALES[0]
  const rate = rateOf(scale.big, scale.small)
  const objects = scale.objects.filter((item) => item.art !== previous?.object.art && (level !== 'easy' || item.weight < rate))
  const object = sample(objects)
  const step = scale.small === 'g' ? 10 : 50
  // 在它真实重量上下浮动一点，鸡蛋不会称出几千克
  let weight = Math.max(step, Math.round((object.weight * (0.8 + Math.random() * 0.5)) / step) * step)
  if (level === 'easy') weight = Math.min(weight, rate - step)
  const weights = weightsFor(weight, scale.weights)
  const asSmall = level === 'easy' || Math.random() < 0.5
  const answer: Part[] = asSmall || weight < rate ? [{ value: weight, unit: scale.small }] : split(weight, scale.big, scale.small)
  const wrongTotals = [weight + step * 5, Math.max(step, weight - step * 3), weight * 10, Math.round(weight / 10) || step]
  const toParts = (value: number): Part[] => (answer.length === 1 ? [{ value, unit: scale.small }] : split(value, scale.big, scale.small))
  const wrong = wrongTotals.filter((value) => value !== weight).map(toParts)
  return {
    mode: 'weigh',
    object: { ...object, weight },
    big: scale.big,
    small: scale.small,
    weights,
    weight,
    answer,
    options: uniqueOptions(answer, wrong, () => toParts(weight + step * randInt(1, 9))),
  }
}

export function makeQuestion(mode: QuizMode, level: Level, previous: Question | null): Question {
  if (mode === 'convert') return convertQuestion(level, previous?.mode === 'convert' ? previous : undefined)
  if (mode === 'compare') return compareQuestion(level, previous?.mode === 'compare' ? previous : undefined)
  if (mode === 'unit') return unitQuestion(level, previous?.mode === 'unit' ? previous : undefined)
  return weighQuestion(level, previous?.mode === 'weigh' ? previous : undefined)
}
