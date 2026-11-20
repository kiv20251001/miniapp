/**
 * 「3D 人体器官」的部位清单和身体坐标。和模型怎么做出来无关：
 * 代码生成的模型（procedural.ts）和以后换成的模型文件都按这里的部位 id、坐标系对齐。
 *
 * 坐标系：y 朝上，z 朝身体正前方，x 朝身体的左边（面对我们时在画面右侧）。
 * 单位约等于米的 1/1：头顶 y≈0.95，脚底 y≈-0.96，肚脐附近 y≈0。
 * 心跳、呼吸、食物旅行的路线也写在这里（DEFAULT_ROUTES），模型文件可以带自己的一份 BodyRoutes。
 */

export type Vec3 = [number, number, number]

/** 由外往里一层层剖开 */
export type Layer = 'skin' | 'muscle' | 'bone' | 'organ'
export const LAYERS: Layer[] = ['skin', 'muscle', 'bone', 'organ']

export type System = 'respiratory' | 'circulatory' | 'digestive' | 'urinary' | 'nervous' | 'skeletal'
export const SYSTEMS: System[] = ['respiratory', 'circulatory', 'digestive', 'urinary', 'nervous', 'skeletal']

export type DemoId = 'heart' | 'lungs' | 'food'

export type PartId =
  | 'skin'
  | 'muscle'
  | 'skull'
  | 'ribcage'
  | 'spine'
  | 'pelvis'
  | 'limbBones'
  | 'brain'
  | 'spinalCord'
  | 'trachea'
  | 'lungs'
  | 'diaphragm'
  | 'heart'
  | 'vessels'
  | 'esophagus'
  | 'stomach'
  | 'liver'
  | 'gallbladder'
  | 'pancreas'
  | 'spleen'
  | 'smallIntestine'
  | 'largeIntestine'
  | 'kidneys'
  | 'bladder'

export type PartMeta = {
  layer: Layer
  system?: System
  /** 器官卡片上的圆点颜色，代码生成的模型也用它上色 */
  color: string
  /**
   * 「展开」时往哪里飞。左右成对的部位（肺、肾）按每一块自己的中心在左边还是右边，x 自动取正负。
   * 不写时原地不动（皮肤、肌肉、骨骼展开时淡出）。
   */
  explode?: Vec3
  /** 可以切开看里面 */
  cut?: boolean
  /** 有工作演示 */
  demo?: DemoId
  /** 平时画淡一点，免得挡住别的器官；选中、筛到它的系统或演示时才完全显示 */
  faint?: boolean
}

export const PARTS: Record<PartId, PartMeta> = {
  skin: { layer: 'skin', color: '#ffd8c2' },
  muscle: { layer: 'muscle', color: '#e9827a' },
  skull: { layer: 'bone', system: 'skeletal', color: '#efe4c8' },
  ribcage: { layer: 'bone', system: 'skeletal', color: '#efe4c8' },
  spine: { layer: 'bone', system: 'skeletal', color: '#efe4c8' },
  pelvis: { layer: 'bone', system: 'skeletal', color: '#efe4c8' },
  limbBones: { layer: 'bone', system: 'skeletal', color: '#efe4c8' },
  brain: { layer: 'organ', system: 'nervous', color: '#ff9fb5', explode: [0, 0.19, 0.05], cut: true },
  spinalCord: { layer: 'organ', system: 'nervous', color: '#ffc94d', explode: [0, 0, -0.2] },
  trachea: { layer: 'organ', system: 'respiratory', color: '#8fd0f2', explode: [0, 0.1, 0.14], demo: 'lungs' },
  lungs: { layer: 'organ', system: 'respiratory', color: '#ffa8b6', explode: [0.22, 0.14, 0.05], cut: true, demo: 'lungs' },
  diaphragm: { layer: 'organ', system: 'respiratory', color: '#e8857a', explode: [0, 0.03, 0.15], demo: 'lungs', faint: true },
  heart: { layer: 'organ', system: 'circulatory', color: '#ff4f66', explode: [0, 0.03, 0.26], cut: true, demo: 'heart' },
  vessels: { layer: 'organ', system: 'circulatory', color: '#ff4757', explode: [0, 0, -0.06], demo: 'heart' },
  esophagus: { layer: 'organ', system: 'digestive', color: '#ffb38a', explode: [0, 0, 0.07], demo: 'food' },
  stomach: { layer: 'organ', system: 'digestive', color: '#ffa064', explode: [0.26, -0.02, 0.1], cut: true, demo: 'food' },
  liver: { layer: 'organ', system: 'digestive', color: '#c4524a', explode: [-0.27, -0.02, 0.1] },
  gallbladder: { layer: 'organ', system: 'digestive', color: '#6cc46a', explode: [-0.27, -0.08, 0.15] },
  pancreas: { layer: 'organ', system: 'digestive', color: '#ffcf7a', explode: [0, -0.04, 0.22] },
  spleen: { layer: 'organ', system: 'circulatory', color: '#a8506e', explode: [0.36, 0.04, 0.06] },
  smallIntestine: { layer: 'organ', system: 'digestive', color: '#ffb3a0', explode: [0, -0.1, 0.24], demo: 'food' },
  largeIntestine: { layer: 'organ', system: 'digestive', color: '#e0a04e', explode: [0, -0.3, 0.02], demo: 'food' },
  kidneys: { layer: 'organ', system: 'urinary', color: '#b94a73', explode: [0.22, -0.2, -0.02] },
  bladder: { layer: 'organ', system: 'urinary', color: '#ffd24d', explode: [0, -0.46, 0.12] },
}

