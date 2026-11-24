/** 第 15–30 关：每种玩法只出现一次，要比前 14 关更费筹划。 */

export type Dir = 'up' | 'down' | 'left' | 'right'

export type MoreKind =
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

export type FlowRound = {
  kind: 'flow'
  n: number
  ends: number[]
  paths: number[][]
  active: number
}
export type PegRound = { kind: 'peg'; pegs: boolean[]; pick: number }
export type MatchRound = { kind: 'match'; rows: number; cols: number; on: boolean[]; held: number; moved: number; limit: number; target: number }
export type PackPiece = { id: number; cells: Array<[number, number]>; r: number; c: number; rot: number; placed: boolean }
export type PackRound = { kind: 'pack'; rows: number; cols: number; pieces: PackPiece[]; board: number[] }
export type BridgeRound = {
  kind: 'bridge'
  rows: number
  cols: number
  islands: Array<{ r: number; c: number; need: number }>
  links: number[]
  pick: number
}
export type TiltRound = {
  kind: 'tilt'
  rows: number
  cols: number
  walls: boolean[]
  balls: number[]
  goals: boolean[]
  pits: boolean[]
}
export type SkyRound = { kind: 'sky'; n: number; grid: number[]; top: number[]; bottom: number[]; left: number[]; right: number[] }
export type KnightRound = { kind: 'knight'; rows: number; cols: number; at: number; seen: boolean[] }
export type QueenRound = { kind: 'queen'; n: number; queens: boolean[] }
export type CodeRound = {
  kind: 'code'
  secret: number[]
  colors: number
  slots: number[]
  cursor: number
  log: Array<{ guess: number[]; black: number; white: number }>
  limit: number
}
export type AkariRound = { kind: 'akari'; rows: number; cols: number; cell: number[]; lamps: boolean[] }
export type DominoRound = {
  kind: 'domino'
  rows: number
  cols: number
  nums: number[]
  cover: number[]
  pick: number
  nextId: number
}
export type GearRound = { kind: 'gear'; teeth: number[]; rot: number[]; mesh: Array<[number, number]> }
export type SlitherRound = {
  kind: 'slither'
  n: number
  clues: number[]
  horiz: boolean[]
  vert: boolean[]
}
export type MineRound = { kind: 'mine'; rows: number; cols: number; mines: boolean[]; open: boolean[]; flags: boolean[] }
export type CipherRound = { kind: 'cipher'; dials: number[]; target: number[]; clues: Array<{ a: number; b: number; op: 'eq' | 'gt' | 'sum'; n: number }> }

export type MoreRound =
  | FlowRound
  | PegRound
  | MatchRound
  | PackRound
  | BridgeRound
  | TiltRound
  | SkyRound
  | KnightRound
  | QueenRound
  | CodeRound
  | AkariRound
  | DominoRound
  | GearRound
  | SlitherRound
  | MineRound
  | CipherRound

export type MoreMove =
  | { op: 'flow'; color: number; path: number[] }
  | { op: 'peg'; from: number; to: number }
  | { op: 'match'; from: number; to: number }
  | { op: 'pack'; id: number; r: number; c: number; rot: number }
  | { op: 'pack-off'; id: number }
  | { op: 'bridge'; a: number; b: number }
  | { op: 'tilt'; dir: Dir }
  | { op: 'sky'; index: number }
  | { op: 'knight'; to: number }
  | { op: 'queen'; index: number }
  | { op: 'code-set'; index: number; color: number }
  | { op: 'code-go' }
  | { op: 'akari'; index: number }
  | { op: 'domino'; a: number; b: number }
  | { op: 'gear'; index: number }
  | { op: 'slither'; axis: 'h' | 'v'; index: number }
  | { op: 'mine'; index: number }
  | { op: 'cipher'; index: number; to?: number }

const PEG_OK: Array<[number, number, number]> = [
  [0, 1, 3], [0, 2, 5],
  [1, 3, 6], [1, 4, 8],
  [2, 4, 7], [2, 5, 9],
  [3, 1, 0], [3, 4, 5], [3, 6, 10], [3, 7, 12],
  [4, 7, 11], [4, 8, 13],
  [5, 2, 0], [5, 4, 3], [5, 8, 12], [5, 9, 14],
  [6, 3, 1], [6, 7, 8],
  [7, 3, 6], [7, 4, 2], [7, 8, 9], [7, 12, 14],
  [8, 4, 1], [8, 5, 9], [8, 7, 6], [8, 12, 10],
  [9, 5, 2], [9, 8, 7],
  [10, 6, 3], [10, 11, 12],
  [11, 7, 4], [11, 12, 13],
  [12, 7, 3], [12, 8, 5], [12, 11, 10], [12, 13, 14],
  [13, 8, 4], [13, 12, 11],
  [14, 9, 5], [14, 13, 12],
]

function rotCells(cells: Array<[number, number]>, rot: number) {
  let next = cells.map(([r, c]) => [r, c] as [number, number])
  for (let step = 0; step < ((rot % 4) + 4) % 4; step += 1) {
    next = next.map(([r, c]) => [c, -r] as [number, number])
    const minR = Math.min(...next.map((cell) => cell[0]))
    const minC = Math.min(...next.map((cell) => cell[1]))
    next = next.map(([r, c]) => [r - minR, c - minC] as [number, number])
  }
  return next
}

function packShape(piece: PackPiece) {
  return rotCells(piece.cells, piece.rot).map(([r, c]) => [r + piece.r, c + piece.c] as [number, number])
}

