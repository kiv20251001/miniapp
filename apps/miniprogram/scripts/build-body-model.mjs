/**
 * 生成「3D 人体器官」的写实人体模型文件 cloud-storage/body/body-v1.bin，上传云存储后小程序按需下载。
 *
 * 数据来源（都是 CC BY 4.0，可商用，需署名并注明修改，见 docs/third-party-assets.md）：
 * - BodyParts3D 4.0（© The Database Center for Life Science）：皮肤、肌肉、骨骼、大脑、心脏、血管、消化和泌尿器官。
 *   2025-02-27 起官方许可页改为 CC BY 4.0（旧的 OBJ 文件头还写着 CC BY-SA 2.1 JP，以许可页为准）。
 *   用 tahfimism/human-atlas 仓库里已转成米、Y 朝上的整理版（MIT 代码 + CC BY 4.0 数据），固定在一个提交上。
 *   皮肤上的外生殖器在 mannequin() 里去掉，给孩子看的版本不带。
 * - HuBMAP Human Reference Atlas「3D Reference Organ Set」男性肺 v1.4：BodyParts3D 没有完整的肺表面，肺用这一份，
 *   按两边都有的支气管树对齐到 BodyParts3D 的坐标里。
 *
 * 处理：按部位挑网格 → 合并、焊接顶点、去掉重合的内壁 → meshoptimizer 减面 → 重新算法线 →
 * 换到 anatomy.ts 的坐标系（脚底 y≈-0.96，头顶 y≈0.95）→ 位置量化成 int16、法线 int8、索引 uint16 →
 * 同时从网格里算出食物旅行、呼吸、血液循环的路线，一起写进文件头。
 *
 * 用法：node scripts/build-body-model.mjs（第一次会下载约 70 MB 原始数据到 .cache/body，之后直接用缓存）
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MeshoptSimplifier } from 'meshoptimizer'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const CACHE = path.join(root, '.cache/body')
const OUT = path.join(root, 'cloud-storage/body/body-v1.bin')

const ATLAS_REPO = 'https://raw.githubusercontent.com/tahfimism/human-atlas/02c818408bdd55ff84e622b910512a68444fb28e'
const ATLAS_FALLBACK = 'https://raw.githubusercontent.com/tahfimism/human-atlas/HEAD'
const HRA_LUNG = 'https://cdn.humanatlas.io/digital-objects/ref-organ/lung-male/v1.4/assets/3d-vh-m-lung.glb'

/** BodyParts3D 身高 1.7195 m（脚底 y=0）；场景里脚底 -0.96、头顶 0.95 */
const SRC_HEIGHT = 1.7195
const SCALE = 1.91 / SRC_HEIGHT
const toScene = (x, y, z) => [x * SCALE, y * SCALE - 0.96, z * SCALE]

// ---- 下载和读取 ----

async function cached(name, urls) {
  const file = path.join(CACHE, name)
  if (existsSync(file)) return readFile(file)
  await mkdir(path.dirname(file), { recursive: true })
  for (const url of urls) {
    const res = await fetch(url)
    if (!res.ok) continue
    const buf = Buffer.from(await res.arrayBuffer())
    await writeFile(file, buf)
    console.log(`downloaded ${name} (${(buf.length / 1e6).toFixed(1)} MB)`)
    return buf
  }
  throw new Error(`下载失败：${name}`)
}

const atlasUrls = (file) => [`${ATLAS_REPO}/public/models/${file}`, `${ATLAS_FALLBACK}/public/models/${file}`]

const atlas = JSON.parse((await cached('atlas.json', atlasUrls('atlas.json'))).toString('utf8'))
const chunkBuffers = []
for (let i = 0; i < atlas.chunks.length; i += 1) chunkBuffers.push(await cached(`body-${i}.bin`, atlasUrls(`body-${i}.bin`)))

/** 一个 BodyParts3D 网格，坐标已换到场景坐标系 */
function bpMesh(part) {
  const buf = chunkBuffers[part.chunk]
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  const src = new Float32Array(ab, part.positions, part.vertexCount * 3)
  const pos = new Float32Array(src.length)
  for (let i = 0; i < src.length; i += 3) pos.set(toScene(src[i], src[i + 1], src[i + 2]), i)
  return { name: part.name, pos, idx: new Uint32Array(new Uint32Array(ab, part.indices, part.indexCount)) }
}

const used = new Set()
/** 按名字挑 BodyParts3D 网格；exclude 排除掉名字里也带关键词的其他结构 */
function bp(include, exclude) {
  const list = atlas.parts.filter((p) => include.test(p.name) && !(exclude && exclude.test(p.name)))
  if (!list.length) console.warn(`  ! 没找到 ${include}`)
  list.forEach((p) => used.add(p.name))
  return list.map(bpMesh)
}

function readGlb(buf) {
  const jsonLength = buf.readUInt32LE(12)
  const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'))
  const bin = buf.subarray(20 + jsonLength + 8)
  const accessor = (index) => {
    const a = json.accessors[index]
    const view = json.bufferViews[a.bufferView]
    const size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type]
    const Type = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }[a.componentType]
    const start = bin.byteOffset + (view.byteOffset || 0) + (a.byteOffset || 0)
    return new Type(bin.buffer.slice(start, start + a.count * size * Type.BYTES_PER_ELEMENT))
  }
  const meshes = []
  for (const node of json.nodes) {
    if (node.mesh === undefined) continue
    for (const prim of json.meshes[node.mesh].primitives) {
      meshes.push({ name: node.name, pos: accessor(prim.attributes.POSITION), idx: Uint32Array.from(accessor(prim.indices)) })
    }
  }
  return meshes
}

// ---- 网格小工具 ----

function merge(list) {
  let vertices = 0
  let indices = 0
  for (const m of list) {
    vertices += m.pos.length / 3
    indices += m.idx.length
  }
  const pos = new Float32Array(vertices * 3)
  const idx = new Uint32Array(indices)
  let v = 0
  let i = 0
  for (const m of list) {
    pos.set(m.pos, v * 3)
    for (let k = 0; k < m.idx.length; k += 1) idx[i + k] = m.idx[k] + v
    v += m.pos.length / 3
    i += m.idx.length
  }
  return { pos, idx }
}

