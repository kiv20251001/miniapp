/** 动手解谜。局面是原创小棋盘，规则在这里，页面只负责手势。 */

import {
  applyMore,
  makeMoreRound,
  moreWon,
  solveMore,
  type MoreMove,
  type MoreRound,
} from './more'

export type Kind =
  | 'frog'
  | 'river'
  | 'lights'
  | 'pipes'
  | 'trace'
  | 'cage'
  | 'scale'
  | 'box'
  | 'slide'
  | 'klotski'
  | 'hanoi'
  | 'flow'
  | 'peg'
  | 'match'
  | 'pack'
  | 'bridge'
  | 'tilt'
  | 'sky'
  | 'knight'
  | 'queen'
  | 'code'
  | 'akari'
  | 'domino'
  | 'gear'
  | 'slither'
  | 'mine'
  | 'cipher'
export type Dir = 'up' | 'down' | 'left' | 'right'
export type FrogPad = 'L' | 'R' | '.'
export type Stage = { id: string; kind: Kind; name: string }

export const STAGES: Stage[] = [
  { id: 'frog2', kind: 'frog', name: '青蛙' },
  { id: 'fox', kind: 'river', name: '过河' },
  { id: 'lamp1', kind: 'lights', name: '关灯' },
  { id: 'pipe', kind: 'pipes', name: '水管' },
  { id: 'cage', kind: 'cage', name: '鸡兔同笼' },
  { id: 'frog3', kind: 'frog', name: '青蛙' },
  { id: 'family', kind: 'river', name: '过河' },
  { id: 'scale', kind: 'scale', name: '天平' },
  { id: 'box', kind: 'box', name: '推箱子' },
  { id: 'lamp2', kind: 'lights', name: '关灯' },
  { id: 'slide', kind: 'slide', name: '滑块' },
  { id: 'klot', kind: 'klotski', name: '华容道' },
  { id: 'hanoi', kind: 'hanoi', name: '汉诺塔' },
  { id: 'house', kind: 'trace', name: '一笔画' },
  { id: 'flow-a', kind: 'flow', name: '连线' },
  { id: 'peg-a', kind: 'peg', name: '跳子' },
  { id: 'match-a', kind: 'match', name: '火柴' },
  { id: 'pack-a', kind: 'pack', name: '拼板' },
  { id: 'bridge-a', kind: 'bridge', name: '造桥' },
  { id: 'tilt-a', kind: 'tilt', name: '滚珠' },
  { id: 'sky-a', kind: 'sky', name: '摩天楼' },
  { id: 'knight-a', kind: 'knight', name: '马步' },
  { id: 'queen-a', kind: 'queen', name: '皇后' },
  { id: 'code-a', kind: 'code', name: '破译' },
  { id: 'akari-a', kind: 'akari', name: '点灯' },
  { id: 'domino-a', kind: 'domino', name: '骨牌' },
  { id: 'gear-a', kind: 'gear', name: '齿轮' },
  { id: 'slither-a', kind: 'slither', name: '围栏' },
  { id: 'mine-a', kind: 'mine', name: '扫雷' },
  { id: 'cipher-a', kind: 'cipher', name: '密码盘' },
]

export type FrogRound = { kind: 'frog'; pads: FrogPad[]; goal: FrogPad[] }
export type Rider = { id: string; w: number; side: 0 | 1 }
export type RiverRound = {
  kind: 'river'
  riders: Rider[]
  boat: 0 | 1
  aboard: string[]
  cap: number
  guard: string
  rowers: string[]
  eats: Array<[string, string]>
}
export type LightsRound = { kind: 'lights'; on: number[]; n: number }
export type PipeTile = { base: number; rot: number; lock: boolean }
export type PipesRound = { kind: 'pipes'; tiles: PipeTile[]; cols: number; sink: number }
export type TraceRound = { kind: 'trace'; nodes: Array<{ x: number; y: number }>; edges: Array<[number, number]>; path: number[]; used: string[]; oddStart: boolean }
export type CageWho = 'hen' | 'rabbit'
export type CageRound = { kind: 'cage'; hens: number; rabbits: number; heads: number; feet: number }
export type Weighing = { left: number[]; right: number[]; result: 'L' | 'R' | '=' }
export type ScaleRound = { kind: 'scale'; weights: number[]; heavy: number; left: number[]; right: number[]; limit: number; used: number; log: Weighing[] }
export type BoxRound = { kind: 'box'; w: number; h: number; walls: boolean[]; goals: boolean[]; boxes: boolean[]; player: number }
export type SlideRound = { kind: 'slide'; tiles: number[] }
export type Block = { id: number; r: number; c: number; h: number; w: number; role: 'hero' | 'wall' }
export type KlotskiRound = { kind: 'klotski'; rows: number; cols: number; blocks: Block[]; goal: { r: number; c: number } }
export type HanoiRound = { kind: 'hanoi'; pegs: number[][] }

