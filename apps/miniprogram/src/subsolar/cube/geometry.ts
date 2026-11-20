/**
 * 「3D 几何体」里正方体部分的纯计算：展开图、折叠模拟、小方块堆、三视图、涂色计数和随机出题。
 * 不依赖 three.js，3D 场景、小测验和打印练习题共用。
 *
 * 坐标约定（3D 场景、打印图一致）：x 向右，y 向上，z 朝向观察者。
 * 「正面」是 +z 那一面，「左面」是 -x 那一面。展开图格子 [列, 行]，列对应 +x，行对应 +z。
 */

export type Cell = [number, number]
export type NetFamily = '141' | '231' | '222' | '33'
export type Net = { id: string; family: NetFamily; cells: Cell[] }

/** 正方体的 11 种展开图。 */
export const CUBE_NETS: Net[] = [
  { id: '141-a', family: '141', cells: [[0, 0], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2]] },
  { id: '141-b', family: '141', cells: [[0, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]] },
  { id: '141-c', family: '141', cells: [[0, 0], [0, 1], [1, 1], [2, 1], [3, 1], [2, 2]] },
  { id: '141-d', family: '141', cells: [[0, 0], [0, 1], [1, 1], [2, 1], [3, 1], [3, 2]] },
  { id: '141-e', family: '141', cells: [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]] },
  { id: '141-f', family: '141', cells: [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [2, 2]] },
  { id: '231-a', family: '231', cells: [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1], [1, 2]] },
  { id: '231-b', family: '231', cells: [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1], [2, 2]] },
  { id: '231-c', family: '231', cells: [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1], [3, 2]] },
  { id: '222', family: '222', cells: [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2]] },
  { id: '33', family: '33', cells: [[0, 0], [1, 0], [2, 0], [2, 1], [3, 1], [4, 1]] },
]

/** 常见的「折不成」：田字形、凹字形、一行五个、两个面叠在一起。 */
export const BAD_NETS: Cell[][] = [
  [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
  [[0, 0], [1, 0], [0, 1], [1, 1], [2, 1], [3, 1]],
  [[0, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1]],
  [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [0, 1]],
  [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [2, 1]],
  [[1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [3, 1]],
  [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1], [4, 1]],
  [[0, 0], [0, 1], [1, 1], [2, 1], [2, 0], [3, 1]],
  [[0, 0], [1, 0], [2, 0], [2, 1], [3, 1], [3, 2]],
  [[0, 1], [1, 1], [1, 0], [2, 0], [3, 0], [3, 1]],
  [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [2, 2]],
]

export const DIRS = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] } as const
export type Dir = keyof typeof DIRS

export type FoldNode = {
  /** 在 cells 里的下标 */
  index: number
  parent: number
  /** 从父格子到这一格的方向 */
  dir: Dir | null
  depth: number
}

const key = (cell: Cell) => `${cell[0]},${cell[1]}`

/** 以第一个格子为底面，广度优先连成一棵折叠树。不连通时返回 null。 */
export function foldTree(cells: Cell[], root = 0): FoldNode[] | null {
  const at = new Map(cells.map((cell, index) => [key(cell), index]))
  const nodes: FoldNode[] = [{ index: root, parent: -1, dir: null, depth: 0 }]
  const seen = new Set([root])
  for (let head = 0; head < nodes.length; head += 1) {
    const node = nodes[head]
    const [x, y] = cells[node.index]
    for (const [dir, [dx, dy]] of Object.entries(DIRS) as Array<[Dir, readonly [number, number]]>) {
      const next = at.get(key([x + dx, y + dy]))
      if (next === undefined || seen.has(next)) continue
      seen.add(next)
      nodes.push({ index: next, parent: node.index, dir, depth: node.depth + 1 })
    }
  }
  return nodes.length === cells.length ? nodes : null
}

/**
 * 把正方体放在底面格子上，沿着展开图「滚」过去，每一格贴地的是正方体的哪一面。
 * 面的编号 0..5，0/1、2/3、4/5 互为对面。展开图里有环（田字）时按折叠树走，会出现两格同一面。
 */