export function makeMoreRound(id: string): MoreRound | null {
  if (id === 'flow-a') {
    const n = 5
    const ends = Array(n * n).fill(0)
    ends[0] = 1
    ends[21] = 1
    ends[3] = 2
    ends[22] = 2
    ends[7] = 3
    ends[12] = 3
    ends[2] = 4
    ends[16] = 4
    return { kind: 'flow', n, ends, paths: [[], [], [], [], []], active: 0 }
  }
  if (id === 'peg-a') {
    const pegs = Array(15).fill(true)
    pegs[4] = false
    return { kind: 'peg', pegs, pick: -1 }
  }
  if (id === 'match-a') {
    const rows = 2
    const cols = 3
    const on = Array((rows + 1) * cols + rows * (cols + 1)).fill(false)
    const h = (r: number, c: number) => {
      on[r * cols + c] = true
    }
    const v = (r: number, c: number) => {
      on[(rows + 1) * cols + r * (cols + 1) + c] = true
    }
    for (let r = 0; r < 2; r += 1) {
      for (let c = 0; c < 2; c += 1) {
        h(r, c)
        h(r + 1, c)
        v(r, c)
        v(r, c + 1)
      }
    }
    return { kind: 'match', rows, cols, on, held: -1, moved: 0, limit: 3, target: 0 }
  }
  if (id === 'pack-a') {
    const pieces: PackPiece[] = [
      { id: 0, cells: [[0, 0], [0, 1], [0, 2], [0, 3]], r: 0, c: 0, rot: 0, placed: false },
      { id: 1, cells: [[0, 0], [0, 1], [1, 0], [1, 1]], r: 0, c: 0, rot: 0, placed: false },
      { id: 2, cells: [[0, 1], [1, 1], [2, 0], [2, 1]], r: 0, c: 0, rot: 0, placed: false },
      { id: 3, cells: [[0, 0], [1, 0], [2, 0], [2, 1]], r: 0, c: 0, rot: 0, placed: false },
      { id: 4, cells: [[0, 1], [0, 2], [1, 0], [1, 1]], r: 0, c: 0, rot: 0, placed: false },
    ]
    return { kind: 'pack', rows: 4, cols: 5, pieces, board: Array(20).fill(-1) }
  }
  if (id === 'bridge-a') {
    return {
      kind: 'bridge',
      rows: 5,
      cols: 5,
      islands: [
        { r: 0, c: 0, need: 3 },
        { r: 0, c: 2, need: 3 },
        { r: 0, c: 4, need: 2 },
        { r: 2, c: 0, need: 3 },
        { r: 2, c: 2, need: 4 },
        { r: 2, c: 4, need: 3 },
        { r: 4, c: 0, need: 1 },
        { r: 4, c: 2, need: 3 },
        { r: 4, c: 4, need: 2 },
      ],
      links: [],
      pick: -1,
    }
  }
  if (id === 'tilt-a') {
    const rows = 5
    const cols = 5
    const map = [
      '@...#',
      '.#...',
      '..#..',
      '...#.',
      '#...G',
    ]
    const walls: boolean[] = []
    const goals: boolean[] = []
    const pits: boolean[] = []
    const balls: number[] = []
    map.forEach((row, r) => {
      ;[...row].forEach((ch, c) => {
        const index = r * cols + c
        walls[index] = ch === '#'
        goals[index] = ch === 'G'
        pits[index] = ch === 'O'
        if (ch === '@') balls.push(index)
      })
    })
    return { kind: 'tilt', rows, cols, walls, balls, goals, pits }
  }
  if (id === 'sky-a') {
    // 解：2 1 3 4 / 3 2 4 1 / 1 4 2 3 / 4 3 1 2
    return {
      kind: 'sky',
      n: 4,
      grid: Array(16).fill(0),
      top: [3, 3, 2, 1],
      bottom: [1, 2, 3, 3],
      left: [3, 2, 2, 1],
      right: [1, 2, 2, 3],
    }
  }
  if (id === 'knight-a') {
    const rows = 3
    const cols = 4
    const seen = Array(rows * cols).fill(false)
    seen[0] = true
    return { kind: 'knight', rows, cols, at: 0, seen }
  }
  if (id === 'queen-a') return { kind: 'queen', n: 4, queens: Array(16).fill(false) }
  if (id === 'code-a') {
    return {
      kind: 'code',
      secret: [1, 4, 2, 5],
      colors: 6,
      slots: [-1, -1, -1, -1],
      cursor: 0,
      log: [],
      limit: 8,
    }
  }
  if (id === 'akari-a') {
    // -1 白格；0..4 黑格数字；-2 无数字黑格
    const cell = [
      -1, -1, 1, -1, -1,
      -1, -2, -1, 2, -1,
      1, -1, -1, -1, 1,
      -1, 2, -1, -2, -1,
      -1, -1, 1, -1, -1,
    ]
    return { kind: 'akari', rows: 5, cols: 5, cell, lamps: Array(25).fill(false) }
  }
  if (id === 'domino-a') {
    // 每对数字恰好出现一次，可唯一配对成骨牌
    const nums = [
      1, 2, 2, 3,
      1, 4, 3, 4,
      5, 5, 6, 6,
      7, 8, 7, 8,
    ]
    return { kind: 'domino', rows: 4, cols: 4, nums, cover: Array(16).fill(-1), pick: -1, nextId: 0 }
  }
  if (id === 'gear-a') {
    return {
      kind: 'gear',
      teeth: [5, 5, 5, 5, 5],
      rot: [2, 2, 2, 2, 2],
      mesh: [[0, 1], [1, 2], [2, 3], [3, 4]],
    }
  }
  if (id === 'slither-a') {
    return {
      kind: 'slither',
      n: 4,
      clues: [3, 2, 2, 1, 2, 3, 2, 2, 2, 2, 1, 2, 3, 2, 2, 3],
      horiz: Array(20).fill(false),
      vert: Array(20).fill(false),
    }
  }
  if (id === 'mine-a') {
    const rows = 6
    const cols = 6
    const mines = Array(36).fill(false)
    ;[2, 10, 13, 21, 24, 29, 32, 34].forEach((index) => {
      mines[index] = true
    })
    const round: MineRound = { kind: 'mine', rows, cols, mines, open: Array(36).fill(false), flags: Array(36).fill(false) }
    const opened = mineOpen(round, 0)
    return opened === 'boom' ? round : opened
  }
  if (id === 'cipher-a') {
    return {
      kind: 'cipher',
      dials: [0, 0, 0, 0, 0],
      target: [7, 3, 5, 4, 3],
      clues: [
        { a: 0, b: 1, op: 'sum', n: 10 },
        { a: 1, b: 2, op: 'sum', n: 8 },
        { a: 2, b: 3, op: 'sum', n: 9 },
        { a: 3, b: 4, op: 'sum', n: 7 },
        { a: 0, b: 4, op: 'sum', n: 10 },
      ],
    }
  }
  return null
}

export function flowCellColor(round: FlowRound, index: number) {
  if (round.ends[index]) return round.ends[index]
  for (let color = 1; color < round.paths.length; color += 1) {
    if (round.paths[color].includes(index)) return color
  }
  return 0
}

