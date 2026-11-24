/** 第 15–30 关：十六种不同的谜题。规则和解法在这里，画面在 puzzle-draw.ts。 */

export type Dir = 'up' | 'down' | 'left' | 'right'
export type PuzzleKind =
  | 'ice' | 'magic' | 'jugs' | 'color' | 'laser' | 'match' | 'spin' | 'tubes'
  | 'mines' | 'detect' | 'flow' | 'nono' | 'peg' | 'knight' | 'park' | 'sudoku'

export const PUZZLE_KINDS: PuzzleKind[] = ['ice', 'magic', 'jugs', 'color', 'laser', 'match', 'spin', 'tubes', 'mines', 'detect', 'flow', 'nono', 'peg', 'knight', 'park', 'sudoku']

const STEP: Record<Dir, [number, number]> = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }
const DIRS: Dir[] = ['up', 'right', 'down', 'left']

export type IceRound = { kind: 'ice'; w: number; h: number; rocks: boolean[]; at: number; goal: number }
export type MagicRound = { kind: 'magic'; cells: number[]; fixed: boolean[] }
export type JugsRound = { kind: 'jugs'; caps: number[]; water: number[] }
export type ColorRound = { kind: 'color'; w: number; h: number; map: number[]; paint: number[]; fixed: boolean[] }
export type LaserRound = { kind: 'laser'; n: number; cells: string[]; row: number }
export type MatchRound = { kind: 'match'; lit: boolean[]; start: boolean[] }
export type SpinRound = { kind: 'spin'; tiles: number[] }
export type TubesRound = { kind: 'tubes'; cap: number; tubes: number[][] }
export type MinesRound = { kind: 'mines'; w: number; h: number; mine: boolean[]; open: boolean[]; flag: boolean[] }
export type DetectRound = { kind: 'detect'; slots: number[] }
export type FlowRound = { kind: 'flow'; n: number; dots: number[]; paths: number[][] }
export type NonoRound = { kind: 'nono'; w: number; h: number; cells: number[]; art: number[]; rows: number[][]; cols: number[][] }
export type PegRound = { kind: 'peg'; pegs: boolean[] }
export type KnightRound = { kind: 'knight'; cells: number[] }
export type ParkCar = { id: number; r: number; c: number; len: number; axis: 'h' | 'v'; hero: boolean }
export type ParkRound = { kind: 'park'; n: number; exit: number; cars: ParkCar[] }
export type SudokuRound = { kind: 'sudoku'; cells: number[]; given: boolean[] }

export type PuzzleRound =
  | IceRound | MagicRound | JugsRound | ColorRound | LaserRound | MatchRound | SpinRound | TubesRound
  | MinesRound | DetectRound | FlowRound | NonoRound | PegRound | KnightRound | ParkRound | SudokuRound

export type PuzzleMove =
  | { op: 'ice'; dir: Dir }
  | { op: 'place'; value: number; from: number; to: number }
  | { op: 'pour'; from: number; to: number }
  | { op: 'paint'; cell: number; value: number }
  | { op: 'mirror'; index: number }
  | { op: 'stick'; from: number; to: number }
  | { op: 'spin'; index: number }
  | { op: 'dig'; cell: number }
  | { op: 'flag'; cell: number }
  | { op: 'flow'; color: number; path: number[]; live?: boolean }
  | { op: 'jump'; from: number; to: number }
  | { op: 'car'; id: number; dir: Dir }

export type Anim = { type: string; t: number; speed: number; a: number; b: number; c: number; prev?: number[]; list?: number[] }
export type Outcome = { round: PuzzleRound; anim: Anim | null; delay: number }

export function isPuzzle(round: { kind: string }): round is PuzzleRound {
  return (PUZZLE_KINDS as string[]).includes(round.kind)
}

function anim(type: string, frames: number, a = -1, b = -1, c = -1, extra: Partial<Anim> = {}): Anim {
  return { type, t: 0, speed: 1 / Math.max(1, frames), a, b, c, ...extra }
}

function neighbors4(index: number, w: number, h: number) {
  const row = Math.floor(index / w)
  const col = index % w
  const out: number[] = []
  if (row > 0) out.push(index - w)
  if (col < w - 1) out.push(index + 1)
  if (row < h - 1) out.push(index + w)
  if (col > 0) out.push(index - 1)
  return out
}

function neighbors8(index: number, w: number, h: number) {
  const row = Math.floor(index / w)
  const col = index % w
  const out: number[] = []
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (!dr && !dc) continue
      const r = row + dr
      const c = col + dc
      if (r >= 0 && c >= 0 && r < h && c < w) out.push(r * w + c)
    }
  }
  return out
}

function bfs<S>(start: S, key: (state: S) => string, done: (state: S) => boolean, next: (state: S) => Array<[PuzzleMove, S]>, limit = 400000): PuzzleMove[] {
  const root = key(start)
  const prev = new Map<string, { from: string; move: PuzzleMove }>()
  const states = new Map<string, S>([[root, start]])
  const queue = [root]
  let head = 0
  while (head < queue.length && head < limit) {
    const here = queue[head]
    head += 1
    const state = states.get(here) as S
    if (done(state)) {
      const moves: PuzzleMove[] = []
      let cursor = here
      while (cursor !== root) {
        const item = prev.get(cursor)
        if (!item) break
        moves.push(item.move)
        cursor = item.from
      }
      return moves.reverse()
    }
    for (const [move, after] of next(state)) {
      const mark = key(after)
      if (states.has(mark)) continue
      states.set(mark, after)
      prev.set(mark, { from: here, move })
      queue.push(mark)
    }
  }
  return []
}