export function rollFaces(cells: Cell[]): number[] | null {
  const tree = foldTree(cells)
  if (!tree) return null
  // 朝向：下、上、+x、-x、+z、-z 各是哪一面
  type Pose = { down: number; up: number; px: number; nx: number; pz: number; nz: number }
  const poses = new Map<number, Pose>()
  poses.set(tree[0].index, { down: 0, up: 1, px: 2, nx: 3, pz: 4, nz: 5 })
  for (const node of tree.slice(1)) {
    const p = poses.get(node.parent)!
    let next: Pose
    if (node.dir === 'right') next = { down: p.px, px: p.up, up: p.nx, nx: p.down, pz: p.pz, nz: p.nz }
    else if (node.dir === 'left') next = { down: p.nx, nx: p.up, up: p.px, px: p.down, pz: p.pz, nz: p.nz }
    else if (node.dir === 'down') next = { down: p.pz, pz: p.up, up: p.nz, nz: p.down, px: p.px, nx: p.nx }
    else next = { down: p.nz, nz: p.up, up: p.pz, pz: p.down, px: p.px, nx: p.nx }
    poses.set(node.index, next)
  }
  return cells.map((_, index) => poses.get(index)!.down)
}

export function hasSquareBlock(cells: Cell[]) {
  const set = new Set(cells.map(key))
  return cells.some(([x, y]) => set.has(key([x + 1, y])) && set.has(key([x, y + 1])) && set.has(key([x + 1, y + 1])))
}

/** 能不能折成正方体：6 个格子连在一起，没有田字块，折起来 6 个面各不相同。 */
export function isCubeNet(cells: Cell[]) {
  if (cells.length !== 6 || hasSquareBlock(cells)) return false
  const faces = rollFaces(cells)
  return Boolean(faces && new Set(faces).size === 6)
}

/** 折起来后和第 index 格相对的那一格。 */
export function oppositeCell(cells: Cell[], index: number) {
  const faces = rollFaces(cells)
  if (!faces) return -1
  return faces.findIndex((face) => face === (faces[index] ^ 1))
}