export function flowApply(round: FlowRound, color: number, path: number[]): FlowRound | 'bad' {
  if (color < 1 || color >= round.paths.length) return 'bad'
  if (path.length < 2) return 'bad'
  if (round.ends[path[0]] !== color || round.ends[path[path.length - 1]] !== color) return 'bad'
  if (path[0] === path[path.length - 1]) return 'bad'
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1]
    const b = path[i]
    const ar = Math.floor(a / round.n)
    const ac = a % round.n
    const br = Math.floor(b / round.n)
    const bc = b % round.n
    if (Math.abs(ar - br) + Math.abs(ac - bc) !== 1) return 'bad'
  }
  const used = new Set<number>()
  for (let c = 1; c < round.paths.length; c += 1) {
    if (c === color) continue
    round.paths[c].forEach((cell) => used.add(cell))
  }
  for (let i = 0; i < round.ends.length; i += 1) {
    if (round.ends[i] && round.ends[i] !== color) used.add(i)
  }
  for (const cell of path) {
    if (used.has(cell)) return 'bad'
    if (round.ends[cell] && round.ends[cell] !== color) return 'bad'
  }
  const uniq = new Set(path)
  if (uniq.size !== path.length) return 'bad'
  const paths = round.paths.map((item, index) => (index === color ? [...path] : [...item]))
  return { ...round, paths, active: 0 }
}

export function flowWon(round: FlowRound) {
  const colors = [...new Set(round.ends.filter(Boolean))]
  if (!colors.every((color) => (round.paths[color] ?? []).length >= 2)) return false
  // 管道不能留空洞：所有空格也要被某条线占住
  const filled = new Set<number>()
  colors.forEach((color) => round.paths[color].forEach((cell) => filled.add(cell)))
  return filled.size === round.n * round.n
}

export function pegJump(round: PegRound, from: number, to: number): PegRound | null {
  const hit = PEG_OK.find((item) => item[0] === from && item[2] === to)
  if (!hit) return null
  const over = hit[1]
  if (!round.pegs[from] || !round.pegs[over] || round.pegs[to]) return null
  const pegs = [...round.pegs]
  pegs[from] = false
  pegs[over] = false
  pegs[to] = true
  return { ...round, pegs, pick: -1 }
}

export function pegWon(round: PegRound) {
  return round.pegs.filter(Boolean).length === 1
}

export function matchSquares(round: MatchRound) {
  const horizCount = (round.rows + 1) * round.cols
  const H = (r: number, c: number) => round.on[r * round.cols + c]
  const V = (r: number, c: number) => round.on[horizCount + r * (round.cols + 1) + c]
  let count = 0
  for (let r = 0; r < round.rows; r += 1) {
    for (let c = 0; c < round.cols; c += 1) {
      if (H(r, c) && H(r + 1, c) && V(r, c) && V(r, c + 1)) count += 1
    }
  }
  for (let r = 0; r + 1 < round.rows; r += 1) {
    for (let c = 0; c + 1 < round.cols; c += 1) {
      const top = H(r, c) && H(r, c + 1)
      const bottom = H(r + 2, c) && H(r + 2, c + 1)
      const left = V(r, c) && V(r + 1, c)
      const right = V(r, c + 2) && V(r + 1, c + 2)
      if (top && bottom && left && right) count += 1
    }
  }
  return count
}

export function matchMove(round: MatchRound, from: number, to: number): MatchRound | 'limit' | null {
  if (round.moved >= round.limit) return 'limit'
  if (from === to) return null
  if (!round.on[from] || round.on[to]) return null
  const on = [...round.on]
  on[from] = false
  on[to] = true
  return { ...round, on, held: -1, moved: round.moved + 1 }
}

export function matchWon(round: MatchRound) {
  return matchSquares(round) === round.target
}

export function packPlace(round: PackRound, id: number, r: number, c: number, rot: number): PackRound | null {
  const piece = round.pieces.find((item) => item.id === id)
  if (!piece) return null
  const nextPiece = { ...piece, r, c, rot, placed: true }
  const cells = packShape(nextPiece)
  if (cells.some(([row, col]) => row < 0 || col < 0 || row >= round.rows || col >= round.cols)) return null
  const board = round.board.map((cell) => (cell === id ? -1 : cell))
  if (cells.some(([row, col]) => board[row * round.cols + col] >= 0)) return null
  cells.forEach(([row, col]) => {
    board[row * round.cols + col] = id
  })
  return {
    ...round,
    board,
    pieces: round.pieces.map((item) => (item.id === id ? nextPiece : item)),
  }
}

export function packRemove(round: PackRound, id: number): PackRound {
  return {
    ...round,
    board: round.board.map((cell) => (cell === id ? -1 : cell)),
    pieces: round.pieces.map((item) => (item.id === id ? { ...item, placed: false } : item)),
  }
}

export function packWon(round: PackRound) {
  return round.pieces.every((piece) => piece.placed) && round.board.every((cell) => cell >= 0)
}