/* ---------- 企鹅滑冰 ---------- */

const ICE_MAP = [
  '..#....',
  '......#',
  '.#.....',
  '....#..',
  '#......',
  '...#.#.',
  '.P..F..',
]

function parseIce(rows: string[]): IceRound {
  const h = rows.length
  const w = rows[0].length
  const rocks: boolean[] = []
  let at = 0
  let goal = 0
  rows.forEach((row, r) => {
    ;[...row].forEach((ch, c) => {
      const index = r * w + c
      rocks[index] = ch === '#'
      if (ch === 'P') at = index
      if (ch === 'F') goal = index
    })
  })
  return { kind: 'ice', w, h, rocks, at, goal }
}

export function iceSlide(round: IceRound, dir: Dir) {
  let row = Math.floor(round.at / round.w)
  let col = round.at % round.w
  let moved = false
  for (;;) {
    const r = row + STEP[dir][0]
    const c = col + STEP[dir][1]
    if (r < 0 || c < 0 || r >= round.h || c >= round.w || round.rocks[r * round.w + c]) break
    row = r
    col = c
    moved = true
  }
  return moved ? row * round.w + col : -1
}

/* ---------- 幻方 ---------- */

export const MAGIC_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]
const MAGIC_ANSWER = [8, 1, 6, 3, 5, 7, 4, 9, 2]

export function magicSum(cells: number[], line: number[]) {
  if (line.some((index) => !cells[index])) return -1
  return line.reduce((sum, index) => sum + cells[index], 0)
}

function placeCells(cells: number[], fixed: boolean[], move: { value: number; from: number; to: number }, accept: (value: number, slot: number) => boolean) {
  let from = move.from
  if (from < 0 && cells.includes(move.value)) from = cells.indexOf(move.value)
  if (move.to >= 0 && fixed[move.to]) return 'fixed'
  if (from >= 0 && fixed[from]) return 'fixed'
  if (from >= 0 && cells[from] !== move.value) return 'miss'
  if (from === move.to) return 'still'
  const next = [...cells]
  if (move.to < 0) {
    if (from < 0) return 'still'
    next[from] = 0
    return next
  }
  if (!accept(move.value, move.to)) return 'slot'
  const old = next[move.to]
  if (from >= 0) {
    if (old && !accept(old, from)) return 'slot'
    next[from] = old
  }
  next[move.to] = move.value
  return next
}

/* ---------- 量杯分水 ---------- */

/* ---------- 地图涂色 ---------- */

const COLOR_MAP = [
  'AABBBC',
  'ADDBCC',
  'EDFFCG',
  'EEFHGG',
  'IEHHHG',
  'IIIJJJ',
]
const COLOR_FIXED: Record<number, number> = { 0: 1, 9: 3 }

function parseColor(): ColorRound {
  const h = COLOR_MAP.length
  const w = COLOR_MAP[0].length
  const map: number[] = []
  COLOR_MAP.forEach((row) => [...row].forEach((ch) => map.push(ch.charCodeAt(0) - 65)))
  const count = Math.max(...map) + 1
  const paint = Array.from({ length: count }, (_, index) => COLOR_FIXED[index] ?? 0)
  const fixed = paint.map((value) => value > 0)
  return { kind: 'color', w, h, map, paint, fixed }
}

export function colorLinks(round: ColorRound) {
  const links = new Set<string>()
  round.map.forEach((region, index) => {
    neighbors4(index, round.w, round.h).forEach((other) => {
      const next = round.map[other]
      if (next !== region) links.add(region < next ? `${region}-${next}` : `${next}-${region}`)
    })
  })
  return [...links].map((link) => link.split('-').map(Number) as [number, number])
}

export function colorClash(round: ColorRound) {
  return colorLinks(round).filter(([a, b]) => round.paint[a] && round.paint[a] === round.paint[b])
}

/* ---------- 激光 ---------- */

const LASER_MAP = [
  '.\\..*.',
  '..#.\\.',
  '/..\\..',
  '.*..#/',
  '..\\..*',
  '#.../.',
]
const LASER_ROW = 2

const SLASH = [1, 0, 3, 2]
const BACK = [3, 2, 1, 0]
const DR = [-1, 0, 1, 0]
const DC = [0, 1, 0, -1]

export function laserPath(round: LaserRound) {
  let row = round.row
  let col = -1
  let dir = 1
  const cells: number[] = []
  const seen = new Set<string>()
  let blocked = false
  for (let guard = 0; guard < 200; guard += 1) {
    row += DR[dir]
    col += DC[dir]
    if (row < 0 || col < 0 || row >= round.n || col >= round.n) break
    const index = row * round.n + col
    const mark = `${index}:${dir}`
    if (seen.has(mark)) break
    seen.add(mark)
    cells.push(index)
    const ch = round.cells[index]
    if (ch === '#') {
      blocked = true
      break
    }
    if (ch === '/') dir = SLASH[dir]
    if (ch === '\\') dir = BACK[dir]
  }
  return { cells, row, col, blocked }
}

