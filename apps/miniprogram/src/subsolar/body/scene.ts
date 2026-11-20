/**
 * 「3D 人体器官」的 3D 场景。只认 model.ts 的 BodyModel，人体由 procedural.ts 生成，以后可以换成模型文件。
 * - 探索：一层层剖开（皮肤 → 肌肉 → 骨骼 → 器官）、按系统筛选、点器官、展开、切开看里面。
 * - 演示：心脏泵血（血液沿几条环路流动）、肺呼吸（按住吸气）、食物旅行（六站）。
 * 页面只负责 UI，触摸坐标原样传进来，点中的部位、呼吸次数、食物到了哪一站通过回调告诉页面。
 */
import {
  AmbientLight,
  Box3,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  ColorManagement,
  DataTexture,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LinearFilter,
  LinearSRGBColorSpace,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  Plane,
  Points,
  PointsMaterial,
  Raycaster,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
} from 'three'
import type { CanvasNode, TouchPoint } from '../scene'
import { createLabel, disposeLabel, fitLabel, type Label } from '../labels'
import {
  DEFAULT_ROUTES,
  FOOD_SECONDS,
  FOOD_STAGES,
  LAYERS,
  PARTS,
  type BodyRoutes,
  type DemoId,
  type Layer,
  type PartId,
  type PartMeta,
  type System,
  type Vec3,
} from './anatomy'
import type { BodyModel, BodyPart } from './model'
import { buildProceduralBody } from './procedural'

export type { CanvasNode, TouchPoint }
export type View = 'front' | 'back' | 'side'

export type SceneOptions = {
  canvas: CanvasNode
  width: number
  height: number
  pixelRatio: number
  background: string
  dark: boolean
  /** 默认用代码生成的人体；以后换模型文件时把读好的 BodyModel 传进来 */
  model?: BodyModel
  onPick?: (id: PartId | null) => void
  onTouch?: () => void
  onBeat?: () => void
  onBreath?: (value: number, count: number) => void
  onFoodStage?: (stage: number) => void
  onFoodDone?: () => void
}

const FOV = 40
const MAX_PARTICLES = 320
const RED = new Color('#ff3b4f')
const BLUE = new Color('#5b7cfa')
const OXYGEN = new Color('#3fb6ff')
const CARBON = new Color('#a2a9b8')
const NUTRIENT = new Color('#4fd27f')
const WATER = new Color('#3fa9ff')
const CHYME = new Color('#f2cf5b')
const WASTE = new Color('#9a6a3a')

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
const v3 = (p: Vec3) => new Vector3(p[0], p[1], p[2])

/** 玻璃人外壳：越靠边缘越不透明，像一层发光的轮廓。 */
function glassMaterial(color: string) {
  return new ShaderMaterial({
    uniforms: { color: { value: new Color(color) }, opacity: { value: 0 } },
    vertexShader: `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 color;
      uniform float opacity;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float rim = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        gl_FragColor = vec4(color, opacity * (0.08 + 0.72 * pow(rim, 2.4)));
      }`,
    transparent: true,
    depthWrite: false,
  })
}

/** 粒子用的圆点纹理，代码画，不带图片。 */
function dotTexture() {
  const size = 32
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const d = Math.hypot(x - size / 2 + 0.5, y - size / 2 + 0.5) / (size / 2)
      const alpha = clamp((1 - d) * 3, 0, 1)
      const at = (y * size + x) * 4
      data[at] = 255
      data[at + 1] = 255
      data[at + 2] = 255
      data[at + 3] = Math.round(alpha * 255)
    }
  }
  const texture = new DataTexture(data, size, size, RGBAFormat)
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  texture.needsUpdate = true
  return texture
}

function patchCanvas(canvas: CanvasNode) {
  if (!canvas.style) canvas.style = { width: '', height: '' }
  if (!canvas.addEventListener) canvas.addEventListener = () => {}
  if (!canvas.removeEventListener) canvas.removeEventListener = () => {}
}

type Shaded = MeshLambertMaterial & { emissive: Color; emissiveIntensity: number }

type PieceState = {
  object: Object3D
  center: Vector3
  radius: number
  offset: Vector3
  label: Label | null
}

type PartState = {
  id: PartId
  meta: PartMeta
  part: BodyPart
  pieces: PieceState[]
  meshes: Mesh[]
  materials: Shaded[]
  innerMaterials: Set<Material>
  opacity: number
  goal: number
}

/** 折线上按长度取点，per-particle 的呼吸路线用。 */
type Polyline = { points: Vector3[]; lengths: number[]; total: number }

function polyline(points: Vector3[]): Polyline {
  const lengths = [0]
  for (let i = 1; i < points.length; i += 1) lengths.push(lengths[i - 1] + points[i].distanceTo(points[i - 1]))
  return { points, lengths, total: lengths[lengths.length - 1] }
}

function sampleLine(line: Polyline, u: number, out: Vector3) {
  const d = clamp(u, 0, 1) * line.total
  let i = 1
  while (i < line.lengths.length - 1 && line.lengths[i] < d) i += 1
  const span = line.lengths[i] - line.lengths[i - 1] || 1
  return out.copy(line.points[i - 1]).lerp(line.points[i], (d - line.lengths[i - 1]) / span)
}

type Blood = { loop: number; u: number; speed: number }
type Air = { line: Polyline; offset: number }
type Spark = { origin: Vector3; velocity: Vector3; born: number; color: Color }

export class BodyScene {
  private readonly opts: SceneOptions
  private readonly canvas: CanvasNode
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera: PerspectiveCamera
  private readonly holder = new Group()
  private readonly fx = new Group()
  private width: number
  private height: number
  private running = false
  private frameId = 0
  private lastTime = 0
  private clock = 0

