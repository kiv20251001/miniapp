/**
 * 用代码生成卡通风格的人体：变形的球做器官，沿曲线、粗细可变的管子做食道、肠子、血管和骨头。
 * 没有模型文件，全身约 5 万个三角形。位置和路线都取自 anatomy.ts，返回 model.ts 约定的结构。
 */
import {
  BufferGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  Mesh,
  MeshLambertMaterial,
  MeshPhongMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type Material,
  type Object3D,
} from 'three'
import {
  ANCHORS,
  APPENDIX,
  BRONCHI,
  ESOPHAGUS,
  LARGE_INTESTINE,
  LUNG_RADII,
  PARTS,
  SMALL_INTESTINE,
  STOMACH,
  TRACHEA,
  VESSELS,
  stomachRadius,
  type PartId,
  type Vec3,
} from './anatomy'
import { disposeTree, type BodyModel, type BodyPart } from './model'

const v = (p: Vec3) => new Vector3(p[0], p[1], p[2])

// ---- 几何体工具 ----

/** 球面接缝和两极有重合的顶点，算完法线后把它们的法线取平均，光照才不会出现一道缝。 */
function smoothSeams(geometry: BufferGeometry) {
  geometry.computeVertexNormals()
  const pos = geometry.getAttribute('position')
  const nor = geometry.getAttribute('normal')
  const groups = new Map<string, number[]>()
  for (let i = 0; i < pos.count; i += 1) {
    const key = `${Math.round(pos.getX(i) * 1e5)},${Math.round(pos.getY(i) * 1e5)},${Math.round(pos.getZ(i) * 1e5)}`
    const list = groups.get(key)
    if (list) list.push(i)
    else groups.set(key, [i])
  }
  const n = new Vector3()
  groups.forEach((list) => {
    if (list.length < 2) return
    n.set(0, 0, 0)
    for (const i of list) n.x += nor.getX(i), n.y += nor.getY(i), n.z += nor.getZ(i)
    n.normalize()
    for (const i of list) nor.setXYZ(i, n.x, n.y, n.z)
  })
  return geometry
}

/** 单位球先按 deform 变形，再按 radii 拉成椭球。deform 拿到的是单位球上的点。 */
function blob(radii: Vec3, deform?: (p: Vector3) => void, widthSegments = 28, heightSegments = 20) {
  const geometry = new SphereGeometry(1, widthSegments, heightSegments)
  geometry.deleteAttribute('uv')
  const pos = geometry.getAttribute('position')
  const p = new Vector3()
  for (let i = 0; i < pos.count; i += 1) {
    p.fromBufferAttribute(pos, i)
    deform?.(p)
    pos.setXYZ(i, p.x * radii[0], p.y * radii[1], p.z * radii[2])
  }
  return smoothSeams(geometry)
}