export const PART_IDS = Object.keys(PARTS) as PartId[]
export const ORGAN_IDS = PART_IDS.filter((id) => PARTS[id].layer === 'organ')

/** 器官卡片里的排列：常见的大器官在前 */
export const PART_ORDER: PartId[] = [
  'brain', 'heart', 'lungs', 'stomach', 'liver', 'smallIntestine', 'largeIntestine', 'kidneys',
  'bladder', 'trachea', 'esophagus', 'diaphragm', 'pancreas', 'gallbladder', 'spleen', 'spinalCord',
  'vessels', 'skull', 'ribcage', 'spine', 'pelvis', 'limbBones', 'muscle', 'skin',
]

// ---- 位置（代码生成的模型按这些摆，模型文件也要大致对上） ----

export const ANCHORS = {
  head: [0, 0.8, 0] as Vec3,
  mouth: [0, 0.735, 0.11] as Vec3,
  brain: [0, 0.83, -0.005] as Vec3,
  heart: [0.02, 0.3, 0.04] as Vec3,
  lungL: [0.078, 0.36, -0.005] as Vec3,
  lungR: [-0.078, 0.36, -0.005] as Vec3,
  diaphragm: [0, 0.18, -0.005] as Vec3,
  liver: [-0.045, 0.17, 0.025] as Vec3,
  gallbladder: [-0.055, 0.115, 0.07] as Vec3,
  spleen: [0.1, 0.16, -0.045] as Vec3,
  kidneyL: [0.07, 0.085, -0.065] as Vec3,
  kidneyR: [-0.07, 0.085, -0.065] as Vec3,
  bladder: [0, -0.2, 0.045] as Vec3,
  anus: [0, -0.262, -0.05] as Vec3,
}

/** 镜头默认看向的点和全身的大致半径 */
export const BODY_CENTER: Vec3 = [0, -0.01, 0]
export const BODY_RADIUS = 0.98
/** 全身的半宽、半高，镜头按它取景 */
export const BODY_HALF: [number, number] = [0.34, 0.96]

// ---- 消化道：食物旅行沿着走，代码生成的食道、胃、小肠、大肠也沿着它做管子 ----

export const PHARYNX: Vec3[] = [ANCHORS.mouth, [0, 0.72, 0.07], [0, 0.705, 0.03], [0, 0.69, 0.01]]

export const ESOPHAGUS: Vec3[] = [
  [0, 0.69, 0.01],
  [0, 0.6, 0],
  [0, 0.45, -0.02],
  [0.005, 0.32, -0.03],
  [0.015, 0.24, -0.015],
  [0.035, 0.2, 0],
]

