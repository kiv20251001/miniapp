/**
 * 「3D 几何体」里各种立体图形的数据：只给顶点，面、棱用凸包算出来；
 * 再给每种图形找一张不重叠的展开图（从底面出发的展开树）。纯计算，不依赖 three.js。
 */
export type Solid = 'cube' | 'cuboid' | 'prism3' | 'prism5' | 'prism6' | 'pyramid' | 'tetra' | 'octa' | 'dodeca' | 'icosa'
export type Vec = [number, number, number]

export const SOLIDS: Solid[] = ['cube', 'cuboid', 'prism3', 'prism5', 'prism6', 'pyramid', 'tetra', 'octa', 'dodeca', 'icosa']

export type Polyhedron = {
  vertices: Vec[]
  /** 每个面的顶点下标，从外面看逆时针 */
  faces: number[][]
  normals: Vec[]
  edges: Array<[number, number]>
  /** 平行的面分成一组，配色时同组同色；长方体按法线方向 x、y、z 分 0、1、2 */
  groups: number[]
  /** 长方体、正方体：[长 x, 高 y, 宽 z] */
  box: Vec | null
  radius: number
}

export type Unfold = {
  /** 父面在前、子面在后 */
  order: number[]
  parent: number[]
  /** 折痕：和父面共用的那条棱的两个顶点 */
  hinge: Array<[number, number] | null>
  /** 摊平时绕折痕转的角度（弧度，带方向） */
  angle: number[]
  /** 摊平后每个面的顶点 */
  flat: Vec[][]
}

const EPS = 1e-6
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const mul = (a: Vec, s: number): Vec => [a[0] * s, a[1] * s, a[2] * s]
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const length = (a: Vec) => Math.hypot(a[0], a[1], a[2])
const normalize = (a: Vec): Vec => mul(a, 1 / (length(a) || 1))

/** 绕过 origin、方向 axis（单位向量）的轴转 angle。 */
export function rotateAbout(point: Vec, origin: Vec, axis: Vec, angle: number): Vec {
  const p = sub(point, origin)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const rotated = add(add(mul(p, cos), mul(cross(axis, p), sin)), mul(axis, dot(axis, p) * (1 - cos)))
  return add(rotated, origin)
}

const PHI = (1 + Math.sqrt(5)) / 2

function ring(sides: number, radius: number, y: number, turn: number): Vec[] {
  return Array.from({ length: sides }, (_, index) => {
    const angle = turn + (index * 2 * Math.PI) / sides
    return [radius * Math.sin(angle), y, radius * Math.cos(angle)] as Vec
  })
}

function signs(values: number[][]): Vec[] {
  const out: Vec[] = []
  for (const [x, y, z] of values) {
    for (const sx of x ? [1, -1] : [1]) for (const sy of y ? [1, -1] : [1]) for (const sz of z ? [1, -1] : [1]) out.push([x * sx, y * sy, z * sz])
  }
  return out
}

function rawVertices(solid: Solid): Vec[] {
  switch (solid) {
    case 'cube':
      return signs([[1, 1, 1]])
    case 'cuboid':
      return signs([[1.4, 0.75, 0.9]])
    case 'prism3':
      return [...ring(3, 1.25, -0.95, Math.PI), ...ring(3, 1.25, 0.95, Math.PI)]
    case 'prism5':
      return [...ring(5, 1.15, -0.85, Math.PI / 5), ...ring(5, 1.15, 0.85, Math.PI / 5)]
    case 'prism6':
      return [...ring(6, 1.1, -0.8, Math.PI / 6), ...ring(6, 1.1, 0.8, Math.PI / 6)]
    case 'pyramid':
      return [...signs([[1.1, 0, 1.1]]).map(([x, , z]) => [x, -0.8, z] as Vec), [0, 1.1, 0]]
    case 'tetra':
      return [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]]
    case 'octa':
      return signs([[1, 0, 0], [0, 1, 0], [0, 0, 1]])
    case 'dodeca':
      return signs([[1, 1, 1], [0, 1 / PHI, PHI], [1 / PHI, PHI, 0], [PHI, 0, 1 / PHI]])
    case 'icosa':
      return signs([[0, 1, PHI], [1, PHI, 0], [PHI, 0, 1]])
  }
}

