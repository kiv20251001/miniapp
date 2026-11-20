/** 打印练习题：按选中的题型和难度随机出题，题型轮流排，每页 6 道。 */
import { randInt, shuffle, type Box, type Cell, type Stack } from './geometry'
import { calcQuestion, countQuestion, foldQuestion, oppositeQuestion, viewsQuestion, type Level } from './quiz'

export type SheetKind = 'net' | 'opposite' | 'count' | 'views' | 'calc' | 'paint'

export type SheetItem =
  | { kind: 'net'; nets: Array<{ cells: Cell[]; valid: boolean }> }
  | { kind: 'opposite'; cells: Cell[]; letters: string[]; star: number }
  | { kind: 'count'; stack: Stack }
  | { kind: 'views'; stack: Stack }
  | { kind: 'calc'; box: Box; cube: boolean }
  | { kind: 'paint'; n: number }

export const SHEET_KINDS: Array<{ value: SheetKind; label: string }> = [
  { value: 'net', label: '展开图判断' },
  { value: 'opposite', label: '找相对面' },
  { value: 'count', label: '数小方块' },
  { value: 'views', label: '三视图' },
  { value: 'calc', label: '表面积和体积' },
  { value: 'paint', label: '涂色问题' },
]

function makeItem(kind: SheetKind, level: Level): SheetItem {
  if (kind === 'net') {
    const first = Math.random() < 0.5
    return { kind, nets: [foldQuestion(level, first), foldQuestion(level, Math.random() < 0.5 ? !first : first)].map(({ cells, valid }) => ({ cells, valid })) }
  }
  if (kind === 'opposite') {
    const { cells, letters, star } = oppositeQuestion(level)
    return { kind, cells, letters, star }
  }
  if (kind === 'count') return { kind, stack: countQuestion(level).stack }
  if (kind === 'views') return { kind, stack: viewsQuestion(level === 'easy' ? 'easy' : 'medium').stack }
  if (kind === 'paint') return { kind, n: level === 'easy' ? 3 : level === 'medium' ? randInt(3, 4) : randInt(4, 6) }
  if (level === 'hard') {
    const a = randInt(5, 12)
    return Math.random() < 0.4 ? { kind, box: [a, a, a], cube: true } : { kind, box: [randInt(6, 15), randInt(3, 10), randInt(2, 8)], cube: false }
  }
  const { box, cube } = calcQuestion(level)
  return { kind, box, cube }
}

export function buildSheet(kinds: SheetKind[], level: Level, count: number): SheetItem[] {
  const order = kinds.length ? kinds : SHEET_KINDS.map((item) => item.value)
  const items: SheetItem[] = []
  let round = shuffle(order)
  while (items.length < count) {
    if (!round.length) round = shuffle(order)
    items.push(makeItem(round.shift()!, level))
  }
  return items
}