/** 沿曲线的管子，粗细可以随位置变化，两头封口。 */
function tube(points: Vec3[], radius: number | ((u: number) => number), segments = 48, radial = 8, caps = true) {
  const curve = new CatmullRomCurve3(points.map(v), false, 'centripetal')
  const frames = curve.computeFrenetFrames(segments, false)
  const r = typeof radius === 'number' ? () => radius : radius
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  const n = new Vector3()
  for (let i = 0; i <= segments; i += 1) {
    const u = i / segments
    const point = curve.getPointAt(u)
    const size = r(u)
    for (let j = 0; j < radial; j += 1) {
      const a = (j / radial) * Math.PI * 2
      n.copy(frames.normals[i]).multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i], Math.sin(a)).normalize()
      positions.push(point.x + n.x * size, point.y + n.y * size, point.z + n.z * size)
      normals.push(n.x, n.y, n.z)
    }
  }
  for (let i = 0; i < segments; i += 1) {
    for (let j = 0; j < radial; j += 1) {
      const a = i * radial + j
      const b = (i + 1) * radial + j
      const c = (i + 1) * radial + ((j + 1) % radial)
      const d = i * radial + ((j + 1) % radial)
      indices.push(a, d, b, b, d, c)
    }
  }
  if (caps) {
    for (const end of [0, 1]) {
      const at = positions.length / 3
      const point = curve.getPointAt(end)
      const t = frames.tangents[end ? segments : 0]
      const sign = end ? 1 : -1
      positions.push(point.x, point.y, point.z)
      normals.push(t.x * sign, t.y * sign, t.z * sign)
      const ring = end ? segments * radial : 0
      for (let j = 0; j < radial; j += 1) {
        const k = (j + 1) % radial
        if (end) indices.push(at, ring + j, ring + k)
        else indices.push(at, ring + k, ring + j)
      }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  return geometry
}

/** 把几个带索引的几何体合成一个，少一些绘制调用。只保留位置和法线。 */
function merge(list: BufferGeometry[]) {
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  for (const geometry of list) {
    const base = positions.length / 3
    const pos = geometry.getAttribute('position')
    const nor = geometry.getAttribute('normal')
    for (let i = 0; i < pos.count; i += 1) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i))
      normals.push(nor.getX(i), nor.getY(i), nor.getZ(i))
    }
    const index = geometry.getIndex()
    if (index) for (let i = 0; i < index.count; i += 1) indices.push(index.getX(i) + base)
    else for (let i = 0; i < pos.count; i += 1) indices.push(i + base)
    geometry.dispose()
  }
  const merged = new BufferGeometry()
  merged.setAttribute('position', new Float32BufferAttribute(positions, 3))
  merged.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  merged.setIndex(indices)
  return merged
}

function at(geometry: BufferGeometry, p: Vec3) {
  geometry.translate(p[0], p[1], p[2])
  return geometry
}

// ---- 材质 ----

function organMaterial(color: string, options: { side?: typeof DoubleSide; shininess?: number } = {}) {
  return new MeshPhongMaterial({ color, shininess: options.shininess ?? 36, specular: 0x2a2a2a, side: options.side })
}

function boneMaterial() {
  return new MeshLambertMaterial({ color: PARTS.skull.color })
}

// ---- 部位 ----

type Built = { part: BodyPart }

/** 一块 piece：几何体是按身体坐标画的，这里平移到 center，让 object 的原点落在中心。 */
function piece(center: Vec3, meshes: Mesh[]) {
  const group = new Group()
  const c = v(center)
  group.position.copy(c)
  for (const mesh of meshes) {
    mesh.position.sub(c)
    group.add(mesh)
  }
  return { object: group, center: c }
}

function mesh(geometry: BufferGeometry, material: Material) {
  return new Mesh(geometry, material)
}

/** 身体左右对称的四肢关节位置，s = 1 是身体左边 */
function limb(s: number) {
  return {
    shoulder: [s * 0.19, 0.52, 0] as Vec3,
    elbow: [s * 0.25, 0.22, -0.01] as Vec3,
    wrist: [s * 0.29, -0.07, 0.02] as Vec3,
    hand: [s * 0.303, -0.108, 0.024] as Vec3,
    hip: [s * 0.08, -0.18, 0] as Vec3,
    knee: [s * 0.092, -0.55, 0.01] as Vec3,
    ankle: [s * 0.1, -0.885, -0.01] as Vec3,
    foot: [s * 0.1, -0.905, 0.035] as Vec3,
  }
}

const TORSO_PROFILE: Array<[number, number]> = [
  [0, -0.27], [0.06, -0.265], [0.12, -0.24], [0.155, -0.2], [0.16, -0.12], [0.148, -0.04], [0.14, 0.05],
  [0.152, 0.15], [0.172, 0.28], [0.185, 0.4], [0.19, 0.48], [0.178, 0.53], [0.14, 0.57], [0.085, 0.6], [0.05, 0.615],
]

