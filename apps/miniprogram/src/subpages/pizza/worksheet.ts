import { MAX_PARTS, randomFraction, type Fraction, type Level } from './fraction'

/** line 看分数画线段：印好分数，下面留一条 0 到 1 的线段让孩子自己分、自己画；read 看图写分数：披萨已切开，下面留空。 */
export type PizzaMode = 'line' | 'read'
export type PizzaSheetKind = PizzaMode | 'mixed'
export type PizzaItem = { fraction: Fraction; mode: PizzaMode }

export const SHEET_KINDS: Array<{ value: PizzaSheetKind; label: string }> = [
  { value: 'line', label: '看分数画线段' },
  { value: 'read', label: '看图写分数' },
  { value: 'mixed', label: '随机混合' },
]

/** 每行固定 3 道，不再让人选择。 */
export const PER_ROW = 3

function toFraction(num: number, den: number): Fraction | null {
  const valid = [num, den].every(Number.isInteger) && den >= 1 && den <= MAX_PARTS && num >= 0 && num <= den
  return valid ? { num, den } : null
}

/**
 * 支持 3/4、3／4，也支持说出来的顺序 4分之3。
 * 斜线前面是分子；「分之」前面是分母。用空格、逗号或换行隔开。
 */
export function parseFractions(text: string) {
  const fractions: Fraction[] = []
  const skipped: string[] = []
  for (const raw of text.split(/[\s,，、;；]+/)) {
    const token = raw.trim()
    if (!token) continue
    const slash = token.match(/^(\d{1,2})\s*[/／]\s*(\d{1,2})$/)
    const spoken = token.match(/^(\d{1,2})分之(\d{1,2})$/)
    const fraction = slash
      ? toFraction(Number(slash[1]), Number(slash[2]))
      : spoken
        ? toFraction(Number(spoken[2]), Number(spoken[1]))
        : null
    if (fraction) fractions.push(fraction)
    else skipped.push(token)
  }
  return { fractions, skipped }
}

export function formatFraction(fraction: Fraction) {
  return `${fraction.num}/${fraction.den}`
}

export function joinFractions(fractions: Fraction[]) {
  return fractions.map(formatFraction).join('  ')
}

export function randomFractions(level: Level, count: number) {
  const fractions: Fraction[] = []
  for (let index = 0; index < count; index += 1) {
    fractions.push(randomFraction(level, fractions[index - 1]))
  }
  return fractions
}

/** 混合题型一半画线段、一半写分数，顺序打乱。 */
export function assignModes(fractions: Fraction[], kind: PizzaSheetKind): PizzaItem[] {
  if (kind !== 'mixed') return fractions.map((fraction) => ({ fraction, mode: kind }))
  const modes = fractions.map((_, index): PizzaMode => (index % 2 === 0 ? 'line' : 'read')).sort(() => Math.random() - 0.5)
  return fractions.map((fraction, index) => ({ fraction, mode: modes[index] }))
}