export function laserLit(round: LaserRound) {
  const path = new Set(laserPath(round).cells)
  return round.cells.map((ch, index) => ch === '*' && path.has(index))
}

/* ---------- 火柴棒 ---------- */

const SEGS = 'abcdefg'
const DIGIT_SEGS = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg']
export const MATCH_PLUS = 21
const MATCH_START = { a: 6, plus: true, b: 4, c: 4 }

function matchLit(eq: { a: number; plus: boolean; b: number; c: number }) {
  const lit: boolean[] = Array.from({ length: 22 }, () => false)
  ;[eq.a, eq.b, eq.c].forEach((digit, place) => {
    ;[...DIGIT_SEGS[digit]].forEach((seg) => {
      lit[place * 7 + SEGS.indexOf(seg)] = true
    })
  })
  lit[MATCH_PLUS] = eq.plus
  return lit
}

export function matchRead(lit: boolean[]) {
  const digits = [0, 1, 2].map((place) => {
    const segs = [...SEGS].filter((_, index) => lit[place * 7 + index]).join('')
    return DIGIT_SEGS.indexOf(segs)
  })
  if (digits.some((digit) => digit < 0)) return null
  return { a: digits[0], plus: lit[MATCH_PLUS], b: digits[1], c: digits[2] }
}

function matchTrue(lit: boolean[]) {
  const eq = matchRead(lit)
  if (!eq) return false
  return (eq.plus ? eq.a + eq.b : eq.a - eq.b) === eq.c
}

export function matchMoved(round: MatchRound) {
  return round.lit.filter((on, index) => on && !round.start[index]).length
}

/* ---------- 转方块 ---------- */

const SPIN_START = [3, 0, 2, 4, 1, 5, 6, 7, 8]
export const SPIN_QUADS = [0, 1, 3, 4]

export function spinCycle(index: number) {
  const base = SPIN_QUADS[index]
  return [base, base + 1, base + 4, base + 3]
}

export function spinTurn(tiles: number[], index: number) {
  const ring = spinCycle(index)
  const next = [...tiles]
  next[ring[1]] = tiles[ring[0]]
  next[ring[2]] = tiles[ring[1]]
  next[ring[3]] = tiles[ring[2]]
  next[ring[0]] = tiles[ring[3]]
  return next
}

/* ---------- 试管倒水 ---------- */

const TUBES_START = [[1, 2, 3, 1], [2, 4, 4, 3], [3, 1, 2, 4], [4, 3, 1, 2], [], []]

export function tubePour(round: TubesRound, from: number, to: number) {
  if (from === to) return null
  const source = round.tubes[from]
  const target = round.tubes[to]
  if (!source?.length || !target || target.length >= round.cap) return null
  const color = source[source.length - 1]
  if (target.length && target[target.length - 1] !== color) return null
  let run = 0
  for (let index = source.length - 1; index >= 0 && source[index] === color; index -= 1) run += 1
  const count = Math.min(run, round.cap - target.length)
  const tubes = round.tubes.map((tube) => [...tube])
  for (let step = 0; step < count; step += 1) tubes[to].push(tubes[from].pop() as number)
  return { tubes, color, count }
}

function tubesDone(round: TubesRound) {
  return round.tubes.every((tube) => !tube.length || (tube.length === round.cap && tube.every((color) => color === tube[0])))
}

/* ---------- 扫雷 ---------- */

const MINES_MAP = [
  '......',
  '.*....',
  '....*.',
  '*.....',
  '...*..',
  '.*...*',
]
const MINES_OPEN = 14

export function mineCount(round: MinesRound, index: number) {
  return neighbors8(index, round.w, round.h).filter((other) => round.mine[other]).length
}

function flood(round: MinesRound, start: number) {
  const open = [...round.open]
  const opened: number[] = []
  const stack = [start]
  while (stack.length) {
    const index = stack.pop() as number
    if (open[index] || round.mine[index]) continue
    open[index] = true
    opened.push(index)
    if (mineCount(round, index) === 0) neighbors8(index, round.w, round.h).forEach((other) => { if (!open[other] && !round.flag[other]) stack.push(other) })
  }
  return { open, opened }
}

function parseMines(): MinesRound {
  const h = MINES_MAP.length
  const w = MINES_MAP[0].length
  const mine: boolean[] = []
  MINES_MAP.forEach((row) => [...row].forEach((ch) => mine.push(ch === '*')))
  const round: MinesRound = { kind: 'mines', w, h, mine, open: mine.map(() => false), flag: mine.map(() => false) }
  return { ...round, open: flood(round, MINES_OPEN).open }
}

/* ---------- 侦探推理 ---------- */

export const DETECT_SOLUTION = [2, 1, 4, 3, 6, 7, 5, 8]
export type Clue =
  | { t: 'at'; a: number; h: number }
  | { t: 'not'; a: number; hs: number[] }
  | { t: 'same'; a: number; b: number }
  | { t: 'right'; a: number; b: number }
  | { t: 'next'; a: number; b: number }
