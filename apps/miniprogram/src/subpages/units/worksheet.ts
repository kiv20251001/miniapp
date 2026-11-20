/** 打印练习题：每页按选中的题型分成几段，题目从小测验的出题器里取。 */
import { compareQuestion, convertQuestion, unitQuestion, type CompareQuestion, type ConvertQuestion, type Level, type UnitQuestion } from './quiz'
import { randInt } from './units'

export type SheetKind = 'convert' | 'compare' | 'unit' | 'ruler'

export const SHEET_KINDS: Array<{ value: SheetKind; label: string }> = [
  { value: 'convert', label: '换算填空' },
  { value: 'compare', label: '比大小' },
  { value: 'unit', label: '填单位' },
  { value: 'ruler', label: '量一量' },
]

/** 量一量：尺子上方一根彩条，长 mm 毫米 */
export type RulerItem = { mm: number; ask: 'cm' | 'cmmm' | 'all' }

export type SheetSection =
  | { kind: 'convert'; items: ConvertQuestion[] }
  | { kind: 'compare'; items: CompareQuestion[] }
  | { kind: 'unit'; items: UnitQuestion[] }
  | { kind: 'ruler'; items: RulerItem[] }

function rulerItem(level: Level): RulerItem {
  if (level === 'easy') return { mm: randInt(2, 7) * 10, ask: 'cm' }
  let mm = randInt(12, 76)
  if (mm % 10 === 0) mm += 3
  return { mm, ask: level === 'medium' ? 'cmmm' : 'all' }
}

function many<T>(count: number, make: (previous?: T) => T) {
  const out: T[] = []
  for (let index = 0; index < count; index += 1) out.push(make(out[index - 1]))
  return out
}

export function buildSection(kind: SheetKind, level: Level, count: number): SheetSection {
  if (kind === 'convert') return { kind, items: many<ConvertQuestion>(count, (previous) => convertQuestion(level, previous)) }
  if (kind === 'compare') return { kind, items: many<CompareQuestion>(count, (previous) => compareQuestion(level, previous)) }
  if (kind === 'unit') {
    // 同一页不重复用同一句
    const items: UnitQuestion[] = []
    let guard = 0
    while (items.length < count && guard < count * 10) {
      guard += 1
      const item = unitQuestion(level, items[items.length - 1])
      if (!items.some((other) => other.fact === item.fact)) items.push(item)
    }
    return { kind, items }
  }
  return { kind, items: Array.from({ length: count }, () => rulerItem(level)) }
}