export const STOMACH: Vec3[] = [
  [0.035, 0.2, 0],
  [0.07, 0.19, 0.02],
  [0.095, 0.15, 0.035],
  [0.085, 0.1, 0.045],
  [0.05, 0.075, 0.05],
  [0.01, 0.08, 0.05],
  [-0.02, 0.1, 0.04],
]

/** 胃从入口到出口的粗细：中间鼓起来像口袋 */
export function stomachRadius(u: number) {
  return 0.014 + 0.028 * Math.pow(Math.sin(Math.PI * u), 0.6) * (1 - 0.25 * u)
}

/** 小肠：十二指肠绕一个 C 形，然后在肚子中间来回盘六层。 */
function smallIntestinePath(): Vec3[] {
  const points: Vec3[] = [
    [-0.02, 0.1, 0.04],
    [-0.045, 0.085, 0.02],
    [-0.05, 0.05, 0.005],
    [-0.02, 0.035, 0],
    [0.03, 0.04, 0.01],
    [0.065, 0.022, 0.03],
  ]
  const rows = 6
  for (let row = 0; row < rows; row += 1) {
    const y0 = 0.002 - row * 0.026
    const leftward = row % 2 === 0
    for (let k = 1; k <= 8; k += 1) {
      const f = k / 8
      const x = leftward ? 0.065 - 0.13 * f : -0.065 + 0.13 * f
      points.push([x, y0 + 0.008 * Math.sin(f * Math.PI * 3 + row), 0.035 + 0.018 * Math.sin(f * Math.PI * 2 + row * 1.3)])
    }
  }
  points.push([-0.078, -0.14, 0.03], [-0.092, -0.135, 0.03])
  return points
}

export const SMALL_INTESTINE = smallIntestinePath()

export const LARGE_INTESTINE: Vec3[] = [
  [-0.092, -0.135, 0.03],
  [-0.1, -0.1, 0.03],
  [-0.107, 0, 0.03],
  [-0.1, 0.045, 0.035],
  [-0.07, 0.035, 0.058],
  [0, 0.02, 0.064],
  [0.07, 0.035, 0.058],
  [0.105, 0.06, 0.03],
  [0.112, 0, 0.02],
  [0.108, -0.09, 0.02],
  [0.08, -0.15, 0.03],
  [0.03, -0.16, 0.01],
  [0.005, -0.19, -0.035],
  ANCHORS.anus,
]

export const APPENDIX: Vec3[] = [[-0.1, -0.13, 0.028], [-0.098, -0.16, 0.03], [-0.085, -0.185, 0.032]]

/** 食物旅行的六站，points 为空的一站停在原地 */
export type FoodStage = 'mouth' | 'esophagus' | 'stomach' | 'small' | 'large' | 'out'
export const FOOD_STAGES: FoodStage[] = ['mouth', 'esophagus', 'stomach', 'small', 'large', 'out']
export const FOOD_STAGE_PART: Record<FoodStage, PartId | null> = {
  mouth: null,
  esophagus: 'esophagus',
  stomach: 'stomach',
  small: 'smallIntestine',
  large: 'largeIntestine',
  out: 'largeIntestine',
}
/** 每一站演示几秒 */
export const FOOD_SECONDS: Record<FoodStage, number> = { mouth: 3.5, esophagus: 3, stomach: 5.5, small: 7, large: 6, out: 2.5 }

// ---- 呼吸道 ----

export const TRACHEA: Vec3[] = [[0, 0.665, 0.035], [0, 0.56, 0.032], [0, 0.46, 0.025]]
export const BRONCHI: Vec3[][] = [
  [[0, 0.46, 0.025], [0.04, 0.425, 0.012], [0.07, 0.385, 0]],
  [[0, 0.46, 0.025], [-0.04, 0.425, 0.012], [-0.07, 0.385, 0]],
]
/** 空气从鼻子进来，经过气管分到左右肺 */
export const AIRWAY: Vec3[] = [[0, 0.77, 0.13], [0, 0.735, 0.1], [0, 0.7, 0.05], ...TRACHEA.slice(0, 2), TRACHEA[2]]

/** 肺的大小（半径），用来在肺里撒氧气点、做支气管树 */
export const LUNG_RADII: Vec3 = [0.076, 0.15, 0.09]

// ---- 血管和血液循环 ----