export const DETECT_CLUES: Clue[] = [
  { t: 'at', a: 3, h: 3 },
  { t: 'right', a: 1, b: 2 },
  { t: 'same', a: 4, b: 5 },
  { t: 'at', a: 6, h: 0 },
  { t: 'not', a: 8, hs: [0, 1] },
  { t: 'right', a: 5, b: 7 },
]

function houseOf(slots: number[], item: number) {
  const index = slots.indexOf(item)
  return index < 0 ? -1 : index % 4
}

export function clueState(slots: number[], clue: Clue): boolean | null {
  const a = houseOf(slots, clue.a)
  if (a < 0) return null
  if (clue.t === 'at') return a === clue.h
  if (clue.t === 'not') return !clue.hs.includes(a)
  const b = houseOf(slots, clue.b)
  if (b < 0) return null
  if (clue.t === 'same') return a === b
  if (clue.t === 'right') return a === b + 1
  return Math.abs(a - b) === 1
}

/* ---------- 连线 ---------- */

const FLOW_ANSWER = [
  [15, 9, 3, 2, 1, 0, 6, 12, 18],
  [4, 5, 11, 17, 23, 29, 35],
  [13, 7, 8, 9, 10, 16, 22, 28],
]

function flowRound(): FlowRound {
  const n = 6
  const dots = Array.from({ length: n * n }, () => 0)
  FLOW_ANSWER.forEach((path, index) => {
    dots[path[0]] = index + 1
    dots[path[path.length - 1]] = index + 1
  })
  return { kind: 'flow', n, dots, paths: FLOW_ANSWER.map(() => []) }
}

function adjacent(a: number, b: number, n: number) {
  return neighbors4(a, n, n).includes(b)
}

export function flowStart(round: FlowRound, cell: number) {
  const dot = round.dots[cell]
  if (dot) return { color: dot, path: [cell] }
  for (let color = 1; color <= round.paths.length; color += 1) {
    const path = round.paths[color - 1]
    const at = path.indexOf(cell)
    if (at >= 0) return { color, path: path.slice(0, at + 1) }
  }
  return null
}

export function flowLinked(round: FlowRound, color: number, path = round.paths[color - 1]) {
  if (path.length < 2) return false
  const ends = round.dots.map((dot, index) => (dot === color ? index : -1)).filter((index) => index >= 0)
  return ends.includes(path[0]) && ends.includes(path[path.length - 1]) && path[0] !== path[path.length - 1]
}

export function flowExtend(round: FlowRound, color: number, path: number[], cell: number) {
  const last = path[path.length - 1]
  if (cell === last) return null
  const back = path.indexOf(cell)
  if (back >= 0) return path.slice(0, back + 1)
  if (!adjacent(last, cell, round.n)) return null
  if (round.dots[cell] && round.dots[cell] !== color) return null
  if (flowLinked(round, color, path)) return null
  return [...path, cell]
}

/* ---------- 数织 ---------- */

const NONO_ART = [
  '#.....#',
  '##...##',
  '#######',
  '#.#.#.#',
  '#######',
  '.##.##.',
  '..###..',
]

export function lineRuns(line: number[]) {
  const runs: number[] = []
  let count = 0
  line.forEach((cell) => {
    if (cell === 1) count += 1
    else if (count) {
      runs.push(count)
      count = 0
    }
  })
  if (count) runs.push(count)
  return runs
}

function nonoRound(): NonoRound {
  const h = NONO_ART.length
  const w = NONO_ART[0].length
  const art: number[] = []
  NONO_ART.forEach((row) => [...row].forEach((ch) => art.push(ch === '#' ? 1 : 0)))
  const rows = Array.from({ length: h }, (_, r) => lineRuns(art.slice(r * w, r * w + w)))
  const cols = Array.from({ length: w }, (_, c) => lineRuns(Array.from({ length: h }, (_, r) => art[r * w + c])))
  return { kind: 'nono', w, h, cells: art.map(() => 0), art, rows, cols }
}

export function nonoRow(round: NonoRound, r: number) {
  return round.cells.slice(r * round.w, r * round.w + round.w)
}

export function nonoCol(round: NonoRound, c: number) {
  return Array.from({ length: round.h }, (_, r) => round.cells[r * round.w + c])
}