export type Round = FrogRound | RiverRound | LightsRound | PipesRound | TraceRound | CageRound | ScaleRound | BoxRound | SlideRound | KlotskiRound | HanoiRound | MoreRound

const HOUSE = {
  nodes: [{ x: 50, y: 14 }, { x: 18, y: 42 }, { x: 82, y: 42 }, { x: 18, y: 84 }, { x: 82, y: 84 }],
  edges: [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4], [3, 4], [3, 2]] as Array<[number, number]>,
}

function pipes(): PipeTile[] {
  const bases = [2, 10, 12, 6, 10, 9, 3, 10, 8]
  const turns = [0, 1, 2, 3, 1, 2, 1, 3, 0]
  return bases.map((base, index) => ({ base, rot: turns[index], lock: index === 0 || index === 8 }))
}

function parseBox(rows: string[]): BoxRound {
  const h = rows.length
  const w = rows[0].length
  const walls: boolean[] = []
  const goals: boolean[] = []
  const boxes: boolean[] = []
  let player = 0
  rows.forEach((row, r) => {
    ;[...row].forEach((ch, c) => {
      const index = r * w + c
      walls[index] = ch === '#'
      goals[index] = ch === '.' || ch === '+' || ch === '*'
      boxes[index] = ch === '$' || ch === '*'
      if (ch === '@' || ch === '+') player = index
    })
  })
  return { kind: 'box', w, h, walls, goals, boxes, player }
}

export function makeRound(index: number): Round {
  const stage = STAGES[index] ?? STAGES[0]
  if (stage.id === 'frog2') return { kind: 'frog', pads: ['L', 'L', '.', 'R', 'R'], goal: ['R', 'R', '.', 'L', 'L'] }
  if (stage.id === 'frog3') return { kind: 'frog', pads: ['L', 'L', 'L', '.', 'R', 'R', 'R'], goal: ['R', 'R', 'R', '.', 'L', 'L', 'L'] }
  if (stage.id === 'fox') {
    return {
      kind: 'river',
      riders: [
        { id: 'me', w: 1, side: 0 },
        { id: 'fox', w: 1, side: 0 },
        { id: 'hen', w: 1, side: 0 },
        { id: 'rice', w: 1, side: 0 },
      ],
      boat: 0,
      aboard: [],
      cap: 2,
      guard: 'me',
      rowers: ['me'],
      eats: [['fox', 'hen'], ['hen', 'rice']],
    }
  }
  if (stage.id === 'family') {
    return {
      kind: 'river',
      riders: [
        { id: 'dad', w: 2, side: 0 },
        { id: 'mom', w: 2, side: 0 },
        { id: 'bro', w: 1, side: 0 },
        { id: 'sis', w: 1, side: 0 },
      ],
      boat: 0,
      aboard: [],
      cap: 2,
      guard: '',
      rowers: [],
      eats: [],
    }
  }
  if (stage.id === 'lamp1') return { kind: 'lights', on: [1, 1, 0, 1, 0, 1, 0, 1, 1], n: 3 }
  if (stage.id === 'lamp2') return { kind: 'lights', on: [1, 1, 1, 1, 1, 0, 1, 0, 0], n: 3 }
  if (stage.id === 'pipe') return { kind: 'pipes', tiles: pipes(), cols: 3, sink: 8 }
  if (stage.id === 'cage') return { kind: 'cage', hens: 0, rabbits: 0, heads: 35, feet: 94 }
  if (stage.id === 'house') {
    return { kind: 'trace', nodes: HOUSE.nodes.map((node) => ({ ...node })), edges: HOUSE.edges.map((edge) => [...edge] as [number, number]), path: [], used: [], oddStart: true }
  }
  if (stage.id === 'scale') return { kind: 'scale', weights: [1, 1, 1, 1, 1, 1, 1, 2, 1], heavy: 7, left: [], right: [], limit: 2, used: 0, log: [] }
  if (stage.id === 'box') {
    return parseBox(['########', '#@ #   #', '# $# $ #', '#  $ . #', '# . #. #', '#      #', '########'])
  }
  if (stage.id === 'slide') return { kind: 'slide', tiles: [0, 7, 2, 4, 5, 6, 8, 3, 1] }
  if (stage.id === 'hanoi') return { kind: 'hanoi', pegs: [[5, 4, 3, 2, 1], [], []] }
  if (stage.id === 'klot' || stage.kind === 'klotski') {
    return {
      kind: 'klotski',
      rows: 4,
      cols: 4,
      goal: { r: 2, c: 1 },
      blocks: [
        { id: 0, r: 0, c: 0, h: 2, w: 2, role: 'hero' },
        { id: 1, r: 0, c: 2, h: 2, w: 1, role: 'wall' },
        { id: 2, r: 0, c: 3, h: 2, w: 1, role: 'wall' },
        { id: 3, r: 2, c: 0, h: 1, w: 1, role: 'wall' },
        { id: 4, r: 2, c: 1, h: 1, w: 2, role: 'wall' },
        { id: 5, r: 3, c: 3, h: 1, w: 1, role: 'wall' },
      ],
    }
  }
  const more = makeMoreRound(stage.id)
  if (more) return more
  return { kind: 'hanoi', pegs: [[4, 3, 2, 1], [], []] }
}

