/**
 * 「3D 太阳系」3D 场景。四种模式：
 * - system  太阳系：按今天的真实位置摆放行星，距离和大小做了压缩，能看清轨道。
 * - compare 大小对比：行星按真实比例排成一排，太阳只露出一角。
 * - moon    月相：地球不动，阳光从右边照过来，拖动月球绕地球转，看亮面怎么变。
 * - seasons 四季：太阳在中间，拖动地球公转，地轴斜着且方向不变。
 * 页面只负责 UI，触摸坐标原样传进来；场景每隔一小段时间回调一次当前的天文数据。
 */
import {
  AdditiveBlending,
  AmbientLight,
  BufferGeometry,
  Color,
  ColorManagement,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  LinearSRGBColorSpace,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  PerspectiveCamera,
  Plane,
  PointLight,
  Points,
  PointsMaterial,
  Raycaster,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
  type WebGLRenderTarget,
} from 'three'
import { DEG, OBLIQUITY, SYNODIC_MONTH, YEAR_DAYS, daysSinceJ2000, eclipticToScene, heliocentric, moonLongitude, mod360, sceneToEcliptic } from './astro'
import { BODIES, BODY_MAP, type BodyKey, type SurfaceKind } from './bodies'
import { createLabel, disposeLabel, fitLabel, type Label } from './labels'
import { bakeSurfaces, radialTexture } from './textures'

export type Mode = 'system' | 'compare' | 'moon' | 'seasons'

export type CanvasNode = {
  width: number
  height: number
  getContext(type: string, attrs?: Record<string, unknown>): any
  requestAnimationFrame(callback: (time: number) => void): number
  cancelAnimationFrame(id: number): void
  [key: string]: any
}

export type SceneInfo = { mode: Mode; days: number; earthLon: number; moonLon: number }
export type TouchPoint = { x: number; y: number }

export type SceneOptions = {
  canvas: CanvasNode
  width: number
  height: number
  pixelRatio: number
  names: Record<BodyKey, string>
  /** 春分、夏至、秋分、冬至 */
  seasonMarks: [string, string, string, string]
  /** 新月、上弦月、满月、下弦月 */
  phaseMarks: [string, string, string, string]
  /** 阳光 */
  sunlight: string
  onSelect: (key: BodyKey | null) => void
  onInfo: (info: SceneInfo) => void
  /** 孩子开始拖动地球或月球 */
  onDrag?: (body: 'earth' | 'moon') => void
}

const FOV = 45
/** 太阳系模式里，1 秒走多少天（1 倍速）。地球大约 30 秒转一圈。 */
const SYSTEM_DAYS_PER_SECOND = 12
/** 四季模式里 1 秒走多少天，1 倍速大约 30 秒转一圈。 */
const SEASON_DAYS_PER_SECOND = 12
/** 月相模式里 1 秒走多少天，1 倍速大约 15 秒变一轮。 */
const MOON_DAYS_PER_SECOND = 2
const MOON_SYSTEM_DISTANCE = 2.2
const SEASON = { sun: 2.6, orbit: 14, earth: 1.8 }
/** 月相模式：地球在原点，太阳固定在 +x 方向（地心黄经 0°）。 */
const LUNAR = { earth: 2.2, orbit: 7.5, moon: 0.8, sunX: 15, sun: 2.2 }
const RING_INNER = 1.24
const RING_OUTER = 2.27

const systemDistance = (au: number) => 10 + 14 * Math.sqrt(au)
const systemRadius = (key: BodyKey) => (key === 'sun' ? 6 : Math.pow(BODY_MAP[key].radiusKm / 6371, 0.55))
const realRadius = (key: BodyKey) => BODY_MAP[key].radiusKm / 6371

type BodyNode = {
  key: BodyKey
  /** 决定位置 */
  root: Group
  /** 自转轴倾斜 */
  tilt: Group
  /** 自转 */
  spin: Mesh
  radius: number
  label: Label | null
  /** 名字放在星球下方 */
  below?: boolean
}

type ModeView = {
  group: Group
  nodes: Partial<Record<BodyKey, BodyNode>>
  labels: Label[]
}

const RING_VERTEX = /* glsl */ `
varying vec2 vPos;
void main() {
  vPos = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const RING_FRAGMENT = /* glsl */ `