/** 折起来叠在一起的格子（折不成时用来标红）。 */
export function overlapCells(cells: Cell[]) {
  const faces = rollFaces(cells)
  if (!faces) return []
  const out = new Set<number>()
  faces.forEach((face, index) => {
    faces.forEach((other, at) => {
      if (at !== index && other === face) out.add(index)
    })
  })
  if (hasSquareBlock(cells)) {
    const set = new Set(cells.map(key))
    cells.forEach(([x, y]) => {
      for (const [ox, oy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
        const bx = x + ox
        const by = y + oy
        if ([[0, 0], [1, 0], [0, 1], [1, 1]].every(([dx, dy]) => set.has(key([bx + dx, by + dy])))) {
          cells.forEach((cell, index) => {
            if (cell[0] >= bx && cell[0] <= bx + 1 && cell[1] >= by && cell[1] <= by + 1) out.add(index)
          })
        }
      }
    })
  }
  return [...out]
}

export function netBounds(cells: Cell[]) {
  const xs = cells.map((cell) => cell[0])
  const ys = cells.map((cell) => cell[1])
  return { minX: Math.min(...xs), minY: Math.min(...ys), cols: Math.max(...xs) - Math.min(...xs) + 1, rows: Math.max(...ys) - Math.min(...ys) + 1 }
}

/** 旋转 90°×turns，可选左右翻转，再挪回从 0 开始。出题时让同一种展开图换个样子。 */
export function transformNet(cells: Cell[], turns: number, mirror: boolean): Cell[] {
  let out = cells.map(([x, y]) => [mirror ? -x : x, y] as Cell)
  for (let index = 0; index < ((turns % 4) + 4) % 4; index += 1) out = out.map(([x, y]) => [-y, x] as Cell)
  const { minX, minY } = netBounds(out)
  return out.map(([x, y]) => [x - minX, y - minY] as Cell)
}

/** 横着摆放（列数不少于行数），手机上和 A4 格子里都更好放。 */
export function landscape(cells: Cell[]) {
  const { cols, rows } = netBounds(cells)
  return rows > cols ? transformNet(cells, 1, false) : cells
}

// ---- 随机工具 ----

export function randInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

export function pickOne<T>(list: readonly T[]) {
  return list[Math.floor(Math.random() * list.length)]
}

export function shuffle<T>(list: readonly T[]) {
  const out = [...list]
  for (let index = out.length - 1; index > 0; index -= 1) {
    const at = Math.floor(Math.random() * (index + 1))
    ;[out[index], out[at]] = [out[at], out[index]]
  }
  return out
}

export function randomNet(valid: boolean): Cell[] {
  const base = valid ? pickOne(CUBE_NETS).cells : pickOne(BAD_NETS)
  return landscape(transformNet(base, randInt(0, 3), Math.random() < 0.5))
}

// ---- 小方块堆 ----

/** heights[z][x]：第 z 行（从后往前）第 x 列叠了几块。 */
export type Stack = number[][]
export type View = 'front' | 'top' | 'left'
/** 视图：rows 从上到下，每行从左到右，true 是看到的正方形。 */
export type ViewGrid = boolean[][]

export function stackCount(stack: Stack) {
  return stack.reduce((sum, row) => sum + row.reduce((a, b) => a + b, 0), 0)
}

export function stackSize(stack: Stack) {
  return { depth: stack.length, width: stack[0]?.length ?? 0, height: Math.max(0, ...stack.flat()) }
}

/** 正面从 +z 往里看；左面从 -x 往右看，前面在右手边；上面从上往下看，前面在下边。 */
export function stackView(stack: Stack, view: View): ViewGrid {
  const { depth, width, height } = stackSize(stack)
  if (view === 'top') {
    return Array.from({ length: depth }, (_, z) => Array.from({ length: width }, (_, x) => stack[z][x] > 0))
  }
  const columns =
    view === 'front'
      ? Array.from({ length: width }, (_, x) => Math.max(...stack.map((row) => row[x])))
      : Array.from({ length: depth }, (_, z) => Math.max(...stack[z]))
  return Array.from({ length: height }, (_, row) => columns.map((h) => h >= height - row))
}

export function trimView(grid: ViewGrid): ViewGrid {
  let rows = grid.filter((row) => row.some(Boolean))
  if (!rows.length) return [[false]]
  const cols = rows[0].map((_, x) => rows.some((row) => row[x]))
  const first = cols.indexOf(true)
  const last = cols.lastIndexOf(true)
  rows = rows.map((row) => row.slice(first, last + 1))
  return rows
}

export const viewKey = (grid: ViewGrid) => trimView(grid).map((row) => row.map((on) => (on ? 1 : 0)).join('')).join('/')

function connected(stack: Stack) {
  const cells: Array<[number, number]> = []
  stack.forEach((row, z) => row.forEach((h, x) => h > 0 && cells.push([x, z])))
  if (!cells.length) return false
  const set = new Set(cells.map(([x, z]) => `${x},${z}`))
  const seen = new Set([`${cells[0][0]},${cells[0][1]}`])
  const queue = [cells[0]]
  while (queue.length) {
    const [x, z] = queue.shift()!
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const id = `${x + dx},${z + dz}`
      if (set.has(id) && !seen.has(id)) {
        seen.add(id)
        queue.push([x + dx, z + dz])
      }
    }
  }
  return seen.size === cells.length
}

export type StackLevel = 'easy' | 'medium' | 'hard'

const STACK_SHAPES: Record<StackLevel, { width: number; depth: number; height: number; min: number; max: number }> = {
  easy: { width: 3, depth: 2, height: 2, min: 3, max: 6 },
  medium: { width: 3, depth: 3, height: 2, min: 5, max: 9 },
  hard: { width: 3, depth: 3, height: 3, min: 7, max: 14 },
}

/** 随机搭一堆：每列从地面往上叠，底面连成一片，前后左右都不是空行。 */
export function randomStack(level: StackLevel, avoid?: Stack): Stack {
  const shape = STACK_SHAPES[level]
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const stack: Stack = Array.from({ length: shape.depth }, () =>
      Array.from({ length: shape.width }, () => (Math.random() < 0.72 ? randInt(1, shape.height) : 0)),
    )
    const count = stackCount(stack)
    if (count < shape.min || count > shape.max) continue
    if (stack.some((row) => row.every((h) => h === 0))) continue
    if (stack[0].some((_, x) => stack.every((row) => row[x] === 0))) continue
    if (!connected(stack)) continue
    if (stackSize(stack).height < Math.min(2, shape.height)) continue
    if (avoid && JSON.stringify(avoid) === JSON.stringify(stack)) continue
    return stack
  }
  return [[1, 1], [1, 0]]
}