function bridgeKey(a: number, b: number) {
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

function bridgePairs(round: BridgeRound) {
  const pairs: Array<[number, number]> = []
  for (let i = 0; i < round.islands.length; i += 1) {
    for (let j = i + 1; j < round.islands.length; j += 1) {
      const A = round.islands[i]
      const B = round.islands[j]
      if (A.r !== B.r && A.c !== B.c) continue
      let clear = true
      for (let k = 0; k < round.islands.length; k += 1) {
        if (k === i || k === j) continue
        const C = round.islands[k]
        if (A.r === B.r && C.r === A.r && C.c > Math.min(A.c, B.c) && C.c < Math.max(A.c, B.c)) clear = false
        if (A.c === B.c && C.c === A.c && C.r > Math.min(A.r, B.r) && C.r < Math.max(A.r, B.r)) clear = false
      }
      if (clear) pairs.push([i, j])
    }
  }
  return pairs
}

function bridgeCount(round: BridgeRound, a: number, b: number) {
  const key = bridgeKey(a, b)
  return round.links.filter((item) => item === key).length
}

function bridgeCross(round: BridgeRound, a: number, b: number) {
  const A = round.islands[a]
  const B = round.islands[b]
  const horizontal = A.r === B.r
  for (let i = 0; i < round.islands.length; i += 1) {
    for (let j = i + 1; j < round.islands.length; j += 1) {
      if (!bridgeCount(round, i, j)) continue
      if (i === a || i === b || j === a || j === b) continue
      const C = round.islands[i]
      const D = round.islands[j]
      const otherH = C.r === D.r
      if (horizontal === otherH) continue
      if (horizontal) {
        const y = A.r
        const x0 = Math.min(A.c, B.c)
        const x1 = Math.max(A.c, B.c)
        const x = C.c
        const y0 = Math.min(C.r, D.r)
        const y1 = Math.max(C.r, D.r)
        if (x > x0 && x < x1 && y > y0 && y < y1) return true
      } else {
        const x = A.c
        const y0 = Math.min(A.r, B.r)
        const y1 = Math.max(A.r, B.r)
        const y = C.r
        const x0 = Math.min(C.c, D.c)
        const x1 = Math.max(C.c, D.c)
        if (y > y0 && y < y1 && x > x0 && x < x1) return true
      }
    }
  }
  return false
}

export function bridgeToggle(round: BridgeRound, a: number, b: number): BridgeRound | 'cross' | null {
  if (a === b) return null
  if (!bridgePairs(round).some(([x, y]) => (x === a && y === b) || (x === b && y === a))) return null
  const key = bridgeKey(a, b)
  const count = bridgeCount(round, a, b)
  let links = round.links.filter((item) => item !== key)
  if (count < 2) {
    const trial = { ...round, links: [...links, ...Array(count + 1).fill(key)] }
    if (bridgeCross(trial, a, b)) return 'cross'
    links = trial.links
  }
  return { ...round, links, pick: -1 }
}

export function bridgeWon(round: BridgeRound) {
  return round.islands.every((_, index) => {
    let deg = 0
    round.islands.forEach((__, other) => {
      if (other === index) return
      deg += bridgeCount(round, index, other)
    })
    return deg === round.islands[index].need
  })
}

export function tiltRoll(round: TiltRound, dir: Dir): TiltRound | 'pit' {
  const dr = dir === 'up' ? -1 : dir === 'down' ? 1 : 0
  const dc = dir === 'left' ? -1 : dir === 'right' ? 1 : 0
  const balls = round.balls.map((start) => {
    let at = start
    while (true) {
      const row = Math.floor(at / round.cols) + dr
      const col = (at % round.cols) + dc
      if (row < 0 || col < 0 || row >= round.rows || col >= round.cols) break
      const next = row * round.cols + col
      if (round.walls[next]) break
      at = next
      if (round.pits[at]) return -1
    }
    return at
  })
  if (balls.some((ball) => ball < 0)) return 'pit'
  return { ...round, balls }
}

export function tiltWon(round: TiltRound) {
  return round.balls.length > 0 && round.balls.every((ball) => round.goals[ball])
}

function skyVisible(line: number[]) {
  let best = 0
  let count = 0
  line.forEach((h) => {
    if (h > best) {
      best = h
      count += 1
    }
  })
  return count
}

export function skyTap(round: SkyRound, index: number): SkyRound {
  const grid = [...round.grid]
  grid[index] = (grid[index] + 1) % (round.n + 1)
  return { ...round, grid }
}

export function skyWon(round: SkyRound) {
  const { n, grid } = round
  if (grid.some((cell) => !cell)) return false
  for (let r = 0; r < n; r += 1) {
    const row = grid.slice(r * n, r * n + n)
    if (new Set(row).size !== n) return false
  }
  for (let c = 0; c < n; c += 1) {
    const col = Array.from({ length: n }, (_, r) => grid[r * n + c])
    if (new Set(col).size !== n) return false
  }
  for (let c = 0; c < n; c += 1) {
    const col = Array.from({ length: n }, (_, r) => grid[r * n + c])
    if (round.top[c] && skyVisible(col) !== round.top[c]) return false
    if (round.bottom[c] && skyVisible([...col].reverse()) !== round.bottom[c]) return false
  }
  for (let r = 0; r < n; r += 1) {
    const row = grid.slice(r * n, r * n + n)
    if (round.left[r] && skyVisible(row) !== round.left[r]) return false
    if (round.right[r] && skyVisible([...row].reverse()) !== round.right[r]) return false
  }
  return true
}

export function knightTargets(round: KnightRound) {
  const row = Math.floor(round.at / round.cols)
  const col = round.at % round.cols
  const deltas = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]
  return deltas
    .map(([dr, dc]) => [row + dr, col + dc] as [number, number])
    .filter(([r, c]) => r >= 0 && c >= 0 && r < round.rows && c < round.cols)
    .map(([r, c]) => r * round.cols + c)
    .filter((index) => !round.seen[index])
}

export function knightStep(round: KnightRound, to: number): KnightRound | null {
  if (!knightTargets(round).includes(to)) return null
  const seen = [...round.seen]
  seen[to] = true
  return { ...round, at: to, seen }
}

export function knightWon(round: KnightRound) {
  return round.seen.every(Boolean)
}

export function queenToggle(round: QueenRound, index: number): QueenRound {
  const queens = [...round.queens]
  queens[index] = !queens[index]
  return { ...round, queens }
}

export function queenAttacking(round: QueenRound) {
  const spots = round.queens.map((on, index) => (on ? index : -1)).filter((index) => index >= 0)
  const bad = new Set<number>()
  for (let i = 0; i < spots.length; i += 1) {
    for (let j = i + 1; j < spots.length; j += 1) {
      const a = spots[i]
      const b = spots[j]
      const ar = Math.floor(a / round.n)
      const ac = a % round.n
      const br = Math.floor(b / round.n)
      const bc = b % round.n
      if (ar === br || ac === bc || Math.abs(ar - br) === Math.abs(ac - bc)) {
        bad.add(a)
        bad.add(b)
      }
    }
  }
  return bad
}

export function queenWon(round: QueenRound) {
  const count = round.queens.filter(Boolean).length
  return count === round.n && queenAttacking(round).size === 0
}

export function codeSet(round: CodeRound, index: number, color: number): CodeRound {
  const slots = [...round.slots]
  slots[index] = ((color % round.colors) + round.colors) % round.colors
  return { ...round, slots, cursor: (index + 1) % slots.length }
}

export function codeGrade(secret: number[], guess: number[]) {
  const s = [...secret]
  const g = [...guess]
  let black = 0
  for (let i = 0; i < s.length; i += 1) {
    if (g[i] === s[i]) {
      black += 1
      s[i] = -1
      g[i] = -2
    }
  }
  let white = 0
  for (let i = 0; i < g.length; i += 1) {
    if (g[i] < 0) continue
    const at = s.indexOf(g[i])
    if (at < 0) continue
    white += 1
    s[at] = -1
  }
  return { black, white }
}

export function codeGo(round: CodeRound): CodeRound | 'limit' | 'code' {
  if (round.slots.some((color) => color < 0)) return 'code'
  if (round.log.length >= round.limit) return 'limit'
  const grade = codeGrade(round.secret, round.slots)
  return {
    ...round,
    log: [...round.log, { guess: [...round.slots], ...grade }],
  }
}

export function codeWon(round: CodeRound) {
  const last = round.log[round.log.length - 1]
  return !!last && last.black === round.secret.length
}