  private model: BodyModel
  private routes: BodyRoutes
  private parts = new Map<PartId, PartState>()
  private glass: Array<{ mesh: Mesh; material: ShaderMaterial }> = []
  private glassOpacity = 0
  private derived: Object3D[] = []
  private pickable: Mesh[] = []
  private names: Partial<Record<PartId, string>> = {}

  private readonly cam = { yaw: 0, pitch: 0.08, dist: 4 }
  private readonly goal = { yaw: 0, pitch: 0.08, dist: 4 }
  private readonly target = new Vector3()
  private readonly targetGoal = new Vector3()
  private touched = false
  private sway = true

  private layer: Layer = 'organ'
  private system: System | null = null
  private selected: PartId | null = null
  private explode = 0
  private explodeGoal = 0
  private cut: PartId | null = null
  private readonly cutPlane = new Plane()

  private demo: DemoId | null = null
  private points: Points | null = null
  private pointPositions: Float32Array | null = null
  private pointColors: Float32Array | null = null
  private bolus: Mesh | null = null
  // 心跳
  private bpm = 80
  private bpmGoal = 80
  private beatPhase = 0
  private bloodCurves: Array<{ curve: CatmullRomCurve3; length: number }> = []
  private blood: Blood[] = []
  // 呼吸
  private breath = 0
  private holding = false
  private breathAuto = true
  private breathArmed = false
  private breathCount = 0
  private breathColor = OXYGEN
  private lastBreathReport = 0
  private air: Air[] = []
  // 食物
  private foodStage = 0
  private foodT = 0
  private foodPlaying = false
  private foodColor = new Color('#ff6b5a')
  private foodCurves: Record<'swallow' | 'stomach' | 'small' | 'large' | 'out', CatmullRomCurve3> | null = null
  private sparks: Spark[] = []
  private sparkClock = 0

  private touches: TouchPoint[] = []
  private tapStart = 0
  private tapPoint: TouchPoint = { x: 0, y: 0 }
  private tapMoved = false
  private pinchSpan = 0
  private readonly raycaster = new Raycaster()
  private readonly ndc = new Vector2()
  private readonly tmp = new Vector3()
  private readonly tmp2 = new Vector3()

  constructor(opts: SceneOptions) {
    this.opts = opts
    this.canvas = opts.canvas
    this.width = opts.width
    this.height = opts.height
    patchCanvas(this.canvas)
    const gl = this.canvas.getContext('webgl', { antialias: true, alpha: false, depth: true, stencil: false })
    if (!gl) throw new Error('no-webgl')
    ColorManagement.enabled = false
    this.renderer = new WebGLRenderer({ canvas: this.canvas as unknown as HTMLCanvasElement, context: gl, antialias: true })
    this.renderer.outputColorSpace = LinearSRGBColorSpace
    this.renderer.localClippingEnabled = true
    this.renderer.setPixelRatio(opts.pixelRatio)
    this.renderer.setSize(opts.width, opts.height, false)
    this.renderer.setClearColor(new Color(opts.background), 1)

    this.camera = new PerspectiveCamera(FOV, opts.width / opts.height, 0.02, 40)
    // three.js r155 起光照按物理单位算，强度乘 π 才是想要的亮度
    const key = new DirectionalLight(0xffffff, 0.55 * Math.PI)
    key.position.set(1.5, 2.5, 3)
    this.camera.add(key)
    this.scene.add(this.camera, new AmbientLight(0xffffff, 0.62 * Math.PI))
    this.scene.add(this.holder, this.fx)

    this.model = opts.model ?? buildProceduralBody()
    this.routes = this.model.routes ?? DEFAULT_ROUTES
    this.target.copy(v3(this.routes.center))
    this.targetGoal.copy(this.target)
    this.mountModel()
    this.goal.dist = this.frameBody()
    this.cam.dist = this.goal.dist
    this.refreshGoals(true)
  }

  // ---- 模型接入 ----

