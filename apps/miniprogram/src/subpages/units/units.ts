/**
 * 「单位换算」的单位和进率，按小学数学教材的口径：
 * 二年级长度（厘米、米）、三年级长度和质量（毫米、分米、千米、克、千克、吨）、
 * 三四年级面积（平方厘米、平方分米、平方米、公顷、平方千米）、五年级体积和容积（立方厘米、立方分米、立方米、毫升、升）。
 * 中英文写在一起，页面按语言取，不走 i18n 词表。
 */
export type Text = { zh: string; en: string }

export function pick(text: Text, en: boolean) {
  return en ? text.en : text.zh
}

export type Category = 'length' | 'mass' | 'area' | 'volume'
export type UnitId =
  | 'mm' | 'cm' | 'dm' | 'm' | 'km'
  | 'g' | 'kg' | 't'
  | 'cm2' | 'dm2' | 'm2' | 'ha' | 'km2'
  | 'ml' | 'l' | 'cm3' | 'dm3' | 'm3'

type Unit = { cat: Category; zh: string; en: string; /** 换成本类最小单位是多少 */ base: number }

export const UNITS: Record<UnitId, Unit> = {
  mm: { cat: 'length', zh: '毫米', en: 'mm', base: 1 },
  cm: { cat: 'length', zh: '厘米', en: 'cm', base: 10 },
  dm: { cat: 'length', zh: '分米', en: 'dm', base: 100 },
  m: { cat: 'length', zh: '米', en: 'm', base: 1000 },
  km: { cat: 'length', zh: '千米', en: 'km', base: 1000000 },
  g: { cat: 'mass', zh: '克', en: 'g', base: 1 },
  kg: { cat: 'mass', zh: '千克', en: 'kg', base: 1000 },
  t: { cat: 'mass', zh: '吨', en: 't', base: 1000000 },
  cm2: { cat: 'area', zh: '平方厘米', en: 'cm²', base: 1 },
  dm2: { cat: 'area', zh: '平方分米', en: 'dm²', base: 100 },
  m2: { cat: 'area', zh: '平方米', en: 'm²', base: 10000 },
  ha: { cat: 'area', zh: '公顷', en: 'ha', base: 100000000 },
  km2: { cat: 'area', zh: '平方千米', en: 'km²', base: 10000000000 },
  ml: { cat: 'volume', zh: '毫升', en: 'mL', base: 1 },
  cm3: { cat: 'volume', zh: '立方厘米', en: 'cm³', base: 1 },
  l: { cat: 'volume', zh: '升', en: 'L', base: 1000 },
  dm3: { cat: 'volume', zh: '立方分米', en: 'dm³', base: 1000 },
  m3: { cat: 'volume', zh: '立方米', en: 'm³', base: 1000000 },
}

/** 填单位时备选的单位，按从小到大排 */
export const CATEGORY_UNITS: Record<Category, UnitId[]> = {
  length: ['mm', 'cm', 'dm', 'm', 'km'],
  mass: ['g', 'kg', 't'],
  area: ['cm2', 'dm2', 'm2', 'ha', 'km2'],
  volume: ['ml', 'l', 'cm3', 'dm3', 'm3'],
}

export function unitName(unit: UnitId, en: boolean) {
  return en ? UNITS[unit].en : UNITS[unit].zh
}

/** 两个单位之间的进率 */
export function rateOf(big: UnitId, small: UnitId) {
  return UNITS[big].base / UNITS[small].base
}

/** 复名数，例如 2 米 5 厘米 */
export type Part = { value: number; unit: UnitId }

export function formatParts(parts: Part[], en: boolean) {
  return parts.map((part) => `${part.value} ${unitName(part.unit, en)}`).join(' ')
}

/** 把最小单位的数拆成「大单位 + 小单位」，例如 1250 克 → 1 千克 250 克 */
export function split(amount: number, big: UnitId, small: UnitId): Part[] {
  const rate = rateOf(big, small)
  const whole = Math.floor(amount / rate)
  const rest = amount - whole * rate
  if (!whole) return [{ value: rest, unit: small }]
  if (!rest) return [{ value: whole, unit: big }]
  return [{ value: whole, unit: big }, { value: rest, unit: small }]
}

export type Pair = { big: UnitId; small: UnitId }

/** 小测验和练习题会用到的相邻单位，按难度逐级放开 */
export const LEVEL_PAIRS: Record<'easy' | 'medium' | 'hard', Pair[]> = {
  easy: [
    { big: 'cm', small: 'mm' },
    { big: 'dm', small: 'cm' },
    { big: 'm', small: 'dm' },
    { big: 'm', small: 'cm' },
    { big: 'kg', small: 'g' },
    { big: 'km', small: 'm' },
  ],
  medium: [
    { big: 'cm', small: 'mm' },
    { big: 'm', small: 'cm' },
    { big: 'dm', small: 'mm' },
    { big: 'km', small: 'm' },
    { big: 'kg', small: 'g' },
    { big: 't', small: 'kg' },
    { big: 'dm2', small: 'cm2' },
    { big: 'm2', small: 'dm2' },
    { big: 'l', small: 'ml' },
  ],
  hard: [
    { big: 'm', small: 'cm' },
    { big: 'km', small: 'm' },
    { big: 'kg', small: 'g' },
    { big: 't', small: 'kg' },
    { big: 'm2', small: 'dm2' },
    { big: 'ha', small: 'm2' },
    { big: 'km2', small: 'ha' },
    { big: 'l', small: 'ml' },
    { big: 'dm3', small: 'cm3' },
    { big: 'm3', small: 'dm3' },
  ],
}

export function randInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

export function sample<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

export function shuffle<T>(list: readonly T[]): T[] {
  const out = [...list]
  for (let index = out.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1))
    ;[out[index], out[other]] = [out[other], out[index]]
  }
  return out
}
