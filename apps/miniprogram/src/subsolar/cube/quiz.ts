/** 小测验和打印练习题共用的随机出题。只出数据，文字由页面和打印模板各自写。 */
import {
  BAD_NETS,
  CUBE_NETS,
  edgeSum,
  landscape,
  numberOptions,
  oppositeCell,
  paintCounts,
  pickOne,
  randInt,
  randomStack,
  shuffle,
  stackCount,
  stackView,
  surfaceArea,
  transformNet,
  viewKey,
  viewOptions,
  volume,
  type Box,
  type Cell,
  type Stack,
  type StackLevel,
  type View,
  type ViewGrid,
} from './geometry'

export type Level = StackLevel
export type QuizMode = 'fold' | 'opposite' | 'count' | 'views' | 'calc'
export type CalcAsk = 'edge' | 'area' | 'volume' | 'paint3' | 'paint2' | 'paint1' | 'paint0' | 'edgeFromSum'

export type FoldQuestion = { mode: 'fold'; cells: Cell[]; valid: boolean }
export type OppositeQuestion = { mode: 'opposite'; cells: Cell[]; letters: string[]; star: number; answer: number; choices: number[] }
export type CountQuestion = { mode: 'count'; stack: Stack; answer: number; options: number[] }
export type ViewsQuestion = { mode: 'views'; stack: Stack; view: View; options: ViewGrid[]; answer: number }
export type CalcQuestion = { mode: 'calc'; ask: CalcAsk; box: Box; cube: boolean; given?: number; answer: number; options: number[] }
export type Question = FoldQuestion | OppositeQuestion | CountQuestion | ViewsQuestion | CalcQuestion

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

function shaped(cells: Cell[]) {
  return landscape(transformNet(cells, randInt(0, 3), Math.random() < 0.5))
}

export function foldQuestion(level: Level, valid = Math.random() < 0.5): FoldQuestion {
  const goods = level === 'easy' ? CUBE_NETS.filter((net) => net.family === '141') : CUBE_NETS
  const bads = level === 'easy' ? BAD_NETS.slice(0, 5) : level === 'medium' ? BAD_NETS.slice(0, 8) : BAD_NETS
  const cells = valid ? pickOne(goods).cells : pickOne(bads)
  return { mode: 'fold', cells: shaped(cells), valid }
}

export function oppositeQuestion(level: Level): OppositeQuestion {
  const pool = level === 'easy' ? CUBE_NETS.filter((net) => net.family === '141') : level === 'medium' ? CUBE_NETS.filter((net) => net.family !== '141') : CUBE_NETS
  const cells = level === 'easy' ? landscape(pickOne(pool).cells) : shaped(pickOne(pool).cells)
  const star = randInt(0, 5)
  const letters = shuffle(LETTERS).slice(0, 6)
  letters[star] = '★'
  const answer = oppositeCell(cells, star)
  const choices = cells.map((_, index) => index).filter((index) => index !== star)
  return { mode: 'opposite', cells, letters, star, answer, choices: choices.sort((a, b) => letters[a].localeCompare(letters[b])) }
}

export function countQuestion(level: Level, avoid?: Stack): CountQuestion {
  const stack = randomStack(level, avoid)
  const answer = stackCount(stack)
  const visible = stack.flat().filter((h) => h > 0).length
  return { mode: 'count', stack, answer, options: numberOptions(answer, [answer - 1, answer + 1, visible, answer - 2, answer + 2]) }
}

export function viewsQuestion(level: Level, avoid?: Stack): ViewsQuestion {
  const stack = randomStack(level, avoid)
  const views: View[] = level === 'easy' ? ['front', 'top'] : ['front', 'top', 'left']
  const view = pickOne(views)
  const options = viewOptions(stack, view)
  const truth = viewKey(stackView(stack, view))
  return { mode: 'views', stack, view, options, answer: options.findIndex((grid) => viewKey(grid) === truth) }
}

export function calcQuestion(level: Level): CalcQuestion {
  if (level === 'easy') {
    const a = randInt(2, 6)
    const box: Box = [a, a, a]
    const ask = pickOne(['edge', 'area', 'volume'] as const)
    return withOptions({ mode: 'calc', ask, box, cube: true })
  }
  if (level === 'medium') {
    // 3D 里按 1 cm 的小方块画，控制在 100 块以内
    const box: Box = [randInt(3, 6), randInt(2, 4), randInt(2, 4)]
    if (box[0] === box[1] && box[1] === box[2]) box[0] += 1
    const ask = pickOne(['edge', 'area', 'volume'] as const)
    return withOptions({ mode: 'calc', ask, box, cube: false })
  }
  if (Math.random() < 0.6) {
    const n = randInt(3, 5)
    const ask = pickOne(['paint3', 'paint2', 'paint1', 'paint0'] as const)
    return withOptions({ mode: 'calc', ask, box: [n, n, n], cube: true })
  }
  const a = randInt(2, 9)
  return withOptions({ mode: 'calc', ask: 'edgeFromSum', box: [a, a, a], cube: true, given: 12 * a })
}

function withOptions(question: Omit<CalcQuestion, 'answer' | 'options'>): CalcQuestion {
  const { box, ask } = question
  const [l, w, h] = box
  const n = box[0]
  const paint = paintCounts(n)
  let answer = 0
  let wrongs: number[] = []
  if (ask === 'edge') {
    answer = edgeSum(box)
    wrongs = question.cube ? [4 * l, 6 * l, 8 * l] : [2 * (l + w + h), 3 * (l + w + h), l + w + h]
  } else if (ask === 'area') {
    answer = surfaceArea(box)
    wrongs = question.cube ? [4 * l * l, l * l * l, 6 * l] : [l * w + l * h + w * h, 2 * (l * w + l * h), l * w * h]
  } else if (ask === 'volume') {
    answer = volume(box)
    wrongs = question.cube ? [l * l * 6, 3 * l, l * l] : [surfaceArea(box), l * w + h, 4 * (l + w + h)]
  } else if (ask === 'edgeFromSum') {
    answer = l
    wrongs = [question.given! / 4, question.given! / 6, question.given! / 8]
  } else {
    const at = ['paint3', 'paint2', 'paint1', 'paint0'].indexOf(ask)
    answer = paint[at]
    wrongs = [...paint.filter((_, index) => index !== at), 6 * (n - 2), 12 * (n - 1), 4 * (n - 2)]
  }
  wrongs = wrongs.filter((value) => Number.isInteger(value))
  return { ...question, answer, options: numberOptions(answer, wrongs) }
}

export function makeQuestion(mode: QuizMode, level: Level, prev?: Question | null): Question {
  const avoid = prev && (prev.mode === 'count' || prev.mode === 'views') ? prev.stack : undefined
  if (mode === 'fold') return foldQuestion(level)
  if (mode === 'opposite') return oppositeQuestion(level)
  if (mode === 'count') return countQuestion(level, avoid)
  if (mode === 'views') return viewsQuestion(level, avoid)
  return calcQuestion(level)
}