/** 小顶点集的凸包：三点定一个平面，其余点都在一侧就是一个面。 */
function hull(points: Vec[]) {
  const faces: number[][] = []
  const normals: Vec[] = []
  const seen = new Set<string>()
  const n = points.length
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      for (let k = j + 1; k < n; k += 1) {
        let normal = cross(sub(points[j], points[i]), sub(points[k], points[i]))
        if (length(normal) < EPS) continue
        normal = normalize(normal)
        const d = dot(normal, points[i])
        let above = 0
        let below = 0
        const on: number[] = []
        points.forEach((point, m) => {
          const s = dot(normal, point) - d
          if (s > EPS) above += 1
          else if (s < -EPS) below += 1
          else on.push(m)
        })
        if (above && below) continue
        if (above) normal = mul(normal, -1)
        const key = on.join(',')
        if (seen.has(key)) continue
        seen.add(key)
        const center = mul(on.reduce((sum, m) => add(sum, points[m]), [0, 0, 0] as Vec), 1 / on.length)
        const u = normalize(sub(points[on[0]], center))
        const v = cross(normal, u)
        on.sort((a, b) => {
          const pa = sub(points[a], center)
          const pb = sub(points[b], center)
          return Math.atan2(dot(pa, v), dot(pa, u)) - Math.atan2(dot(pb, v), dot(pb, u))
        })
        faces.push(on)
        normals.push(normal)
      }
    }
  }
  return { faces, normals }
}

/** 转到最朝下的那个面贴地，再按包围盒居中。 */
function settle(points: Vec[]): Vec[] {
  const { normals } = hull(points)
  let best = 0
  normals.forEach((normal, index) => {
    if (normal[1] < normals[best][1]) best = index
  })
  const from = normals[best]
  const to: Vec = [0, -1, 0]
  const axis = cross(from, to)
  const angle = Math.acos(Math.max(-1, Math.min(1, dot(from, to))))
  const rotated = length(axis) < EPS ? points : points.map((point) => rotateAbout(point, [0, 0, 0], normalize(axis), angle))
  const min: Vec = [Infinity, Infinity, Infinity]
  const max: Vec = [-Infinity, -Infinity, -Infinity]
  for (const point of rotated) {
    for (let axisIndex = 0; axisIndex < 3; axisIndex += 1) {
      min[axisIndex] = Math.min(min[axisIndex], point[axisIndex])
      max[axisIndex] = Math.max(max[axisIndex], point[axisIndex])
    }
  }
  const center = mul(add(min, max), 0.5)
  return rotated.map((point) => sub(point, center))
}

/** 场景默认相机的水平角（CubeScene.resetView 的 yaw）。 */
const VIEW_YAW = -0.55

/**
 * 绕竖轴转一下，让两个侧面中间的棱大致对着默认视角。
 * 不转的话正四面体、三棱柱会有一个面正对相机，看上去只是一个平面图形。
 */
function faceTheView(points: Vec[]): Vec[] {
  const sides = hull(points).normals.filter((normal) => Math.abs(normal[1]) < 0.95)
  if (!sides.length) return points
  const azimuth = Math.atan2(sides[0][0], sides[0][2])
  // 偏离正中一点，两个面一大一小更有立体感
  const turn = VIEW_YAW + (0.7 * Math.PI) / sides.length - azimuth
  return points.map((point) => rotateAbout(point, [0, 0, 0], [0, 1, 0], turn))
}

/** 除正方体、长方体外，统一缩放到外接球半径 1.6。 */
const TARGET_RADIUS = 1.6

const cache = new Map<Solid, Polyhedron>()

export function polyhedron(solid: Solid): Polyhedron {
  const hit = cache.get(solid)
  if (hit) return hit
  let vertices = settle(rawVertices(solid))
  const isBox = solid === 'cube' || solid === 'cuboid'
  if (!isBox) {
    const r = Math.max(...vertices.map(length))
    vertices = faceTheView(vertices.map((point) => mul(point, TARGET_RADIUS / r)))
  }
  const { faces, normals } = hull(vertices)
  const edgeKeys = new Set<string>()
  const edges: Array<[number, number]> = []
  for (const face of faces) {
    face.forEach((a, index) => {
      const b = face[(index + 1) % face.length]
      const key = a < b ? `${a},${b}` : `${b},${a}`
      if (edgeKeys.has(key)) return
      edgeKeys.add(key)
      edges.push(a < b ? [a, b] : [b, a])
    })
  }
  const groups: number[] = []
  if (isBox) {
    normals.forEach((normal) => groups.push(normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)))))
  } else {
    let next = 0
    normals.forEach((normal, index) => {
      const twin = normals.findIndex((other, at) => at < index && dot(other, normal) < -1 + 1e-4)
      groups.push(twin >= 0 ? groups[twin] : next++)
    })
  }
  const box: Vec | null = isBox ? [0, 1, 2].map((axis) => Math.max(...vertices.map((point) => point[axis])) * 2) as Vec : null
  const result: Polyhedron = { vertices, faces, normals, edges, groups, box, radius: Math.max(...vertices.map(length)) }
  cache.set(solid, result)
  return result
}

/** 和这个面平行（相对）的面，没有时返回 -1。 */
export function oppositeFace(poly: Polyhedron, index: number) {
  const normal = poly.normals[index]
  return poly.normals.findIndex((other) => dot(other, normal) < -1 + 1e-4)
}

export function counts(poly: Polyhedron) {
  return { face: poly.faces.length, edge: poly.edges.length, vertex: poly.vertices.length }
}

// ---- 展开图 ----