function akariWhite(cell: number) {
  return cell === -1
}

export function akariLit(round: AkariRound) {
  const lit = Array(round.rows * round.cols).fill(false)
  round.lamps.forEach((on, index) => {
    if (!on) return
    lit[index] = true
    const row = Math.floor(index / round.cols)
    const col = index % round.cols
    const walk = (dr: number, dc: number) => {
      let r = row + dr
      let c = col + dc
      while (r >= 0 && c >= 0 && r < round.rows && c < round.cols) {
        const at = r * round.cols + c
        if (!akariWhite(round.cell[at])) break
        lit[at] = true
        r += dr
        c += dc
      }
    }
    walk(-1, 0)
    walk(1, 0)
    walk(0, -1)
    walk(0, 1)
  })
  return lit
}

export function akariToggle(round: AkariRound, index: number): AkariRound | null {
  if (!akariWhite(round.cell[index])) return null
  const lamps = [...round.lamps]
  lamps[index] = !lamps[index]
  return { ...round, lamps }
}

export function akariWon(round: AkariRound) {
  const lit = akariLit(round)
  for (let i = 0; i < round.cell.length; i += 1) {
    if (akariWhite(round.cell[i]) && !lit[i]) return false
  }
  for (let i = 0; i < round.lamps.length; i += 1) {
    if (!round.lamps[i]) continue
    const row = Math.floor(i / round.cols)
    const col = i % round.cols
    const hit = (dr: number, dc: number) => {
      let r = row + dr
      let c = col + dc
      while (r >= 0 && c >= 0 && r < round.rows && c < round.cols) {
        const at = r * round.cols + c
        if (!akariWhite(round.cell[at])) return false
        if (round.lamps[at]) return true
        r += dr
        c += dc
      }
      return false
    }
    if (hit(-1, 0) || hit(1, 0) || hit(0, -1) || hit(0, 1)) return false
  }
  for (let i = 0; i < round.cell.length; i += 1) {
    const need = round.cell[i]
    if (need < 0) continue
    const row = Math.floor(i / round.cols)
    const col = i % round.cols
    let count = 0
    ;[[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => {
      const r = row + dr
      const c = col + dc
      if (r < 0 || c < 0 || r >= round.rows || c >= round.cols) return
      if (round.lamps[r * round.cols + c]) count += 1
    })
    if (count !== need) return false
  }
  return true
}

export function dominoToggle(round: DominoRound, a: number, b: number): DominoRound | 'pair' | null {
  if (a === b) return null
  const ar = Math.floor(a / round.cols)
  const ac = a % round.cols
  const br = Math.floor(b / round.cols)
  const bc = b % round.cols
  if (Math.abs(ar - br) + Math.abs(ac - bc) !== 1) return null
  if (round.cover[a] >= 0 || round.cover[b] >= 0) {
    const id = round.cover[a] >= 0 ? round.cover[a] : round.cover[b]
    return {
      ...round,
      cover: round.cover.map((cell) => (cell === id ? -1 : cell)),
      pick: -1,
    }
  }
  if (round.nums[a] !== round.nums[b] && false) return 'pair'
  // 规则：相邻两格盖上即可；数字相同的优先教学，这里允许任意相邻，但必须整板盖满且骨牌不重叠。
  // 为增加考点：只有数字相同或构成规定骨牌。这里要求两格数字之差的绝对值 ≤ 1 太弱。
  // 改为：盖住后，每种数字对 (min,max) 全局最多一次（骨牌不重复）。
  const lo = Math.min(round.nums[a], round.nums[b])
  const hi = Math.max(round.nums[a], round.nums[b])
  const used = new Set<string>()
  for (let i = 0; i < round.cover.length; i += 1) {
    if (round.cover[i] < 0) continue
    for (let j = i + 1; j < round.cover.length; j += 1) {
      if (round.cover[j] !== round.cover[i]) continue
      const x = Math.min(round.nums[i], round.nums[j])
      const y = Math.max(round.nums[i], round.nums[j])
      used.add(`${x}-${y}`)
    }
  }
  if (used.has(`${lo}-${hi}`)) return 'pair'
  const cover = [...round.cover]
  cover[a] = round.nextId
  cover[b] = round.nextId
  return { ...round, cover, pick: -1, nextId: round.nextId + 1 }
}

export function dominoWon(round: DominoRound) {
  return round.cover.every((cell) => cell >= 0)
}

export function gearTurn(round: GearRound, index: number): GearRound {
  const rot = [...round.rot]
  rot[index] = (rot[index] + 1) % round.teeth[index]
  round.mesh.forEach(([a, b]) => {
    if (a === index) rot[b] = (rot[b] + round.teeth[b] - 1) % round.teeth[b]
    if (b === index) rot[a] = (rot[a] + round.teeth[a] - 1) % round.teeth[a]
  })
  return { ...round, rot }
}

export function gearWon(round: GearRound) {
  return round.rot.every((rot) => rot === 0)
}

export function slitherToggle(round: SlitherRound, axis: 'h' | 'v', index: number): SlitherRound {
  if (axis === 'h') {
    const horiz = [...round.horiz]
    horiz[index] = !horiz[index]
    return { ...round, horiz }
  }
  const vert = [...round.vert]
  vert[index] = !vert[index]
  return { ...round, vert }
}

function slitherLoops(round: SlitherRound) {
  const n = round.n
  const nodes = (n + 1) * (n + 1)
  const adj: number[][] = Array.from({ length: nodes }, () => [])
  const id = (r: number, c: number) => r * (n + 1) + c
  for (let r = 0; r <= n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (!round.horiz[r * n + c]) continue
      const a = id(r, c)
      const b = id(r, c + 1)
      adj[a].push(b)
      adj[b].push(a)
    }
  }
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c <= n; c += 1) {
      if (!round.vert[r * (n + 1) + c]) continue
      const a = id(r, c)
      const b = id(r + 1, c)
      adj[a].push(b)
      adj[b].push(a)
    }
  }
  const deg = adj.map((list) => list.length)
  if (deg.some((d) => d !== 0 && d !== 2)) return false
  const start = deg.findIndex((d) => d === 2)
  if (start < 0) return false
  const seen = new Set<number>()
  let prev = -1
  let cur = start
  do {
    seen.add(cur)
    const next = adj[cur].find((node) => node !== prev) ?? -1
    if (next < 0) return false
    prev = cur
    cur = next
  } while (cur !== start)
  return seen.size === deg.filter((d) => d === 2).length
}