/** 位置相同的顶点合成一个；再去掉两块挨着的器官之间重合的内壁（同样三个顶点出现两次的三角形）。 */
function weld({ pos, idx }, eps = 2e-5) {
  const map = new Map()
  const remap = new Uint32Array(pos.length / 3)
  const out = []
  for (let i = 0; i < pos.length / 3; i += 1) {
    const key = `${Math.round(pos[i * 3] / eps)},${Math.round(pos[i * 3 + 1] / eps)},${Math.round(pos[i * 3 + 2] / eps)}`
    let at = map.get(key)
    if (at === undefined) {
      at = out.length / 3
      map.set(key, at)
      out.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])
    }
    remap[i] = at
  }
  const faces = new Map()
  const tris = []
  for (let i = 0; i < idx.length; i += 3) {
    const a = remap[idx[i]]
    const b = remap[idx[i + 1]]
    const c = remap[idx[i + 2]]
    if (a === b || b === c || a === c) continue
    const key = [a, b, c].sort((x, y) => x - y).join(',')
    faces.set(key, (faces.get(key) ?? 0) + 1)
    tris.push([a, b, c, key])
  }
  const keep = []
  for (const [a, b, c, key] of tris) if (faces.get(key) === 1) keep.push(a, b, c)
  return compact({ pos: new Float32Array(out), idx: Uint32Array.from(keep) })
}

/** 去掉没用到的顶点 */
function compact({ pos, idx }) {
  const remap = new Int32Array(pos.length / 3).fill(-1)
  const out = []
  const index = new Uint32Array(idx.length)
  for (let i = 0; i < idx.length; i += 1) {
    const v = idx[i]
    if (remap[v] < 0) {
      remap[v] = out.length / 3
      out.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2])
    }
    index[i] = remap[v]
  }
  return { pos: new Float32Array(out), idx: index }
}

function simplify(mesh, triangles, error = 0.02) {
  if (mesh.idx.length / 3 <= triangles) return mesh
  let [idx] = MeshoptSimplifier.simplify(mesh.idx, mesh.pos, 3, triangles * 3, error, [])
  if (idx.length / 3 > triangles * 1.4) [idx] = MeshoptSimplifier.simplifySloppy(mesh.idx, mesh.pos, 3, null, triangles * 3, error * 2)
  return compact({ pos: mesh.pos, idx })
}

function normals({ pos, idx }) {
  const n = new Float32Array(pos.length)
  for (let i = 0; i < idx.length; i += 3) {
    const [a, b, c] = [idx[i] * 3, idx[i + 1] * 3, idx[i + 2] * 3]
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2]
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2]
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    for (const v of [a, b, c]) {
      n[v] += nx
      n[v + 1] += ny
      n[v + 2] += nz
    }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1
    n[i] /= l
    n[i + 1] /= l
    n[i + 2] /= l
  }
  return n
}

function bounds(pos) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < pos.length; i += 3) {
    for (let k = 0; k < 3; k += 1) {
      min[k] = Math.min(min[k], pos[i + k])
      max[k] = Math.max(max[k], pos[i + k])
    }
  }
  return { min, max, center: min.map((v, k) => (v + max[k]) / 2), size: min.map((v, k) => max[k] - v) }
}

const boundsOf = (list) => bounds(merge(list).pos)

function centroid(pos) {
  const c = [0, 0, 0]
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k += 1) c[k] += pos[i + k]
  return c.map((v) => v / (pos.length / 3))
}

const sub = (a, b) => a.map((v, k) => v - b[k])
const add = (a, b) => a.map((v, k) => v + b[k])
const mul = (a, s) => a.map((v) => v * s)
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

function nearestVertex(pos, p) {
  let best = null
  let d = Infinity
  for (let i = 0; i < pos.length; i += 3) {
    const q = [pos[i], pos[i + 1], pos[i + 2]]
    const e = dist(p, q)
    if (e < d) {
      d = e
      best = q
    }
  }
  return best
}

/** 沿某个方向最远的顶点 */
function extreme(pos, dir) {
  let best = null
  let d = -Infinity
  for (let i = 0; i < pos.length; i += 3) {
    const e = pos[i] * dir[0] + pos[i + 1] * dir[1] + pos[i + 2] * dir[2]
    if (e > d) {
      d = e
      best = [pos[i], pos[i + 1], pos[i + 2]]
    }
  }
  return best
}

// ---- 中心线 ----

/** 主方向：协方差矩阵幂迭代 */
function principal(pos) {
  const c = centroid(pos)
  const m = [0, 0, 0, 0, 0, 0, 0, 0, 0]
  for (let i = 0; i < pos.length; i += 3) {
    const d = [pos[i] - c[0], pos[i + 1] - c[1], pos[i + 2] - c[2]]
    for (let r = 0; r < 3; r += 1) for (let k = 0; k < 3; k += 1) m[r * 3 + k] += d[r] * d[k]
  }
  let v = [0.3, 1, 0.2]
  for (let it = 0; it < 40; it += 1) {
    const w = [0, 1, 2].map((r) => m[r * 3] * v[0] + m[r * 3 + 1] * v[1] + m[r * 3 + 2] * v[2])
    const l = Math.hypot(...w) || 1
    v = w.map((x) => x / l)
  }
  return { center: c, axis: v }
}

/** 细长的管子（血管、气管、食道）：沿主方向分段取每段顶点的平均位置。 */
function centerline(pos, bins = 8) {
  const { center, axis } = principal(pos)
  let lo = Infinity
  let hi = -Infinity
  const t = []
  for (let i = 0; i < pos.length; i += 3) {
    const s = (pos[i] - center[0]) * axis[0] + (pos[i + 1] - center[1]) * axis[1] + (pos[i + 2] - center[2]) * axis[2]
    t.push(s)
    lo = Math.min(lo, s)
    hi = Math.max(hi, s)
  }
  const sums = Array.from({ length: bins }, () => [0, 0, 0, 0])
  t.forEach((s, i) => {
    const b = Math.min(bins - 1, Math.floor(((s - lo) / (hi - lo || 1)) * bins))
    sums[b][0] += pos[i * 3]
    sums[b][1] += pos[i * 3 + 1]
    sums[b][2] += pos[i * 3 + 2]
    sums[b][3] += 1
  })
  return sums.filter((s) => s[3] > 0).map((s) => [s[0] / s[3], s[1] / s[3], s[2] / s[3]])
}