export function frogTargets(pads: FrogPad[], index: number) {
  const dir = pads[index] === 'L' ? 1 : pads[index] === 'R' ? -1 : 0
  if (!dir) return []
  const step = index + dir
  const jump = index + dir * 2
  if (step < 0 || step >= pads.length) return []
  if (pads[step] === '.') return [step]
  if (jump >= 0 && jump < pads.length && pads[jump] === '.') return [jump]
  return []
}

export function frogMove(pads: FrogPad[], from: number, to: number) {
  if (!frogTargets(pads, from).includes(to)) return null
  const next = [...pads]
  next[to] = next[from]
  next[from] = '.'
  return next
}

export function frogWon(round: FrogRound) {
  return round.pads.every((pad, index) => pad === round.goal[index])
}

export function riverGroup(round: RiverRound, bank: 0 | 1) {
  return round.riders.filter((rider) => (round.aboard.includes(rider.id) ? round.boat : rider.side) === bank).map((rider) => rider.id)
}

export function riverThreat(round: RiverRound) {
  if (!round.guard) return ''
  for (const bank of [0, 1] as const) {
    const group = riverGroup(round, bank)
    if (group.includes(round.guard)) continue
    for (const [hunter, prey] of round.eats) {
      if (group.includes(hunter) && group.includes(prey)) return hunter
    }
  }
  return ''
}

export function riverWon(round: RiverRound) {
  return riverGroup(round, 0).length === 0
}

export function boardRider(round: RiverRound, id: string): RiverRound | 'heavy' | 'away' {
  const rider = round.riders.find((item) => item.id === id)
  if (!rider) return 'away'
  if (round.aboard.includes(id)) {
    return {
      ...round,
      aboard: round.aboard.filter((item) => item !== id),
      riders: round.riders.map((item) => item.id === id ? { ...item, side: round.boat } : item),
    }
  }
  if (rider.side !== round.boat) return 'away'
  const weight = round.aboard.reduce((sum, item) => sum + (round.riders.find((rider) => rider.id === item)?.w ?? 0), 0)
  if (weight + rider.w > round.cap) return 'heavy'
  return { ...round, aboard: [...round.aboard, id] }
}

export function crossRiver(round: RiverRound): RiverRound | 'empty' | 'rower' | 'fox' | 'hen' {
  if (!round.aboard.length) return 'empty'
  if (round.rowers.length && !round.aboard.some((id) => round.rowers.includes(id))) return 'rower'
  const boat = (round.boat ^ 1) as 0 | 1
  const next: RiverRound = {
    ...round,
    boat,
    riders: round.riders.map((rider) => round.aboard.includes(rider.id) ? { ...rider, side: boat } : rider),
  }
  const threat = riverThreat(next)
  if (threat) return threat === 'fox' ? 'fox' : 'hen'
  return next
}