/** 看不见的方块：被压在下面、上面和前面、左面都被挡住的。 */
export function hiddenCount(stack: Stack) {
  let hidden = 0
  const { depth, width } = stackSize(stack)
  for (let z = 0; z < depth; z += 1) {
    for (let x = 0; x < width; x += 1) {
      for (let y = 0; y < stack[z][x]; y += 1) {
        const top = y + 1 < stack[z][x]
        const front = z + 1 < depth && stack[z + 1][x] > y
        const left = x > 0 && stack[z][x - 1] > y
        if (top && front && left) hidden += 1
      }
    }
  }
  return hidden
}

/** 三视图选项：正确答案 + 另外两个方向的视图 + 随手改一格的样子，去重后凑够 4 个。 */
export function viewOptions(stack: Stack, view: View): ViewGrid[] {
  const answer = trimView(stackView(stack, view))
  const seen = new Set([viewKey(answer)])
  const out: ViewGrid[] = [answer]
  const push = (grid: ViewGrid) => {
    const trimmed = trimView(grid)
    const id = viewKey(trimmed)
    if (seen.has(id) || !trimmed.flat().some(Boolean)) return
    seen.add(id)
    out.push(trimmed)
  }
  for (const other of ['front', 'top', 'left'] as View[]) if (other !== view) push(stackView(stack, other))
  push(answer.map((row) => [...row].reverse()))
  for (let attempt = 0; out.length < 4 && attempt < 60; attempt += 1) {
    const grid = answer.map((row) => [...row])
    const rows = grid.length
    const cols = grid[0].length
    const extra = Math.random() < 0.4
    if (extra) {
      const wider = grid.map((row) => [...row, false])
      wider[rows - 1][cols] = true
      push(wider)
    } else {
      const y = randInt(0, rows - 1)
      const x = randInt(0, cols - 1)
      grid[y][x] = !grid[y][x]
      // 视图里方块不会悬空，只接受底下有支撑的
      if (view !== 'top' && grid.some((row, ry) => row.some((on, cx) => on && ry + 1 < rows && !grid[ry + 1][cx]))) continue
      push(grid)
    }
  }
  return shuffle(out.slice(0, 4))
}

// ---- 计算 ----

export type Box = [number, number, number]

export function edgeSum([l, w, h]: Box) {
  return 4 * (l + w + h)
}

export function surfaceArea([l, w, h]: Box) {
  return 2 * (l * w + l * h + w * h)
}

export function volume([l, w, h]: Box) {
  return l * w * h
}

/** 棱长 n 的正方体表面涂色后切成 1×1×1：三面、两面、一面、没涂色各几块。 */
export function paintCounts(n: number): [number, number, number, number] {
  if (n <= 1) return [0, 0, 0, 0]
  const inner = n - 2
  return [8, 12 * inner, 6 * inner * inner, inner * inner * inner]
}

/** 在一个大正方体（或长方体）里，第 (x, y, z) 块露在外面的面数。 */
export function outerFaces([l, h, w]: [number, number, number], x: number, y: number, z: number) {
  return Number(x === 0) + Number(x === l - 1) + Number(y === 0) + Number(y === h - 1) + Number(z === 0) + Number(z === w - 1)
}

/** 数字选项：正确答案加上几个相近、常见算错的数。 */
export function numberOptions(answer: number, wrongs: number[]) {
  const seen = new Set([answer])
  const out = [answer]
  for (const value of shuffle(wrongs)) {
    if (out.length >= 4) break
    if (value > 0 && !seen.has(value)) {
      seen.add(value)
      out.push(value)
    }
  }
  for (let step = 1; out.length < 4; step += 1) {
    for (const value of [answer + step, answer - step]) {
      if (out.length < 4 && value > 0 && !seen.has(value)) {
        seen.add(value)
        out.push(value)
      }
    }
  }
  return shuffle(out)
}