/**
 * 弯曲的粗管子（胃、结肠）：体素化后找一条从 start 到 end、尽量走在中间的路，同时得到每处的半径。
 * 找不到时退回 centerline。
 */
function tubePath({ pos, idx }, start, end, samples = 12) {
  const box = bounds(pos)
  const res = Math.max(0.0025, Math.max(...box.size) / 90)
  const pad = 2
  const nx = Math.ceil(box.size[0] / res) + pad * 2
  const ny = Math.ceil(box.size[1] / res) + pad * 2
  const nz = Math.ceil(box.size[2] / res) + pad * 2
  const ox = box.min[0] - pad * res
  const oy = box.min[1] - pad * res
  const oz = box.min[2] - pad * res
  const inside = new Uint8Array(nx * ny * nz)
  const cell = (x, y, z) => x + nx * (y + ny * z)
  // 每一列 (x, y) 沿 z 方向打一条射线，按穿过表面的次数填充里面
  const hits = new Map()
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3
    const b = idx[i + 1] * 3
    const c = idx[i + 2] * 3
    const ax = pos[a], ay = pos[a + 1], bx = pos[b], by = pos[b + 1], cx = pos[c], cy = pos[c + 1]
    const x0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - ox) / res))
    const x1 = Math.min(nx - 1, Math.ceil((Math.max(ax, bx, cx) - ox) / res))
    const y0 = Math.max(0, Math.floor((Math.min(ay, by, cy) - oy) / res))
    const y1 = Math.min(ny - 1, Math.ceil((Math.max(ay, by, cy) - oy) / res))
    const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
    if (Math.abs(det) < 1e-14) continue
    for (let x = x0; x <= x1; x += 1) {
      for (let y = y0; y <= y1; y += 1) {
        const px = ox + (x + 0.5) * res
        const py = oy + (y + 0.5) * res
        const l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / det
        const l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / det
        const l3 = 1 - l1 - l2
        if (l1 < 0 || l2 < 0 || l3 < 0) continue
        const z = l1 * pos[a + 2] + l2 * pos[b + 2] + l3 * pos[c + 2]
        const key = x + nx * y
        if (!hits.has(key)) hits.set(key, [])
        hits.get(key).push(z)
      }
    }
  }
  for (const [key, list] of hits) {
    list.sort((p, q) => p - q)
    const x = key % nx
    const y = Math.floor(key / nx)
    for (let k = 0; k + 1 < list.length; k += 2) {
      const z0 = Math.ceil((list[k] - oz) / res - 0.5)
      const z1 = Math.floor((list[k + 1] - oz) / res - 0.5)
      for (let z = Math.max(0, z0); z <= Math.min(nz - 1, z1); z += 1) inside[cell(x, y, z)] = 1
    }
  }
  // 到表面的距离（两遍倒角距离变换）
  const far = 1e9
  const d = new Float32Array(nx * ny * nz)
  for (let i = 0; i < d.length; i += 1) d[i] = inside[i] ? far : 0
  const pass = (forward) => {
    for (let zz = 0; zz < nz; zz += 1) {
      const z = forward ? zz : nz - 1 - zz
      for (let yy = 0; yy < ny; yy += 1) {
        const y = forward ? yy : ny - 1 - yy
        for (let xx = 0; xx < nx; xx += 1) {
          const x = forward ? xx : nx - 1 - xx
          const i = cell(x, y, z)
          if (!d[i]) continue
          const s = forward ? -1 : 1
          let best = d[i]
          for (const [dx, dy, dz, w] of [[s, 0, 0, 1], [0, s, 0, 1], [0, 0, s, 1], [s, s, 0, 1.414], [s, 0, s, 1.414], [0, s, s, 1.414]]) {
            const X = x + dx, Y = y + dy, Z = z + dz
            if (X < 0 || Y < 0 || Z < 0 || X >= nx || Y >= ny || Z >= nz) continue
            best = Math.min(best, d[cell(X, Y, Z)] + w)
          }
          d[i] = best
        }
      }
    }
  }
  pass(true)
  pass(false)
  pass(true)
  const toCell = (p) => [0, 1, 2].map((k) => Math.round((p[k] - [ox, oy, oz][k]) / res - 0.5))
  const nearestInside = (p) => {
    const [cx, cy, cz] = toCell(p)
    let best = -1
    let bd = Infinity
    for (let r = 0; r < 12 && best < 0; r += 1) {
      for (let z = cz - r; z <= cz + r; z += 1) for (let y = cy - r; y <= cy + r; y += 1) for (let x = cx - r; x <= cx + r; x += 1) {
        if (x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz) continue
        const i = cell(x, y, z)
        if (!inside[i]) continue
        const e = (x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2
        if (e < bd) {
          bd = e
          best = i
        }
      }
    }
    return best
  }
  const from = nearestInside(start)
  const to = nearestInside(end)
  const fallback = () => {
    const line = centerline(pos, samples)
    if (dist(line[0], start) > dist(line[line.length - 1], start)) line.reverse()
    return { points: line, radii: line.map(() => Math.min(...box.size) / 3) }
  }
  if (from < 0 || to < 0) return fallback()
  // 走在中间代价小：代价 = 1 + k / 距离²
  const cost = new Float32Array(d.length).fill(Infinity)
  const prev = new Int32Array(d.length).fill(-1)
  const heap = [[0, from]]
  cost[from] = 0
  const push = (item) => {
    heap.push(item)
    let i = heap.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (heap[p][0] <= heap[i][0]) break
      ;[heap[p], heap[i]] = [heap[i], heap[p]]
      i = p
    }
  }
  const pop = () => {
    const top = heap[0]
    const last = heap.pop()
    if (heap.length) {
      heap[0] = last
      let i = 0
      for (;;) {
        const l = i * 2 + 1
        const r = l + 1
        let m = i
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r
        if (m === i) break
        ;[heap[m], heap[i]] = [heap[i], heap[m]]
        i = m
      }
    }
    return top
  }
  while (heap.length) {
    const [c, i] = pop()
    if (c > cost[i]) continue
    if (i === to) break
    const x = i % nx
    const y = Math.floor(i / nx) % ny
    const z = Math.floor(i / (nx * ny))
    for (let dz = -1; dz <= 1; dz += 1) for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      if (!dx && !dy && !dz) continue
      const X = x + dx, Y = y + dy, Z = z + dz
      if (X < 0 || Y < 0 || Z < 0 || X >= nx || Y >= ny || Z >= nz) continue
      const j = cell(X, Y, Z)
      if (!inside[j]) continue
      const step = Math.hypot(dx, dy, dz) * (1 + 6 / (d[j] * d[j]))
      if (c + step < cost[j]) {
        cost[j] = c + step
        prev[j] = i
        push([c + step, j])
      }
    }
  }
  if (prev[to] < 0) return fallback()
  const chain = []
  for (let i = to; i >= 0; i = prev[i]) chain.push(i)
  chain.reverse()
  const pick = Array.from({ length: samples }, (_, k) => chain[Math.round((k / (samples - 1)) * (chain.length - 1))])
  return {
    points: pick.map((i) => [ox + ((i % nx) + 0.5) * res, oy + ((Math.floor(i / nx) % ny) + 0.5) * res, oz + (Math.floor(i / (nx * ny)) + 0.5) * res]),
    radii: pick.map((i) => d[i] * res),
  }
}