varying vec2 vPos;
float h(float x) { return fract(sin(x * 127.1) * 43758.5453); }
void main() {
  float t = (length(vPos) - ${RING_INNER.toFixed(2)}) / ${(RING_OUTER - RING_INNER).toFixed(2)};
  float n = h(floor(t * 160.0)) * 0.5 + h(floor(t * 41.0)) * 0.5;
  float gap = smoothstep(0.585, 0.6, t) * (1.0 - smoothstep(0.64, 0.655, t));
  float edge = smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.95, 1.0, t));
  float alpha = (0.35 + 0.55 * n) * edge * (1.0 - gap * 0.88);
  vec3 col = mix(vec3(0.62, 0.54, 0.42), vec3(0.96, 0.89, 0.74), n);
  gl_FragColor = vec4(col, alpha);
}
`

function ease(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** 小程序的 WebGL 画布没有 DOM 事件和 style，three.js 只在初始化时用到它们，补成空的就行。 */
function patchCanvas(canvas: CanvasNode) {
  if (!canvas.style) canvas.style = { width: '', height: '' }
  if (!canvas.addEventListener) canvas.addEventListener = () => {}
  if (!canvas.removeEventListener) canvas.removeEventListener = () => {}
}

export class SolarScene {
  private readonly opts: SceneOptions
  private readonly canvas: CanvasNode
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera: PerspectiveCamera
  private readonly sphere = new SphereGeometry(1, 48, 32)
  private readonly baked: Map<SurfaceKind, { texture: Texture; target: WebGLRenderTarget }>
  private readonly materials = new Map<SurfaceKind, Material>()
  private readonly ringMaterial: ShaderMaterial
  private readonly glowTexture: Texture
  private readonly starTexture: Texture
  private readonly views: Record<Mode, ModeView>
  private readonly orbitMaterials = new Map<BodyKey, LineBasicMaterial>()
  private readonly sunLight = new PointLight(0xffffff, 3.2, 0, 0)
  private readonly ambient = new AmbientLight(0xffffff, 0.5)
  private readonly frontLight = new DirectionalLight(0xffffff, 2.6)
  private belt: Points | null = null
  private sightLine: Line | null = null
  private compareEnd = 0

  private mode: Mode = 'system'
  private days = daysSinceJ2000()
  private earthLon = 0
  private moonLon = 0
  private speed = 1
  private playing = true
  private running = false
  private frameId = 0
  private lastTime = 0
  private infoTimer = 0
  private width: number
  private height: number

  // 相机：绕 target 的球坐标，cam 是当前值，goal 是要缓动到的值
  private cam = { yaw: 0.3, pitch: 0.5, dist: 130 }
  private goal = { yaw: 0.3, pitch: 0.5, dist: 130 }
  private target = new Vector3()
  private freeTarget = new Vector3()
  private focusKey: BodyKey | null = null
  private focusFrom = new Vector3()
  private focusBlend = 1

  // 手势
  private touches: TouchPoint[] = []
  private tapStart = 0
  private tapPoint: TouchPoint = { x: 0, y: 0 }
  private tapMoved = false
  private dragBody: 'earth' | 'moon' | null = null
  private pinchSpan = 0
  /** 点二分二至、月相按钮后，地球或月球转过去的动画 */
  private tween: { body: 'earth' | 'moon'; from: number; delta: number; t: number } | null = null

  private readonly raycaster = new Raycaster()
  private readonly plane = new Plane(new Vector3(0, 1, 0), 0)
  private readonly tmp = new Vector3()
  private readonly tmp2 = new Vector3()
  private readonly ndc = new Vector2()

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
    this.renderer.setClearColor(new Color(0x03040a), 1)

    this.camera = new PerspectiveCamera(FOV, opts.width / opts.height, 0.05, 6000)
    this.baked = bakeSurfaces(this.renderer, BODIES.map((body) => body.key))
    for (const [kind, { texture }] of this.baked) {
      this.materials.set(kind, kind === 'sun' ? new MeshBasicMaterial({ map: texture }) : new MeshLambertMaterial({ map: texture }))
    }
    this.ringMaterial = new ShaderMaterial({
      vertexShader: RING_VERTEX,
      fragmentShader: RING_FRAGMENT,
      transparent: true,
      side: DoubleSide,
      depthWrite: false,
    })
    this.glowTexture = radialTexture(128, [
      [0, 255, 236, 180, 255],
      [0.22, 255, 196, 90, 200],
      [0.5, 255, 130, 40, 60],
      [1, 255, 100, 20, 0],
    ])
    this.starTexture = radialTexture(16, [
      [0, 255, 255, 255, 255],
      [0.45, 255, 255, 255, 140],
      [1, 255, 255, 255, 0],
    ])

    this.scene.add(this.sunLight, this.ambient, this.frontLight)
    this.frontLight.position.set(0.3, 0.6, 1)
    this.scene.add(this.buildStars())
    this.views = {
      system: this.buildSystem(),
      compare: this.buildCompare(),
      moon: this.buildMoon(),
      seasons: this.buildSeasons(),
    }
    for (const view of Object.values(this.views)) this.scene.add(view.group)
    this.fitLabels()

    this.setMode('system')
    this.layout(0)
  }

  // ---- 搭建场景 ----

  private makeNode(key: BodyKey, radius: number, withLabel: boolean, labels: Label[], glowScale = 4.6): BodyNode {
    const root = new Group()
    const tilt = new Group()
    tilt.rotation.x = -BODY_MAP[key].tilt * DEG
    const spin = new Mesh(this.sphere, this.materials.get(key)!)
    spin.scale.setScalar(radius)
    tilt.add(spin)
    root.add(tilt)
    if (key === 'sun') {
      const glow = new Sprite(new SpriteMaterial({ map: this.glowTexture, blending: AdditiveBlending, depthWrite: false, transparent: true }))
      glow.scale.setScalar(radius * glowScale)
      root.add(glow)
    }
    if (key === 'saturn') {
      const ring = new Mesh(new RingGeometry(RING_INNER, RING_OUTER, 128, 1), this.ringMaterial)
      ring.rotation.x = -Math.PI / 2
      ring.scale.setScalar(radius)
      tilt.add(ring)
    }
    let label: Label | null = null
    if (withLabel) {
      label = createLabel(this.opts.names[key])
      if (label) {
        label.sprite.center.set(0.5, -0.25)
        label.sprite.position.y = radius
        root.add(label.sprite)
        labels.push(label)
      }
    }
    return { key, root, tilt, spin, radius, label }
  }

  private buildStars() {
    const group = new Group()
    for (const [count, size] of [[1400, 1.6], [260, 2.8]] as const) {
      const positions: number[] = []
      const colors: number[] = []
      for (let i = 0; i < count; i += 1) {
        const u = Math.random() * 2 - 1
        const a = Math.random() * Math.PI * 2
        const r = Math.sqrt(1 - u * u) * 2600
        positions.push(r * Math.cos(a), u * 2600, r * Math.sin(a))
        const warm = Math.random()
        const light = 0.55 + Math.random() * 0.45
        colors.push(light * (0.85 + warm * 0.15), light * 0.92, light * (1 - warm * 0.2))
      }
      const geometry = new BufferGeometry()
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
      geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
      group.add(new Points(geometry, new PointsMaterial({
        size,
        sizeAttenuation: false,
        vertexColors: true,
        map: this.starTexture,
        transparent: true,
        depthWrite: false,
      })))
    }
    return group
  }

  private orbitLine(points: Array<{ x: number; z: number }>, material: LineBasicMaterial) {
    const positions: number[] = []
    for (const p of points) positions.push(p.x, 0, p.z)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    return new LineLoop(geometry, material)
  }

  private circle(radius: number, segments = 128) {
    return Array.from({ length: segments }, (_, i) => eclipticToScene((i / segments) * 360, radius))
  }

  private buildSystem(): ModeView {
    const group = new Group()
    const labels: Label[] = []
    const nodes: ModeView['nodes'] = {}
    for (const body of BODIES) {
      const node = this.makeNode(body.key, systemRadius(body.key), true, labels)
      nodes[body.key] = node
      if (body.key === 'moon') continue
      group.add(node.root)
      if (body.orbit) {
        const material = new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16 })
        this.orbitMaterials.set(body.key, material)
        const el = body.orbit
        const points = Array.from({ length: 240 }, (_, i) => {
          const { lon, r } = heliocentric(el, (i / 240) * el.period)
          return eclipticToScene(lon, systemDistance(r))
        })
        group.add(this.orbitLine(points, material))
      }
    }
    const moon = nodes.moon!
    nodes.earth!.root.add(moon.root)
    const moonOrbit = new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 })
    this.orbitMaterials.set('moon', moonOrbit)
    nodes.earth!.root.add(this.orbitLine(this.circle(MOON_SYSTEM_DISTANCE, 64), moonOrbit))

    // 小行星带：火星和木星之间
    const positions: number[] = []
    for (let i = 0; i < 1400; i += 1) {
      const au = 2.2 + Math.random() * 1.1
      const p = eclipticToScene(Math.random() * 360, systemDistance(au))
      positions.push(p.x, (Math.random() - 0.5) * 0.8, p.z)
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    this.belt = new Points(geometry, new PointsMaterial({
      size: 1.6,
      sizeAttenuation: false,
      color: 0x9b8f80,
      map: this.starTexture,
      transparent: true,
      depthWrite: false,
    }))
    group.add(this.belt)
    return { group, nodes, labels }
  }

  private buildCompare(): ModeView {
    const group = new Group()
    const labels: Label[] = []
    const nodes: ModeView['nodes'] = {}
    const sun = this.makeNode('sun', realRadius('sun'), false, labels, 1.25)
    sun.root.position.x = -realRadius('sun') - 1
    nodes.sun = sun
    group.add(sun.root)
    let cursor = 1.5
    const row: BodyKey[] = ['mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']
    row.forEach((key, index) => {
      const radius = realRadius(key)
      const half = key === 'saturn' ? radius * RING_OUTER : radius
      const node = this.makeNode(key, radius, true, labels)
      // 相邻的名字一上一下，挨得近的小行星也能都显示出来
      if (index % 2 === 1 && node.label) {
        node.below = true
        node.label.sprite.center.set(0.5, 1.25)
        node.label.sprite.position.y = -radius
      }
      node.root.position.x = cursor + half
      cursor += half * 2 + 1.6
      nodes[key] = node
      group.add(node.root)
    })
    this.compareEnd = cursor
    return { group, nodes, labels }
  }

  private markLabel(group: Group, labels: Label[], text: string, x: number, z: number, color: string, below = false) {
    const label = createLabel(text, color)
    if (!label) return
    label.sprite.center.set(0.5, below ? -0.4 : 1.4)
    label.sprite.position.set(x, 0, z)
    group.add(label.sprite)
    labels.push(label)
  }

  private markPoints(group: Group, points: number[], color: number) {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(points, 3))
    group.add(new Points(geometry, new PointsMaterial({ size: 7, sizeAttenuation: false, color, map: this.starTexture, transparent: true, depthWrite: false })))
  }

  private buildMoon(): ModeView {
    const group = new Group()
    const labels: Label[] = []
    const nodes: ModeView['nodes'] = {}
    const earth = this.makeNode('earth', LUNAR.earth, true, labels)
    const moon = this.makeNode('moon', LUNAR.moon, true, labels)
    const sun = this.makeNode('sun', LUNAR.sun, false, labels, 3.2)
    earth.tilt.rotation.x = -OBLIQUITY * DEG
    if (moon.label) {
      moon.label.sprite.center.set(0.5, 1.25)
      moon.label.sprite.position.y = -LUNAR.moon
    }
    sun.root.position.set(LUNAR.sunX, 0, 0)
    nodes.earth = earth
    nodes.moon = moon
    nodes.sun = sun
    group.add(earth.root, moon.root, sun.root)
    group.add(this.orbitLine(this.circle(LUNAR.orbit, 96), new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 })))

    // 平行的阳光：从太阳那边一道道照过来
    const rays: number[] = []
    for (const z of [-9, -6, -3, 3, 6, 9]) rays.push(LUNAR.sunX - LUNAR.sun * 1.6, 0, z, -LUNAR.orbit - 2, 0, z)
    const rayGeometry = new BufferGeometry()
    rayGeometry.setAttribute('position', new Float32BufferAttribute(rays, 3))
    group.add(new LineSegments(rayGeometry, new LineBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.22 })))
    this.markLabel(group, labels, this.opts.sunlight, LUNAR.sunX - LUNAR.sun * 1.6, -9, '#ffc46b')

    // 从地球看月亮的视线
    const sight = new BufferGeometry()
    sight.setAttribute('position', new Float32BufferAttribute([0, 0, 0, LUNAR.orbit, 0, 0], 3))
    this.sightLine = new Line(sight, new LineBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.55 }))
    group.add(this.sightLine)

    // 四个主要月相的位置：月球在太阳方向是新月，逆时针转 90° 是上弦月
    const marks: number[] = []
    this.opts.phaseMarks.forEach((text, index) => {
      const p = eclipticToScene(index * 90, LUNAR.orbit)
      marks.push(p.x, 0, p.z)
      this.markLabel(group, labels, text, p.x, p.z, '#bfe1ff', index === 3)
    })
    this.markPoints(group, marks, 0xbfe1ff)
    return { group, nodes, labels }
  }

  private buildSeasons(): ModeView {
    const group = new Group()
    const labels: Label[] = []
    const nodes: ModeView['nodes'] = {}
    const sun = this.makeNode('sun', SEASON.sun, true, labels)
    const earth = this.makeNode('earth', SEASON.earth, true, labels)
    earth.tilt.rotation.x = -OBLIQUITY * DEG
    nodes.sun = sun
    nodes.earth = earth
    group.add(sun.root, earth.root)

    // 地轴：穿过南北极的一根线，方向在公转时保持不变
    const axis = new BufferGeometry()
    axis.setAttribute('position', new Float32BufferAttribute([0, -SEASON.earth * 1.7, 0, 0, SEASON.earth * 1.7, 0], 3))
    earth.tilt.add(new Line(axis, new LineBasicMaterial({ color: 0xffd28a })))

    group.add(this.orbitLine(this.circle(SEASON.orbit), new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 })))

    // 二分二至点：太阳黄经 0/90/180/270 时，地球在日心黄经 180/270/0/90
    const marks: number[] = []
    this.opts.seasonMarks.forEach((text, index) => {
      const p = eclipticToScene(mod360(index * 90 + 180), SEASON.orbit)
      marks.push(p.x, 0, p.z)
      this.markLabel(group, labels, text, p.x, p.z, '#ffd28a')
    })
    this.markPoints(group, marks, 0xffd28a)
    return { group, nodes, labels }
  }

  private fitLabels() {
    for (const view of Object.values(this.views)) {
      for (const label of view.labels) fitLabel(label, this.height, FOV)
    }
  }

  // ---- 对外接口 ----

  start() {
    if (this.running) return
    this.running = true
    this.lastTime = Date.now()
    const loop = () => {
      if (!this.running) return
      const now = Date.now()
      const dt = Math.min(0.05, (now - this.lastTime) / 1000)
      this.lastTime = now
      this.layout(dt)
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

  setPlaying(playing: boolean) {
    this.playing = playing
  }

  setSpeed(speed: number) {
    this.speed = speed
  }

  /** 回到今天的真实位置。 */
  resetToday() {
    this.days = daysSinceJ2000()
    this.syncToDays()
  }

  /** 按 days 摆好地球和月球。月相模式里太阳固定在 0°，月球黄经换成它离太阳的角度。 */
  private syncToDays() {
    this.tween = null
    this.earthLon = heliocentric(BODY_MAP.earth.orbit!, this.days).lon
    const moonLon = moonLongitude(this.days)
    this.moonLon = this.mode === 'moon' ? mod360(moonLon - (this.earthLon + 180)) : moonLon
  }

  setMode(mode: Mode) {
    this.mode = mode
    // 进入月相、四季时先摆成今天真实的样子
    if (mode === 'moon' || mode === 'seasons') this.syncToDays()
    for (const [key, view] of Object.entries(this.views)) view.group.visible = key === mode
    if (this.belt) this.belt.visible = mode === 'system'
    // 月相模式用平行光：阳光从 +x 照过来，地球、月球都是朝太阳的一半亮
    this.sunLight.visible = mode === 'system' || mode === 'seasons'
    this.frontLight.visible = mode === 'compare' || mode === 'moon'
    if (mode === 'moon') {
      this.frontLight.position.set(1, 0, 0)
      this.frontLight.intensity = 3
    } else {
      this.frontLight.position.set(0.3, 0.6, 1)
      this.frontLight.intensity = 2.6
    }
    this.ambient.intensity = mode === 'compare' ? 0.9 : mode === 'system' ? 0.5 : 0.1
    this.tween = null
    this.focusKey = null
    this.focusBlend = 1
    this.applyViewOffset()
    this.overview(true)
  }

  /** 太阳系模式把画面中心往下挪一点，上方的轨道不被切掉。 */
  private applyViewOffset() {
    const shift = this.mode === 'system' ? 0.04 : 0
    if (shift) this.camera.setViewOffset(this.width, this.height, 0, -this.height * shift, this.width, this.height)
    else this.camera.clearViewOffset()
  }

  /** 让地球（四季）或月球（月相）转到指定黄经，总是往前（逆时针）转。 */
  goTo(body: 'earth' | 'moon', lon: number) {
    const from = body === 'earth' ? this.earthLon : this.moonLon
    let delta = mod360(lon - from)
    if (delta > 355) delta -= 360
    this.tween = { body, from, delta, t: 0 }
  }

  /** 选中某个天体，相机飞过去并跟着它；传 null 回到全景。 */
  focus(key: BodyKey | null) {
    const node = key ? this.views[this.mode].nodes[key] : undefined
    if (!key || !node) {
      this.focusKey = null
      this.overview(false)
      this.highlight(null)
      return
    }
    this.focusFrom.copy(this.target)
    this.focusKey = key
    this.focusBlend = 0
    const ring = key === 'saturn' ? RING_OUTER : 1
    const near = this.mode === 'compare' ? 4.2 : 5
    this.goal.dist = Math.max(node.radius * ring * near, this.mode === 'compare' ? 1.4 : 3)
    if (this.mode === 'compare' && key === 'sun') this.goal.dist = node.radius * 3
    this.highlight(key)
  }

  resize(width: number, height: number) {
    // 重设尺寸会清空画布，尺寸没变时跳过，避免闪一下
    if (Math.round(width) === Math.round(this.width) && Math.round(height) === Math.round(this.height)) return
    this.width = width
    this.height = height
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.applyViewOffset()
    this.camera.updateProjectionMatrix()
    this.fitLabels()
  }

  dispose() {
    this.stop()
    for (const view of Object.values(this.views)) view.labels.forEach(disposeLabel)
    this.scene.traverse((object: Object3D) => {
      const mesh = object as Mesh
      if (mesh.geometry && mesh.geometry !== this.sphere) mesh.geometry.dispose()
      const material = (mesh as { material?: Material | Material[] }).material
      if (material && !Array.isArray(material) && !this.isShared(material)) material.dispose()
    })
    this.sphere.dispose()
    this.materials.forEach((material) => material.dispose())
    this.ringMaterial.dispose()
    this.baked.forEach(({ target }) => target.dispose())
    this.glowTexture.dispose()
    this.starTexture.dispose()
    this.renderer.dispose()
  }

  private isShared(material: Material) {
    for (const value of this.materials.values()) if (value === material) return true
    return material === this.ringMaterial
  }

  // ---- 手势 ----

  /** factor < 1 拉近，> 1 拉远；和双指缩放共用距离上下限。 */
  zoomBy(factor: number) {
    this.goal.dist = this.clampDist(this.goal.dist * factor)
  }

  touchStart(points: TouchPoint[]) {
    this.touches = points
    if (points.length === 1) {
      this.tapStart = Date.now()
      this.tapPoint = points[0]
      this.tapMoved = false
      this.dragBody = this.pickDraggable(points[0])
      if (this.dragBody) {
        this.tween = null
        this.opts.onDrag?.(this.dragBody)
      }
    } else if (points.length >= 2) {
      this.dragBody = null
      this.tapMoved = true
      this.pinchSpan = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
    }
  }

  touchMove(points: TouchPoint[]) {
    const prev = this.touches
    this.touches = points
    if (points.length >= 2 && prev.length >= 2) {
      const span = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
      if (this.pinchSpan > 0 && span > 0) this.goal.dist = this.clampDist(this.goal.dist * (this.pinchSpan / span))
      this.pinchSpan = span
      return
    }
    if (points.length !== 1 || prev.length !== 1) return
    const dx = points[0].x - prev[0].x
    const dy = points[0].y - prev[0].y
    if (Math.hypot(points[0].x - this.tapPoint.x, points[0].y - this.tapPoint.y) > 8) this.tapMoved = true
    if (this.dragBody) {
      this.dragTo(points[0])
      return
    }
    if (this.mode === 'compare') {
      if (this.focusKey) {
        this.freeTarget.copy(this.target)
        this.focusKey = null
        this.highlight(null)
        this.opts.onSelect(null)
      }
      const perPixel = (2 * this.cam.dist * Math.tan((FOV * DEG) / 2)) / this.height
      this.freeTarget.x = clamp(this.freeTarget.x - dx * perPixel, -realRadius('sun') - 1, this.compareEnd)
      return
    }
    this.goal.yaw -= dx * 0.008
    this.goal.pitch = clamp(this.goal.pitch + dy * 0.006, -1.35, 1.45)
  }

  touchEnd(points: TouchPoint[]) {
    const last = this.touches
    this.touches = points
    if (points.length > 0) {
      if (points.length === 1) this.pinchSpan = 0
      return
    }
    const wasDrag = this.dragBody
    this.dragBody = null
    if (wasDrag || this.tapMoved || Date.now() - this.tapStart > 350 || last.length !== 1) return
    if (this.mode === 'moon' || this.mode === 'seasons') return
    const key = this.pick(last[0])
    this.opts.onSelect(key)
  }

  // ---- 拾取 ----

  private screenOf(node: BodyNode) {
    node.root.getWorldPosition(this.tmp)
    const depth = this.tmp2.copy(this.tmp).sub(this.camera.position).length()
    this.tmp.project(this.camera)
    if (this.tmp.z > 1) return null
    const ring = node.key === 'saturn' ? 1.6 : 1
    return {
      x: (this.tmp.x + 1) * 0.5 * this.width,
      y: (1 - this.tmp.y) * 0.5 * this.height,
      r: ((node.radius * ring) / (depth * Math.tan((FOV * DEG) / 2))) * (this.height / 2),
      depth,
    }
  }

  private pick(point: TouchPoint): BodyKey | null {
    let best: BodyKey | null = null
    let bestScore = Infinity
    for (const node of Object.values(this.views[this.mode].nodes)) {
      if (!node || !this.isShown(node)) continue
      const screen = this.screenOf(node)
      if (!screen) continue
      const reach = Math.max(screen.r * 1.15, 24)
      const d = Math.hypot(screen.x - point.x, screen.y - point.y)
      if (d > reach) continue
      const score = d / reach + screen.depth * 1e-4
      if (score < bestScore) {
        bestScore = score
        best = node.key
      }
    }
    return best
  }

  private pickDraggable(point: TouchPoint): 'earth' | 'moon' | null {
    if (this.mode === 'moon') {
      const m = this.screenOf(this.views.moon.nodes.moon!)
      if (m && Math.hypot(m.x - point.x, m.y - point.y) <= Math.max(m.r * 2, 36)) return 'moon'
    } else if (this.mode === 'seasons') {
      const e = this.screenOf(this.views.seasons.nodes.earth!)
      if (e && Math.hypot(e.x - point.x, e.y - point.y) <= Math.max(e.r * 1.6, 36)) return 'earth'
    }
    return null
  }

  private dragTo(point: TouchPoint) {
    this.ndc.set((point.x / this.width) * 2 - 1, -(point.y / this.height) * 2 + 1)
    this.raycaster.setFromCamera(this.ndc, this.camera)
    if (!this.raycaster.ray.intersectPlane(this.plane, this.tmp)) return
    if (this.dragBody === 'earth') this.earthLon = sceneToEcliptic(this.tmp.x, this.tmp.z)
    else this.moonLon = sceneToEcliptic(this.tmp.x, this.tmp.z)
  }

  private isShown(node: BodyNode) {
    if (this.mode !== 'system' || node.key !== 'moon') return true
    return this.focusKey === 'earth' || this.focusKey === 'moon'
  }

  // ---- 每帧 ----

  private overview(snap: boolean) {
    if (this.mode === 'system') {
      Object.assign(this.goal, { yaw: 0.35, pitch: 0.62, dist: 150 })
      this.freeTarget.set(0, 0, 0)
    } else if (this.mode === 'compare') {
      const tanH = Math.tan((FOV * DEG) / 2) * (this.width / this.height)
      const span = this.compareEnd + 12
      Object.assign(this.goal, { yaw: 0, pitch: 0.12, dist: clamp(span / 2 / tanH, 30, 320) })
      this.freeTarget.set(span / 2 - 12, 0, 0)
    } else if (this.mode === 'moon') {
      // 从斜上方往下看，左右要装下月球轨道和右边的太阳
      const tanH = Math.tan((FOV * DEG) / 2) * (this.width / this.height)
      const tanV = Math.tan((FOV * DEG) / 2)
      const right = LUNAR.sunX + LUNAR.sun * 1.3
      const half = (LUNAR.orbit + right) / 2 + 1
      Object.assign(this.goal, { yaw: 0, pitch: 1.05, dist: clamp(Math.max(half / tanH, (LUNAR.orbit + 2) / tanV), 14, 90) })
      // 画面中心放在地球和太阳之间，地球偏左、太阳在右边
      this.freeTarget.set((right - LUNAR.orbit) / 2, 0, 0)
    } else {
      const tanH = Math.tan((FOV * DEG) / 2) * (this.width / this.height)
      const tanV = Math.tan((FOV * DEG) / 2)
      const reach = SEASON.orbit * 1.32
      Object.assign(this.goal, { yaw: 0.25, pitch: 0.72, dist: clamp(Math.max(reach / tanH, (reach * 0.85) / tanV), 24, 120) })
      this.freeTarget.set(0, 0, 0)
    }
    if (snap) {
      Object.assign(this.cam, this.goal)
      this.target.copy(this.freeTarget)
    }
  }

  private clampDist(value: number) {
    const node = this.focusKey ? this.views[this.mode].nodes[this.focusKey] : undefined
    const min = node ? node.radius * 1.8 : this.mode === 'compare' ? 2 : 10
    const max = this.mode === 'system' ? 480 : this.mode === 'compare' ? 360 : this.mode === 'moon' ? 90 : 130
    return clamp(value, min, max)
  }

  private highlight(key: BodyKey | null) {
    for (const [body, material] of this.orbitMaterials) {
      material.opacity = body === key ? 0.6 : body === 'moon' ? 0.22 : 0.16
    }
  }

  private layout(dt: number) {
    const running = this.playing && !this.dragBody
    const step = running ? dt * this.speed : 0
    const spinStep = this.playing ? dt * Math.sqrt(Math.min(this.speed, 4)) : 0

    if (this.mode === 'system') {
      this.days += step * SYSTEM_DAYS_PER_SECOND
      this.placeSystem(spinStep)
    } else if (this.mode === 'compare') {
      for (const node of Object.values(this.views.compare.nodes)) if (node) this.spin(node, spinStep)
    } else {
      if (this.tween) this.stepTween(dt)
      else if (this.mode === 'moon') this.moonLon = mod360(this.moonLon + (step * MOON_DAYS_PER_SECOND * 360) / SYNODIC_MONTH)
      else this.earthLon = mod360(this.earthLon + (step * SEASON_DAYS_PER_SECOND * 360) / YEAR_DAYS)
      if (this.mode === 'moon') this.placeMoon(spinStep)
      else this.placeSeasons(spinStep)
    }

    this.moveCamera(dt)
    this.declutter()

    this.infoTimer += dt
    if (this.infoTimer >= 0.12 || dt === 0) {
      this.infoTimer = 0
      // 月相模式里太阳固定在地心黄经 0°，相当于地球在日心黄经 180°
      const earthLon = this.mode === 'system' ? heliocentric(BODY_MAP.earth.orbit!, this.days).lon : this.mode === 'moon' ? 180 : this.earthLon
      const moonLon = this.mode === 'system' ? moonLongitude(this.days) : this.moonLon
      this.opts.onInfo({ mode: this.mode, days: this.days, earthLon, moonLon })
    }
  }

  /** 名字挤在一起时，先保住大星球的名字，小星球的放大后再出现。 */
  private declutter() {
    if (this.mode === 'moon' || this.mode === 'seasons') return
    const nodes = Object.values(this.views[this.mode].nodes)
      .filter((node): node is BodyNode => Boolean(node?.label))
      .sort((a, b) => b.radius - a.radius)
    const placed: Array<[number, number, number, number]> = []
    for (const node of nodes) {
      const sprite = node.label!.sprite
      const screen = this.isShown(node) ? this.screenOf(node) : null
      if (!screen) {
        sprite.visible = false
        continue
      }
      const w = node.label!.aspect * 22
      const r = Math.min(screen.r, this.height)
      const top = node.below ? screen.y + r + 4 : screen.y - r - 28
      const box: [number, number, number, number] = [screen.x - w / 2 - 2, top, screen.x + w / 2 + 2, top + 24]
      const hit = placed.some((p) => box[0] < p[2] && box[2] > p[0] && box[1] < p[3] && box[3] > p[1])
      sprite.visible = !hit
      if (!hit) placed.push(box)
    }
  }

  private spin(node: BodyNode, step: number) {
    const hours = BODY_MAP[node.key].rotationHours
    if (node.key === 'moon') return
    const revPerSecond = 0.12 * Math.pow(24 / Math.abs(hours), 0.4)
    node.spin.rotation.y += Math.sign(hours) * revPerSecond * Math.PI * 2 * step
  }

  private placeSystem(spinStep: number) {
    const { nodes } = this.views.system
    for (const body of BODIES) {
      const node = nodes[body.key]
      if (!node) continue
      if (body.orbit) {
        const { lon, r } = heliocentric(body.orbit, this.days)
        const p = eclipticToScene(lon, systemDistance(r))
        node.root.position.set(p.x, 0, p.z)
      }
      this.spin(node, spinStep)
    }
    const moonLon = moonLongitude(this.days)
    const p = eclipticToScene(moonLon, MOON_SYSTEM_DISTANCE)
    nodes.moon!.root.position.set(p.x, 0, p.z)
    nodes.moon!.spin.rotation.y = moonLon * DEG + Math.PI
    if (this.belt) this.belt.rotation.y = -(this.days / 1680) * Math.PI * 2
  }

  private stepTween(dt: number) {
    const tween = this.tween!
    tween.t = Math.min(1, tween.t + dt / 0.9)
    const lon = mod360(tween.from + tween.delta * ease(tween.t))
    if (tween.body === 'earth') this.earthLon = lon
    else this.moonLon = lon
    if (tween.t >= 1) this.tween = null
  }

  private placeMoon(spinStep: number) {
    const { earth, moon, sun } = this.views.moon.nodes
    const m = eclipticToScene(this.moonLon, LUNAR.orbit)
    moon!.root.position.set(m.x, 0, m.z)
    // 月球总是同一面朝着地球
    moon!.spin.rotation.y = this.moonLon * DEG + Math.PI
    if (this.sightLine) {
      const position = this.sightLine.geometry.getAttribute('position')
      position.setXYZ(1, m.x * (1 - LUNAR.moon / LUNAR.orbit), 0, m.z * (1 - LUNAR.moon / LUNAR.orbit))
      position.setXYZ(0, (m.x / LUNAR.orbit) * LUNAR.earth, 0, (m.z / LUNAR.orbit) * LUNAR.earth)
      position.needsUpdate = true
    }
    this.spin(earth!, spinStep * 2.5)
    this.spin(sun!, spinStep)
  }

  private placeSeasons(spinStep: number) {
    const { earth, sun } = this.views.seasons.nodes
    const e = eclipticToScene(this.earthLon, SEASON.orbit)
    earth!.root.position.set(e.x, 0, e.z)
    this.spin(earth!, spinStep * 2.5)
    this.spin(sun!, spinStep)
  }

  private moveCamera(dt: number) {
    const k = dt === 0 ? 1 : 1 - Math.exp(-dt * 7)
    this.cam.yaw += (this.goal.yaw - this.cam.yaw) * k
    this.cam.pitch += (this.goal.pitch - this.cam.pitch) * k
    this.cam.dist += (this.goal.dist - this.cam.dist) * k
    const node = this.focusKey ? this.views[this.mode].nodes[this.focusKey] : undefined
    if (node) {
      node.root.getWorldPosition(this.tmp)
      this.focusBlend = Math.min(1, this.focusBlend + dt / 0.9)
      this.target.copy(this.focusFrom).lerp(this.tmp, ease(this.focusBlend))
      this.freeTarget.copy(this.target)
    } else {
      this.target.lerp(this.freeTarget, k)
    }
    const { yaw, pitch, dist } = this.cam
    this.camera.position.set(
      this.target.x + dist * Math.cos(pitch) * Math.sin(yaw),
      this.target.y + dist * Math.sin(pitch),
      this.target.z + dist * Math.cos(pitch) * Math.cos(yaw),
    )
    this.camera.lookAt(this.target)
    this.camera.updateMatrixWorld()
  }
}