  private mountModel() {
    const skin = this.model.parts.skin
    if (skin) this.buildGlass(skin)
    const parts = { ...this.model.parts }
    if (!parts.muscle && skin) parts.muscle = this.deriveMuscle(skin)
    for (const [id, part] of Object.entries(parts) as Array<[PartId, BodyPart | undefined]>) {
      if (!part) continue
      const meta = PARTS[id]
      const materials = new Set<Shaded>()
      const meshes: Mesh[] = []
      const innerMaterials = new Set<Material>()
      for (const inner of part.inner ?? []) {
        inner.traverse((object) => {
          const material = (object as Mesh).material
          if (material) for (const one of Array.isArray(material) ? material : [material]) innerMaterials.add(one)
        })
      }
      const pieces: PieceState[] = part.pieces.map((one) => {
        this.holder.add(one.object)
        one.object.traverse((object) => {
          const mesh = object as Mesh
          if (!mesh.isMesh || mesh.userData.glass) return
          mesh.userData.part = id
          if (mesh.userData.keep) return
          meshes.push(mesh)
          for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
            const shaded = material as Shaded
            if (shaded.emissive) shaded.emissive.set('#ffffff')
            shaded.emissiveIntensity = 0
            materials.add(shaded)
          }
        })
        const box = new Box3().setFromObject(one.object)
        const radius = box.isEmpty() ? 0.05 : box.getSize(new Vector3()).length() / 2
        const offset = meta.explode ? v3(meta.explode) : new Vector3()
        if (Math.abs(one.center.x) > 0.02) offset.x = Math.abs(offset.x) * Math.sign(one.center.x)
        return { object: one.object, center: one.center.clone(), radius, offset, label: null }
      })
      this.parts.set(id, { id, meta, part, pieces, meshes, materials: [...materials], innerMaterials, opacity: 1, goal: 1 })
    }
  }

  private buildGlass(skin: BodyPart) {
    for (const one of skin.pieces) {
      const sources: Mesh[] = []
      one.object.traverse((object) => {
        const mesh = object as Mesh
        if (mesh.isMesh && !mesh.userData.keep) sources.push(mesh)
      })
      for (const source of sources) {
        const material = glassMaterial('#5fb4ff')
        const mesh = new Mesh(source.geometry, material)
        mesh.position.copy(source.position)
        mesh.quaternion.copy(source.quaternion)
        mesh.scale.copy(source.scale)
        mesh.renderOrder = 6
        mesh.userData.glass = true
        source.parent?.add(mesh)
        this.glass.push({ mesh, material })
      }
    }
  }

  /** 模型没有肌肉层时，用皮肤往里缩一点做出来，并画上竖条纹理。 */
  private deriveMuscle(skin: BodyPart): BodyPart {
    const material = new MeshLambertMaterial({ color: '#ffffff', vertexColors: true })
    const base = new Color(PARTS.muscle.color)
    const pieces = skin.pieces.map((one) => {
      const group = new Group()
      group.position.copy(one.object.position)
      one.object.traverse((object) => {
        const source = object as Mesh
        if (!source.isMesh || source.userData.keep || source.userData.glass) return
        const geometry = source.geometry.clone()
        const pos = geometry.getAttribute('position')
        const nor = geometry.getAttribute('normal')
        const colors: number[] = []
        for (let i = 0; i < pos.count; i += 1) {
          pos.setXYZ(i, pos.getX(i) - nor.getX(i) * 0.006, pos.getY(i) - nor.getY(i) * 0.006, pos.getZ(i) - nor.getZ(i) * 0.006)
          const stripe = 0.86 + 0.14 * Math.sin(Math.atan2(pos.getX(i), pos.getZ(i)) * 14 + pos.getY(i) * 6)
          colors.push(base.r * stripe, base.g * stripe, base.b * stripe)
        }
        geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
        const mesh = new Mesh(geometry, material)
        mesh.position.copy(source.position)
        group.add(mesh)
      })
      this.derived.push(group)
      return { object: group, center: one.center.clone() }
    })
    return { id: 'muscle', pieces }
  }

  // ---- 对外接口 ----

  setBackground(color: string, dark: boolean) {
    this.renderer.setClearColor(new Color(color), 1)
    this.opts.dark = dark
  }

  /** 模型文件里可能缺几个部位，页面按它决定名单里列哪些 */
  hasPart(id: PartId) {
    return this.parts.has(id)
  }

  setNames(names: Partial<Record<PartId, string>>) {
    this.names = names
    for (const state of this.parts.values()) {
      for (const piece of state.pieces) {
        if (!piece.label) continue
        piece.label.sprite.removeFromParent()
        disposeLabel(piece.label)
        piece.label = null
      }
    }
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
    for (const state of this.parts.values()) for (const piece of state.pieces) if (piece.label) fitLabel(piece.label, this.height, FOV)
  }

  dispose() {
    this.stop()
    for (const state of this.parts.values()) {
      for (const piece of state.pieces) if (piece.label) disposeLabel(piece.label)
    }
    this.model.dispose()
    for (const { material } of this.glass) material.dispose()
    for (const group of this.derived) {
      group.traverse((object) => {
        const mesh = object as Mesh
        if (mesh.isMesh) {
          mesh.geometry.dispose()
          ;(mesh.material as Material).dispose()
        }
      })
    }
    this.clearFx()
    this.renderer.dispose()
  }

  setLayer(layer: Layer) {
    this.layer = layer
    if (layer !== 'organ' && layer !== 'bone') this.explodeGoal = 0
    this.refreshGoals()
  }

  setSystem(system: System | null) {
    this.system = system
    this.refreshGoals()
  }

  /** 选中一个部位，镜头飞过去；null 回到全身。 */
  select(id: PartId | null, focus = true) {
    this.selected = id
    if (this.cut && this.cut !== id) this.setCut(null)
    if (focus) {
      if (id) this.focusPart(id)
      else this.resetView()
    }
    this.refreshGoals()
  }

  setExplode(value: number) {
    this.explodeGoal = clamp(value, 0, 1)
    if (this.explodeGoal > 0) this.setCut(null)
    this.refreshGoals()
    if (!this.selected) this.frameAll()
  }

  getExplode() {
    return this.explodeGoal
  }

  /** 切开：从朝着镜头的一面切掉一半，露出里面。 */
  setCut(id: PartId | null) {
    if (this.cut === id) return
    const prev = this.cut ? this.parts.get(this.cut) : null
    if (prev) this.applyClip(prev, false)
    this.cut = id
    const state = id ? this.parts.get(id) : null
    if (state) {
      this.explodeGoal = 0
      this.applyClip(state, true)
      if (this.selected !== state.id) {
        this.selected = state.id
        this.focusPart(state.id)
      }
    }
    this.refreshGoals()
  }

  private applyClip(state: PartState, on: boolean) {
    for (const material of state.materials) {
      if (state.innerMaterials.has(material)) continue
      material.clippingPlanes = on ? [this.cutPlane] : null
      material.side = on ? DoubleSide : material.side
      material.needsUpdate = true
    }
    for (const inner of state.part.inner ?? []) inner.visible = on
  }

  resetView() {
    this.targetGoal.copy(v3(this.routes.center))
    this.goal.dist = this.frameBody()
    this.goal.pitch = 0.08
    this.goal.yaw = Math.round(this.goal.yaw / (Math.PI * 2)) * Math.PI * 2
  }

  viewFrom(view: View) {
    this.sway = false
    const turn = Math.round(this.goal.yaw / (Math.PI * 2)) * Math.PI * 2
    this.goal.yaw = turn + (view === 'front' ? 0 : view === 'back' ? Math.PI : Math.PI / 2)
    this.goal.pitch = 0.06
  }

  // ---- 演示 ----

  setDemo(demo: DemoId | null) {
    if (this.demo === demo) return
    this.demo = demo
    this.selected = null
    this.setCut(null)
    this.explodeGoal = 0
    this.clearFx()
    this.sway = false
    if (demo === 'heart') this.startHeart()
    else if (demo === 'lungs') this.startLungs()
    else if (demo === 'food') this.startFood()
    else this.resetView()
    this.refreshGoals()
  }

  setHeartRate(bpm: number) {
    this.bpmGoal = clamp(bpm, 50, 150)
  }

  getHeartRate() {
    return Math.round(this.bpm)
  }

  setBreathing(holding: boolean) {
    this.holding = holding
    if (holding) this.breathAuto = false
  }

  setFoodColor(color: string) {
    this.foodColor.set(color)
    if (this.bolus) (this.bolus.material as MeshLambertMaterial).color.set(color)
  }

  /** 跳到第几站，从头开始播这一站 */
  playFood(stage: number) {
    this.foodStage = clamp(stage, 0, FOOD_STAGES.length - 1)
    this.foodT = 0
    this.foodPlaying = true
    this.sparks = []
    this.opts.onFoodStage?.(this.foodStage)
  }

  pauseFood(paused: boolean) {
    this.foodPlaying = !paused
  }

  private ensurePoints(size: number) {
    if (this.points) {
      ;(this.points.material as PointsMaterial).size = size
      return
    }
    const geometry = new BufferGeometry()
    this.pointPositions = new Float32Array(MAX_PARTICLES * 3)
    this.pointColors = new Float32Array(MAX_PARTICLES * 3)
    // BufferAttribute 直接用这块数组，每帧改完标记 needsUpdate 就行
    geometry.setAttribute('position', new BufferAttribute(this.pointPositions, 3))
    geometry.setAttribute('color', new BufferAttribute(this.pointColors, 3))
    const material = new PointsMaterial({ size, map: dotTexture(), vertexColors: true, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: true })
    this.points = new Points(geometry, material)
    this.points.frustumCulled = false
    this.points.renderOrder = 20
    this.fx.add(this.points)
  }

  private clearFx() {
    if (this.points) {
      this.points.geometry.dispose()
      const material = this.points.material as PointsMaterial
      material.map?.dispose()
      material.dispose()
      this.points.removeFromParent()
    }
    if (this.bolus) {
      this.bolus.geometry.dispose()
      ;(this.bolus.material as Material).dispose()
      this.bolus.removeFromParent()
    }
    this.points = null
    this.pointPositions = null
    this.pointColors = null
    this.bolus = null
    this.blood = []
    this.air = []
    this.sparks = []
  }

  private writePoint(index: number, position: Vector3 | null, color?: Color) {
    const positions = this.pointPositions
    const colors = this.pointColors
    if (!positions || !colors || index >= MAX_PARTICLES) return
    if (!position) {
      positions[index * 3 + 1] = -50
      return
    }
    positions[index * 3] = position.x
    positions[index * 3 + 1] = position.y
    positions[index * 3 + 2] = position.z
    if (color) {
      colors[index * 3] = color.r
      colors[index * 3 + 1] = color.g
      colors[index * 3 + 2] = color.b
    }
  }

  private flushPoints(count: number) {
    if (!this.points) return
    for (let i = count; i < MAX_PARTICLES; i += 1) this.writePoint(i, null)
    this.points.geometry.getAttribute('position').needsUpdate = true
    this.points.geometry.getAttribute('color').needsUpdate = true
  }

  private startHeart() {
    this.ensurePoints(0.028)
    this.bpm = 80
    this.bpmGoal = 80
    this.beatPhase = 0
    this.bloodCurves = this.routes.blood.map((loop) => {
      const curve = new CatmullRomCurve3(loop.points.map(v3), true, 'centripetal')
      return { curve, length: curve.getLength() }
    })
    const total = 240
    this.blood = []
    this.routes.blood.forEach((loop, index) => {
      const count = Math.round(total * loop.share)
      for (let i = 0; i < count; i += 1) this.blood.push({ loop: index, u: i / count, speed: 0.85 + Math.random() * 0.3 })
    })
    this.targetGoal.copy(v3(this.routes.center)).y += 0.02
    this.goal.dist = this.frameBox(0.3, this.routes.half[1] * 0.94, 1.02) + 0.15
    this.goal.pitch = 0.08
  }

  private startLungs() {
    this.ensurePoints(0.017)
    this.breath = 0
    this.holding = false
    this.breathAuto = true
    this.breathArmed = false
    this.breathCount = 0
    const { airway: airwayPoints, lungs } = this.routes
    const airway = new CatmullRomCurve3(airwayPoints.map(v3), false, 'centripetal').getPoints(16)
    this.air = []
    for (let i = 0; i < 150; i += 1) {
      const lung = lungs[i % lungs.length]
      const bronchus = lung.bronchus.slice(1).map(v3)
      let end: Vector3
      if (lung.samples?.length) end = v3(lung.samples[Math.floor(Math.random() * lung.samples.length)])
      else {
        // 肺里随机一点：先在单位球里取，再拉成肺的形状并往里收一点
        const [rx, ry, rz] = lung.radii
        const p = new Vector3()
        do p.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1)
        while (p.lengthSq() > 1)
        end = new Vector3(p.x * rx * 0.62, p.y * ry * 0.7, p.z * rz * 0.6).add(v3(lung.center))
      }
      this.air.push({ line: polyline([...airway, ...bronchus, end]), offset: Math.random() })
    }
    const lungCenter = new Vector3()
    for (const lung of lungs) lungCenter.add(v3(lung.center))
    lungCenter.multiplyScalar(1 / Math.max(1, lungs.length))
    this.targetGoal.set(0, lungCenter.y + (airwayPoints[0][1] - lungCenter.y) * 0.3, 0)
    this.goal.dist = this.frameDist(0.38, 1.1)
    this.goal.pitch = 0.05
  }

  private startFood() {
    this.ensurePoints(0.015)
    const bolus = new Mesh(new SphereGeometry(0.016, 16, 12), new MeshLambertMaterial({ color: this.foodColor, transparent: true, depthTest: false }))
    bolus.renderOrder = 21
    this.bolus = bolus
    this.fx.add(bolus)
    const curve = (points: Vec3[]) => new CatmullRomCurve3(points.map(v3), false, 'centripetal')
    const { swallow, stomach, small, large, out, mouth } = this.routes
    this.foodCurves = { swallow: curve(swallow), stomach: curve(stomach), small: curve(small), large: curve(large), out: curve(out) }
    this.playFood(0)
    this.targetGoal.copy(v3(mouth))
    this.goal.dist = this.frameDist(0.34, 1.1)
    this.goal.pitch = 0.1
    this.goal.yaw = Math.round(this.goal.yaw / (Math.PI * 2)) * Math.PI * 2 + 0.5
  }

  // ---- 透明度 ----

  /** 按剖开到哪一层、筛选的系统、选中的部位、演示，算出每个部位该有多不透明。 */
  private refreshGoals(snap = false) {
    const level = LAYERS.indexOf(this.layer)
    const exploded = this.explodeGoal > 0.02
    for (const state of this.parts.values()) {
      const { meta } = state
      const index = LAYERS.indexOf(meta.layer)
      let goal = 1
      if (state.id === 'skin') goal = level === 0 ? 1 : 0
      else if (index < level) goal = meta.layer === 'bone' && level === 3 ? 0.12 : 0
      if (exploded && (meta.layer === 'bone' || meta.layer === 'muscle')) goal = 0
      if (this.system && state.id !== 'skin') {
        const inSystem = meta.system === this.system
        if (!inSystem) goal = Math.min(goal, meta.layer === 'organ' ? 0.1 : 0.05)
      }
      if (this.demo && state.id !== 'skin') {
        if (meta.layer === 'organ') goal = meta.demo === this.demo ? 1 : 0.1
        else if (meta.layer === 'bone') goal = this.demo === 'lungs' && state.id === 'ribcage' ? 0.32 : 0.06
        else goal = 0
      }
      if (meta.faint && !this.demo && this.selected !== state.id && this.system !== meta.system) goal = Math.min(goal, 0.3)
      if (this.selected && !this.demo && this.selected !== state.id && meta.layer === 'organ' && PARTS[this.selected].layer === 'organ') {
        goal = Math.min(goal, this.cut ? 0.08 : 0.2)
      }
      state.goal = goal
      if (snap) state.opacity = goal
    }
  }

  private applyOpacity(state: PartState, hidden: boolean) {
    const o = state.opacity
    const visible = o > 0.01 && !hidden
    for (const material of state.materials) {
      material.opacity = o
      const transparent = o < 0.995
      // 不透明的材质编译时会把 alpha 固定成 1，切换透明要重新编译
      if (material.transparent !== transparent) {
        material.transparent = transparent
        material.needsUpdate = true
      }
      material.depthWrite = o > 0.6
    }
    for (const mesh of state.meshes) {
      if (mesh.userData.inner === undefined) mesh.userData.inner = state.part.inner?.includes(mesh) ?? false
      if (mesh.userData.inner) mesh.visible = visible && this.cut === state.id
      else mesh.visible = visible
    }
  }

  // ---- 镜头 ----

  /** 让半宽 halfW、半高 halfH 的一块刚好放进画面。 */
  private frameBox(halfW: number, halfH: number, margin: number) {
    const v = Math.tan((FOV * Math.PI) / 360)
    const h = v * (this.width / this.height)
    return Math.max(halfH / v, halfW / h) * margin
  }

  private frameDist(radius: number, margin: number) {
    return this.frameBox(radius, radius, margin) + radius
  }

  private partCenter(state: PartState, out: Vector3) {
    out.set(0, 0, 0)
    for (const piece of state.pieces) out.add(piece.object.position)
    return out.multiplyScalar(1 / Math.max(1, state.pieces.length))
  }

  private focusPart(id: PartId) {
    const state = this.parts.get(id)
    if (!state) return
    this.sway = false
    const center = new Vector3()
    for (const piece of state.pieces) center.add(piece.center.clone().addScaledVector(piece.offset, this.explodeGoal))
    center.multiplyScalar(1 / state.pieces.length)
    let radius = 0.09
    for (const piece of state.pieces) {
      const at = piece.center.clone().addScaledVector(piece.offset, this.explodeGoal)
      radius = Math.max(radius, at.distanceTo(center) + piece.radius * 0.8)
    }
    if (state.meta.layer !== 'organ') radius = Math.max(radius, 0.4)
    this.targetGoal.copy(center)
    this.goal.dist = this.frameDist(Math.min(radius, this.routes.radius), 1.35)
  }

  private frameBody() {
    const [halfW, halfH] = this.routes.half
    return this.frameBox(halfW, halfH, 1.06) + 0.2
  }

  /** 展开后器官散在躯干周围，镜头对准躯干一带 */
  private frameAll() {
    if (this.explodeGoal > 0) {
      this.targetGoal.set(0, this.routes.heart[1] - 0.1, 0)
      this.goal.dist = this.frameBox(0.5, 0.92, 1.04) + 0.2
    } else {
      this.targetGoal.copy(v3(this.routes.center))
      this.goal.dist = this.frameBody()
    }
  }

  // ---- 手势 ----

  touchStart(points: TouchPoint[]) {
    this.touches = points
    if (!this.touched) {
      this.touched = true
      this.opts.onTouch?.()
    }
    this.sway = false
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
      if (this.pinchSpan > 0 && span > 0) this.goal.dist = clamp(this.goal.dist * (this.pinchSpan / span), 0.22, 7)
      this.pinchSpan = span
      return
    }
    if (points.length !== 1 || prev.length !== 1) return
    const dx = points[0].x - prev[0].x
    const dy = points[0].y - prev[0].y
    if (Math.hypot(points[0].x - this.tapPoint.x, points[0].y - this.tapPoint.y) > 8) this.tapMoved = true
    this.goal.yaw -= dx * 0.01
    this.goal.pitch = clamp(this.goal.pitch + dy * 0.008, -1.2, 1.3)
  }

  touchEnd(points: TouchPoint[]) {
    const last = this.touches
    this.touches = points
    if (points.length > 0) {
      if (points.length === 1) this.pinchSpan = 0
      return
    }
    if (this.tapMoved || Date.now() - this.tapStart > 350 || last.length !== 1) return
    this.pick(last[0])
  }

  private pick(point: TouchPoint) {
    this.ndc.set((point.x / this.width) * 2 - 1, -(point.y / this.height) * 2 + 1)
    this.raycaster.setFromCamera(this.ndc, this.camera)
    this.pickable.length = 0
    for (const state of this.parts.values()) {
      if (state.goal < 0.5) continue
      for (const mesh of state.meshes) if (mesh.visible) this.pickable.push(mesh)
    }
    const hits = this.raycaster.intersectObjects(this.pickable, false)
    // 切开的部位，切掉的那一半不能点
    const hit = hits.find((one) => !this.cut || one.object.userData.part !== this.cut || this.cutPlane.distanceToPoint(one.point) >= 0)
    const id = (hit?.object.userData.part as PartId | undefined) ?? null
    if (this.demo) {
      this.opts.onPick?.(id)
      return
    }
    if (id === this.selected) return
    this.select(id, true)
    this.opts.onPick?.(id)
  }

  // ---- 每一帧 ----

  private step(dt: number) {
    this.clock += dt
    if (this.sway) this.goal.yaw = Math.sin(this.clock * 0.45) * 0.55

    // 展开
    this.explode += (this.explodeGoal - this.explode) * (1 - Math.exp(-dt * 5))
    for (const state of this.parts.values()) {
      for (const piece of state.pieces) {
        piece.object.position.copy(piece.center).addScaledVector(piece.offset, ease(clamp(this.explode, 0, 1)))
        piece.object.scale.set(1, 1, 1)
      }
    }

    // 透明度慢慢变过去
    const k = 1 - Math.exp(-dt * 6)
    this.glassOpacity += ((this.layer === 'skin' ? 0 : this.selected || this.demo ? 0.55 : 1) - this.glassOpacity) * k
    for (const { mesh, material } of this.glass) {
      material.uniforms.opacity.value = this.glassOpacity
      mesh.visible = this.glassOpacity > 0.01
    }
    const skin = this.parts.get('skin')
    const muscle = this.parts.get('muscle')
    for (const state of this.parts.values()) {
      state.opacity += (state.goal - state.opacity) * k
      if (Math.abs(state.goal - state.opacity) < 0.003) state.opacity = state.goal
    }
    // 外层完全不透明时，里面的部位不用画
    const skinClosed = !!skin && skin.opacity > 0.98
    // 自动生成的肌肉是整张皮，模型文件里的肌肉之间有缝，要能透过缝看到里面
    const muscleClosed = !!muscle && muscle.opacity > 0.98 && this.layer === 'muscle' && this.derived.length > 0
    for (const state of this.parts.values()) {
      const index = LAYERS.indexOf(state.meta.layer)
      const hidden = (skinClosed && index > 0) || (muscleClosed && index > 1)
      this.applyOpacity(state, hidden)
    }

    // 选中的部位轻轻发光
    for (const state of this.parts.values()) {
      const glow = state.id === this.selected && !this.cut ? 0.1 + 0.1 * (1 + Math.sin(this.clock * 5)) : 0
      for (const material of state.materials) material.emissiveIntensity = glow
    }

    if (this.demo === 'heart') this.stepHeart(dt)
    else if (this.demo === 'lungs') this.stepLungs(dt)
    else if (this.demo === 'food') this.stepFood(dt)

    // 镜头
    const c = 1 - Math.exp(-dt * 6)
    this.cam.yaw += (this.goal.yaw - this.cam.yaw) * c
    this.cam.pitch += (this.goal.pitch - this.cam.pitch) * c
    this.cam.dist += (this.goal.dist - this.cam.dist) * c
    this.target.lerp(this.targetGoal, c)
    const { yaw, pitch, dist } = this.cam
    this.camera.position.set(dist * Math.cos(pitch) * Math.sin(yaw), dist * Math.sin(pitch), dist * Math.cos(pitch) * Math.cos(yaw)).add(this.target)
    this.camera.lookAt(this.target)
    this.camera.updateMatrixWorld()

    // 切面始终朝着镜头
    if (this.cut) {
      const state = this.parts.get(this.cut)
      if (state) {
        const center = this.partCenter(state, this.tmp)
        const normal = this.tmp2.copy(center).sub(this.camera.position).normalize()
        this.cutPlane.setFromNormalAndCoplanarPoint(normal, center)
      }
    }

    this.syncLabels()
  }

  private syncLabels() {
    const showAll = this.explode > 0.55 && !this.demo
    for (const state of this.parts.values()) {
      const want = !this.demo && state.opacity > 0.5 && (state.id === this.selected || (showAll && state.meta.layer === 'organ'))
      for (const piece of state.pieces) {
        if (want && !piece.label) {
          const name = this.names[state.id]
          if (!name) continue
          piece.label = createLabel(name, '#ffffff', state.meta.color === '#ffd8c2' ? '#ff9a6b' : state.meta.color)
          if (!piece.label) continue
          fitLabel(piece.label, this.height, FOV)
          this.holder.add(piece.label.sprite)
        }
        if (!piece.label) continue
        piece.label.sprite.visible = want
        if (want) piece.label.sprite.position.copy(piece.object.position).add(this.tmp.set(0, Math.min(piece.radius * 0.7, 0.12), 0))
      }
    }
  }

  private stepHeart(dt: number) {
    this.bpm += (this.bpmGoal - this.bpm) * (1 - Math.exp(-dt * 0.8))
    const before = this.beatPhase
    this.beatPhase = (this.beatPhase + (dt * this.bpm) / 60) % 1
    if (this.beatPhase < before) this.opts.onBeat?.()
    const p = this.beatPhase
    // 先心房轻轻一缩，再心室用力一缩
    const atria = p > 0.82 ? Math.sin(((p - 0.82) / 0.18) * Math.PI) * 0.35 : 0
    const squeeze = p < 0.28 ? Math.sin((p / 0.28) * Math.PI) : 0
    const heart = this.parts.get('heart')
    if (heart) for (const piece of heart.pieces) piece.object.scale.setScalar(1 - 0.1 * squeeze - 0.03 * atria)
    const speed = 0.22 * (this.bpm / 80) * (0.55 + 1.6 * squeeze)
    const color = new Color()
    this.blood.forEach((drop, index) => {
      const { curve, length } = this.bloodCurves[drop.loop]
      drop.u = (drop.u + (dt * speed * drop.speed) / length) % 1
      const loop = this.routes.blood[drop.loop]
      const out = loop.out === 'red' ? RED : BLUE
      const back = loop.out === 'red' ? BLUE : RED
      const mix = clamp((drop.u - loop.split + 0.04) / 0.08, 0, 1)
      color.copy(out).lerp(back, mix)
      this.writePoint(index, curve.getPointAt(drop.u, this.tmp), color)
    })
    this.flushPoints(this.blood.length)
  }

  private stepLungs(dt: number) {
    const before = this.breath
    if (this.breathAuto) this.breath = 0.5 - 0.5 * Math.cos((this.clock * Math.PI * 2) / 4.6)
    else if (this.holding) this.breath += (1 - this.breath) * (1 - Math.exp(-dt * 1.5))
    else this.breath += (0 - this.breath) * (1 - Math.exp(-dt * 1.7))
    const b = this.breath
    const delta = b - before
    if (delta > 0.0008) this.breathColor = OXYGEN
    else if (delta < -0.0008) this.breathColor = CARBON
    if (!this.breathAuto) {
      if (b > 0.8) this.breathArmed = true
      if (this.breathArmed && b < 0.2) {
        this.breathArmed = false
        this.breathCount += 1
        this.lastBreathReport = 0
      }
    }
    const now = Date.now()
    if (now - this.lastBreathReport > 80) {
      this.lastBreathReport = now
      this.opts.onBreath?.(b, this.breathCount)
    }
    const lungs = this.parts.get('lungs')
    if (lungs) for (const piece of lungs.pieces) piece.object.scale.set(1 + 0.12 * b, 1 + 0.08 * b, 1 + 0.12 * b)
    const diaphragm = this.parts.get('diaphragm')
    if (diaphragm) {
      for (const piece of diaphragm.pieces) {
        piece.object.position.y -= 0.035 * b
        piece.object.scale.set(1 + 0.04 * b, 1 - 0.4 * b, 1 + 0.04 * b)
      }
    }
    const ribs = this.parts.get('ribcage')
    if (ribs) for (const piece of ribs.pieces) piece.object.scale.set(1 + 0.035 * b, 1 + 0.01 * b, 1 + 0.05 * b)
    this.air.forEach((one, index) => {
      const s = clamp(b * 1.4 - one.offset * 0.4, 0, 1)
      this.writePoint(index, s < 0.02 ? null : sampleLine(one.line, s, this.tmp), this.breathColor)
    })
    this.flushPoints(this.air.length)
  }

  private stomachRadius(u: number) {
    const list = this.routes.stomachRadius
    const at = clamp(u, 0, 1) * (list.length - 1)
    const i = Math.min(list.length - 2, Math.floor(at))
    return list[i] + (list[i + 1] - list[i]) * (at - i)
  }

  private stepFood(dt: number) {
    const curves = this.foodCurves
    const bolus = this.bolus
    if (!curves || !bolus) return
    const stage = FOOD_STAGES[this.foodStage]
    const seconds = FOOD_SECONDS[stage]
    if (this.foodPlaying) {
      this.foodT += dt
      if (this.foodT >= seconds) {
        if (this.foodStage < FOOD_STAGES.length - 1) {
          this.foodStage += 1
          this.foodT = 0
          this.sparks = []
          this.opts.onFoodStage?.(this.foodStage)
        } else {
          this.foodT = seconds
          this.foodPlaying = false
          this.opts.onFoodDone?.()
        }
      }
    }
    const f = clamp(this.foodT / FOOD_SECONDS[FOOD_STAGES[this.foodStage]], 0, 1)
    const current = FOOD_STAGES[this.foodStage]
    let count = 0
    const color = new Color()
    const mouth = v3(this.routes.mouth)
    let focus: Vector3 = mouth
    bolus.visible = current === 'mouth' || current === 'esophagus'
    const stomach = this.parts.get('stomach')
    const small = this.parts.get('smallIntestine')
    const large = this.parts.get('largeIntestine')
    const esophagus = this.parts.get('esophagus')
    if (current === 'mouth') {
      bolus.position.copy(mouth)
      const chew = Math.sin(this.foodT * 11)
      bolus.scale.set(1 + 0.25 * chew, 1 - 0.25 * chew, 1).multiplyScalar(1 - 0.25 * f)
      for (let i = 0; i < 10; i += 1) {
        const a = i * 0.63 + this.foodT * 3
        const r = 0.012 + 0.008 * Math.sin(this.foodT * 7 + i)
        this.writePoint(count++, this.tmp.copy(bolus.position).add(this.tmp2.set(Math.cos(a) * r, Math.sin(a * 1.3) * r * 0.6, Math.sin(a) * r * 0.5)), this.foodColor)
      }
      focus = bolus.position
    } else if (current === 'esophagus') {
      curves.swallow.getPointAt(ease(f), bolus.position)
      bolus.scale.setScalar(0.75)
      if (esophagus) for (const piece of esophagus.pieces) piece.object.scale.set(1 + 0.08 * Math.sin(this.clock * 9), 1, 1 + 0.08 * Math.sin(this.clock * 9))
      focus = bolus.position
    } else if (current === 'stomach') {
      const frames = curves.stomach.computeFrenetFrames(16, false)
      color.copy(this.foodColor).lerp(CHYME, f)
      for (let i = 0; i < 46; i += 1) {
        const u = 0.12 + ((i * 0.618) % 1) * 0.76
        const point = curves.stomach.getPointAt(u, this.tmp)
        const frame = Math.min(16, Math.round(u * 16))
        const theta = i * 2.4 + this.foodT * (2.2 + (i % 3))
        const r = this.stomachRadius(u) * (0.25 + 0.45 * ((i * 0.37) % 1))
        point.addScaledVector(frames.normals[frame], Math.cos(theta) * r).addScaledVector(frames.binormals[frame], Math.sin(theta) * r)
        this.writePoint(count++, point, color)
      }
      if (stomach) for (const piece of stomach.pieces) piece.object.scale.set(1 + 0.05 * Math.sin(this.foodT * 5), 1 + 0.05 * Math.sin(this.foodT * 5 + 1.6), 1 + 0.04 * Math.sin(this.foodT * 4))
      focus = curves.stomach.getPointAt(0.5, this.tmp2).clone()
    } else {
      const curve = current === 'small' ? curves.small : current === 'large' ? curves.large : curves.out
      const train = current === 'out' ? 14 : 34
      const gap = current === 'small' ? 0.006 : current === 'large' ? 0.012 : 0.03
      const head = f * (1 + train * gap)
      if (current === 'small') color.copy(CHYME)
      else color.copy(CHYME).lerp(WASTE, current === 'large' ? f : 1)
      let lead: Vector3 | null = null
      for (let i = 0; i < train; i += 1) {
        const u = head - i * gap
        if (u < 0 || u > 1) continue
        const point = curve.getPointAt(u, this.tmp)
        if (!lead) lead = point.clone()
        this.writePoint(count++, point, color)
      }
      // 小肠吸收营养（绿点），大肠吸收水分（蓝点），从食物旁边往外飘走
      if (current !== 'out' && lead && this.foodPlaying) {
        this.sparkClock += dt
        while (this.sparkClock > 0.05) {
          this.sparkClock -= 0.05
          const dir = new Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).normalize()
          this.sparks.push({ origin: lead.clone(), velocity: dir.multiplyScalar(0.06), born: this.clock, color: current === 'small' ? NUTRIENT : WATER })
        }
      }
      this.sparks = this.sparks.filter((spark) => this.clock - spark.born < 1.3)
      for (const spark of this.sparks) {
        const age = this.clock - spark.born
        this.writePoint(count++, this.tmp.copy(spark.origin).addScaledVector(spark.velocity, age), spark.color)
      }
      const wobble = 1 + 0.025 * Math.sin(this.clock * 6)
      const organ = current === 'small' ? small : large
      if (organ) for (const piece of organ.pieces) piece.object.scale.set(wobble, 1, wobble)
      focus = lead ?? curve.getPointAt(clamp(head, 0, 1), this.tmp2).clone()
    }
    this.flushPoints(count)
    // 镜头跟着食物走，离得近一点
    this.targetGoal.lerp(focus, 1 - Math.exp(-dt * 2))
    const wantDist = this.frameDist(current === 'mouth' || current === 'esophagus' ? 0.3 : 0.24, 1.15)
    if (!this.touches.length) this.goal.dist += (wantDist - this.goal.dist) * (1 - Math.exp(-dt * 1.2))
  }
}