function sameRuns(a: number[], b: number[]) {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

/* ---------- 孔明棋 ---------- */

export const PEG_ROWS = 5
export const PEG_CELLS: Array<[number, number]> = []
for (let r = 0; r < PEG_ROWS; r += 1) for (let k = 0; k <= r; k += 1) PEG_CELLS.push([r, k])

function pegIndex(r: number, k: number) {
  if (r < 0 || r >= PEG_ROWS || k < 0 || k > r) return -1
  return (r * (r + 1)) / 2 + k
}

const PEG_DIRS: Array<[number, number]> = [[0, 1], [0, -1], [1, 0], [1, 1], [-1, 0], [-1, -1]]

export function pegJumps(from: number) {
  const [r, k] = PEG_CELLS[from]
  const out: Array<{ over: number; to: number }> = []
  PEG_DIRS.forEach(([dr, dk]) => {
    const over = pegIndex(r + dr, k + dk)
    const to = pegIndex(r + dr * 2, k + dk * 2)
    if (over >= 0 && to >= 0) out.push({ over, to })
  })
  return out
}

export function pegTargets(round: PegRound, from: number) {
  if (!round.pegs[from]) return []
  return pegJumps(from).filter((jump) => round.pegs[jump.over] && !round.pegs[jump.to])
}

/* ---------- 骑士换位 ---------- */

const KNIGHT_START = [1, 0, 1, 0, 0, 0, 2, 0, 2]
const KNIGHT_GOAL = [2, 0, 2, 0, 0, 0, 1, 0, 1]

export function knightTargets(cells: number[], from: number) {
  if (!cells[from]) return []
  const r = Math.floor(from / 3)
  const c = from % 3
  const out: number[] = []
  ;[[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]].forEach(([dr, dc]) => {
    const rr = r + dr
    const cc = c + dc
    if (rr >= 0 && cc >= 0 && rr < 3 && cc < 3 && !cells[rr * 3 + cc]) out.push(rr * 3 + cc)
  })
  return out
}

/* ---------- 挪车 ---------- */

const PARK_CARS: ParkCar[] = [
  { id: 0, r: 2, c: 0, len: 2, axis: 'h', hero: true },
]

export function carCells(car: ParkCar) {
  return Array.from({ length: car.len }, (_, step) => (car.axis === 'h' ? [car.r, car.c + step] : [car.r + step, car.c]) as [number, number])
}

export function carSlide(round: ParkRound, id: number, dir: Dir) {
  const car = round.cars.find((item) => item.id === id)
  if (!car) return null
  if (car.axis === 'h' && (dir === 'up' || dir === 'down')) return null
  if (car.axis === 'v' && (dir === 'left' || dir === 'right')) return null
  const moved = { ...car, r: car.r + STEP[dir][0], c: car.c + STEP[dir][1] }
  const taken = new Set<string>()
  round.cars.forEach((item) => {
    if (item.id !== id) carCells(item).forEach(([r, c]) => taken.add(`${r},${c}`))
  })
  for (const [r, c] of carCells(moved)) {
    if (r < 0 || c < 0 || r >= round.n || c >= round.n || taken.has(`${r},${c}`)) return null
  }
  return { ...round, cars: round.cars.map((item) => (item.id === id ? moved : item)) }
}

/* ---------- 数独 ---------- */

const SUDOKU_START = [
  0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0,
]

export function sudokuPeers(index: number) {
  const r = Math.floor(index / 6)
  const c = index % 6
  const br = Math.floor(r / 2) * 2
  const bc = Math.floor(c / 3) * 3
  const out = new Set<number>()
  for (let k = 0; k < 6; k += 1) {
    out.add(r * 6 + k)
    out.add(k * 6 + c)
  }
  for (let rr = br; rr < br + 2; rr += 1) for (let cc = bc; cc < bc + 3; cc += 1) out.add(rr * 6 + cc)
  out.delete(index)
  return [...out]
}

export function sudokuClash(cells: number[]) {
  return cells.map((value, index) => !!value && sudokuPeers(index).some((other) => cells[other] === value))
}

export function sudokuSolve(cells: number[], limit = 1): number[][] {
  const found: number[][] = []
  const grid = [...cells]
  const walk = () => {
    if (found.length >= limit) return
    let best = -1
    let options: number[] = []
    for (let index = 0; index < 36; index += 1) {
      if (grid[index]) continue
      const used = new Set(sudokuPeers(index).map((other) => grid[other]))
      const can = [1, 2, 3, 4, 5, 6].filter((value) => !used.has(value))
      if (best < 0 || can.length < options.length) {
        best = index
        options = can
        if (!can.length) return
      }
    }
    if (best < 0) {
      found.push([...grid])
      return
    }
    for (const value of options) {
      grid[best] = value
      walk()
      grid[best] = 0
    }
  }
  walk()
  return found
}

/* ---------- 开局 ---------- */

export function makePuzzle(kind: PuzzleKind): PuzzleRound {
  if (kind === 'ice') return parseIce(ICE_MAP)
  if (kind === 'magic') return { kind, cells: [0, 1, 0, 0, 0, 0, 0, 0, 0], fixed: [false, true, false, false, false, false, false, false, false] }
  if (kind === 'jugs') return { kind, caps: [8, 5, 3], water: [8, 0, 0] }
  if (kind === 'color') return parseColor()
  if (kind === 'laser') return { kind, n: LASER_MAP.length, cells: LASER_MAP.join('').split(''), row: LASER_ROW }
  if (kind === 'match') {
    const lit = matchLit(MATCH_START)
    return { kind, lit, start: [...lit] }
  }
  if (kind === 'spin') return { kind, tiles: [...SPIN_START] }
  if (kind === 'tubes') return { kind, cap: 4, tubes: TUBES_START.map((tube) => [...tube]) }
  if (kind === 'mines') return parseMines()
  if (kind === 'detect') return { kind, slots: Array.from({ length: 8 }, () => 0) }
  if (kind === 'flow') return flowRound()
  if (kind === 'nono') return nonoRound()
  if (kind === 'peg') return { kind, pegs: PEG_CELLS.map((_, index) => index !== 0) }
  if (kind === 'knight') return { kind, cells: [...KNIGHT_START] }
  if (kind === 'park') return { kind, n: 6, exit: 2, cars: PARK_CARS.map((car) => ({ ...car })) }
  return { kind: 'sudoku', cells: [...SUDOKU_START], given: SUDOKU_START.map((value) => value > 0) }
}

/* ---------- 走一步 ---------- */

export function puzzleApply(round: PuzzleRound, move: PuzzleMove): Outcome | string {
  if (round.kind === 'ice' && move.op === 'ice') {
    const stop = iceSlide(round, move.dir)
    if (stop < 0) return 'still'
    const dist = Math.abs(Math.floor(stop / round.w) - Math.floor(round.at / round.w)) + Math.abs((stop % round.w) - (round.at % round.w))
    return { round: { ...round, at: stop }, anim: anim('slide', 4 + dist * 4, round.at, stop), delay: 260 + dist * 80 }
  }
  if (round.kind === 'magic' && move.op === 'place') {
    const next = placeCells(round.cells, round.fixed, move, () => true)
    if (typeof next === 'string') return next
    return { round: { ...round, cells: next }, anim: anim('pop', 12, move.to), delay: 420 }
  }
  if (round.kind === 'detect' && move.op === 'place') {
    const next = placeCells(round.slots, round.slots.map(() => false), move, (value, slot) => (value <= 4) === (slot < 4))
    if (typeof next === 'string') return next
    return { round: { ...round, slots: next }, anim: anim('pop', 12, move.to), delay: 460 }
  }
  if (round.kind === 'jugs' && move.op === 'pour') {
    if (move.from === move.to) return 'still'
    const amount = Math.min(round.water[move.from], round.caps[move.to] - round.water[move.to])
    if (amount <= 0) return round.water[move.from] ? 'full' : 'empty'
    const water = [...round.water]
    water[move.from] -= amount
    water[move.to] += amount
    return { round: { ...round, water }, anim: anim('pour', 34, move.from, move.to, amount, { prev: round.water }), delay: 820 }
  }
  if (round.kind === 'tubes' && move.op === 'pour') {
    const poured = tubePour(round, move.from, move.to)
    if (!poured) return 'mix'
    return { round: { ...round, tubes: poured.tubes }, anim: anim('pour', 30, move.from, move.to, poured.color, { list: [poured.count] }), delay: 760 }
  }
  if (round.kind === 'color' && move.op === 'paint') {
    if (round.fixed[move.cell]) return 'fixed'
    const paint = [...round.paint]
    paint[move.cell] = move.value
    return { round: { ...round, paint }, anim: anim('fill', 16, move.cell), delay: 380 }
  }
  if (round.kind === 'nono' && move.op === 'paint') {
    if (round.cells[move.cell] === move.value) return 'still'
    const cells = [...round.cells]
    cells[move.cell] = move.value
    return { round: { ...round, cells }, anim: anim('pop', 8, move.cell), delay: 120 }
  }
  if (round.kind === 'sudoku' && move.op === 'paint') {
    if (round.given[move.cell]) return 'fixed'
    const cells = [...round.cells]
    cells[move.cell] = move.value
    return { round: { ...round, cells }, anim: anim('pop', 12, move.cell), delay: 300 }
  }
  if (round.kind === 'laser' && move.op === 'mirror') {
    const ch = round.cells[move.index]
    if (ch !== '/' && ch !== '\\') return 'still'
    const cells = [...round.cells]
    cells[move.index] = ch === '/' ? '\\' : '/'
    return { round: { ...round, cells }, anim: anim('beam', 26, move.index), delay: 560 }
  }
  if (round.kind === 'match' && move.op === 'stick') {
    if (!round.lit[move.from] || round.lit[move.to] || move.from === move.to) return 'stick'
    const lit = [...round.lit]
    lit[move.from] = false
    lit[move.to] = true
    return { round: { ...round, lit }, anim: anim('stick', 22, move.from, move.to), delay: 640 }
  }
  if (round.kind === 'spin' && move.op === 'spin') {
    return { round: { ...round, tiles: spinTurn(round.tiles, move.index) }, anim: anim('spin', 16, move.index), delay: 480 }
  }
  if (round.kind === 'mines' && move.op === 'dig') {
    if (round.open[move.cell] || round.flag[move.cell]) return 'still'
    if (round.mine[move.cell]) return 'boom'
    const result = flood(round, move.cell)
    return { round: { ...round, open: result.open }, anim: anim('dig', 18, move.cell, -1, -1, { list: result.opened }), delay: 340 }
  }
  if (round.kind === 'mines' && move.op === 'flag') {
    if (round.open[move.cell]) return 'still'
    const flag = [...round.flag]
    flag[move.cell] = !flag[move.cell]
    return { round: { ...round, flag }, anim: anim('pop', 10, move.cell), delay: 240 }
  }
  if (round.kind === 'flow' && move.op === 'flow') {
    const path = move.path
    for (let index = 1; index < path.length; index += 1) if (!adjacent(path[index - 1], path[index], round.n)) return 'flow'
    if (!path.length || round.dots[path[0]] !== move.color) return 'flow'
    if (new Set(path).size !== path.length) return 'flow'
    if (path.some((cell) => round.dots[cell] && round.dots[cell] !== move.color)) return 'flow'
    const taken = new Set(path)
    const paths = round.paths.map((other, index) => {
      if (index === move.color - 1) return [...path]
      const cut = other.findIndex((cell) => taken.has(cell))
      return cut < 0 ? other : other.slice(0, cut)
    })
    const next = { ...round, paths }
    const linked = flowLinked(next, move.color) && !flowLinked(round, move.color)
    return { round: next, anim: linked ? anim('link', 24, move.color) : null, delay: 520 }
  }
  if (round.kind === 'peg' && move.op === 'jump') {
    const jump = pegTargets(round, move.from).find((item) => item.to === move.to)
    if (!jump) return 'peg'
    const pegs = [...round.pegs]
    pegs[move.from] = false
    pegs[jump.over] = false
    pegs[move.to] = true
    return { round: { ...round, pegs }, anim: anim('jump', 18, move.from, move.to, jump.over), delay: 560 }
  }
  if (round.kind === 'knight' && move.op === 'jump') {
    if (!knightTargets(round.cells, move.from).includes(move.to)) return 'knight'
    const cells = [...round.cells]
    cells[move.to] = cells[move.from]
    cells[move.from] = 0
    return { round: { ...round, cells }, anim: anim('jump', 16, move.from, move.to), delay: 520 }
  }
  if (round.kind === 'park' && move.op === 'car') {
    const next = carSlide(round, move.id, move.dir)
    if (!next) return 'wall'
    return { round: next, anim: null, delay: 220 }
  }
  return 'still'
}

export function puzzleWon(round: PuzzleRound) {
  if (round.kind === 'ice') return round.at === round.goal
  if (round.kind === 'magic') return round.cells.every((value) => value > 0) && MAGIC_LINES.every((line) => magicSum(round.cells, line) === 15)
  if (round.kind === 'jugs') return round.water[0] === 4 && round.water[1] === 4
  if (round.kind === 'color') return round.paint.every((value) => value > 0) && !colorClash(round).length
  if (round.kind === 'laser') return laserLit(round).filter(Boolean).length === round.cells.filter((ch) => ch === '*').length
  if (round.kind === 'match') return matchMoved(round) === 1 && matchTrue(round.lit)
  if (round.kind === 'spin') return round.tiles.every((tile, index) => tile === index)
  if (round.kind === 'tubes') return tubesDone(round)
  if (round.kind === 'mines') return round.mine.every((mine, index) => mine || round.open[index])
  if (round.kind === 'detect') return round.slots.every((value, index) => value === DETECT_SOLUTION[index])
  if (round.kind === 'flow') return round.paths.every((_, index) => flowLinked(round, index + 1)) && round.paths.flat().length === round.n * round.n
  if (round.kind === 'nono') {
    for (let r = 0; r < round.h; r += 1) if (!sameRuns(lineRuns(nonoRow(round, r)), round.rows[r])) return false
    for (let c = 0; c < round.w; c += 1) if (!sameRuns(lineRuns(nonoCol(round, c)), round.cols[c])) return false
    return true
  }
  if (round.kind === 'peg') return round.pegs.filter(Boolean).length === 1
  if (round.kind === 'knight') return round.cells.every((value, index) => value === KNIGHT_GOAL[index])
  if (round.kind === 'park') {
    const hero = round.cars.find((car) => car.hero)
    return !!hero && hero.r === round.exit && hero.c + hero.len === round.n
  }
  return round.cells.every((value) => value > 0) && !sudokuClash(round.cells).some(Boolean)
}

/* ---------- 看答案 ---------- */

function bfsApply(start: PuzzleRound, key: (round: PuzzleRound) => string, moves: (round: PuzzleRound) => PuzzleMove[], limit?: number) {
  return bfs(start, key, puzzleWon, (round) => {
    const out: Array<[PuzzleMove, PuzzleRound]> = []
    moves(round).forEach((move) => {
      const result = puzzleApply(round, move)
      if (typeof result !== 'string') out.push([move, result.round])
    })
    return out
  }, limit)
}

function colorSolve(round: ColorRound) {
  const links = colorLinks(round)
  const paint = [...round.paint]
  const ok = (region: number) => links.every(([a, b]) => !(a === region || b === region) || !paint[a] || !paint[b] || paint[a] !== paint[b])
  const walk = (region: number): boolean => {
    if (region >= paint.length) return true
    if (round.fixed[region]) return walk(region + 1)
    for (let value = 1; value <= 3; value += 1) {
      paint[region] = value
      if (ok(region) && walk(region + 1)) return true
    }
    paint[region] = 0
    return false
  }
  return walk(0) ? paint : []
}

function pegSolve(round: PegRound): PuzzleMove[] {
  const failed = new Set<string>()
  const moves: PuzzleMove[] = []
  const walk = (pegs: boolean[]): boolean => {
    if (pegs.filter(Boolean).length === 1) return true
    const mark = pegs.map((on) => (on ? 1 : 0)).join('')
    if (failed.has(mark)) return false
    for (let from = 0; from < pegs.length; from += 1) {
      for (const jump of pegTargets({ kind: 'peg', pegs }, from)) {
        const next = [...pegs]
        next[from] = false
        next[jump.over] = false
        next[jump.to] = true
        moves.push({ op: 'jump', from, to: jump.to })
        if (walk(next)) return true
        moves.pop()
      }
    }
    failed.add(mark)
    return false
  }
  return walk(round.pegs) ? moves : []
}

export function puzzleSolve(round: PuzzleRound): PuzzleMove[] {
  if (round.kind === 'ice') return bfsApply(round, (item) => String((item as IceRound).at), () => DIRS.map((dir) => ({ op: 'ice', dir })))
  if (round.kind === 'magic') return MAGIC_ANSWER.map((value, to) => ({ op: 'place' as const, value, from: -1, to })).filter((move) => !round.fixed[move.to])
  if (round.kind === 'jugs') {
    const pours: PuzzleMove[] = []
    for (let from = 0; from < 3; from += 1) for (let to = 0; to < 3; to += 1) if (from !== to) pours.push({ op: 'pour', from, to })
    return bfsApply(round, (item) => (item as JugsRound).water.join(','), () => pours)
  }
  if (round.kind === 'color') {
    const paint = colorSolve(round)
    return paint.map((value, cell) => ({ op: 'paint' as const, cell, value })).filter((move) => !round.fixed[move.cell])
  }
  if (round.kind === 'laser') {
    const mirrors = round.cells.map((ch, index) => (ch === '/' || ch === '\\' ? index : -1)).filter((index) => index >= 0)
    return bfsApply(round, (item) => (item as LaserRound).cells.join(''), () => mirrors.map((index) => ({ op: 'mirror', index })))
  }
  if (round.kind === 'match') {
    for (let from = 0; from < 22; from += 1) {
      for (let to = 0; to < 22; to += 1) {
        const result = puzzleApply(round, { op: 'stick', from, to })
        if (typeof result !== 'string' && puzzleWon(result.round)) return [{ op: 'stick', from, to }]
      }
    }
    return []
  }
  if (round.kind === 'spin') return bfsApply(round, (item) => (item as SpinRound).tiles.join(''), () => [0, 1, 2, 3].map((index) => ({ op: 'spin', index })))
  if (round.kind === 'tubes') {
    const pours: PuzzleMove[] = []
    round.tubes.forEach((_, from) => round.tubes.forEach((__, to) => { if (from !== to) pours.push({ op: 'pour', from, to }) }))
    return bfsApply(round, (item) => (item as TubesRound).tubes.map((tube) => tube.join('')).join('|'), () => pours)
  }
  if (round.kind === 'mines') {
    const moves: PuzzleMove[] = []
    let sim: MinesRound = round
    sim.mine.forEach((mine, cell) => {
      if (mine || sim.open[cell]) return
      const result = puzzleApply(sim, { op: 'dig', cell })
      if (typeof result === 'string') return
      sim = result.round as MinesRound
      moves.push({ op: 'dig', cell })
    })
    return moves
  }
  if (round.kind === 'detect') return DETECT_SOLUTION.map((value, to) => ({ op: 'place' as const, value, from: -1, to }))
  if (round.kind === 'flow') return FLOW_ANSWER.map((path, index) => ({ op: 'flow' as const, color: index + 1, path: [...path] }))
  if (round.kind === 'nono') return round.art.map((value, cell) => ({ op: 'paint' as const, cell, value })).filter((move) => move.value === 1)
  if (round.kind === 'peg') return pegSolve(round)
  if (round.kind === 'knight') {
    return bfsApply(round, (item) => (item as KnightRound).cells.join(''), (item) => {
      const cells = (item as KnightRound).cells
      const out: PuzzleMove[] = []
      cells.forEach((_, from) => knightTargets(cells, from).forEach((to) => out.push({ op: 'jump', from, to })))
      return out
    })
  }
  if (round.kind === 'park') {
    return bfsApply(round, (item) => (item as ParkRound).cars.map((car) => `${car.r}${car.c}`).join(''), (item) => {
      const out: PuzzleMove[] = []
      ;(item as ParkRound).cars.forEach((car) => DIRS.forEach((dir) => out.push({ op: 'car', id: car.id, dir })))
      return out
    })
  }
  const solved = sudokuSolve(round.cells)[0]
  if (!solved) return []
  return solved.map((value, cell) => ({ op: 'paint' as const, cell, value })).filter((move) => !round.given[move.cell])
}

export function failAnim(move: PuzzleMove, code: string): Anim | null {
  if (code === 'boom' && move.op === 'dig') return anim('boom', 40, move.cell)
  if (code === 'mix' && move.op === 'pour') return anim('nope', 18, move.from, move.to)
  if ((code === 'peg' || code === 'knight') && move.op === 'jump') return anim('nope', 18, move.from, move.to)
  return null
}