function buildSkin(): Built {
  const material = new MeshLambertMaterial({ color: PARTS.skin.color })
  const torso = new LatheGeometry(TORSO_PROFILE.map(([r, y]) => new Vector2(r, y)), 40)
  torso.deleteAttribute('uv')
  torso.scale(1, 1, 0.72)
  smoothSeams(torso)
  const neck = new CylinderGeometry(0.054, 0.06, 0.1, 20, 1, true)
  neck.deleteAttribute('uv')
  neck.scale(1, 1, 0.9)
  const parts: BufferGeometry[] = [torso, at(neck, [0, 0.64, 0]), at(blob([0.13, 0.145, 0.135], undefined, 36, 24), ANCHORS.head)]
  for (const s of [1, -1]) {
    const j = limb(s)
    parts.push(at(blob([0.02, 0.035, 0.025]), [s * 0.128, 0.8, 0]))
    parts.push(at(blob([0.053, 0.053, 0.053]), j.shoulder))
    parts.push(tube([j.shoulder, j.elbow, j.wrist], (u) => 0.052 - 0.022 * u, 40, 14))
    parts.push(at(blob([0.028, 0.042, 0.017]), j.hand))
    parts.push(tube([[s * 0.07, -0.04, 0], j.hip, j.knee, j.ankle], (u) => 0.08 - 0.042 * u, 44, 16))
    parts.push(at(blob([0.04, 0.028, 0.075]), j.foot))
  }
  const body = mesh(merge(parts), material)
  // 眼睛和嘴一直显示，皮肤变透明时也看得出哪边是正面
  const ink = new MeshLambertMaterial({ color: '#2b3340' })
  const face = mesh(
    merge([
      at(blob([0.013, 0.017, 0.008], undefined, 12, 8), [0.045, 0.812, 0.127]),
      at(blob([0.013, 0.017, 0.008], undefined, 12, 8), [-0.045, 0.812, 0.127]),
      tube([[-0.03, 0.757, 0.122], [0, 0.745, 0.13], [0.03, 0.757, 0.122]], 0.0035, 12, 5),
    ]),
    ink,
  )
  face.userData.keep = true
  return { part: { id: 'skin', pieces: [piece([0, 0, 0], [body, face])] } }
}

function spineZ(y: number) {
  return -0.088 + 0.012 * Math.sin((y + 0.2) * 6.5)
}