export function slitherWon(round: SlitherRound) {
  const n = round.n
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      const clue = round.clues[r * n + c]
      if (clue < 0) continue
      let count = 0
      if (round.horiz[r * n + c]) count += 1
      if (round.horiz[(r + 1) * n + c]) count += 1
      if (round.vert[r * (n + 1) + c]) count += 1
      if (round.vert[r * (n + 1) + c + 1]) count += 1
      if (count !== clue) return false
    }
  }
  return slitherLoops(round)
}

export function mineCount(round: MineRound, index: number) {
  const row = Math.floor(index / round.cols)
  const col = index % round.cols
  let count = 0
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (!dr && !dc) continue
      const r = row + dr
      const c = col + dc
      if (r < 0 || c < 0 || r >= round.rows || c >= round.cols) continue
      if (round.mines[r * round.cols + c]) count += 1
    }
  }
  return count
}

export function mineOpen(round: MineRound, index: number): MineRound | 'boom' {
  if (round.open[index] || round.flags[index]) return round
  if (round.mines[index]) return 'boom'
  const open = [...round.open]
  const stack = [index]
  while (stack.length) {
    const at = stack.pop() ?? 0
    if (open[at]) continue
    open[at] = true
    if (mineCount(round, at) !== 0) continue
    const row = Math.floor(at / round.cols)
    const col = at % round.cols
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        const r = row + dr
        const c = col + dc
        if (r < 0 || c < 0 || r >= round.rows || c >= round.cols) continue
        const next = r * round.cols + c
        if (!open[next] && !round.mines[next]) stack.push(next)
      }
    }
  }
  return { ...round, open }
}

export function mineWon(round: MineRound) {
  return round.mines.every((mine, index) => mine || round.open[index])
}

export function cipherTurn(round: CipherRound, index: number): CipherRound {
  const dials = [...round.dials]
  dials[index] = (dials[index] + 1) % 10
  return { ...round, dials }
}

export function cipherSet(round: CipherRound, index: number, to: number): CipherRound {
  const dials = [...round.dials]
  dials[index] = ((to % 10) + 10) % 10
  return { ...round, dials }
}

export function cipherOk(round: CipherRound) {
  return round.clues.every((clue) => {
    const a = round.dials[clue.a]
    const b = round.dials[clue.b]
    if (clue.op === 'eq') return a === b
    if (clue.op === 'gt') return a === b + clue.n
    return a + b === clue.n
  })
}