export type Vessel = { points: Vec3[]; radius: number; kind: 'artery' | 'vein' }

const AORTA: Vec3[] = [
  [0.015, 0.335, 0.04],
  [0.008, 0.385, 0.035],
  [0.015, 0.425, 0.012],
  [0.032, 0.42, -0.03],
  [0.03, 0.375, -0.062],
  [0.02, 0.2, -0.065],
  [0.01, 0, -0.06],
  [0, -0.12, -0.045],
]
const IVC: Vec3[] = [[-0.02, -0.12, -0.04], [-0.025, 0.1, -0.045], [-0.022, 0.24, 0.005], [-0.008, 0.285, 0.03]]
const SVC: Vec3[] = [[-0.03, 0.5, 0.015], [-0.022, 0.42, 0.022], [-0.012, 0.33, 0.03]]

export const VESSELS: Vessel[] = [
  { points: AORTA, radius: 0.0105, kind: 'artery' },
  { points: IVC, radius: 0.0095, kind: 'vein' },
  { points: SVC, radius: 0.008, kind: 'vein' },
  { points: [[0.015, 0.425, 0.012], [0.028, 0.55, 0.01], [0.035, 0.68, 0.0]], radius: 0.005, kind: 'artery' },
  { points: [[0.008, 0.425, 0.014], [-0.025, 0.55, 0.01], [-0.035, 0.68, 0.0]], radius: 0.005, kind: 'artery' },
  { points: [[-0.03, 0.5, 0.015], [-0.045, 0.6, 0.02], [-0.05, 0.68, 0.01]], radius: 0.004, kind: 'vein' },
  { points: [[0, -0.12, -0.045], [0.06, -0.22, 0.0], [0.09, -0.5, 0.012], [0.098, -0.84, -0.005]], radius: 0.0042, kind: 'artery' },
  { points: [[0, -0.12, -0.045], [-0.06, -0.22, 0.0], [-0.09, -0.5, 0.012], [-0.098, -0.84, -0.005]], radius: 0.0042, kind: 'artery' },
  { points: [[-0.02, -0.12, -0.04], [0.045, -0.23, -0.012], [0.078, -0.5, -0.01], [0.09, -0.84, -0.02]], radius: 0.004, kind: 'vein' },
  { points: [[-0.02, -0.12, -0.04], [-0.07, -0.23, -0.012], [-0.1, -0.5, -0.01], [-0.106, -0.84, -0.02]], radius: 0.004, kind: 'vein' },
  { points: [[0.012, 0.33, 0.06], [0.0, 0.37, 0.05], [0.05, 0.38, 0.012]], radius: 0.007, kind: 'vein' },
  { points: [[0.0, 0.37, 0.05], [-0.05, 0.38, 0.012]], radius: 0.006, kind: 'vein' },
]

/**
 * 心跳演示里血液走的几条环路。split 之前是从心脏出发的一段，之后是回心脏的一段，
 * 去全身的路上带着氧气画成红色，回来画成蓝色；去肺的路上反过来。
 */
export type BloodLoop = { points: Vec3[]; split: number; out: 'red' | 'blue'; share: number }

