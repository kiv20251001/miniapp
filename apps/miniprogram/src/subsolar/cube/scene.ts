/**
 * 「3D 几何体」3D 场景。三类内容：
 * - solid  各种几何体：点面、棱、顶点做标记，可以透视，平行的面同色，长方体三组棱分颜色。
 * - net    展开图：正方体按 11 种格子展开图折；其他几何体按 solids.ts 找到的展开树折。
 *          每个面挂在父面的折痕上，open 从 0（立体）到 1（摊平）连续变化。
 * - blocks 小正方体：体积一层层搭、表面涂色切块、小测验里的方块堆。
 * 页面只负责 UI，触摸坐标原样传进来；标记数、点中的面通过回调告诉页面。
 */
import {
  AmbientLight,
  BackSide,
  BoxGeometry,
  BufferGeometry,
  Color,
  ColorManagement,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  FrontSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  LinearSRGBColorSpace,
  Material,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Raycaster,
  Scene,
  SphereGeometry,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import type { CanvasNode, TouchPoint } from '../scene'
import { createLabel, disposeLabel, fitLabel, type Label } from '../labels'
import { foldTree, outerFaces, rollFaces, type Cell, type Dir, type View } from './geometry'
import type { MarkKind } from './lessons'
import { polyhedron, unfoldSolid, type Polyhedron, type Solid } from './solids'
import { faceTexture } from './textures'

export type { CanvasNode, TouchPoint }

export type SolidOptions = {
  shape: Solid
  kind: MarkKind
  /** 透视：面变成半透明，背面的棱和顶点也能点 */
  see: boolean
  /** 相对的面同一种颜色 */
  pairs: boolean
  /** 棱按长、宽、高分三种颜色，并标出名字 */
  groups: boolean
  names: { length: string; width: string; height: string }
}

export type NetOptions = {
  cells: Cell[]
  /** 每个面上写的字，null 时不写 */
  letters?: string[] | null
  /** 相对的面同色，或者全部一个颜色 */
  colors: 'pairs' | 'plain'
  open: number
}

export type PolyNetOptions = {
  shape: Solid
  colors: 'pairs' | 'plain'
  open: number
}

export type BlockOptions = {
  /** 方块所在的格子 [x, y, z] */
  cubes: Array<[number, number, number]>
  /** 整体尺寸 [长 x, 高 y, 宽 z]，算外露面和居中用 */
  size: [number, number, number]
  paint: 'none' | 'pairs' | 'red'
  color?: 'cream' | 'blue'
  gap?: number
  /** 只亮出外露面数等于它的方块 */
  filter?: number | null
  /** 棱上的长宽高标注 */
  dims?: { length: string; width: string; height: string } | null
  /** 方块堆前面写「正面」，并铺一块地面 */
  front?: string | null
  /** 一层一层搭出来 */
  build?: boolean
}

export type SceneOptions = {
  canvas: CanvasNode
  width: number
  height: number
  pixelRatio: number
  background: string
  dark: boolean
  onMark?: (kind: MarkKind, count: number, total: number) => void
  onFace?: (index: number) => void
  onOpen?: (open: number) => void
  onBlock?: (painted: number) => void
  onLayer?: (layer: number) => void
  onTouch?: () => void
}

const FOV = 40
/** 平行的面同色：前三种给正方体、长方体的三对面，和长宽高三组棱的颜色一致 */
const PALETTE = ['#ff8f5a', '#4fa3ff', '#2fcf8a', '#ffc53d', '#a07bff', '#ff6fa3', '#22c3cf', '#8bd448', '#ff5d5d', '#6a86ff']
const PAIR_COLORS = PALETTE.slice(0, 3)
const PAIR_DEEP = ['#ff6a2b', '#2f86f6', '#14b277']
const PLAIN_FACE = '#ffcf4d'
const MARK = '#ff4f2e'
const EDGE_INK = '#2c3654'
const NET_LINE = '#3d4866'
const BLOCK_COLORS = { cream: '#ffd36b', blue: '#6fb6ff' }
const RED = '#ff4a3a'
const INNER = '#fff4dc'

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/** 凸多边形面：从第一个顶点扇形三角化，法线统一给面法线。 */
function polygonGeometry(ring: Vector3[], normal: Vector3) {
  const positions: number[] = []
  for (let i = 1; i < ring.length - 1; i += 1) {
    for (const point of [ring[0], ring[i], ring[i + 1]]) positions.push(point.x, point.y, point.z)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(Array.from({ length: positions.length / 3 }, () => [normal.x, normal.y, normal.z]).flat(), 3))
  return geometry
}

function outlineGeometry(ring: Vector3[]) {
  const positions: number[] = []
  ring.forEach((point, index) => {
    const next = ring[(index + 1) % ring.length]
    positions.push(point.x, point.y, point.z, next.x, next.y, next.z)
  })
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  return geometry
}

function patchCanvas(canvas: CanvasNode) {
  if (!canvas.style) canvas.style = { width: '', height: '' }
  if (!canvas.addEventListener) canvas.addEventListener = () => {}
  if (!canvas.removeEventListener) canvas.removeEventListener = () => {}
}

type SolidItem = {
  kind: MarkKind
  index: number
  mesh: Mesh
  material: MeshLambertMaterial
  base: string
  center: Vector3
  /** 棱的两端，屏幕上量点到线段的距离 */
  ends?: [Vector3, Vector3]
  /** 面和棱往外推一点放标号 */
  out: Vector3
}

type NetFace = {
  index: number
  pivot: Group
  face: Group
  axis: 'x' | 'z'
  sign: number
  meshes: Object3D[]
  outer: MeshLambertMaterial
  inner: MeshLambertMaterial
  texture: Texture | null
}

type PolyFace = {
  index: number
  parent: number
  /** 折痕上的一点和方向，摊平时绕它转 angle */
  origin: Vector3
  axis: Vector3
  angle: number
  meshes: Object3D[]
  material: MeshLambertMaterial
  matrix: Matrix4
}

type Block = {
  mesh: Mesh
  edges: LineSegments
  cell: [number, number, number]
  outer: number
  delay: number
  pop: number
}

export class CubeScene {
  private readonly opts: SceneOptions
  private readonly canvas: CanvasNode
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera: PerspectiveCamera
  private readonly holder = new Group()
  private content = new Group()
  private labels: Label[] = []
  private markLabels: Label[] = []
  private width: number
  private height: number
  private running = false
  private frameId = 0
  private lastTime = 0
  private clock = 0

  private readonly cam = { yaw: -0.55, pitch: 0.5, dist: 7 }
  private readonly goal = { yaw: -0.55, pitch: 0.5, dist: 7 }
  private minDist = 3
  private maxDist = 20
  private autoSpin = true
  private touched = false
  private celebrateT = -1
  private shakeT = -1

  private touches: TouchPoint[] = []
  private tapStart = 0
  private tapPoint: TouchPoint = { x: 0, y: 0 }
  private tapMoved = false
  private pinchSpan = 0
  private readonly raycaster = new Raycaster()
  private readonly ndc = new Vector2()
  private readonly tmp = new Vector3()

  // 共享几何体
  private readonly plane = new PlaneGeometry(1, 1)
  private readonly planeEdges = new EdgesGeometry(new PlaneGeometry(1, 1))
  private readonly box = new BoxGeometry(1, 1, 1)
  private readonly boxEdges = new EdgesGeometry(new BoxGeometry(1, 1, 1))
  private readonly blockMaterials = new Map<string, MeshLambertMaterial>()
  private readonly ghost = new MeshLambertMaterial({ color: '#c9d2e3', transparent: true, opacity: 0.08, depthWrite: false })
  private readonly edgeLine = new LineBasicMaterial({ color: '#a8761f', transparent: true, opacity: 0.6 })
  private readonly ghostLine = new LineBasicMaterial({ color: '#9aa3b8', transparent: true, opacity: 0.12 })

  private mode: 'solid' | 'net' | 'blocks' = 'solid'

  // solid
  private solidOpts: SolidOptions | null = null
  private solidPoly: Polyhedron | null = null
  private solidItems: SolidItem[] = []
  private faceMeshes: Mesh[] = []
  private marks: Record<MarkKind, number[]> = { face: [], edge: [], vertex: [] }

  // net
  private netFaces: NetFace[] = []
  private polyFaces: PolyFace[] = []
  private netRoot = new Group()
  private netCenter = { cube: new Vector3(), flat: new Vector3() }
  private netRadius = { cube: 1, flat: 2 }
  private open = 1
  private openTween: { from: number; to: number; t: number; seconds: number } | null = null
  private lastOpenReport = 0
  private highlight: { indices: number[]; tone: 'pick' | 'bad' } | null = null

  // blocks
  private blocks: Block[] = []
  private blockOpts: BlockOptions | null = null
  private blockSet = new Set<string>()
  private gap = 0
  private gapGoal = 0
  private buildT = -1
  private lastLayer = -1
  private blockLabels: Array<{ label: Label; at: (spacing: number) => Vector3 }> = []

  constructor(opts: SceneOptions) {
    this.opts = opts
    this.canvas = opts.canvas
    this.width = opts.width
    this.height = opts.height
    patchCanvas(this.canvas)
    const gl = this.canvas.getContext('webgl', { antialias: true, alpha: false, depth: true })
    if (!gl) throw new Error('no-webgl')
    ColorManagement.enabled = false
    this.renderer = new WebGLRenderer({ canvas: this.canvas as unknown as HTMLCanvasElement, context: gl, antialias: true })
    this.renderer.outputColorSpace = LinearSRGBColorSpace
    this.renderer.setPixelRatio(opts.pixelRatio)
    this.renderer.setSize(opts.width, opts.height, false)
    this.renderer.setClearColor(new Color(opts.background), 1)

    this.camera = new PerspectiveCamera(FOV, opts.width / opts.height, 0.1, 200)
    // 主光跟着相机走，转到哪一面都亮；再从右上偏一点，三个面明暗不同，看得出立体
    // three.js r155 起光照按物理单位算，漫反射要除以 π，强度乘 π 才是想要的亮度
    const key = new DirectionalLight(0xffffff, 0.4 * Math.PI)
    key.position.set(2.5, 4, 3)
    this.camera.add(key)
    this.scene.add(this.camera, new AmbientLight(0xffffff, 0.76 * Math.PI))
    this.scene.add(this.holder)
    this.holder.add(this.content)
  }

  // ---- 对外接口 ----

  setBackground(color: string, dark: boolean) {
    this.renderer.setClearColor(new Color(color), 1)
    this.opts.dark = dark
  }

  start() {
    if (this.running) return
    this.running = true
    this.lastTime = Date.now()
    const loop = () => {
      if (!this.running) return
      const now = Date.now()
      const dt = Math.min(0.05, (now - this.lastTime) / 1000)
      this.lastTime = now
      this.step(dt)
      this.renderer.render(this.scene, this.camera)
      this.frameId = this.canvas.requestAnimationFrame(loop)
    }
    this.frameId = this.canvas.requestAnimationFrame(loop)
  }

  stop() {
    this.running = false
    if (this.frameId) this.canvas.cancelAnimationFrame(this.frameId)
    this.frameId = 0
  }

  resize(width: number, height: number) {
    if (Math.round(width) === Math.round(this.width) && Math.round(height) === Math.round(this.height)) return
    this.width = width
    this.height = height
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    for (const label of [...this.labels, ...this.markLabels]) fitLabel(label, this.height, FOV)
  }

  dispose() {
    this.stop()
    this.clearContent()
    this.plane.dispose()
    this.planeEdges.dispose()
    this.box.dispose()
    this.boxEdges.dispose()
    this.blockMaterials.forEach((material) => material.dispose())
    this.ghost.dispose()
    this.edgeLine.dispose()
    this.ghostLine.dispose()
    this.renderer.dispose()
  }

  /** 答对时整体弹一下、转一圈。 */
  celebrate() {
    this.celebrateT = 0
    this.goal.yaw += Math.PI * 2
  }

  /** 答错时左右晃一晃。 */
  shake() {
    this.shakeT = 0
  }

  setAutoSpin(on: boolean) {
    this.autoSpin = on
  }

  /** 相机飞到正面、上面或左面。 */
  viewFrom(view: View) {
    this.autoSpin = false
    const turn = Math.round(this.goal.yaw / (Math.PI * 2)) * Math.PI * 2
    if (view === 'front') Object.assign(this.goal, { yaw: turn, pitch: 0.02 })
    else if (view === 'left') Object.assign(this.goal, { yaw: turn - Math.PI / 2, pitch: 0.02 })
    else Object.assign(this.goal, { yaw: turn, pitch: 1.52 })
  }

  resetView(yaw = -0.55, pitch = 0.5) {
    const turn = Math.round(this.goal.yaw / (Math.PI * 2)) * Math.PI * 2
    this.goal.yaw = turn + yaw
    this.goal.pitch = pitch
  }

  // ---- 正方体 / 长方体 ----

  showSolid(options: SolidOptions) {
    const rebuild = this.mode !== 'solid' || !this.solidOpts || this.solidOpts.shape !== options.shape
    if (rebuild) {
      this.clearContent()
      this.mode = 'solid'
      this.marks = { face: [], edge: [], vertex: [] }
      this.solidOpts = options
      this.buildSolid(options.shape)
      this.frame(this.solidPoly!.radius, 1.25)
      this.autoSpin = !this.touched
      this.resetView()
    }
    this.solidOpts = options
    this.paintSolid()
    this.syncMarkLabels()
    this.reportMarks()
  }

  clearMarks() {
    if (!this.solidOpts) return
    this.marks[this.solidOpts.kind] = []
    this.paintSolid()
    this.syncMarkLabels()
    this.reportMarks()
  }

  private buildSolid(shape: Solid) {
    const poly = polyhedron(shape)
    this.solidPoly = poly
    const points = poly.vertices.map(([x, y, z]) => new Vector3(x, y, z))
    const items: SolidItem[] = []
    this.faceMeshes = []
    poly.faces.forEach((face, index) => {
      const normal = new Vector3(...poly.normals[index])
      const material = new MeshLambertMaterial({ color: PLAIN_FACE, side: DoubleSide, transparent: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
      const mesh = new Mesh(polygonGeometry(face.map((at) => points[at]), normal), material)
      mesh.userData.index = index
      this.content.add(mesh)
      this.faceMeshes.push(mesh)
      const center = face.reduce((sum, at) => sum.add(points[at]), new Vector3()).multiplyScalar(1 / face.length)
      items.push({ kind: 'face', index, mesh, material, base: PLAIN_FACE, center, out: center.clone().add(normal.multiplyScalar(0.05)) })
    })
    const sphere = new SphereGeometry(1, 20, 14)
    const rod = new CylinderGeometry(1, 1, 1, 12)
    const up = new Vector3(0, 1, 0)
    poly.edges.forEach(([i, j], index) => {
      const a = points[i]
      const b = points[j]
      const material = new MeshLambertMaterial({ color: EDGE_INK })
      const mesh = new Mesh(rod, material)
      const center = a.clone().add(b).multiplyScalar(0.5)
      const dir = b.clone().sub(a)
      mesh.position.copy(center)
      mesh.quaternion.copy(new Quaternion().setFromUnitVectors(up, dir.clone().normalize()))
      mesh.scale.set(0.04, dir.length(), 0.04)
      if (poly.box) mesh.userData.axis = [Math.abs(dir.x), Math.abs(dir.y), Math.abs(dir.z)].indexOf(Math.max(Math.abs(dir.x), Math.abs(dir.y), Math.abs(dir.z)))
      this.content.add(mesh)
      items.push({ kind: 'edge', index, mesh, material, base: EDGE_INK, center, ends: [a, b], out: center.clone().multiplyScalar(1.12) })
    })
    points.forEach((corner, index) => {
      const material = new MeshLambertMaterial({ color: EDGE_INK })
      const mesh = new Mesh(sphere, material)
      mesh.position.copy(corner)
      this.content.add(mesh)
      items.push({ kind: 'vertex', index, mesh, material, base: EDGE_INK, center: corner, out: corner.clone().multiplyScalar(1.16) })
    })
    this.solidItems = items
  }

  /** 按当前选项给面、棱、顶点上色和定粗细。 */
  private paintSolid() {
    const options = this.solidOpts
    if (!options) return
    const marked = new Set(this.marks[options.kind])
    for (const item of this.solidItems) {
      const on = item.kind === options.kind && marked.has(item.index)
      if (item.kind === 'face') {
        const group = this.solidPoly?.groups[item.index] ?? 0
        const base = options.pairs ? PALETTE[group % PALETTE.length] : PLAIN_FACE
        item.material.color.set(on ? MARK : base)
        item.material.opacity = options.see ? (on ? 0.62 : 0.3) : 1
        item.material.depthWrite = !options.see
        continue
      }
      const axis = item.mesh.userData.axis as number | undefined
      const groupColor = item.kind === 'edge' && options.groups && axis !== undefined ? PAIR_DEEP[axis] : EDGE_INK
      item.material.color.set(on ? MARK : groupColor)
      if (item.kind === 'edge') {
        const thick = options.kind === 'edge' ? (on ? 0.085 : 0.055) : 0.035
        item.mesh.scale.x = thick
        item.mesh.scale.z = thick
      } else {
        const r = options.kind === 'vertex' ? (on ? 0.15 : 0.11) : options.kind === 'edge' ? 0.05 : 0.045
        item.mesh.scale.setScalar(r)
      }
    }
    this.syncGroupLabels()
  }

  private syncGroupLabels() {
    this.labels.forEach((label) => {
      label.sprite.removeFromParent()
      disposeLabel(label)
    })
    this.labels = []
    const options = this.solidOpts
    const box = this.solidPoly?.box
    if (!options || !box || !options.groups || options.kind !== 'edge') return
    const [l, h, w] = box
    const spots: Array<[string, string, Vector3]> = [
      [options.names.length, PAIR_DEEP[0], new Vector3(0, -h / 2 - 0.28, w / 2 + 0.12)],
      [options.names.width, PAIR_DEEP[2], new Vector3(l / 2 + 0.34, -h / 2 - 0.2, 0)],
      [options.names.height, PAIR_DEEP[1], new Vector3(l / 2 + 0.34, 0, w / 2 + 0.1)],
    ]
    for (const [text, color, at] of spots) {
      const label = createLabel(text, '#ffffff', color)
      if (!label) continue
      fitLabel(label, this.height, FOV)
      label.sprite.position.copy(at)
      this.content.add(label.sprite)
      this.labels.push(label)
    }
  }

  private syncMarkLabels() {
    this.markLabels.forEach((label) => {
      label.sprite.removeFromParent()
      disposeLabel(label)
    })
    this.markLabels = []
    const options = this.solidOpts
    if (!options) return
    this.marks[options.kind].forEach((index, order) => {
      const item = this.solidItems.find((one) => one.kind === options.kind && one.index === index)
      const label = item ? createLabel(String(order + 1), '#ffffff', '#ff6a33') : null
      if (!item || !label) return
      fitLabel(label, this.height, FOV)
      label.sprite.position.copy(item.out)
      this.content.add(label.sprite)
      this.markLabels.push(label)
    })
  }

  private reportMarks() {
    const options = this.solidOpts
    if (!options) return
    const total = this.solidItems.filter((item) => item.kind === options.kind).length
    this.opts.onMark?.(options.kind, this.marks[options.kind].length, total)
  }

  private toggleMark(item: SolidItem) {
    const list = this.marks[item.kind]
    const at = list.indexOf(item.index)
    if (at >= 0) list.splice(at, 1)
    else list.push(item.index)
    this.paintSolid()
    this.syncMarkLabels()
    this.reportMarks()
  }

  /** 从相机看过去，这个点前面有没有被面挡住。 */
  private visible(point: Vector3) {
    if (this.solidOpts?.see) return true
    const world = point.clone()
    this.content.localToWorld(world)
    const dir = world.clone().sub(this.camera.position)
    const dist = dir.length()
    this.raycaster.set(this.camera.position, dir.normalize())
    const hit = this.raycaster.intersectObjects(this.faceMeshes, false)[0]
    return !hit || hit.distance > dist - 0.06
  }

  private screen(point: Vector3) {
    const world = point.clone()
    this.content.localToWorld(world)
    world.project(this.camera)
    return { x: (world.x + 1) * 0.5 * this.width, y: (1 - world.y) * 0.5 * this.height }
  }

  private pickSolid(point: TouchPoint) {
    const options = this.solidOpts
    if (!options) return
    if (options.kind === 'face') {
      this.setRay(point)
      const hit = this.raycaster.intersectObjects(this.faceMeshes, false)[0]
      if (!hit) return
      const item = this.solidItems.find((one) => one.kind === 'face' && one.mesh === hit.object)
      if (item) this.toggleMark(item)
      return
    }
    let best: SolidItem | null = null
    let bestD = options.kind === 'edge' ? 22 : 30
    for (const item of this.solidItems) {
      if (item.kind !== options.kind) continue
      let d: number
      if (item.ends) {
        const a = this.screen(item.ends[0])
        const b = this.screen(item.ends[1])
        const abx = b.x - a.x
        const aby = b.y - a.y
        const len = abx * abx + aby * aby || 1
        const t = clamp(((point.x - a.x) * abx + (point.y - a.y) * aby) / len, 0.08, 0.92)
        d = Math.hypot(point.x - (a.x + abx * t), point.y - (a.y + aby * t))
      } else {
        const s = this.screen(item.center)
        d = Math.hypot(point.x - s.x, point.y - s.y)
      }
      if (d >= bestD || !this.visible(item.center)) continue
      bestD = d
      best = item
    }
    if (best) this.toggleMark(best)
  }

  // ---- 展开图 ----

  showNet(options: NetOptions) {
    this.clearContent()
    this.mode = 'net'
    this.highlight = null
    this.openTween = null
    const { cells } = options
    const root = this.centerCell(cells)
    const tree = foldTree(cells, root) ?? []
    const faces = rollFaces(cells) ?? cells.map(() => 0)
    this.netRoot = new Group()
    this.content.add(this.netRoot)
    const byIndex = new Map<number, NetFace>()
    const dirVec: Record<Dir, Vector3> = {
      right: new Vector3(1, 0, 0),
      left: new Vector3(-1, 0, 0),
      down: new Vector3(0, 0, 1),
      up: new Vector3(0, 0, -1),
    }
    for (const node of tree) {
      const fill = options.colors === 'pairs' ? PAIR_COLORS[faces[node.index] >> 1] : PLAIN_FACE
      const letter = options.letters?.[node.index] ?? ''
      const texture = faceTexture(fill, letter, letter === '★' ? '#f15a36' : '#2b3340')
      const outer = new MeshLambertMaterial({ color: texture ? '#ffffff' : fill, map: texture, side: FrontSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
      const inner = new MeshLambertMaterial({ color: INNER, side: BackSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
      const pivot = new Group()
      const face = new Group()
      pivot.add(face)
      const outerMesh = new Mesh(this.plane, outer)
      const innerMesh = new Mesh(this.plane, inner)
      const line = new LineSegments(this.planeEdges, new LineBasicMaterial({ color: NET_LINE }))
      for (const mesh of [outerMesh, innerMesh, line]) {
        mesh.rotation.x = -Math.PI / 2
        mesh.userData.index = node.index
        face.add(mesh)
      }
      let axis: 'x' | 'z' = 'x'
      let sign = 0
      if (node.dir) {
        const parent = byIndex.get(node.parent)!
        const step = dirVec[node.dir].clone().multiplyScalar(0.5)
        pivot.position.copy(step)
        face.position.copy(step)
        parent.face.add(pivot)
        axis = node.dir === 'right' || node.dir === 'left' ? 'z' : 'x'
        sign = node.dir === 'right' || node.dir === 'up' ? -1 : 1
      } else {
        this.netRoot.add(pivot)
      }
      const item: NetFace = { index: node.index, pivot, face, axis, sign, meshes: [outerMesh, innerMesh, line], outer, inner, texture }
      byIndex.set(node.index, item)
      this.netFaces.push(item)
    }
    const [rx, ry] = cells[root]
    const flat = new Vector3()
    for (const [x, y] of cells) flat.add(new Vector3(x - rx, 0, y - ry))
    flat.multiplyScalar(1 / cells.length)
    this.netCenter = { cube: new Vector3(0, -0.5, 0), flat }
    const spread = Math.max(...cells.map(([x, y]) => Math.hypot(x - rx - flat.x, y - ry - flat.z))) + 0.75
    this.netRadius = { cube: 0.95, flat: spread }
    this.setOpen(options.open)
    this.cam.dist = this.goal.dist
    this.autoSpin = false
    this.goal.yaw = Math.round(this.goal.yaw / (Math.PI * 2)) * Math.PI * 2
    this.goal.pitch = this.pitchFor(options.open)
  }

  /** 尽量从中间那一格开始折，折的时候整体不会甩到一边。 */
  private centerCell(cells: Cell[]) {
    let best = 0
    let bestScore = Infinity
    cells.forEach(([x, y], index) => {
      const score = cells.reduce((sum, [ox, oy]) => sum + Math.abs(ox - x) + Math.abs(oy - y), 0)
      if (score < bestScore) {
        bestScore = score
        best = index
      }
    })
    return best
  }

  private pitchFor(open: number) {
    return 0.5 + open * 0.85
  }

  setOpen(open: number) {
    this.open = clamp(open, 0, 1)
    if (this.polyFaces.length) this.layoutPolyNet()
    const angle = (1 - this.open) * (Math.PI / 2)
    for (const item of this.netFaces) {
      if (!item.sign) continue
      item.pivot.rotation.set(0, 0, 0)
      item.pivot.rotation[item.axis] = item.sign * angle
    }
    this.netRoot.position.copy(this.netCenter.cube).lerp(this.netCenter.flat, this.open).multiplyScalar(-1)
    this.frame(this.netRadius.cube + (this.netRadius.flat - this.netRadius.cube) * this.open, 1.15)
  }

  /** 折起来或摊开，seconds 秒走完。 */
  animateOpen(to: number, seconds = 1.4) {
    if (this.mode !== 'net') return
    this.openTween = { from: this.open, to: clamp(to, 0, 1), t: 0, seconds }
    if (!this.touched) this.autoSpin = false
  }

  /** 拖滑块：停掉正在播的动画，直接摆到这个位置。 */
  dragOpen(open: number) {
    if (this.mode !== 'net') return
    this.openTween = null
    this.setOpen(open)
    this.goal.pitch = this.pitchFor(this.open)
  }

  /** 其他几何体的展开图：面按 solids.ts 的展开树挂在父面的折痕上。 */
  showPolyNet(options: PolyNetOptions) {
    this.clearContent()
    this.mode = 'net'
    this.highlight = null
    this.openTween = null
    const poly = polyhedron(options.shape)
    const unfold = unfoldSolid(options.shape)
    const points = poly.vertices.map(([x, y, z]) => new Vector3(x, y, z))
    const lineMaterial = new LineBasicMaterial({ color: NET_LINE })
    this.netRoot = new Group()
    this.content.add(this.netRoot)
    this.polyFaces = unfold.order.map((index) => {
      const ring = poly.faces[index].map((at) => points[at])
      const fill = options.colors === 'pairs' ? PALETTE[poly.groups[index] % PALETTE.length] : PLAIN_FACE
      const material = new MeshLambertMaterial({ color: fill, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
      const mesh = new Mesh(polygonGeometry(ring, new Vector3(...poly.normals[index])), material)
      const line = new LineSegments(outlineGeometry(ring), lineMaterial)
      for (const one of [mesh, line]) {
        one.userData.index = index
        one.matrixAutoUpdate = false
        this.netRoot.add(one)
      }
      const hinge = unfold.hinge[index]
      return {
        index,
        parent: unfold.parent[index],
        origin: hinge ? points[hinge[0]].clone() : new Vector3(),
        axis: hinge ? points[hinge[1]].clone().sub(points[hinge[0]]).normalize() : new Vector3(0, 1, 0),
        angle: unfold.angle[index],
        meshes: [mesh, line],
        material,
        matrix: new Matrix4(),
      }
    })
    const flatPoints = unfold.flat.flat().map(([x, y, z]) => new Vector3(x, y, z))
    const flat = flatPoints.reduce((sum, point) => sum.add(point), new Vector3()).multiplyScalar(1 / flatPoints.length)
    this.netCenter = { cube: new Vector3(), flat }
    this.netRadius = { cube: poly.radius * 0.85, flat: Math.max(...flatPoints.map((point) => Math.hypot(point.x - flat.x, point.z - flat.z))) + 0.2 }
    this.setOpen(options.open)
    this.cam.dist = this.goal.dist
    this.autoSpin = false
    this.goal.yaw = Math.round(this.goal.yaw / (Math.PI * 2)) * Math.PI * 2
    this.goal.pitch = this.pitchFor(options.open)
  }

  /** 父面先摆好，子面在父面的基础上绕自己的折痕转 angle × open。 */
  private layoutPolyNet() {
    const placed = new Map<number, Matrix4>()
    const move = new Matrix4()
    const turn = new Matrix4()
    const back = new Matrix4()
    for (const face of this.polyFaces) {
      const parent = placed.get(face.parent)
      if (!parent) face.matrix.identity()
      else {
        move.makeTranslation(face.origin.x, face.origin.y, face.origin.z)
        turn.makeRotationAxis(face.axis, face.angle * this.open)
        back.makeTranslation(-face.origin.x, -face.origin.y, -face.origin.z)
        face.matrix.copy(parent).multiply(move).multiply(turn).multiply(back)
      }
      placed.set(face.index, face.matrix)
      for (const mesh of face.meshes) {
        mesh.matrix.copy(face.matrix)
        mesh.matrixWorldNeedsUpdate = true
      }
    }
  }

  highlightFaces(indices: number[], tone: 'pick' | 'bad' = 'pick') {
    this.highlight = indices.length ? { indices, tone } : null
    for (const item of this.polyFaces) {
      const on = this.highlight?.indices.includes(item.index)
      item.material.emissive.set(on ? '#ff8a3d' : '#000000')
      item.material.emissiveIntensity = on ? 0.35 : 0
    }
    for (const item of this.netFaces) {
      const on = this.highlight?.indices.includes(item.index)
      const color = tone === 'bad' ? '#ff2d1a' : '#ff8a3d'
      for (const material of [item.outer, item.inner]) {
        material.emissive.set(on ? color : '#000000')
        material.emissiveIntensity = on ? (tone === 'bad' ? 0.55 : 0.35) : 0
      }
      if (!on) item.meshes.forEach((mesh) => mesh.scale.setScalar(1))
    }
  }

  private pickNet(point: TouchPoint) {
    this.setRay(point)
    const meshes = [...this.netFaces.flatMap((item) => item.meshes.slice(0, 2)), ...this.polyFaces.map((item) => item.meshes[0])]
    const hit = this.raycaster.intersectObjects(meshes, false)[0]
    this.opts.onFace?.(hit ? (hit.object.userData.index as number) : -1)
  }

  // ---- 小正方体 ----

  showBlocks(options: BlockOptions) {
    this.clearContent()
    this.mode = 'blocks'
    this.blockOpts = options
    this.blockSet = new Set(options.cubes.map((cell) => cell.join(',')))
    const [, height] = options.size
    options.cubes.forEach((cell) => {
      const [x, y, z] = cell
      const mesh = new Mesh(this.box, this.ghost)
      mesh.scale.setScalar(0.98)
      mesh.userData.block = this.blocks.length
      const edges = new LineSegments(this.boxEdges, this.edgeLine)
      edges.scale.setScalar(0.985)
      this.content.add(mesh, edges)
      this.blocks.push({ mesh, edges, cell, outer: outerFaces(options.size, x, y, z), delay: y * 0.7 + (x + z * options.size[0]) * 0.035, pop: 0 })
    })
    this.applyFilter()
    this.blockLabels = []
    const [l, h, w] = options.size
    if (options.dims) {
      const spots: Array<[string, string, (s: number) => Vector3]> = [
        [options.dims.length, PAIR_DEEP[0], (s) => new Vector3(0, (-h / 2) * s - 0.35, (w / 2) * s + 0.2)],
        [options.dims.width, PAIR_DEEP[2], (s) => new Vector3((l / 2) * s + 0.45, (-h / 2) * s - 0.25, 0)],
        [options.dims.height, PAIR_DEEP[1], (s) => new Vector3((l / 2) * s + 0.45, 0, (w / 2) * s + 0.15)],
      ]
      for (const [text, color, at] of spots) this.addBlockLabel(text, color, at)
    }
    if (options.front) {
      const ground = new Mesh(this.plane, new MeshLambertMaterial({ color: this.opts.dark ? '#2a3142' : '#e6eaf2' }))
      ground.rotation.x = -Math.PI / 2
      ground.scale.set(l + 0.8, w + 1.6, 1)
      ground.position.set(0, -height / 2 - 0.01, 0.4)
      this.content.add(ground)
      this.addBlockLabel(options.front, '#ff7a45', (s) => new Vector3(0, (-height / 2) * s, (w / 2) * s + 0.75))
    }
    this.gap = options.gap ?? 0
    this.gapGoal = this.gap
    this.buildT = options.build ? 0 : -1
    this.lastLayer = -1
    this.layoutBlocks()
    this.frame(Math.hypot(l, h, w) / 2 + 0.4, options.front ? 1.2 : 1.15)
    this.cam.dist = this.goal.dist
    this.autoSpin = !this.touched && !options.front
    if (options.front) this.resetView(-0.62, 0.62)
    else this.resetView()
  }

  private onBoundary(size: [number, number, number], [x, y, z]: [number, number, number], side: number) {
    const [l, h, w] = size
    return [x === l - 1, x === 0, y === h - 1, y === 0, z === w - 1, z === 0][side]
  }

  private blockMaterial(color: string) {
    let material = this.blockMaterials.get(color)
    if (!material) {
      material = new MeshLambertMaterial({ color })
      this.blockMaterials.set(color, material)
    }
    return material
  }

  private addBlockLabel(text: string, color: string, at: (spacing: number) => Vector3) {
    const label = createLabel(text, '#ffffff', color)
    if (!label) return
    fitLabel(label, this.height, FOV)
    this.content.add(label.sprite)
    this.labels.push(label)
    this.blockLabels.push({ label, at })
  }

  setGap(gap: number) {
    this.gapGoal = clamp(gap, 0, 1)
  }

  /** 只亮出外露面数为 filter 的方块，null 全部显示。 */
  setFilter(filter: number | null) {
    if (!this.blockOpts) return
    this.blockOpts.filter = filter
    this.blocks.forEach((block) => (block.pop = 0))
    this.applyFilter()
  }

  /** 重新一层一层搭一遍。 */
  build() {
    if (this.mode !== 'blocks') return
    this.buildT = 0
    this.lastLayer = -1
  }

  private applyFilter() {
    const filter = this.blockOpts?.filter
    for (const block of this.blocks) {
      const dim = filter !== null && filter !== undefined && block.outer !== filter
      block.edges.material = dim ? this.ghostLine : this.edgeLine
      if (dim) block.mesh.material = this.ghost
      else if (block.mesh.material === this.ghost) block.mesh.material = this.blockFaces(block)
    }
  }

  /** 六个面各用什么颜色：顺序 +x -x +y -y +z -z，和 BoxGeometry 的分组一致。 */
  private blockFaces(block: Block) {
    const options = this.blockOpts!
    const set = this.blockSet
    const [x, y, z] = block.cell
    const exposed = [`${x + 1},${y},${z}`, `${x - 1},${y},${z}`, `${x},${y + 1},${z}`, `${x},${y - 1},${z}`, `${x},${y},${z + 1}`, `${x},${y},${z - 1}`].map((id) => !set.has(id))
    const base = BLOCK_COLORS[options.color ?? 'cream']
    return exposed.map((open, side) => {
      if (options.paint === 'red') return this.blockMaterial(open && this.onBoundary(options.size, block.cell, side) ? RED : INNER)
      if (options.paint === 'pairs') return this.blockMaterial(open && this.onBoundary(options.size, block.cell, side) ? PAIR_COLORS[side >> 1] : base)
      return this.blockMaterial(base)
    })
  }

  private layoutBlocks() {
    const options = this.blockOpts
    if (!options) return
    const [l, h, w] = options.size
    const spacing = 1 + this.gap * 0.7
    for (const block of this.blocks) {
      const [x, y, z] = block.cell
      this.tmp.set((x - (l - 1) / 2) * spacing, (y - (h - 1) / 2) * spacing, (z - (w - 1) / 2) * spacing)
      if (block.pop > 0.001) {
        const out = this.tmp.clone()
        if (out.lengthSq() < 0.01) out.set(0, 1, 0)
        this.tmp.add(out.normalize().multiplyScalar(block.pop * 1.1))
      }
      block.mesh.position.copy(this.tmp)
      block.edges.position.copy(this.tmp)
    }
    for (const { label, at } of this.blockLabels) label.sprite.position.copy(at(spacing))
  }

  private pickBlock(point: TouchPoint) {
    if (this.blockOpts?.paint !== 'red') return
    this.setRay(point)
    const meshes = this.blocks.filter((block) => block.mesh.material !== this.ghost).map((block) => block.mesh)
    const hit = this.raycaster.intersectObjects(meshes, false)[0]
    if (!hit) return
    const block = this.blocks[hit.object.userData.block as number]
    const lifted = block.pop > 0.5
    this.blocks.forEach((one) => (one.pop = 0))
    block.pop = lifted ? 0 : 1
    this.layoutBlocks()
    if (!lifted) this.opts.onBlock?.(block.outer)
  }

  // ---- 手势 ----

  touchStart(points: TouchPoint[]) {
    this.touches = points
    if (!this.touched) {
      this.touched = true
      this.opts.onTouch?.()
    }
    this.autoSpin = false
    if (points.length === 1) {
      this.tapStart = Date.now()
      this.tapPoint = points[0]
      this.tapMoved = false
    } else if (points.length >= 2) {
      this.tapMoved = true
      this.pinchSpan = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
    }
  }

  touchMove(points: TouchPoint[]) {
    const prev = this.touches
    this.touches = points
    if (points.length >= 2 && prev.length >= 2) {
      const span = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
      if (this.pinchSpan > 0 && span > 0) this.goal.dist = clamp(this.goal.dist * (this.pinchSpan / span), this.minDist, this.maxDist)
      this.pinchSpan = span
      return
    }
    if (points.length !== 1 || prev.length !== 1) return
    const dx = points[0].x - prev[0].x
    const dy = points[0].y - prev[0].y
    if (Math.hypot(points[0].x - this.tapPoint.x, points[0].y - this.tapPoint.y) > 8) this.tapMoved = true
    this.goal.yaw -= dx * 0.01
    this.goal.pitch = clamp(this.goal.pitch + dy * 0.008, -1.25, 1.52)
  }

  touchEnd(points: TouchPoint[]) {
    const last = this.touches
    this.touches = points
    if (points.length > 0) {
      if (points.length === 1) this.pinchSpan = 0
      return
    }
    if (this.tapMoved || Date.now() - this.tapStart > 350 || last.length !== 1) return
    if (this.mode === 'solid') this.pickSolid(last[0])
    else if (this.mode === 'net') this.pickNet(last[0])
    else this.pickBlock(last[0])
  }

  // ---- 内部 ----

  private setRay(point: TouchPoint) {
    this.ndc.set((point.x / this.width) * 2 - 1, -(point.y / this.height) * 2 + 1)
    this.raycaster.setFromCamera(this.ndc, this.camera)
  }

  /** 让半径为 radius 的内容刚好放进画面，竖屏时按较窄的水平视角算。 */
  private frame(radius: number, margin: number) {
    const v = (FOV * Math.PI) / 360
    const h = Math.atan(Math.tan(v) * (this.width / this.height))
    const dist = (radius / Math.sin(Math.min(v, h))) * margin
    this.goal.dist = dist
    this.minDist = dist * 0.45
    this.maxDist = dist * 2.4
  }

  private clearContent() {
    for (const label of [...this.labels, ...this.markLabels]) disposeLabel(label)
    this.labels = []
    this.markLabels = []
    this.blockLabels = []
    const shared = new Set<unknown>([this.plane, this.planeEdges, this.box, this.boxEdges, this.ghost, this.edgeLine, this.ghostLine, ...this.blockMaterials.values()])
    const geometries = new Set<{ dispose: () => void }>()
    this.content.traverse((object: Object3D) => {
      const mesh = object as Mesh
      if (mesh.geometry && !shared.has(mesh.geometry)) geometries.add(mesh.geometry)
      const material = (mesh as { material?: Material | Material[] }).material
      const list = Array.isArray(material) ? material : material ? [material] : []
      for (const one of list) if (!shared.has(one)) one.dispose()
    })
    geometries.forEach((geometry) => geometry.dispose())
    for (const item of this.netFaces) item.texture?.dispose()
    this.holder.remove(this.content)
    this.content = new Group()
    this.holder.add(this.content)
    this.solidItems = []
    this.faceMeshes = []
    this.netFaces = []
    this.polyFaces = []
    this.solidPoly = null
    this.blocks = []
    this.blockOpts = null
    this.solidOpts = null
    this.highlight = null
  }

  private step(dt: number) {
    this.clock += dt
    if (this.autoSpin) this.goal.yaw += dt * 0.32
    // 展开 / 折起动画
    if (this.openTween) {
      const tween = this.openTween
      tween.t = Math.min(1, tween.t + dt / tween.seconds)
      this.setOpen(tween.from + (tween.to - tween.from) * ease(tween.t))
      if (!this.touched || this.touches.length === 0) this.goal.pitch = this.pitchFor(this.open)
      const now = Date.now()
      if (tween.t >= 1 || now - this.lastOpenReport > 90) {
        this.lastOpenReport = now
        this.opts.onOpen?.(this.open)
      }
      if (tween.t >= 1) this.openTween = null
    }
    // 选中的面轻轻呼吸
    if (this.highlight) {
      const scale = 1 + 0.035 * (1 + Math.sin(this.clock * 7))
      for (const item of this.netFaces) {
        if (this.highlight.indices.includes(item.index)) item.meshes.forEach((mesh) => mesh.scale.setScalar(scale))
      }
      for (const item of this.polyFaces) {
        if (this.highlight.indices.includes(item.index)) item.material.emissiveIntensity = 0.2 + 0.25 * (1 + Math.sin(this.clock * 7)) / 2
      }
    }
    // 小方块：拆开、一层层搭
    if (this.mode === 'blocks') {
      if (Math.abs(this.gapGoal - this.gap) > 0.001) {
        this.gap += (this.gapGoal - this.gap) * (1 - Math.exp(-dt * 7))
        this.layoutBlocks()
      }
      if (this.buildT >= 0) {
        this.buildT += dt
        let done = true
        for (const block of this.blocks) {
          const t = clamp((this.buildT - block.delay) / 0.35, 0, 1)
          if (t < 1) done = false
          const s = t <= 0 ? 0.0001 : 0.98 * (1 + 0.25 * Math.sin(t * Math.PI) * (1 - t))
          block.mesh.scale.setScalar(s)
          block.edges.scale.setScalar(s * 1.005)
          block.mesh.visible = t > 0
          block.edges.visible = t > 0
        }
        const layer = Math.floor(this.buildT / 0.7)
        const layers = this.blockOpts?.size[1] ?? 0
        if (layer !== this.lastLayer && layer < layers) {
          this.lastLayer = layer
          this.opts.onLayer?.(layer)
        }
        if (done) {
          this.buildT = -1
          this.opts.onLayer?.(layers)
        }
      }
    }
    // 相机
    const k = 1 - Math.exp(-dt * 7)
    this.cam.yaw += (this.goal.yaw - this.cam.yaw) * k
    this.cam.pitch += (this.goal.pitch - this.cam.pitch) * k
    this.cam.dist += (this.goal.dist - this.cam.dist) * k
    const { yaw, pitch, dist } = this.cam
    this.camera.position.set(dist * Math.cos(pitch) * Math.sin(yaw), dist * Math.sin(pitch), dist * Math.cos(pitch) * Math.cos(yaw))
    this.camera.lookAt(0, 0, 0)
    // 答对弹一下、答错晃一晃
    let scale = 1
    if (this.celebrateT >= 0) {
      this.celebrateT += dt / 0.7
      scale = 1 + 0.14 * Math.sin(Math.min(1, this.celebrateT) * Math.PI) * (1 - Math.min(1, this.celebrateT) * 0.4)
      if (this.celebrateT >= 1) this.celebrateT = -1
    }
    this.holder.scale.setScalar(scale)
    this.holder.position.set(0, 0, 0)
    if (this.shakeT >= 0) {
      this.shakeT += dt / 0.5
      const offset = Math.sin(this.shakeT * Math.PI * 6) * 0.12 * (1 - this.shakeT)
      this.tmp.set(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(offset)
      this.holder.position.copy(this.tmp)
      if (this.shakeT >= 1) this.shakeT = -1
    }
  }
}