function buildBones(): Built[] {
  const skull = mesh(
    merge([at(blob([0.118, 0.13, 0.122], undefined, 32, 22), [0, 0.805, 0]), at(blob([0.075, 0.035, 0.065]), [0, 0.705, 0.035])]),
    boneMaterial(),
  )
  const vertebrae: BufferGeometry[] = []
  for (let y = -0.2; y <= 0.645; y += 0.03) {
    const disc = new CylinderGeometry(0.017, 0.017, 0.02, 10)
    disc.deleteAttribute('uv')
    vertebrae.push(at(disc, [0, y, spineZ(y)]))
    vertebrae.push(at(blob([0.006, 0.008, 0.012], undefined, 8, 6), [0, y, spineZ(y) - 0.022]))
  }
  const spine = mesh(merge(vertebrae), boneMaterial())

  const ribs: BufferGeometry[] = []
  for (let i = 0; i < 10; i += 1) {
    const yBack = 0.5 - i * 0.028
    const rx = 0.1 + 0.05 * Math.sin(Math.min(1, (i + 1) / 5) * (Math.PI / 2))
    const end = i >= 7 ? 0.74 : 0.88
    for (const s of [1, -1]) {
      const points: Vec3[] = []
      for (let k = 0; k <= 8; k += 1) {
        const phi = (k / 8) * Math.PI * end
        points.push([s * (0.02 + rx * Math.sin(phi)), yBack - 0.05 * (1 - Math.cos(phi)) * 0.5, 0.01 - 0.09 * Math.cos(phi)])
      }
      ribs.push(tube(points, 0.0058, 22, 6))
    }
  }
  ribs.push(at(blob([0.018, 0.085, 0.009]), [0, 0.385, 0.104]))
  for (const s of [1, -1]) ribs.push(tube([[s * 0.02, 0.555, 0.095], [s * 0.1, 0.57, 0.07], [s * 0.18, 0.565, 0.02]], 0.007, 14, 6))
  const ribcage = mesh(merge(ribs), boneMaterial())

  const ring = new TorusGeometry(0.1, 0.018, 8, 28)
  ring.deleteAttribute('uv')
  ring.rotateX(Math.PI / 2)
  ring.scale(1, 1, 0.7)
  const pelvisParts: BufferGeometry[] = [at(ring, [0, -0.17, 0]), at(blob([0.035, 0.05, 0.02]), [0, -0.15, -0.075])]
  for (const s of [1, -1]) pelvisParts.push(at(blob([0.05, 0.055, 0.022]).rotateY(s * 0.5), [s * 0.095, -0.115, -0.01]))
  const pelvis = mesh(merge(pelvisParts), boneMaterial())

  const limbs: BufferGeometry[] = []
  for (const s of [1, -1]) {
    const j = limb(s)
    limbs.push(tube([j.shoulder, [s * 0.22, 0.37, -0.005], j.elbow], 0.012, 16, 8))
    limbs.push(tube([j.elbow, [s * 0.27, 0.08, 0.005], j.wrist], 0.01, 16, 8))
    limbs.push(tube([j.hip, [s * 0.09, -0.37, 0.005], j.knee], 0.016, 16, 8))
    limbs.push(tube([j.knee, [s * 0.098, -0.72, 0], j.ankle], 0.013, 16, 8))
    for (const joint of [j.shoulder, j.elbow, j.wrist, j.hip, j.knee, j.ankle]) limbs.push(at(blob([0.02, 0.02, 0.02], undefined, 10, 8), joint))
    limbs.push(at(blob([0.02, 0.035, 0.01], undefined, 12, 8), j.hand))
    limbs.push(at(blob([0.025, 0.014, 0.055], undefined, 12, 8), j.foot))
  }
  const limbBones = mesh(merge(limbs), boneMaterial())

  return [
    { part: { id: 'skull', pieces: [piece([0, 0.79, 0.01], [skull])] } },
    { part: { id: 'spine', pieces: [piece([0, 0.22, -0.09], [spine])] } },
    { part: { id: 'ribcage', pieces: [piece([0, 0.4, 0], [ribcage])] } },
    { part: { id: 'pelvis', pieces: [piece([0, -0.15, -0.01], [pelvis])] } },
    { part: { id: 'limbBones', pieces: [piece([0, -0.2, 0], [limbBones])] } },
  ]
}

/** 大脑的沟回：在单位球上叠几层正弦起伏 */
function folds(p: Vector3) {
  const n = Math.sin(p.x * 13 + p.y * 3) * Math.sin(p.y * 12 + p.z * 2.5) * Math.sin(p.z * 11 + p.x * 4)
  p.multiplyScalar(1 + 0.05 * n)
}

function buildBrain(): Built {
  const c = ANCHORS.brain
  const pink = organMaterial(PARTS.brain.color, { side: DoubleSide })
  const meshes: Mesh[] = []
  const inner: Object3D[] = []
  const white = organMaterial('#fff1e8')
  for (const s of [1, -1]) {
    const half = blob([0.075, 0.08, 0.11], (p) => {
      if (p.x * s < 0) p.x *= 0.28
      folds(p)
    }, 44, 32)
    meshes.push(mesh(at(half, [c[0] + s * 0.024, c[1], c[2]]), pink))
    const core = mesh(at(blob([0.05, 0.055, 0.08], (p) => { if (p.x * s < 0) p.x *= 0.3 }), [c[0] + s * 0.026, c[1] - 0.005, c[2]]), white)
    meshes.push(core)
    inner.push(core)
  }
  const cerebellum = blob([0.06, 0.03, 0.036], (p) => p.multiplyScalar(1 + 0.04 * Math.sin(p.y * 30)), 28, 24)
  meshes.push(mesh(at(cerebellum, [0, 0.74, -0.07]), organMaterial('#f78aa3')))
  meshes.push(mesh(tube([[0, 0.79, -0.02], [0, 0.745, -0.04], [0, 0.7, -0.06]], (u) => 0.016 - 0.006 * u, 12, 10), organMaterial('#f7b2c0')))
  const built = piece(c, meshes)
  for (const object of inner) object.visible = false
  return { part: { id: 'brain', pieces: [built], inner } }
}