export function cipherWon(round: CipherRound) {
  return cipherOk(round)
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function pathFrom(goal: string, start: string, prev: Map<string, { from: string; move: MoreMove }>) {
  const moves: MoreMove[] = []
  let cursor = goal
  while (cursor !== start) {
    const item = prev.get(cursor)
    if (!item) break
    moves.push(item.move)
    cursor = item.from
  }
  return moves.reverse()
}

function solveFlow(start: FlowRound): MoreMove[] {
  void start
  return [
    { op: 'flow', color: 1, path: [0, 5, 10, 15, 20, 21] },
    { op: 'flow', color: 2, path: [3, 4, 9, 14, 19, 24, 23, 22] },
    { op: 'flow', color: 3, path: [7, 8, 13, 18, 17, 12] },
    { op: 'flow', color: 4, path: [2, 1, 6, 11, 16] },
  ]
}

function solvePeg(start: PegRound): MoreMove[] {
  const key = (pegs: boolean[]) => pegs.map((on) => (on ? '1' : '0')).join('')
  const root = key(start.pegs)
  const queue = [start.pegs]
  const prev = new Map<string, { from: string; move: MoreMove }>()
  const seen = new Set([root])
  while (queue.length) {
    const pegs = queue.shift() ?? []
    const here = key(pegs)
    if (pegs.filter(Boolean).length === 1) return pathFrom(here, root, prev)
    PEG_OK.forEach(([from, over, to]) => {
      if (!pegs[from] || !pegs[over] || pegs[to]) return
      const next = [...pegs]
      next[from] = false
      next[over] = false
      next[to] = true
      const mark = key(next)
      if (seen.has(mark)) return
      seen.add(mark)
      prev.set(mark, { from: here, move: { op: 'peg', from, to } })
      queue.push(next)
    })
  }
  return []
}

function solveMatch(start: MatchRound): MoreMove[] {
  const key = (on: boolean[]) => on.map((bit) => (bit ? '1' : '0')).join('')
  const root = key(start.on)
  const queue: Array<{ on: boolean[]; moved: number }> = [{ on: [...start.on], moved: 0 }]
  const prev = new Map<string, { from: string; move: MoreMove }>()
  const seen = new Set([root])
  while (queue.length) {
    const item = queue.shift()
    if (!item) break
    const here = key(item.on)
    if (matchSquares({ ...start, on: item.on }) === start.target && item.moved > 0) return pathFrom(here, root, prev)
    if (item.moved >= start.limit) continue
    const filled = item.on.map((bit, index) => (bit ? index : -1)).filter((index) => index >= 0)
    const empty = item.on.map((bit, index) => (!bit ? index : -1)).filter((index) => index >= 0)
    filled.forEach((from) => {
      empty.forEach((to) => {
        const on = [...item.on]
        on[from] = false
        on[to] = true
        const mark = key(on)
        if (seen.has(mark)) return
        seen.add(mark)
        prev.set(mark, { from: here, move: { op: 'match', from, to } })
        queue.push({ on, moved: item.moved + 1 })
      })
    })
  }
  return []
}

function solvePack(start: PackRound): MoreMove[] {
  const pieces = start.pieces.map((piece) => ({ ...piece }))
  const board = Array(start.rows * start.cols).fill(-1)
  const moves: MoreMove[] = []
  const fits = (id: number, r: number, c: number, rot: number) => {
    const shape = rotCells(pieces.find((piece) => piece.id === id)!.cells, rot).map(([y, x]) => [y + r, x + c] as [number, number])
    if (shape.some(([y, x]) => y < 0 || x < 0 || y >= start.rows || x >= start.cols)) return null
    if (shape.some(([y, x]) => board[y * start.cols + x] >= 0)) return null
    return shape
  }
  const dfs = (index: number): boolean => {
    if (index >= pieces.length) return true
    const piece = pieces[index]
    for (let rot = 0; rot < 4; rot += 1) {
      for (let r = 0; r < start.rows; r += 1) {
        for (let c = 0; c < start.cols; c += 1) {
          const shape = fits(piece.id, r, c, rot)
          if (!shape) continue
          shape.forEach(([y, x]) => {
            board[y * start.cols + x] = piece.id
          })
          moves.push({ op: 'pack', id: piece.id, r, c, rot })
          if (dfs(index + 1)) return true
          moves.pop()
          shape.forEach(([y, x]) => {
            board[y * start.cols + x] = -1
          })
        }
      }
    }
    return false
  }
  return dfs(0) ? moves : []
}

function solveBridge(start: BridgeRound): MoreMove[] {
  void start
  const plan: Array<[number, number, number]> = [
    [0, 1, 2],
    [1, 2, 1],
    [0, 3, 1],
    [2, 5, 1],
    [3, 4, 1],
    [4, 5, 2],
    [3, 6, 1],
    [4, 7, 1],
    [7, 8, 2],
  ]
  const moves: MoreMove[] = []
  plan.forEach(([a, b, times]) => {
    for (let n = 0; n < times; n += 1) moves.push({ op: 'bridge', a, b })
  })
  return moves
}

function solveTilt(start: TiltRound): MoreMove[] {
  const key = (balls: number[]) => balls.join(',')
  const root = key(start.balls)
  const queue = [start]
  const prev = new Map<string, { from: string; move: MoreMove }>()
  const seen = new Set([root])
  const dirs: Dir[] = ['up', 'down', 'left', 'right']
  while (queue.length) {
    const round = queue.shift() ?? start
    const here = key(round.balls)
    if (tiltWon(round)) return pathFrom(here, root, prev)
    dirs.forEach((dir) => {
      const next = tiltRoll(round, dir)
      if (typeof next === 'string') return
      const mark = key(next.balls)
      if (seen.has(mark)) return
      seen.add(mark)
      prev.set(mark, { from: here, move: { op: 'tilt', dir } })
      queue.push(next)
    })
  }
  return []
}

function solveSky(start: SkyRound): MoreMove[] {
  const goal = [2, 1, 3, 4, 3, 2, 4, 1, 1, 4, 2, 3, 4, 3, 1, 2]
  const moves: MoreMove[] = []
  goal.forEach((value, index) => {
    for (let tap = 0; tap < value; tap += 1) moves.push({ op: 'sky', index })
  })
  void start
  return moves
}

function solveKnight(start: KnightRound): MoreMove[] {
  const key = (round: KnightRound) => `${round.at}:${round.seen.map((on) => (on ? 1 : 0)).join('')}`
  const root = key(start)
  const queue = [start]
  const prev = new Map<string, { from: string; move: MoreMove }>()
  const seen = new Set([root])
  while (queue.length) {
    const round = queue.shift() ?? start
    const here = key(round)
    if (knightWon(round)) return pathFrom(here, root, prev)
    knightTargets(round).forEach((to) => {
      const next = knightStep(round, to)
      if (!next) return
      const mark = key(next)
      if (seen.has(mark)) return
      seen.add(mark)
      prev.set(mark, { from: here, move: { op: 'knight', to } })
      queue.push(next)
    })
  }
  return []
}

function solveQueen(start: QueenRound): MoreMove[] {
  // 4 皇后经典解之一：列 1,3,0,2 → 格 1,7,8,14
  return [1, 7, 8, 14].map((index) => ({ op: 'queen' as const, index }))
}

function solveCode(start: CodeRound): MoreMove[] {
  const moves: MoreMove[] = []
  start.secret.forEach((color, index) => moves.push({ op: 'code-set', index, color }))
  moves.push({ op: 'code-go' })
  return moves
}

function solveAkari(start: AkariRound): MoreMove[] {
  const whites = start.cell.map((cell, index) => (akariWhite(cell) ? index : -1)).filter((index) => index >= 0)
  const key = (lamps: boolean[]) => lamps.map((on) => (on ? 1 : 0)).join('')
  const dfs = (at: number, lamps: boolean[]): boolean[] | null => {
    const round = { ...start, lamps }
    if (at >= whites.length) return akariWon(round) ? lamps : null
    const index = whites[at]
    const skip = dfs(at + 1, lamps)
    if (skip) return skip
    const next = [...lamps]
    next[index] = true
    // 粗剪：若已与另一灯相视则跳过
    const trial = { ...start, lamps: next }
    let ok = true
    const litCheck = () => {
      const row = Math.floor(index / start.cols)
      const col = index % start.cols
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        let r = row + dr
        let c = col + dc
        while (r >= 0 && c >= 0 && r < start.rows && c < start.cols) {
          const i = r * start.cols + c
          if (!akariWhite(start.cell[i])) break
          if (next[i]) return false
          r += dr
          c += dc
        }
      }
      return true
    }
    if (!litCheck()) ok = false
    if (!ok) return null
    return dfs(at + 1, next)
  }
  void key
  const lamps = dfs(0, Array(start.lamps.length).fill(false))
  if (!lamps) return []
  return lamps.map((on, index) => (on ? ({ op: 'akari' as const, index }) : null)).filter(Boolean) as MoreMove[]
}

function solveDomino(start: DominoRound): MoreMove[] {
  const total = start.rows * start.cols
  const cover = Array(total).fill(-1)
  const moves: MoreMove[] = []
  const used = new Set<string>()
  const dfs = (cell: number): boolean => {
    if (cell >= total) return true
    if (cover[cell] >= 0) return dfs(cell + 1)
    const r = Math.floor(cell / start.cols)
    const c = cell % start.cols
    const options = [cell + 1, cell + start.cols].filter((other) => {
      if (other >= total) return false
      if (cover[other] >= 0) return false
      if (other === cell + 1 && Math.floor(other / start.cols) !== r) return false
      const lo = Math.min(start.nums[cell], start.nums[other])
      const hi = Math.max(start.nums[cell], start.nums[other])
      return !used.has(`${lo}-${hi}`)
    })
    for (const other of options) {
      const lo = Math.min(start.nums[cell], start.nums[other])
      const hi = Math.max(start.nums[cell], start.nums[other])
      used.add(`${lo}-${hi}`)
      const id = moves.length
      cover[cell] = id
      cover[other] = id
      moves.push({ op: 'domino', a: cell, b: other })
      if (dfs(cell + 1)) return true
      moves.pop()
      cover[cell] = -1
      cover[other] = -1
      used.delete(`${lo}-${hi}`)
    }
    return false
  }
  return dfs(0) ? moves : []
}