export const BLOOD_LOOPS: BloodLoop[] = [
  {
    // 心脏 → 主动脉 → 往下到腿 → 静脉回到心脏
    points: [
      [0.02, 0.3, 0.04], [0.008, 0.385, 0.035], [0.015, 0.425, 0.012], [0.032, 0.42, -0.03], [0.03, 0.375, -0.062],
      [0.02, 0.2, -0.065], [0.01, 0, -0.06], [0, -0.12, -0.045], [0.06, -0.22, 0], [0.09, -0.5, 0.012], [0.098, -0.82, 0],
      [0.09, -0.84, -0.02], [0.078, -0.5, -0.01], [0.045, -0.23, -0.012], [-0.02, -0.12, -0.04], [-0.025, 0.1, -0.045],
      [-0.022, 0.24, 0.005], [-0.008, 0.285, 0.03],
    ],
    split: 0.5,
    out: 'red',
    share: 0.36,
  },
  {
    points: [
      [0.02, 0.3, 0.04], [0.008, 0.385, 0.035], [0.015, 0.425, 0.012], [0.032, 0.42, -0.03], [0.03, 0.375, -0.062],
      [0.02, 0.2, -0.065], [0.01, 0, -0.06], [0, -0.12, -0.045], [-0.06, -0.22, 0], [-0.09, -0.5, 0.012],
      [-0.098, -0.82, 0], [-0.106, -0.84, -0.02], [-0.1, -0.5, -0.01], [-0.07, -0.23, -0.012], [-0.02, -0.12, -0.04],
      [-0.025, 0.1, -0.045], [-0.022, 0.24, 0.005], [-0.008, 0.285, 0.03],
    ],
    split: 0.5,
    out: 'red',
    share: 0.2,
  },
  {
    // 心脏 → 颈动脉 → 大脑 → 颈静脉 → 回心脏
    points: [
      [0.02, 0.3, 0.04], [0.008, 0.385, 0.035], [0.015, 0.425, 0.012], [0.028, 0.55, 0.01], [0.035, 0.7, 0], [0.03, 0.8, -0.01],
      [0, 0.86, -0.02], [-0.035, 0.8, -0.01], [-0.045, 0.66, 0.015], [-0.03, 0.5, 0.015], [-0.022, 0.42, 0.022], [-0.008, 0.31, 0.032],
    ],
    split: 0.5,
    out: 'red',
    share: 0.18,
  },
  {
    // 心脏 → 肺动脉 → 左肺 → 肺静脉 → 回心脏
    points: [[0.012, 0.32, 0.06], [0.0, 0.37, 0.05], [0.05, 0.38, 0.012], [0.09, 0.4, 0], [0.105, 0.32, -0.01], [0.075, 0.28, 0.01], [0.035, 0.29, 0.03]],
    split: 0.5,
    out: 'blue',
    share: 0.13,
  },
  {
    points: [[0.005, 0.32, 0.06], [0.0, 0.37, 0.05], [-0.05, 0.38, 0.012], [-0.09, 0.4, 0], [-0.105, 0.32, -0.01], [-0.075, 0.28, 0.01], [-0.01, 0.29, 0.035]],
    split: 0.5,
    out: 'blue',
    share: 0.13,
  },
]

// ---- 演示路线：模型文件自带一份（从真实网格算出来），没有时用上面这些 ----

export type LungRoute = {
  center: Vec3
  /** 肺的半径，没有 samples 时在这个椭球里撒氧气点 */
  radii: Vec3
  /** 从气管分叉处到肺中间 */
  bronchus: Vec3[]
  /** 肺里面的点，有就直接用 */
  samples?: Vec3[]
}

export type BodyRoutes = {
  /** 镜头默认看向的点、全身的半宽半高、大致半径 */
  center: Vec3
  half: [number, number]
  radius: number
  heart: Vec3
  mouth: Vec3
  anus: Vec3
  /** 食物旅行：嘴到胃的入口、胃里、小肠、大肠、排出 */
  swallow: Vec3[]
  stomach: Vec3[]
  /** 胃从入口到出口等距取的几处半径 */
  stomachRadius: number[]
  small: Vec3[]
  large: Vec3[]
  out: Vec3[]
  /** 鼻子到气管分叉处 */
  airway: Vec3[]
  lungs: LungRoute[]
  blood: BloodLoop[]
}

export const DEFAULT_ROUTES: BodyRoutes = {
  center: BODY_CENTER,
  half: BODY_HALF,
  radius: BODY_RADIUS,
  heart: ANCHORS.heart,
  mouth: ANCHORS.mouth,
  anus: ANCHORS.anus,
  swallow: [...PHARYNX, ...ESOPHAGUS.slice(1)],
  stomach: STOMACH,
  stomachRadius: Array.from({ length: 13 }, (_, i) => stomachRadius(i / 12)),
  small: SMALL_INTESTINE,
  large: LARGE_INTESTINE.slice(0, 12),
  out: LARGE_INTESTINE.slice(11),
  airway: AIRWAY,
  lungs: [
    { center: ANCHORS.lungL, radii: LUNG_RADII, bronchus: BRONCHI[0] },
    { center: ANCHORS.lungR, radii: LUNG_RADII, bronchus: BRONCHI[1] },
  ],
  blood: BLOOD_LOOPS,
}