function buildSpinalCord(): Built {
  const points: Vec3[] = [[0, 0.72, -0.06]]
  for (let y = 0.64; y >= -0.14; y -= 0.1) points.push([0, y, spineZ(y)])
  const nerve = new MeshPhongMaterial({ color: PARTS.spinalCord.color, shininess: 30 })
  return { part: { id: 'spinalCord', pieces: [piece([0, 0.25, -0.09], [mesh(tube(points, 0.0075, 60, 8), nerve)])] } }
}

/** 支气管在肺里一分二、二分四地往外长，用固定的随机数，每次长得一样。 */
function bronchialTree(s: number) {
  let seed = s > 0 ? 7 : 13
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  const center = v(s > 0 ? ANCHORS.lungL : ANCHORS.lungR)
  const [rx, ry, rz] = LUNG_RADII
  const inside = (p: Vector3) => {
    const d = Math.hypot((p.x - center.x) / rx, (p.y - center.y) / ry, (p.z - center.z) / rz)
    if (d > 0.82) p.sub(center).multiplyScalar(0.82 / d).add(center)
    return p
  }
  const tubes: BufferGeometry[] = []
  const grow = (start: Vector3, dir: Vector3, length: number, radius: number, depth: number) => {
    const end = inside(start.clone().addScaledVector(dir, length))
    const mid = start.clone().lerp(end, 0.5).add(new Vector3(random() - 0.5, random() - 0.5, random() - 0.5).multiplyScalar(length * 0.15))
    tubes.push(tube([start.toArray() as Vec3, mid.toArray() as Vec3, end.toArray() as Vec3], (u) => radius * (1 - 0.35 * u), 8, 5, false))
    if (depth === 0) return
    for (const turn of [-1, 1]) {
      const next = dir.clone().add(new Vector3(turn * 0.55 * s, (random() - 0.5) * 0.9, (random() - 0.5) * 0.7)).normalize()
      grow(end, next, length * 0.68, radius * 0.7, depth - 1)
    }
  }
  const hilum = v(BRONCHI[s > 0 ? 0 : 1][2])
  for (const dir of [new Vector3(s * 0.45, 0.85, 0), new Vector3(s * 0.95, -0.15, 0.15), new Vector3(s * 0.35, -0.9, -0.1)]) {
    grow(hilum.clone(), dir.normalize(), 0.055, 0.0055, 2)
  }
  return merge(tubes)
}

function buildLungs(): Built {
  const pieces = []
  const inner: Object3D[] = []
  const treeMaterial = organMaterial('#8fd0f2')
  for (const s of [1, -1]) {
    const c = s > 0 ? ANCHORS.lungL : ANCHORS.lungR
    const shell = blob(LUNG_RADII, (p) => {
      if (p.y > 0) {
        const k = 1 - 0.38 * p.y
        p.x *= k
        p.z *= k
      }
      if (p.y < -0.55) p.y = -0.55 + (p.y + 0.55) * 0.35
      if (p.y < -0.3) p.y += 0.1 * Math.max(0, 1 - (p.x * p.x + p.z * p.z) * 1.4)
      if (p.x * s < 0) p.x *= 0.7
      // 左肺给心脏让出一块凹口
      if (s > 0 && p.x < 0 && p.y < 0.15 && p.z > -0.1) p.x *= 0.5
    }, 32, 24)
    const lung = mesh(at(shell, c), organMaterial(PARTS.lungs.color, { side: DoubleSide, shininess: 20 }))
    const tree = mesh(bronchialTree(s), treeMaterial)
    tree.visible = false
    inner.push(tree)
    pieces.push(piece(c, [lung, tree]))
  }
  return { part: { id: 'lungs', pieces, inner } }
}