function solveGear(start: GearRound): MoreMove[] {
  const key = (rot: number[]) => rot.join(',')
  const root = key(start.rot)
  const queue = [start]
  const prev = new Map<string, { from: string; move: MoreMove }>()
  const seen = new Set([root])
  while (queue.length) {
    const round = queue.shift() ?? start
    const here = key(round.rot)
    if (gearWon(round)) return pathFrom(here, root, prev)
    round.teeth.forEach((_, index) => {
      const next = gearTurn(round, index)
      const mark = key(next.rot)
      if (seen.has(mark)) return
      seen.add(mark)
      prev.set(mark, { from: here, move: { op: 'gear', index } })
      queue.push(next)
    })
  }
  return []
}

function solveSlither(start: SlitherRound): MoreMove[] {
  void start
  const moves: MoreMove[] = []
  ;[0, 1, 2, 4, 5, 8, 9, 11, 13, 14, 16, 19].forEach((index) => moves.push({ op: 'slither', axis: 'h', index }))
  ;[0, 3, 7, 8, 10, 14, 15, 16, 18, 19].forEach((index) => moves.push({ op: 'slither', axis: 'v', index }))
  return moves
}

function solveMine(start: MineRound): MoreMove[] {
  return start.mines
    .map((mine, index) => (!mine ? ({ op: 'mine' as const, index }) : null))
    .filter(Boolean) as MoreMove[]
}

function solveCipher(start: CipherRound): MoreMove[] {
  const moves: MoreMove[] = []
  start.target.forEach((value, index) => {
    for (let tap = 0; tap < value; tap += 1) moves.push({ op: 'cipher', index })
  })
  return moves
}

export function solveMore(round: MoreRound): MoreMove[] {
  if (round.kind === 'flow') return solveFlow(round)
  if (round.kind === 'peg') return solvePeg(round)
  if (round.kind === 'match') return solveMatch(round)
  if (round.kind === 'pack') return solvePack(round)
  if (round.kind === 'bridge') return solveBridge(round)
  if (round.kind === 'tilt') return solveTilt(round)
  if (round.kind === 'sky') return solveSky(round)
  if (round.kind === 'knight') return solveKnight(round)
  if (round.kind === 'queen') return solveQueen(round)
  if (round.kind === 'code') return solveCode(round)
  if (round.kind === 'akari') return solveAkari(round)
  if (round.kind === 'domino') return solveDomino(round)
  if (round.kind === 'gear') return solveGear(round)
  if (round.kind === 'slither') return solveSlither(round)
  if (round.kind === 'mine') return solveMine(round)
  return solveCipher(round)
}

export function applyMore(round: MoreRound, move: MoreMove): { round: MoreRound; err?: string } | null {
  if (move.op === 'flow' && round.kind === 'flow') {
    const next = flowApply(round, move.color, move.path)
    if (next === 'bad') return { round, err: 'flow' }
    return { round: next }
  }
  if (move.op === 'peg' && round.kind === 'peg') {
    const next = pegJump(round, move.from, move.to)
    if (!next) return { round, err: 'peg' }
    return { round: next }
  }
  if (move.op === 'match' && round.kind === 'match') {
    const next = matchMove(round, move.from, move.to)
    if (next === 'limit') return { round, err: 'limit' }
    if (!next) return { round, err: 'match' }
    return { round: next }
  }
  if (move.op === 'pack' && round.kind === 'pack') {
    const next = packPlace(round, move.id, move.r, move.c, move.rot)
    if (!next) return { round, err: 'pack' }
    return { round: next }
  }
  if (move.op === 'pack-off' && round.kind === 'pack') return { round: packRemove(round, move.id) }
  if (move.op === 'bridge' && round.kind === 'bridge') {
    const next = bridgeToggle(round, move.a, move.b)
    if (next === 'cross') return { round, err: 'cross' }
    if (!next) return { round, err: 'bridge' }
    return { round: next }
  }
  if (move.op === 'tilt' && round.kind === 'tilt') {
    const next = tiltRoll(round, move.dir)
    if (next === 'pit') return { round, err: 'pit' }
    return { round: next }
  }
  if (move.op === 'sky' && round.kind === 'sky') return { round: skyTap(round, move.index) }
  if (move.op === 'knight' && round.kind === 'knight') {
    const next = knightStep(round, move.to)
    if (!next) return { round, err: 'knight' }
    return { round: next }
  }
  if (move.op === 'queen' && round.kind === 'queen') return { round: queenToggle(round, move.index) }
  if (move.op === 'code-set' && round.kind === 'code') return { round: codeSet(round, move.index, move.color) }
  if (move.op === 'code-go' && round.kind === 'code') {
    const next = codeGo(round)
    if (next === 'limit' || next === 'code') return { round, err: next }
    return { round: next }
  }
  if (move.op === 'akari' && round.kind === 'akari') {
    const next = akariToggle(round, move.index)
    if (!next) return { round, err: 'akari' }
    return { round: next }
  }
  if (move.op === 'domino' && round.kind === 'domino') {
    const next = dominoToggle(round, move.a, move.b)
    if (next === 'pair') return { round, err: 'pair' }
    if (!next) return { round, err: 'domino' }
    return { round: next }
  }
  if (move.op === 'gear' && round.kind === 'gear') return { round: gearTurn(round, move.index) }
  if (move.op === 'slither' && round.kind === 'slither') return { round: slitherToggle(round, move.axis, move.index) }
  if (move.op === 'mine' && round.kind === 'mine') {
    const next = mineOpen(round, move.index)
    if (next === 'boom') return { round, err: 'boom' }
    return { round: next }
  }
  if (move.op === 'cipher' && round.kind === 'cipher') {
    const next = move.to === undefined ? cipherTurn(round, move.index) : cipherSet(round, move.index, move.to)
    return { round: next }
  }
  return null
}

export function moreWon(round: MoreRound) {
  if (round.kind === 'flow') return flowWon(round)
  if (round.kind === 'peg') return pegWon(round)
  if (round.kind === 'match') return matchWon(round)
  if (round.kind === 'pack') return packWon(round)
  if (round.kind === 'bridge') return bridgeWon(round)
  if (round.kind === 'tilt') return tiltWon(round)
  if (round.kind === 'sky') return skyWon(round)
  if (round.kind === 'knight') return knightWon(round)
  if (round.kind === 'queen') return queenWon(round)
  if (round.kind === 'code') return codeWon(round)
  if (round.kind === 'akari') return akariWon(round)
  if (round.kind === 'domino') return dominoWon(round)
  if (round.kind === 'gear') return gearWon(round)
  if (round.kind === 'slither') return slitherWon(round)
  if (round.kind === 'mine') return mineWon(round)
  return cipherWon(round)
}

void clone
void packShape