/** 固定种子的随机数，同一种图形每次得到同一张展开图。 */
function seeded(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function sharedEdge(a: number[], b: number[]): [number, number] | null {
  for (let i = 0; i < a.length; i += 1) {
    const p = a[i]
    const q = a[(i + 1) % a.length]
    for (let j = 0; j < b.length; j += 1) {
      if (b[j] === q && b[(j + 1) % b.length] === p) return [p, q]
    }
  }
  return null
}

function buildUnfold(poly: Polyhedron, root: number, random: (() => number) | null): Unfold {
  const count = poly.faces.length
  const parent = Array<number>(count).fill(-1)
  const hinge: Array<[number, number] | null> = Array(count).fill(null)
  const angle = Array<number>(count).fill(0)
  const order = [root]
  const visited = new Set([root])
  for (let head = 0; head < order.length; head += 1) {
    const current = order[head]
    const neighbors: Array<[number, [number, number]]> = []
    for (let other = 0; other < count; other += 1) {
      if (visited.has(other)) continue
      const edge = sharedEdge(poly.faces[current], poly.faces[other])
      if (edge) neighbors.push([other, edge])
    }
    if (random) neighbors.sort(() => random() - 0.5)
    for (const [other, edge] of neighbors) {
      if (visited.has(other)) continue
      visited.add(other)
      parent[other] = current
      hinge[other] = edge
      order.push(other)
    }
  }
  for (const face of order) {
    const edge = hinge[face]
    if (!edge) continue
    const a = poly.vertices[edge[0]]
    const axis = normalize(sub(poly.vertices[edge[1]], a))
    const from = poly.normals[face]
    const to = poly.normals[parent[face]]
    const turn = Math.acos(Math.max(-1, Math.min(1, dot(from, to))))
    const plus = rotateAbout(from, [0, 0, 0], axis, turn)
    angle[face] = dot(plus, to) > dot(rotateAbout(from, [0, 0, 0], axis, -turn), to) ? turn : -turn
  }
  const flatPoint = (face: number, point: Vec): Vec => {
    let p = point
    for (let at = face; parent[at] >= 0; at = parent[at]) {
      const edge = hinge[at]!
      const a = poly.vertices[edge[0]]
      p = rotateAbout(p, a, normalize(sub(poly.vertices[edge[1]], a)), angle[at])
    }
    return p
  }
  const flat = poly.faces.map((face, index) => face.map((vertex) => flatPoint(index, poly.vertices[vertex])))
  return { order, parent, hinge, angle, flat }
}

type P2 = [number, number]

function overlaps(a: P2[], b: P2[]) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i += 1) {
      const p = poly[i]
      const q = poly[(i + 1) % poly.length]
      const nx = q[1] - p[1]
      const ny = p[0] - q[0]
      const project = (points: P2[]) => points.map(([x, y]) => x * nx + y * ny)
      const pa = project(a)
      const pb = project(b)
      if (Math.max(...pa) <= Math.min(...pb) + 1e-6 || Math.max(...pb) <= Math.min(...pa) + 1e-6) return false
    }
  }
  return true
}

/** 摊平后面和面有没有叠在一起（每个面往里缩一点，共用的棱不算）。 */
function hasOverlap(flat: Vec[][]) {
  const shapes = flat.map((points) => {
    const cx = points.reduce((sum, p) => sum + p[0], 0) / points.length
    const cz = points.reduce((sum, p) => sum + p[2], 0) / points.length
    return points.map(([x, , z]) => [cx + (x - cx) * 0.96, cz + (z - cz) * 0.96] as P2)
  })
  for (let i = 0; i < shapes.length; i += 1) {
    for (let j = i + 1; j < shapes.length; j += 1) if (overlaps(shapes[i], shapes[j])) return true
  }
  return false
}

function spread(flat: Vec[][]) {
  const points = flat.flat()
  const cx = points.reduce((sum, p) => sum + p[0], 0) / points.length
  const cz = points.reduce((sum, p) => sum + p[2], 0) / points.length
  return Math.max(...points.map(([x, , z]) => Math.hypot(x - cx, z - cz)))
}

const unfoldCache = new Map<Solid, Unfold>()

/** 从底面出发，试几十种展开树，取不重叠里最紧凑的一张。 */
export function unfoldSolid(solid: Solid): Unfold {
  const hit = unfoldCache.get(solid)
  if (hit) return hit
  const poly = polyhedron(solid)
  let root = 0
  poly.normals.forEach((normal, index) => {
    if (normal[1] < poly.normals[root][1]) root = index
  })
  const random = seeded(solid.length * 7919 + poly.faces.length)
  let best: Unfold | null = null
  let bestSpread = Infinity
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const unfold = buildUnfold(poly, root, attempt ? random : null)
    if (hasOverlap(unfold.flat)) continue
    const size = spread(unfold.flat)
    if (size < bestSpread - 1e-6) {
      best = unfold
      bestSpread = size
    }
  }
  const result = best ?? buildUnfold(poly, root, null)
  unfoldCache.set(solid, result)
  return result
}