function buildTrachea(): Built {
  const geometry = merge([
    tube(TRACHEA, (u) => 0.0115 * (1 + 0.12 * Math.max(0, Math.sin(u * Math.PI * 22))), 60, 12),
    ...BRONCHI.map((points) => tube(points, 0.0075, 16, 8)),
  ])
  return { part: { id: 'trachea', pieces: [piece([0, 0.52, 0.025], [mesh(geometry, organMaterial(PARTS.trachea.color))])] } }
}

function buildDiaphragm(): Built {
  const dome = new SphereGeometry(1, 32, 10, 0, Math.PI * 2, 0, 1.15)
  dome.deleteAttribute('uv')
  dome.scale(0.15, 0.06, 0.105)
  const material = organMaterial(PARTS.diaphragm.color, { side: DoubleSide, shininess: 16 })
  return { part: { id: 'diaphragm', pieces: [piece(ANCHORS.diaphragm, [mesh(at(dome, ANCHORS.diaphragm), material)])] } }
}

function buildHeart(): Built {
  const c = ANCHORS.heart
  const shell = blob([0.048, 0.058, 0.045], (p) => {
    if (p.y < 0) {
      const k = 1 - 0.75 * Math.pow(-p.y, 1.6)
      p.x *= k
      p.z *= k
    }
    if (p.y > 0.3) p.z *= 0.9
    // 前面一道浅沟，分出左右心室
    p.multiplyScalar(1 - 0.06 * Math.exp(-Math.pow((p.x + 0.15 * p.y) * 6, 2)) * Math.max(0, p.z))
  }, 32, 24)
  shell.rotateZ(0.45).rotateX(-0.35)
  const meshes: Mesh[] = [mesh(at(shell, c), organMaterial(PARTS.heart.color, { side: DoubleSide, shininess: 48 }))]
  const blue = organMaterial('#6f8cff')
  const red = organMaterial('#d9233f')
  const chambers: Array<[Vec3, Material]> = [
    [[-0.019, 0.016, 0.002], blue],
    [[-0.008, -0.014, 0.016], blue],
    [[0.02, 0.018, -0.008], red],
    [[0.016, -0.016, 0.006], red],
  ]
  const inner: Object3D[] = []
  for (const [offset, material] of chambers) {
    const chamber = mesh(at(blob([0.016, 0.017, 0.015], undefined, 14, 10), [c[0] + offset[0], c[1] + offset[1], c[2] + offset[2]]), material)
    chamber.visible = false
    inner.push(chamber)
    meshes.push(chamber)
  }
  return { part: { id: 'heart', pieces: [piece(c, meshes)], inner } }
}

function buildVessels(): Built {
  const arteries = VESSELS.filter((one) => one.kind === 'artery').map((one) => tube(one.points, one.radius, Math.max(16, one.points.length * 10), 8))
  const veins = VESSELS.filter((one) => one.kind === 'vein').map((one) => tube(one.points, one.radius, Math.max(16, one.points.length * 10), 8))
  const meshes = [mesh(merge(arteries), organMaterial('#ff4757')), mesh(merge(veins), organMaterial('#5b7cfa'))]
  return { part: { id: 'vessels', pieces: [piece([0, 0.1, -0.02], meshes)] } }
}