/** 网格里面随机取一些点（肺里撒氧气用）：在包围盒里取点，用射线穿过表面的次数判断在不在里面。 */
function interiorSamples({ pos, idx }, count, seed = 1) {
  const box = bounds(pos)
  let s = seed
  const rand = () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
  const out = []
  let guard = 0
  while (out.length < count && guard < count * 200) {
    guard += 1
    const p = box.min.map((v, k) => v + box.size[k] * (0.08 + 0.84 * rand()))
    let crossings = 0
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3
      const ax = pos[a], ay = pos[a + 1], bx = pos[b], by = pos[b + 1], cx = pos[c], cy = pos[c + 1]
      const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
      if (Math.abs(det) < 1e-14) continue
      const l1 = ((by - cy) * (p[0] - cx) + (cx - bx) * (p[1] - cy)) / det
      const l2 = ((cy - ay) * (p[0] - cx) + (ax - cx) * (p[1] - cy)) / det
      const l3 = 1 - l1 - l2
      if (l1 < 0 || l2 < 0 || l3 < 0) continue
      if (l1 * pos[a + 2] + l2 * pos[b + 2] + l3 * pos[c + 2] > p[2]) crossings += 1
    }
    if (crossings % 2 === 1) out.push(p)
  }
  return out
}

/** 把几段折线首尾相接：每一段朝哪头接，看哪头离上一段的终点近。 */
function chain(lines, from) {
  const out = from ? [from] : []
  for (const line of lines) {
    if (!line.length) continue
    const last = out[out.length - 1]
    const seg = last && dist(line[line.length - 1], last) < dist(line[0], last) ? [...line].reverse() : line
    for (const p of seg) if (!out.length || dist(out[out.length - 1], p) > 0.004) out.push(p)
  }
  return out
}

/** 同名的几块按离起点由近到远串起来 */
function orderByProximity(items, start, at = (item) => item.center) {
  const rest = [...items]
  const out = []
  let cur = start
  while (rest.length) {
    let best = 0
    for (let i = 1; i < rest.length; i += 1) if (dist(at(rest[i]), cur) < dist(at(rest[best]), cur)) best = i
    const [item] = rest.splice(best, 1)
    out.push(item)
    cur = at(item)
  }
  return out
}

/** 沿折线生成一根圆管（脊髓用） */
function tube(points, radius, radial = 10) {
  const pos = []
  const idx = []
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i]
    const q = points[Math.min(points.length - 1, i + 1)]
    const o = points[Math.max(0, i - 1)]
    let t = sub(q, o)
    const l = Math.hypot(...t) || 1
    t = mul(t, 1 / l)
    let n = Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
    const dot = n[0] * t[0] + n[1] * t[1] + n[2] * t[2]
    n = sub(n, mul(t, dot))
    const nl = Math.hypot(...n)
    n = mul(n, 1 / nl)
    const b = [t[1] * n[2] - t[2] * n[1], t[2] * n[0] - t[0] * n[2], t[0] * n[1] - t[1] * n[0]]
    for (let k = 0; k < radial; k += 1) {
      const a = (k / radial) * Math.PI * 2
      pos.push(...add(p, add(mul(n, Math.cos(a) * radius), mul(b, Math.sin(a) * radius))))
    }
  }
  for (let i = 0; i < points.length - 1; i += 1) {
    for (let k = 0; k < radial; k += 1) {
      const a = i * radial + k
      const b = i * radial + ((k + 1) % radial)
      const c = b + radial
      const d = a + radial
      idx.push(a, d, b, b, d, c)
    }
  }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx) }
}

// ---- 挑部位 ----

await MeshoptSimplifier.ready
console.log('building body model…')

const L = /^(Left|Right) /

// 肺：HuBMAP，按支气管树对齐
const hra = readGlb(await cached('hra-lung-male-v1.4.glb', [HRA_LUNG]))
const hraLung = (side) => hra.filter((m) => /segment|hilum/.test(m.name) && (side === 'L' ? /_L$|left/.test(m.name) : !/_L$|left/.test(m.name)))
const hraBronchi = hra.filter((m) => /tertiary|lobar|bronchus$/i.test(m.name) && !/cartilage/.test(m.name))
const bpSegmental = bp(/segmental bronchial tree|lingular bronchial tree/)
function lungAlign() {
  const src = boundsOf(hraBronchi.map((m) => ({ pos: m.pos, idx: m.idx })))
  const dst = boundsOf(bpSegmental)
  // HuBMAP 的坐标先按 BodyParts3D 的比例缩放（两边都是米），再换到场景坐标
  const srcScene = { center: src.center, size: src.size }
  const s = (dst.size[0] / (srcScene.size[0] * SCALE) + dst.size[2] / (srcScene.size[2] * SCALE)) / 2
  return (x, y, z) => {
    const p = [(x - src.center[0]) * SCALE * s, (y - src.center[1]) * SCALE * s, (z - src.center[2]) * SCALE * s]
    return add(p, dst.center)
  }
}
const alignLung = lungAlign()
function hraToScene(meshes) {
  return meshes.map((m) => {
    const pos = new Float32Array(m.pos.length)
    for (let i = 0; i < pos.length; i += 3) pos.set(alignLung(m.pos[i], m.pos[i + 1], m.pos[i + 2]), i)
    return { name: m.name, pos, idx: m.idx }
  })
}