export function lightTap(on: number[], index: number, n: number) {
  const next = [...on]
  const row = Math.floor(index / n)
  const col = index % n
  const flip = (r: number, c: number) => {
    if (r < 0 || c < 0 || r >= n || c >= n) return
    const at = r * n + c
    next[at] = next[at] ? 0 : 1
  }
  flip(row, col)
  flip(row - 1, col)
  flip(row + 1, col)
  flip(row, col - 1)
  flip(row, col + 1)
  return next
}

export function lightsOut(on: number[]) {
  return on.every((cell) => !cell)
}

export function pipeMask(tile: PipeTile) {
  let mask = tile.base
  for (let turn = 0; turn < tile.rot % 4; turn += 1) mask = ((mask << 1) & 15) | ((mask & 8) >> 3)
  return mask
}

export function pipeFlow(round: PipesRound) {
  const open = round.tiles.map((tile) => pipeMask(tile))
  const seen = new Set([0])
  const queue = [0]
  const dirs: Array<[number, number]> = [[1, -round.cols], [2, 1], [4, round.cols], [8, -1]]
  while (queue.length) {
    const index = queue.shift() ?? 0
    const row = Math.floor(index / round.cols)
    const col = index % round.cols
    for (const [bit, delta] of dirs) {
      if ((open[index] & bit) === 0) continue
      const next = index + delta
      if (next < 0 || next >= round.tiles.length) continue
      const nextRow = Math.floor(next / round.cols)
      const nextCol = next % round.cols
      if (Math.abs(nextRow - row) + Math.abs(nextCol - col) !== 1) continue
      const back = bit === 1 ? 4 : bit === 2 ? 8 : bit === 4 ? 1 : 2
      if ((open[next] & back) === 0 || seen.has(next)) continue
      seen.add(next)
      queue.push(next)
    }
  }
  return seen
}

export function pipeWon(round: PipesRound) {
  return pipeFlow(round).has(round.sink)
}