function buildDigestive(): Built[] {
  const esophagus = mesh(tube(ESOPHAGUS, 0.0085, 40, 10), organMaterial(PARTS.esophagus.color))
  const stomach = mesh(tube(STOMACH, stomachRadius, 56, 18), organMaterial(PARTS.stomach.color, { side: DoubleSide }))
  // 右边（-x）厚、往左边越来越薄，底面斜着削平，像一块楔子
  const liverShape = blob([0.105, 0.08, 0.078], (p) => {
    const f = 0.35 + 0.65 * ((1 - p.x) / 2)
    p.y *= f
    if (p.y < 0) p.y = p.y * 0.55 - 0.15 * (1 - (1 - p.x) / 2) * (1 - p.y * p.y)
    p.z *= 0.8 + 0.2 * f
  }, 32, 22)
  const liver = mesh(at(liverShape, ANCHORS.liver), organMaterial(PARTS.liver.color, { shininess: 50 }))
  const gallbladder = mesh(at(blob([0.012, 0.022, 0.012]).rotateZ(-0.5), ANCHORS.gallbladder), organMaterial(PARTS.gallbladder.color))
  const pancreas = mesh(tube([[-0.035, 0.09, 0.005], [0.02, 0.105, -0.01], [0.09, 0.125, -0.03]], (u) => 0.014 - 0.006 * u, 24, 10), organMaterial(PARTS.pancreas.color, { shininess: 20 }))
  const spleen = mesh(at(blob([0.022, 0.04, 0.03]).rotateZ(0.3), ANCHORS.spleen), organMaterial(PARTS.spleen.color))
  const small = mesh(tube(SMALL_INTESTINE, 0.0115, 420, 8), organMaterial(PARTS.smallIntestine.color))
  const large = mesh(
    merge([
      tube(LARGE_INTESTINE, (u) => {
        const base = u < 0.06 ? 0.025 : u > 0.86 ? 0.021 - (u - 0.86) * 0.05 : 0.021
        return base * (1 + 0.12 * Math.sin(u * Math.PI * 64))
      }, 240, 12),
      tube(APPENDIX, (u) => 0.0055 - 0.002 * u, 10, 6),
    ]),
    organMaterial(PARTS.largeIntestine.color),
  )
  return [
    { part: { id: 'esophagus', pieces: [piece([0.01, 0.44, -0.015], [esophagus])] } },
    { part: { id: 'stomach', pieces: [piece([0.055, 0.135, 0.035], [stomach])] } },
    { part: { id: 'liver', pieces: [piece(ANCHORS.liver, [liver])] } },
    { part: { id: 'gallbladder', pieces: [piece(ANCHORS.gallbladder, [gallbladder])] } },
    { part: { id: 'pancreas', pieces: [piece([0.025, 0.105, -0.01], [pancreas])] } },
    { part: { id: 'spleen', pieces: [piece(ANCHORS.spleen, [spleen])] } },
    { part: { id: 'smallIntestine', pieces: [piece([0, -0.05, 0.03], [small])] } },
    { part: { id: 'largeIntestine', pieces: [piece([0, -0.06, 0.03], [large])] } },
  ]
}

function buildUrinary(): Built[] {
  const pieces = []
  const material = organMaterial(PARTS.kidneys.color, { shininess: 44 })
  const ureter = organMaterial(PARTS.bladder.color)
  for (const s of [1, -1]) {
    const c = s > 0 ? ANCHORS.kidneyL : ANCHORS.kidneyR
    const bean = blob([0.024, 0.045, 0.02], (p) => {
      if (p.x * s < 0) p.x *= 1 - 0.6 * Math.exp(-p.y * p.y * 6)
    })
    const kidney = mesh(at(bean.rotateZ(s * 0.18), c), material)
    const tubeMesh = mesh(tube([[s * 0.056, 0.065, -0.06], [s * 0.048, -0.05, -0.05], [s * 0.026, -0.17, 0.02], [s * 0.012, -0.192, 0.036]], 0.0035, 30, 6), ureter)
    pieces.push(piece(c, [kidney, tubeMesh]))
  }
  const bladder = mesh(at(blob([0.034, 0.03, 0.03]), ANCHORS.bladder), organMaterial(PARTS.bladder.color, { shininess: 50 }))
  return [
    { part: { id: 'kidneys', pieces } },
    { part: { id: 'bladder', pieces: [piece(ANCHORS.bladder, [bladder])] } },
  ]
}

export function buildProceduralBody(): BodyModel {
  const built: Built[] = [
    buildSkin(),
    ...buildBones(),
    buildBrain(),
    buildSpinalCord(),
    buildTrachea(),
    buildLungs(),
    buildDiaphragm(),
    buildHeart(),
    buildVessels(),
    ...buildDigestive(),
    ...buildUrinary(),
  ]
  const parts: Partial<Record<PartId, BodyPart>> = {}
  for (const { part } of built) parts[part.id] = part
  return {
    parts,
    dispose() {
      for (const part of Object.values(parts)) part?.pieces.forEach((one) => disposeTree(one.object))
    },
  }
}