const MUSCLES = new RegExp(
  [
    'pectoralis major', 'deltoid', 'trapezius', 'latissimus dorsi', 'rectus abdominis', 'external oblique', 'serratus anterior',
    'sternocleidomastoid', 'biceps brachii', 'triceps brachii', 'brachioradialis', 'brachialis$', 'flexor carpi', 'extensor carpi',
    'extensor digitorum$', 'palmaris longus', 'pronator teres', 'flexor digitorum superficialis', 'gluteus maximus', 'gluteus medius',
    'tensor fasciae latae', 'sartorius', 'rectus femoris', 'vastus lateralis', 'vastus medialis', 'gracilis', 'adductor longus',
    'adductor magnus', 'biceps femoris', 'semitendinosus', 'semimembranosus', 'gastrocnemius', 'soleus', 'tibialis anterior',
    'fibularis longus', 'extensor digitorum longus', 'temporalis', 'masseter', 'infraspinatus', 'teres major', 'occipitofrontalis',
    'frontal belly', 'platysma',
  ].join('|'),
  'i',
)
const SKULL = /Frontal bone|Occipital bone|Sphenoid bone|Ethmoid|Vomer|Mandible|maxilla|tooth|zygomatic bone|temporal bone|parietal bone|palatine bone|nasal bone|Hyoid bone/i
const SPINE = /vertebra$|^Atlas$|^Axis$|Sacrum|Coccyx|Intervertebral disk/
const RIBS = /rib$|costal cartilage|sternum|Manubrium|Xiphoid/
const LIMBS = /ulna$|radius$|humerus|scapula$|clavicle$|femur$|patella$|tibia$|fibula$|talus$|calcaneus$|cuboid bone|cuneiform bone|Navicular bone|metatarsal bone|metacarpal bone|phalanx|scaphoid$|lunate$|triquetral$|pisiform$|trapezium$|trapezoid$|capitate$|hamate$|Sesamoid bone/i
const BRAIN_OUT = /gyrus|lobe$|lobule$|insula$|White matter of .* cerebral hemisphere|Cerebellum|^Pons$|^Midbrain$|Medulla oblongata|Peduncle of midbrain|Corpus callosum/
const ARTERIES = /aorta|Pulmonary trunk|pulmonary artery|Brachiocephalic artery|common carotid artery|subclavian artery|axillary artery|^(Left|Right) brachial artery|radial artery$|ulnar artery$|common iliac artery|external iliac artery|femoral artery$|popliteal artery|posterior tibial artery|anterior tibial artery/
const VEINS = /vena cava|brachiocephalic vein|internal jugular vein|subclavian vein|axillary vein|medial brachial vein|basilic vein|cephalic vein|pulmonary vein|common iliac vein|external iliac vein|femoral vein$|popliteal vein|posterior tibial vein|great saphenous vein/

/**
 * 给孩子看的模型不带外生殖器，像商场里的模特假人：
 * 删掉包着阴茎、睾丸的那片皮肤（离这些结构很近的三角形），再把留下的洞用平滑的曲面补上。
 */