export function edgeKey(a: number, b: number) {
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

export function traceDegree(round: TraceRound, node: number) {
  return round.edges.filter((edge) => edge[0] === node || edge[1] === node).length
}

export function traceWon(round: TraceRound) {
  return round.used.length === round.edges.length
}

export function cageStep(round: CageRound, who: CageWho, delta: number): CageRound | 'cage-none' | 'cage-full' {
  const count = who === 'hen' ? round.hens : round.rabbits
  const next = count + delta
  if (next < 0) return 'cage-none'
  if (next > 40) return 'cage-full'
  return who === 'hen' ? { ...round, hens: next } : { ...round, rabbits: next }
}

export function cageWon(round: CageRound) {
  return round.hens + round.rabbits === round.heads && round.hens * 2 + round.rabbits * 4 === round.feet
}

export function weigh(round: ScaleRound): 'L' | 'R' | '=' | 'same' | 'limit' {
  if (round.used >= round.limit) return 'limit'
  if (!round.left.length || round.left.length !== round.right.length) return 'same'
  const sum = (ids: number[]) => ids.reduce((total, id) => total + round.weights[id], 0)
  const left = sum(round.left)
  const right = sum(round.right)
  return left === right ? '=' : left > right ? 'L' : 'R'
}

export function boxStep(round: BoxRound, dir: Dir) {
  const delta = dir === 'left' ? -1 : dir === 'right' ? 1 : dir === 'up' ? -round.w : round.w
  const next = round.player + delta
  const row = Math.floor(round.player / round.w)
  const col = round.player % round.w
  const nextRow = Math.floor(next / round.w)
  const nextCol = next % round.w
  if (next < 0 || next >= round.walls.length || Math.abs(nextRow - row) + Math.abs(nextCol - col) !== 1) return null
  if (round.walls[next]) return null
  const boxes = [...round.boxes]
  if (boxes[next]) {
    const dest = next + delta
    const destRow = Math.floor(dest / round.w)
    const destCol = dest % round.w
    if (dest < 0 || dest >= round.walls.length || Math.abs(destRow - nextRow) + Math.abs(destCol - nextCol) !== 1) return null
    if (round.walls[dest] || boxes[dest]) return null
    boxes[dest] = true
    boxes[next] = false
  }
  return { ...round, boxes, player: next }
}

export function boxWon(round: BoxRound) {
  return round.goals.every((goal, index) => !goal || round.boxes[index])
}

export function slidePull(tiles: number[], index: number) {
  const n = Math.round(Math.sqrt(tiles.length))
  const empty = tiles.indexOf(0)
  const row = Math.floor(index / n)
  const col = index % n
  const emptyRow = Math.floor(empty / n)
  const emptyCol = empty % n
  if (Math.abs(row - emptyRow) + Math.abs(col - emptyCol) !== 1) return null
  const next = [...tiles]
  next[empty] = next[index]
  next[index] = 0
  return next
}

export function slideWon(tiles: number[]) {
  return tiles.every((tile, index) => tile === (index === 8 ? 0 : index + 1))
}

function occupies(block: Block) {
  const cells: Array<[number, number]> = []
  for (let row = 0; row < block.h; row += 1) {
    for (let col = 0; col < block.w; col += 1) cells.push([block.r + row, block.c + col])
  }
  return cells
}

export function canSlide(round: KlotskiRound, id: number, dir: Dir) {
  const block = round.blocks.find((item) => item.id === id)
  if (!block) return false
  const dr = dir === 'up' ? -1 : dir === 'down' ? 1 : 0
  const dc = dir === 'left' ? -1 : dir === 'right' ? 1 : 0
  const next = { ...block, r: block.r + dr, c: block.c + dc }
  if (next.r < 0 || next.c < 0 || next.r + next.h > round.rows || next.c + next.w > round.cols) return false
  const taken = new Set(round.blocks.filter((item) => item.id !== id).flatMap((item) => occupies(item).map(([row, col]) => `${row},${col}`)))
  return occupies(next).every(([row, col]) => !taken.has(`${row},${col}`))
}

export function klotskiWon(round: KlotskiRound) {
  const hero = round.blocks.find((block) => block.role === 'hero')
  return !!hero && hero.r === round.goal.r && hero.c === round.goal.c
}

export function canDrop(pegs: number[][], from: number, to: number) {
  if (from === to) return true
  const disk = pegs[from][pegs[from].length - 1]
  const top = pegs[to][pegs[to].length - 1]
  return disk !== undefined && (top === undefined || disk < top)
}

export function hanoiWon(pegs: number[][]) {
  const n = pegs.reduce((sum, peg) => sum + peg.length, 0)
  const goal = pegs[2]
  return goal.length === n && goal.every((disk, index) => disk === n - index)
}

export type Move =
  | { op: 'frog'; from: number; to: number }
  | { op: 'board'; id: string }
  | { op: 'cross' }
  | { op: 'light'; index: number }
  | { op: 'pipe'; index: number }
  | { op: 'trace'; node: number }
  | { op: 'cage'; who: CageWho; delta: number }
  | { op: 'pan'; id: number; zone: 'left' | 'right' | 'tray' }
  | { op: 'weigh' }
  | { op: 'accuse'; id: number }
  | { op: 'box'; dir: Dir }
  | { op: 'slide'; index: number }
  | { op: 'klot'; id: number; dir: Dir }
  | { op: 'hanoi'; from: number; to: number }
  | MoreMove

function cloneRound<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function pathFrom<T>(goal: string, start: string, prev: Map<string, { from: string; move: Move }>) {
  const moves: Move[] = []
  let cursor = goal
  while (cursor !== start) {
    const item = prev.get(cursor)
    if (!item) break
    moves.push(item.move)
    cursor = item.from
  }
  return moves.reverse()
}

function solveFrog(start: FrogRound): Move[] {
  const key = (pads: FrogPad[]) => pads.join('')
  const root = key(start.pads)
  const queue = [start.pads]
  const prev = new Map<string, { from: string; move: Move }>()
  const seen = new Set([root])
  while (queue.length) {
    const pads = queue.shift() ?? []
    const here = key(pads)
    if (pads.every((pad, index) => pad === start.goal[index])) return pathFrom(here, root, prev)
    pads.forEach((pad, from) => {
      if (pad === '.') return
      frogTargets(pads, from).forEach((to) => {
        const next = frogMove(pads, from, to)
        if (!next) return
        const mark = key(next)
        if (seen.has(mark)) return
        seen.add(mark)
        prev.set(mark, { from: here, move: { op: 'frog', from, to } })
        queue.push(next)
      })
    })
  }
  return []
}

function solveRiver(start: RiverRound): Move[] {
  const ids = start.riders.map((rider) => rider.id)
  const key = (round: RiverRound) => `${round.boat}|${[...round.aboard].sort().join(',')}|${ids.map((id) => round.riders.find((rider) => rider.id === id)?.side ?? 0).join('')}`
  const root = key(start)
  const queue = [cloneRound(start)]
  const prev = new Map<string, { from: string; move: Move }>()
  const seen = new Set([root])
  while (queue.length) {
    const round = queue.shift() ?? start
    const here = key(round)
    if (riverWon(round) && !round.aboard.length) return pathFrom(here, root, prev)
    ids.forEach((id) => {
      const next = boardRider(round, id)
      if (typeof next === 'string') return
      const mark = key(next)
      if (seen.has(mark)) return
      seen.add(mark)
      prev.set(mark, { from: here, move: { op: 'board', id } })
      queue.push(next)
    })
    const crossed = crossRiver(round)
    if (typeof crossed !== 'string') {
      const mark = key(crossed)
      if (!seen.has(mark)) {
        seen.add(mark)
        prev.set(mark, { from: here, move: { op: 'cross' } })
        queue.push(crossed)
      }
    }
  }
  return []
}

function solveLights(start: LightsRound): Move[] {
  const key = (on: number[]) => on.join('')
  const root = key(start.on)
  const queue = [start.on]
  const prev = new Map<string, { from: string; move: Move }>()
  const seen = new Set([root])
  while (queue.length) {
    const on = queue.shift() ?? []
    const here = key(on)
    if (lightsOut(on)) return pathFrom(here, root, prev)
    on.forEach((_, index) => {
      const next = lightTap(on, index, start.n)
      const mark = key(next)
      if (seen.has(mark)) return
      seen.add(mark)
      prev.set(mark, { from: here, move: { op: 'light', index } })
      queue.push(next)
    })
  }
  return []
}

function solvePipes(start: PipesRound): Move[] {
  const moves: Move[] = []
  start.tiles.forEach((tile, index) => {
    if (tile.lock) return
    const taps = (4 - (tile.rot % 4)) % 4
    for (let step = 0; step < taps; step += 1) moves.push({ op: 'pipe', index })
  })
  return moves
}

function solveCage(start: CageRound): Move[] {
  const rabbits = (start.feet - start.heads * 2) / 2
  const hens = start.heads - rabbits
  const moves: Move[] = []
  for (let count = start.hens; count < hens; count += 1) moves.push({ op: 'cage', who: 'hen', delta: 1 })
  for (let count = start.rabbits; count < rabbits; count += 1) moves.push({ op: 'cage', who: 'rabbit', delta: 1 })
  return moves
}

function solveTrace(start: TraceRound): Move[] {
  const nodes = start.oddStart ? [1, 0, 2, 4, 3, 1, 2, 3] : [0, 2, 4, 1, 3, 0]
  return nodes.map((node) => ({ op: 'trace' as const, node }))
}

function solveScale(start: ScaleRound): Move[] {
  const put = (id: number, zone: 'left' | 'right' | 'tray'): Move => ({ op: 'pan', id, zone })
  const sum = (ids: number[]) => ids.reduce((total, id) => total + start.weights[id], 0)
  const moves: Move[] = []
  const weigh = (left: number[], right: number[]) => {
    left.forEach((id) => moves.push(put(id, 'left')))
    right.forEach((id) => moves.push(put(id, 'right')))
    moves.push({ op: 'weigh' })
    ;[...left, ...right].forEach((id) => moves.push(put(id, 'tray')))
  }
  const groups = start.weights.length === 9 ? [[0, 1, 2], [3, 4, 5], [6, 7, 8]] : [[0, 1], [2, 3], [4, 5]]
  weigh(groups[0], groups[1])
  let suspects = groups[2]
  if (sum(groups[0]) > sum(groups[1])) suspects = groups[0]
  else if (sum(groups[0]) < sum(groups[1])) suspects = groups[1]
  weigh([suspects[0]], [suspects[1]])
  const heavy = sum([suspects[0]]) > sum([suspects[1]]) ? suspects[0] : sum([suspects[0]]) < sum([suspects[1]]) ? suspects[1] : suspects[2]
  moves.push({ op: 'accuse', id: heavy })
  return moves
}

function solveBox(start: BoxRound): Move[] {
  const key = (round: BoxRound) => `${round.player}:${round.boxes.map((has, index) => (has ? index : '')).join(',')}`
  const root = key(start)
  const queue = [start]
  const prev = new Map<string, { from: string; move: Move }>()
  const seen = new Set([root])
  const dirs: Dir[] = ['up', 'down', 'left', 'right']
  while (queue.length) {
    const round = queue.shift() ?? start
    const here = key(round)
    if (boxWon(round)) return pathFrom(here, root, prev)
    dirs.forEach((dir) => {
      const next = boxStep(round, dir)
      if (!next) return
      const mark = key(next)
      if (seen.has(mark)) return
      seen.add(mark)
      prev.set(mark, { from: here, move: { op: 'box', dir } })
      queue.push(next)
    })
  }
  return []
}

function solveSlide(start: SlideRound): Move[] {
  const key = (tiles: number[]) => tiles.join(',')
  const root = key(start.tiles)
  const queue = [start.tiles]
  const prev = new Map<string, { from: string; move: Move }>()
  const seen = new Set([root])
  while (queue.length) {
    const tiles = queue.shift() ?? []
    const here = key(tiles)
    if (slideWon(tiles)) return pathFrom(here, root, prev)
    tiles.forEach((_, index) => {
      const next = slidePull(tiles, index)
      if (!next) return
      const mark = key(next)
      if (seen.has(mark)) return
      seen.add(mark)
      prev.set(mark, { from: here, move: { op: 'slide', index } })
      queue.push(next)
    })
  }
  return []
}

function solveKlotski(start: KlotskiRound): Move[] {
  const key = (round: KlotskiRound) => round.blocks.map((block) => `${block.id}:${block.r},${block.c}`).join('|')
  const root = key(start)
  const queue = [cloneRound(start)]
  const prev = new Map<string, { from: string; move: Move }>()
  const seen = new Set([root])
  const dirs: Dir[] = ['up', 'down', 'left', 'right']
  while (queue.length) {
    const round = queue.shift() ?? start
    const here = key(round)
    if (klotskiWon(round)) return pathFrom(here, root, prev)
    round.blocks.forEach((block) => {
      dirs.forEach((dir) => {
        if (!canSlide(round, block.id, dir)) return
        const next = cloneRound(round)
        const target = next.blocks.find((item) => item.id === block.id)
        if (!target) return
        if (dir === 'up') target.r -= 1
        if (dir === 'down') target.r += 1
        if (dir === 'left') target.c -= 1
        if (dir === 'right') target.c += 1
        const mark = key(next)
        if (seen.has(mark)) return
        seen.add(mark)
        prev.set(mark, { from: here, move: { op: 'klot', id: block.id, dir } })
        queue.push(next)
      })
    })
  }
  return []
}

function solveHanoi(): Move[] {
  const moves: Move[] = []
  const walk = (n: number, from: number, to: number, spare: number) => {
    if (!n) return
    walk(n - 1, from, spare, to)
    moves.push({ op: 'hanoi', from, to })
    walk(n - 1, spare, to, from)
  }
  walk(5, 0, 2, 1)
  return moves
}

export function solve(round: Round): Move[] {
  if (round.kind === 'frog') return solveFrog(round)
  if (round.kind === 'river') return solveRiver(round)
  if (round.kind === 'lights') return solveLights(round)
  if (round.kind === 'pipes') return solvePipes(round)
  if (round.kind === 'trace') return solveTrace(round)
  if (round.kind === 'cage') return solveCage(round)
  if (round.kind === 'scale') return solveScale(round)
  if (round.kind === 'box') return solveBox(round)
  if (round.kind === 'slide') return solveSlide(round)
  if (round.kind === 'klotski') return solveKlotski(round)
  if (round.kind === 'hanoi') return solveHanoi()
  return solveMore(round)
}

export { applyMore, moreWon }