function mannequin(skin) {
  const organs = merge(bp(/Corpus cavernosum of penis|Corpus spongiosum of penis|Glans penis|^(Left|Right) testis$/)).pos
  const cell = 0.01
  const grid = new Map()
  const keyOf = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`
  for (let i = 0; i < organs.length; i += 3) {
    const key = keyOf(organs[i], organs[i + 1], organs[i + 2])
    if (!grid.has(key)) grid.set(key, [])
    grid.get(key).push(i)
  }
  const near = (x, y, z, r) => {
    const span = Math.ceil(r / cell)
    const [cx, cy, cz] = [Math.floor(x / cell), Math.floor(y / cell), Math.floor(z / cell)]
    for (let a = -span; a <= span; a += 1) for (let b = -span; b <= span; b += 1) for (let c = -span; c <= span; c += 1) {
      for (const i of grid.get(`${cx + a},${cy + b},${cz + c}`) ?? []) {
        if (Math.hypot(organs[i] - x, organs[i + 1] - y, organs[i + 2] - z) < r) return true
      }
    }
    return false
  }
  const { pos, idx } = skin
  const drop = new Uint8Array(pos.length / 3)
  for (let v = 0; v < drop.length; v += 1) {
    const [x, y, z] = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]]
    if (Math.abs(x) < 0.07 && y < 0.02 && y > -0.2 && near(x, y, z, 0.028)) drop[v] = 1
  }
  let kept = []
  for (let i = 0; i < idx.length; i += 3) if (!drop[idx[i]] && !drop[idx[i + 1]] && !drop[idx[i + 2]]) kept.push(idx[i], idx[i + 1], idx[i + 2])
  // 删完后洞口边上会剩几片和身体断开的碎皮，只留连在一起的大块
  const root = Int32Array.from({ length: pos.length / 3 }, (_, i) => i)
  const find = (v) => {
    while (root[v] !== v) v = root[v] = root[root[v]]
    return v
  }
  for (let i = 0; i < kept.length; i += 3) {
    root[find(kept[i + 1])] = find(kept[i])
    root[find(kept[i + 2])] = find(kept[i])
  }
  const size = new Map()
  for (let i = 0; i < kept.length; i += 3) size.set(find(kept[i]), (size.get(find(kept[i])) ?? 0) + 1)
  const big = kept.length / 3 / 50
  kept = kept.filter((_, k) => size.get(find(kept[k - (k % 3)])) > big)
  // 找洞口：只被一个三角形用到的边，按方向连成环
  const edges = new Map()
  for (let i = 0; i < kept.length; i += 3) {
    for (let k = 0; k < 3; k += 1) {
      const a = kept[i + k]
      const b = kept[i + ((k + 1) % 3)]
      const back = `${b},${a}`
      if (edges.has(back)) edges.delete(back)
      else edges.set(`${a},${b}`, [a, b])
    }
  }
  const next = new Map()
  for (const [a, b] of edges.values()) next.set(a, b)
  const seen = new Set()
  const out = Array.from(pos)
  for (const start of next.keys()) {
    if (seen.has(start)) continue
    const loop = []
    for (let v = start; v !== undefined && !seen.has(v); v = next.get(v)) {
      seen.add(v)
      loop.push(v)
    }
    if (loop.length < 3) continue
    const c = [0, 0, 0]
    for (const v of loop) for (let k = 0; k < 3; k += 1) c[k] += pos[v * 3 + k] / loop.length
    if (Math.abs(c[0]) > 0.05 || c[1] > 0.02 || c[1] < -0.2) continue
    // 洞口往中间收两圈再收到中心，中间那圈稍微往外鼓一点，补出来的面圆润些
    const rings = [loop]
    for (const t of [0.4, 0.75]) {
      const ring = loop.map((v) => {
        const p = [0, 1, 2].map((k) => pos[v * 3 + k] + (c[k] - pos[v * 3 + k]) * t)
        p[2] += 0.006 * Math.sin(t * Math.PI)
        out.push(...p)
        return out.length / 3 - 1
      })
      rings.push(ring)
    }
    out.push(c[0], c[1], c[2] + 0.004)
    const center = out.length / 3 - 1
    const n = loop.length
    // 洞口的边方向是 a→b，补的三角形要反过来 b→a 才和原来的面朝向一致
    for (let r = 0; r < rings.length - 1; r += 1) {
      for (let i = 0; i < n; i += 1) {
        const a = rings[r][i], b = rings[r][(i + 1) % n], d = rings[r + 1][i], e = rings[r + 1][(i + 1) % n]
        kept.push(b, a, d, b, d, e)
      }
    }
    const last = rings[rings.length - 1]
    for (let i = 0; i < n; i += 1) kept.push(last[(i + 1) % n], last[i], center)
  }
  return compact({ pos: new Float32Array(out), idx: Uint32Array.from(kept) })
}

/** 一块：若干网格，每个网格一种颜色（null 用部位颜色） */
const one = (list, triangles, opts = {}) => {
  const mesh = simplify(weld(merge(list)), triangles, opts.error)
  return { ...mesh, color: opts.color ?? null, keep: !!opts.keep, inner: !!opts.inner }
}

const lungL = hraToScene(hraLung('L'))
const lungR = hraToScene(hraLung('R'))
const bronchL = bpSegmental.filter((m) => centroid(m.pos)[0] > 0)
const bronchR = bpSegmental.filter((m) => centroid(m.pos)[0] <= 0)

const vertebrae = bp(/vertebra$|^Atlas$|^Axis$/).map((m) => ({ center: centroid(m.pos) })).sort((a, b) => b.center[1] - a.center[1])
const medulla = boundsOf(bp(/Medulla oblongata/))
const lumbar1 = centroid(bp(/^First lumbar vertebra$/)[0].pos)
/** 椎骨中心忽前忽后，脊髓按它走会弯来弯去，先来回平滑几遍，再放在正中 */
function smoothLine(points, passes = 4) {
  let out = points
  for (let k = 0; k < passes; k += 1) {
    out = out.map((p, i) => (i === 0 || i === out.length - 1 ? p : mul(add(add(out[i - 1], out[i + 1]), mul(p, 2)), 0.25)))
  }
  return out.map((p) => [0, p[1], p[2]])
}
const cordPoints = smoothLine([
  [0, medulla.min[1] + 0.01, medulla.center[2]],
  ...vertebrae.filter((v) => v.center[1] < medulla.min[1] - 0.01 && v.center[1] > lumbar1[1] - 0.02).map((v) => add(v.center, [0, 0, -0.012])),
])

const parts = {
  // 眼睛跟着皮肤一起变透明，不然剖开后两颗眼球浮在半空
  skin: [[one([mannequin(weld(merge(bp(/^Skin$/))))], 12000, { error: 0.01 }), one(bp(/sclera$/), 300, { color: '#ffffff' }), one(bp(/(left|right) iris$/i), 200, { color: '#3b2a24' })]],
  muscle: [[one(bp(MUSCLES, /tendon|nerve|artery|vein/i), 15000, { error: 0.05 })]],
  skull: [[one(bp(SKULL, /Gingiva/), 3200, { error: 0.04 })]],
  spine: [[one(bp(SPINE), 3200, { error: 0.04 })]],
  ribcage: [[one(bp(RIBS), 3600, { error: 0.04 })]],
  pelvis: [[one(bp(/hip bone/), 1600, { error: 0.04 })]],
  limbBones: [[one(bp(LIMBS, /tibialis|muscle/i), 6500, { error: 0.04 })]],
  brain: [[
    one(bp(BRAIN_OUT, /artery|vein|nerve/), 10000, { error: 0.02 }),
    one(bp(/lateral ventricle$|^Third ventricle$|^Fourth ventricle$/), 900, { color: '#6fa8ff', inner: true }),
    one(bp(/thalamus$|caudate nucleus$|putamen$/, /stria/), 700, { color: '#ffd1dc', inner: true }),
  ]],
  spinalCord: [[{ ...tube(cordPoints, 0.006 * SCALE), color: null, keep: false, inner: false }]],
  trachea: [[one(bp(/^Trachea$|^Left main bronchus$|^Right main bronchus proper$/), 1400)]],
  lungs: [
    [one(lungL, 3200, { error: 0.01 }), one(bronchL, 1300, { color: '#7cc6ee', inner: true })],
    [one(lungR, 3200, { error: 0.01 }), one(bronchR, 1300, { color: '#7cc6ee', inner: true })],
  ],
  diaphragm: [[one(bp(/^Diaphragm$/), 1500)]],
  heart: [[
    one(bp(/Wall of (left|right) atrium|Wall of ventricle/), 3200),
    one(bp(/Cavity of left (atrium|ventricle)/), 900, { color: '#ff3b4f', inner: true }),
    one(bp(/Cavity of right (atrium|ventricle)/), 900, { color: '#5b7cfa', inner: true }),
  ]],
  vessels: [[one(bp(ARTERIES), 2600, { color: '#ff4757', error: 0.03 }), one(bp(VEINS), 2600, { color: '#5b7cfa', error: 0.03 })]],
  esophagus: [[one(bp(/^Esophagus$/), 400)]],
  stomach: [[one(bp(/^Stomach$/), 1400)]],
  liver: [[one(bp(/Hepatovenous segment|Caudate lobe of liver/), 2600, { error: 0.02 })]],
  gallbladder: [[one(bp(/^Gallbladder$/), 400)]],
  pancreas: [[one(bp(/^Pancreas$/), 900)]],
  spleen: [[one(bp(/^Spleen$/), 600)]],
  smallIntestine: [[one(bp(/^Duodenum$|part of jejunum|part of ileum|Ileocecal junction/), 4200, { error: 0.03 })]],
  largeIntestine: [[one(bp(/colon$|^Rectum$|^Appendix$/), 3200, { error: 0.02 })]],
  kidneys: [[one(bp(/^Left kidney$/), 700)], [one(bp(/^Right kidney$/), 700)]],
  bladder: [[one(bp(/^Urinary bladder$/), 300)]],
}

// ---- 路线 ----

const routes = {}
{
  const skin = boundsOf(bp(/^Skin$/))
  routes.center = [0, skin.center[1], 0]
  routes.half = [skin.size[0] / 2, skin.size[1] / 2]
  routes.radius = skin.size[1] / 2

  // 消化道
  const lip = boundsOf(bp(/^Lip$/))
  const mouth = [0, lip.center[1], lip.max[2] - 0.012]
  const tongue = boundsOf(bp(/^Tongue$/))
  const esophagus = merge(bp(/^Esophagus$/))
  const esoLine = centerline(esophagus.pos, 10).sort((a, b) => b[1] - a[1])
  const stomach = merge(bp(/^Stomach$/))
  const duodenum = merge(bp(/^Duodenum$/))
  const cardia = nearestVertex(stomach.pos, esoLine[esoLine.length - 1])
  const pylorus = nearestVertex(stomach.pos, nearestVertex(duodenum.pos, centroid(stomach.pos)))
  const stomachTube = tubePath(stomach, cardia, pylorus, 12)
  routes.mouth = mouth
  routes.swallow = chain([[mouth, [0, mouth[1] - 0.01, tongue.min[2] - 0.004]], esoLine, [cardia]])
  routes.stomach = stomachTube.points
  routes.stomachRadius = stomachTube.radii

  const duoTube = tubePath(duodenum, pylorus, extreme(duodenum.pos, [0.4, -0.2, -0.3]), 10)
  const groups = ['Proximal part of jejunum', 'Middle part of jejunum', 'Distal part of jejunum', 'Proximal part of ileum', 'Middle part of ileum', 'Distal part of ileum']
  let cursor = duoTube.points[duoTube.points.length - 1]
  const loops = []
  for (const name of groups) {
    const items = bp(new RegExp(`^${name}$`)).map((m) => ({ center: centroid(m.pos) }))
    for (const item of orderByProximity(items, cursor)) {
      loops.push(item.center)
      cursor = item.center
    }
  }
  const ileocecal = centroid(merge(bp(/^Ileocecal junction$/)).pos)
  routes.small = chain([duoTube.points, loops, [ileocecal]])

  const ascending = merge(bp(/^Ascending colon$/))
  const transverse = merge(bp(/^Transverse colon$/))
  const descending = merge(bp(/^Descending colon$/))
  const rectum = merge(bp(/^Rectum$/))
  const asc = tubePath(ascending, extreme(ascending.pos, [0, -1, 0]), extreme(ascending.pos, [0, 1, 0]), 8).points
  const tra = tubePath(transverse, extreme(transverse.pos, [-1, 0, 0]), extreme(transverse.pos, [1, 0, 0]), 12).points
  const des = tubePath(descending, extreme(descending.pos, [0, 1, 0]), extreme(descending.pos, [0, -1, 0]), 12).points
  const rec = tubePath(rectum, extreme(rectum.pos, [0, 1, 0.3]), extreme(rectum.pos, [0, -1, 0]), 8).points
  const anus = add(rec[rec.length - 1], [0, -0.025, -0.01])
  routes.large = chain([[ileocecal], asc, tra, des, [rec[0]]])
  routes.out = chain([rec, [anus]])
  routes.anus = anus

  // 呼吸道
  const trachea = merge(bp(/^Trachea$/))
  const traLine = centerline(trachea.pos, 6).sort((a, b) => b[1] - a[1])
  const nose = [0, mouth[1] + 0.035, lip.max[2] + 0.004]
  const carina = traLine[traLine.length - 1]
  routes.airway = chain([[nose, [0, nose[1] - 0.01, tongue.min[2] - 0.01]], traLine])
  const lungParts = [merge(lungL), merge(lungR)]
  routes.lungs = lungParts.map((lung, side) => {
    const b = bounds(lung.pos)
    const bronchus = merge(bp(side === 0 ? /^Left main bronchus$/ : /^Right main bronchus proper$/))
    const line = centerline(bronchus.pos, 4)
    return {
      center: b.center,
      radii: mul(b.size, 0.5),
      bronchus: chain([[carina], line, [b.center]], null),
      samples: interiorSamples(weld(lung), 80, side + 3),
    }
  })

  // 血液循环：从心室出发，沿动脉出去，沿静脉回到心房
  const cavity = (re) => centroid(merge(bp(re)).pos)
  const lv = cavity(/Cavity of left ventricle/)
  const la = cavity(/Cavity of left atrium/)
  const rv = cavity(/Cavity of right ventricle/)
  const ra = cavity(/Cavity of right atrium/)
  routes.heart = centroid(merge(bp(/Wall of ventricle/)).pos)
  const line = (re, bins = 6) => {
    const meshes = bp(re)
    return meshes.map((m) => centerline(m.pos, bins))
  }
  const path = (names, from) => {
    const lines = []
    let cur = from
    for (const re of names) {
      const items = line(re).map((points) => ({ points, center: centroid(Float32Array.from(points.flat())) }))
      for (const item of orderByProximity(items, cur)) {
        lines.push(item.points)
        cur = item.points[item.points.length - 1]
      }
    }
    return chain(lines, from)
  }
  const loop = (outNames, backNames, start, end, out, share) => {
    const go = path(outNames, start)
    const back = path(backNames, end).reverse()
    const points = chain([go, back])
    const lengthOf = (list) => list.reduce((s, p, i) => (i ? s + dist(list[i - 1], p) : 0), 0)
    return { points, split: lengthOf(go) / lengthOf(points), out, share }
  }
  const aorta = [/^Ascending aorta$/, /^Arch of aorta$/]
  const down = [...aorta, /^Descending thoracic aorta$|^Descending aorta$/, /^Abdominal aorta$/]
  const leg = (s) => [
    [...down, new RegExp(`^${s} common iliac artery$`), new RegExp(`^${s} external iliac artery$`), new RegExp(`^${s} femoral artery$`), new RegExp(`^${s} popliteal artery$`), new RegExp(`^${s} posterior tibial artery$`)],
    [/^Inferior vena cava$/, new RegExp(`^${s} common iliac vein$`), new RegExp(`^${s} external iliac vein$`), new RegExp(`^${s} femoral vein$`), new RegExp(`^${s} popliteal vein$`), new RegExp(`^${s} posterior tibial vein$`)],
  ]
  const arm = (s) => [
    [...aorta, ...(s === 'Right' ? [/^Brachiocephalic artery$/] : []), new RegExp(`^${s} subclavian artery$`), new RegExp(`^${s} axillary artery$`), new RegExp(`^${s} brachial artery$`), new RegExp(`^${s} radial artery$`)],
    [/^Superior vena cava$/, new RegExp(`^${s} brachiocephalic vein$`), new RegExp(`^${s} subclavian vein$`), new RegExp(`^${s} axillary vein$`), new RegExp(`^${s} medial brachial vein$`), new RegExp(`^${s} basilic vein$`)],
  ]
  const head = (s) => [
    [...aorta, ...(s === 'Right' ? [/^Brachiocephalic artery$/] : []), new RegExp(`^${s} common carotid artery$`)],
    [/^Superior vena cava$/, new RegExp(`^${s} brachiocephalic vein$`), new RegExp(`^${s} internal jugular vein$`)],
  ]
  const lung = (s, side) => {
    const center = routes.lungs[side].center
    const go = path([/^Pulmonary trunk$/, new RegExp(`^${s} pulmonary artery$`)], rv)
    const back = path([new RegExp(`^${s} superior pulmonary vein$`)], la).reverse()
    const points = chain([go, [center], back, [la]])
    const lengthOf = (list) => list.reduce((acc, p, i) => (i ? acc + dist(list[i - 1], p) : 0), 0)
    return { points, split: lengthOf(chain([go, [center]])) / lengthOf(points), out: 'blue', share: 0.1 }
  }
  routes.blood = [
    loop(...leg('Left'), lv, ra, 'red', 0.19),
    loop(...leg('Right'), lv, ra, 'red', 0.19),
    loop(...head('Left'), lv, ra, 'red', 0.1),
    loop(...head('Right'), lv, ra, 'red', 0.1),
    loop(...arm('Left'), lv, ra, 'red', 0.06),
    loop(...arm('Right'), lv, ra, 'red', 0.06),
    lung('Left', 0),
    lung('Right', 1),
  ]
}

// ---- 写文件 ----

function quantize(list) {
  const all = merge(list.flat().map((m) => ({ pos: m.pos, idx: new Uint32Array(0) })))
  const b = bounds(all.pos)
  return { offset: b.min, scale: b.size.map((v) => v || 1) }
}

const flat = Object.values(parts).flat()
const { offset, scale } = quantize(flat)
const blobs = []
let byteLength = 0
const align = () => {
  const pad = (4 - (byteLength % 4)) % 4
  if (pad) {
    blobs.push(Buffer.alloc(pad))
    byteLength += pad
  }
}
const put = (buf) => {
  align()
  const at = byteLength
  blobs.push(buf)
  byteLength += buf.length
  return at
}

const round = (v) => Math.round(v * 1e4) / 1e4
const r3 = (p) => p.map(round)
let totalTriangles = 0
const header = { version: 1, offset: r3(offset), scale: r3(scale), parts: [], routes: null, credits: '' }
for (const [id, pieces] of Object.entries(parts)) {
  const outPieces = []
  for (const meshes of pieces) {
    const main = meshes.filter((m) => !m.inner && !m.keep)
    const center = bounds(merge(main.length ? main : meshes).pos).center
    const outMeshes = []
    for (const mesh of meshes) {
      const count = mesh.pos.length / 3
      if (count > 65535) throw new Error(`${id} 顶点太多：${count}`)
      const n = normals(mesh)
      const q = new Int16Array(count * 3)
      for (let i = 0; i < count * 3; i += 1) q[i] = Math.round(((mesh.pos[i] - offset[i % 3]) / scale[i % 3]) * 65535 - 32768)
      const nn = new Int8Array(count * 3)
      for (let i = 0; i < count * 3; i += 1) nn[i] = Math.round(n[i] * 127)
      const ii = Uint16Array.from(mesh.idx)
      totalTriangles += ii.length / 3
      outMeshes.push({
        v: count,
        i: ii.length,
        pos: put(Buffer.from(q.buffer)),
        nrm: put(Buffer.from(nn.buffer)),
        idx: put(Buffer.from(ii.buffer)),
        ...(mesh.color ? { color: mesh.color } : {}),
        ...(mesh.keep ? { keep: 1 } : {}),
        ...(mesh.inner ? { inner: 1 } : {}),
      })
    }
    outPieces.push({ center: r3(center), meshes: outMeshes })
  }
  header.parts.push({ id, pieces: outPieces })
}

const roundDeep = (value) => (Array.isArray(value) ? value.map(roundDeep) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, roundDeep(v)])) : typeof value === 'number' ? round(value) : value)
header.routes = roundDeep(routes)
header.credits =
  'BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution 4.0 International; ' +
  'HuBMAP Human Reference Atlas 3D Reference Organ Set, male lung v1.4, CC BY 4.0. ' +
  'Modified by Uday: simplified, recolored, re-aligned, external genitalia removed.'

const json = Buffer.from(JSON.stringify(header), 'ascii')
const jsonPadded = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)])
const head = Buffer.alloc(8)
head.write('UBM1', 0, 'ascii')
head.writeUInt32LE(jsonPadded.length, 4)
align()
const file = Buffer.concat([head, jsonPadded, ...blobs])
await mkdir(path.dirname(OUT), { recursive: true })
await writeFile(OUT, file)
console.log(`wrote ${path.relative(root, OUT)}: ${(file.length / 1024).toFixed(0)} KB, ${totalTriangles} triangles`)
for (const [id, pieces] of Object.entries(parts)) {
  const tris = pieces.flat().reduce((s, m) => s + m.idx.length / 3, 0)
  console.log(`  ${id.padEnd(15)} ${String(tris).padStart(6)}`)
}
