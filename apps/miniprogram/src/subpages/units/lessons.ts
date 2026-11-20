/**
 * 「单位换算」探索页的内容：每种量的刻度、生活里的参照物、单位家族的进率和引导。
 * 参照物只取「大约」的量，讲解文字原创编写。中英文写在一起，页面按语言取，不走 i18n 词表。
 */
import type { ArtId } from './art'
import type { Category, Text, UnitId } from './units'

export type Mode = Category

// ---- 长度：卷尺 ----

export type LengthObject = { art: ArtId; name: Text; /** 刻度格数 */ ticks: number }
export type LengthScale = {
  id: string
  big: UnitId
  small: UnitId
  /** 尺子上有几个大单位，每个大单位分 10 格 */
  count: number
  /** 一格是几个小单位 */
  step: number
  objects: LengthObject[]
  feel: Text
}

export const LENGTH_SCALES: LengthScale[] = [
  {
    id: 'cm-mm', big: 'cm', small: 'mm', count: 5, step: 1,
    objects: [
      { art: 'ant', name: { zh: '蚂蚁', en: 'Ant' }, ticks: 5 },
      { art: 'clip', name: { zh: '回形针', en: 'Paper clip' }, ticks: 30 },
      { art: 'eraser', name: { zh: '橡皮', en: 'Eraser' }, ticks: 42 },
    ],
    feel: { zh: '1 厘米大约是指甲盖的宽，1 毫米大约是 10 张纸叠起来那么厚。', en: '1 cm is about the width of a fingernail. 1 mm is about as thick as 10 sheets of paper.' },
  },
  {
    id: 'dm-cm', big: 'dm', small: 'cm', count: 5, step: 1,
    objects: [
      { art: 'pencil', name: { zh: '铅笔', en: 'Pencil' }, ticks: 17 },
      { art: 'chopsticks', name: { zh: '筷子', en: 'Chopsticks' }, ticks: 24 },
      { art: 'book', name: { zh: '数学书', en: 'Maths book' }, ticks: 26 },
    ],
    feel: { zh: '1 分米大约是一根粉笔那么长，10 个 1 厘米接起来就是 1 分米。', en: '1 dm is about as long as a stick of chalk: 10 lots of 1 cm.' },
  },
  {
    id: 'm-dm', big: 'm', small: 'dm', count: 3, step: 1,
    objects: [
      { art: 'desk', name: { zh: '课桌高', en: 'Desk height' }, ticks: 7 },
      { art: 'kid', name: { zh: '小朋友身高', en: 'A child' }, ticks: 13 },
      { art: 'door', name: { zh: '门高', en: 'Door height' }, ticks: 20 },
    ],
    feel: { zh: '小朋友张开双臂，大约就是 1 米。1 米 = 10 分米 = 100 厘米。', en: 'Stretch your arms wide: that is about 1 m. 1 m = 10 dm = 100 cm.' },
  },
  {
    id: 'km-m', big: 'km', small: 'm', count: 3, step: 100,
    objects: [
      { art: 'track', name: { zh: '操场一圈', en: 'One lap' }, ticks: 4 },
      { art: 'school', name: { zh: '家到学校', en: 'Home to school' }, ticks: 12 },
      { art: 'bridge', name: { zh: '一座大桥', en: 'A long bridge' }, ticks: 25 },
    ],
    feel: { zh: '绕 400 米的操场跑 2 圈半，就是 1 千米，大约要走 15 分钟。', en: 'Two and a half laps of a 400 m track make 1 km, about a 15-minute walk.' },
  },
]

// ---- 重量：天平 ----

export type MassObject = { art: ArtId; name: Text; /** 用这一档的小单位计 */ weight: number }
export type MassScale = { id: string; big: UnitId; small: UnitId; weights: number[]; objects: MassObject[]; feel: Text }

export const MASS_SCALES: MassScale[] = [
  {
    id: 'kg-g', big: 'kg', small: 'g',
    weights: [1000, 500, 200, 100, 50, 20, 10],
    objects: [
      { art: 'egg', name: { zh: '鸡蛋', en: 'Egg' }, weight: 50 },
      { art: 'apple', name: { zh: '苹果', en: 'Apple' }, weight: 250 },
      { art: 'salt', name: { zh: '一袋盐', en: 'Bag of salt' }, weight: 500 },
      { art: 'flour', name: { zh: '一袋面粉', en: 'Bag of flour' }, weight: 1000 },
      { art: 'melon', name: { zh: '西瓜', en: 'Watermelon' }, weight: 3200 },
    ],
    feel: { zh: '2 个鸡蛋大约 100 克，一袋盐 500 克，两袋盐就是 1 千克。', en: '2 eggs weigh about 100 g. A bag of salt is 500 g, so two bags make 1 kg.' },
  },
  {
    id: 't-kg', big: 't', small: 'kg',
    weights: [1000, 500, 200, 100, 50],
    objects: [
      { art: 'bear', name: { zh: '棕熊', en: 'Brown bear' }, weight: 300 },
      { art: 'cow', name: { zh: '奶牛', en: 'Cow' }, weight: 600 },
      { art: 'car', name: { zh: '小汽车', en: 'Car' }, weight: 1500 },
      { art: 'elephant', name: { zh: '大象', en: 'Elephant' }, weight: 4000 },
    ],
    feel: { zh: '一个小朋友大约 25 千克，40 个小朋友加起来大约 1 吨。', en: 'A child weighs about 25 kg. 40 children together weigh about 1 t.' },
  },
]

// ---- 面积：铺方格 ----

export type AreaScale = {
  id: string
  big: UnitId
  small: UnitId
  /** 一格是几个小单位 */
  cell: number
  edge: Text
  cellText: Text
  feel: Text
}

export const AREA_SCALES: AreaScale[] = [
  {
    id: 'dm2-cm2', big: 'dm2', small: 'cm2', cell: 1,
    edge: { zh: '1 分米 = 10 厘米', en: '1 dm = 10 cm' },
    cellText: { zh: '每格边长 1 厘米，是 1 平方厘米', en: 'Each square is 1 cm wide: 1 cm²' },
    feel: { zh: '1 平方厘米大约是指甲盖那么大，1 平方分米大约是一个手掌那么大。', en: '1 cm² is about the size of a fingernail. 1 dm² is about the size of your palm.' },
  },
  {
    id: 'm2-dm2', big: 'm2', small: 'dm2', cell: 1,
    edge: { zh: '1 米 = 10 分米', en: '1 m = 10 dm' },
    cellText: { zh: '每格边长 1 分米，是 1 平方分米', en: 'Each square is 1 dm wide: 1 dm²' },
    feel: { zh: '边长 1 米的正方形是 1 平方米，大约能站下 9 个小朋友。', en: 'A square 1 m on each side is 1 m². About 9 children can stand on it.' },
  },
  {
    id: 'ha-m2', big: 'ha', small: 'm2', cell: 100,
    edge: { zh: '100 米 = 10 个 10 米', en: '100 m = 10 × 10 m' },
    cellText: { zh: '每格边长 10 米，是 100 平方米', en: 'Each square is 10 m wide: 100 m²' },
    feel: { zh: '边长 100 米的正方形是 1 公顷，比一个标准足球场还大一些。', en: 'A square 100 m on each side is 1 hectare, a bit bigger than a football pitch.' },
  },
  {
    id: 'km2-ha', big: 'km2', small: 'ha', cell: 1,
    edge: { zh: '1 千米 = 10 个 100 米', en: '1 km = 10 × 100 m' },
    cellText: { zh: '每格边长 100 米，是 1 公顷', en: 'Each square is 100 m wide: 1 ha' },
    feel: { zh: '边长 1 千米的正方形是 1 平方千米，大约有 140 个足球场那么大。', en: 'A square 1 km on each side is 1 km², about 140 football pitches.' },
  },
]

// ---- 容积：倒水和搭方块 ----

export type Pour = { art: ArtId; name: Text; ml: number }
export const POURS: Pour[] = [
  { art: 'cup', name: { zh: '一杯水', en: 'A cup' }, ml: 200 },
  { art: 'milk', name: { zh: '一盒牛奶', en: 'Milk carton' }, ml: 250 },
  { art: 'bottle', name: { zh: '一瓶水', en: 'A bottle' }, ml: 500 },
]
export const JUGS = 2

export type VolumeScale = { id: string; big: UnitId; small: UnitId; kind: 'jug' | 'cube'; feel: Text }
export const VOLUME_SCALES: VolumeScale[] = [
  { id: 'l-ml', big: 'l', small: 'ml', kind: 'jug', feel: { zh: '一瓶矿泉水大约 500 毫升，两瓶就是 1 升。', en: 'A bottle of water is about 500 mL. Two bottles make 1 L.' } },
  { id: 'dm3-cm3', big: 'dm3', small: 'cm3', kind: 'cube', feel: { zh: '棱长 1 分米的正方体盒子正好装 1 升水，所以 1 立方分米 = 1 升，1 立方厘米 = 1 毫升。', en: 'A box 1 dm on each edge holds exactly 1 L of water, so 1 dm³ = 1 L and 1 cm³ = 1 mL.' } },
  { id: 'm3-dm3', big: 'm3', small: 'dm3', kind: 'cube', feel: { zh: '棱长 1 米的正方体是 1 立方米，里面能摆 1000 个 1 立方分米的小盒子。', en: 'A cube 1 m on each edge is 1 m³. It fits 1000 boxes of 1 dm³.' } },
]

// ---- 单位家族 ----

export type Rung = { unit: UnitId; /** 和下一个（更小的）单位的进率 */ rate?: number; also?: UnitId }
export const LADDERS: Record<Category, Rung[]> = {
  length: [{ unit: 'km', rate: 1000 }, { unit: 'm', rate: 10 }, { unit: 'dm', rate: 10 }, { unit: 'cm', rate: 10 }, { unit: 'mm' }],
  mass: [{ unit: 't', rate: 1000 }, { unit: 'kg', rate: 1000 }, { unit: 'g' }],
  area: [{ unit: 'km2', rate: 100 }, { unit: 'ha', rate: 10000 }, { unit: 'm2', rate: 100 }, { unit: 'dm2', rate: 100 }, { unit: 'cm2' }],
  volume: [{ unit: 'm3', rate: 1000 }, { unit: 'dm3', rate: 1000, also: 'l' }, { unit: 'cm3', also: 'ml' }],
}

export const LADDER_TIPS: Record<Category, Text> = {
  length: { zh: '毫米、厘米、分米、米，相邻两个的进率都是 10；米和千米的进率是 1000。', en: 'mm, cm, dm and m: each is 10 times the one before. 1 km is 1000 m.' },
  mass: { zh: '吨、千克、克，相邻两个的进率都是 1000。课本上把「重量」叫做「质量」。', en: 't, kg and g: each is 1000 times the one after.' },
  area: { zh: '边长的进率是 10，面积的进率就是 10 × 10 = 100。', en: 'When the side grows 10 times, the area grows 10 × 10 = 100 times.' },
  volume: { zh: '棱长的进率是 10，体积的进率就是 10 × 10 × 10 = 1000。1 立方分米 = 1 升。', en: 'When the edge grows 10 times, the volume grows 10 × 10 × 10 = 1000 times. 1 dm³ = 1 L.' },
}

// ---- 填单位的题库 ----

export type UnitFact = { text: Text; value: number; unit: UnitId; level: 'easy' | 'medium' | 'hard' }

export const UNIT_FACTS: UnitFact[] = [
  { text: { zh: '一支铅笔长约', en: 'A pencil is about' }, value: 18, unit: 'cm', level: 'easy' },
  { text: { zh: '1 元硬币厚约', en: 'A coin is about' }, value: 2, unit: 'mm', level: 'easy' },
  { text: { zh: '课桌高约', en: 'A desk is about' }, value: 7, unit: 'dm', level: 'easy' },
  { text: { zh: '黑板长约', en: 'The blackboard is about' }, value: 4, unit: 'm', level: 'easy' },
  { text: { zh: '小明身高约', en: 'Tom is about' }, value: 130, unit: 'cm', level: 'easy' },
  { text: { zh: '一层楼高约', en: 'One storey is about' }, value: 3, unit: 'm', level: 'easy' },
  { text: { zh: '一只蚂蚁长约', en: 'An ant is about' }, value: 5, unit: 'mm', level: 'easy' },
  { text: { zh: '两个城市相距约', en: 'Two cities are about' }, value: 150, unit: 'km', level: 'easy' },
  { text: { zh: '一个鸡蛋重约', en: 'An egg weighs about' }, value: 50, unit: 'g', level: 'easy' },
  { text: { zh: '一个苹果重约', en: 'An apple weighs about' }, value: 200, unit: 'g', level: 'easy' },
  { text: { zh: '一袋大米重', en: 'A bag of rice weighs' }, value: 10, unit: 'kg', level: 'easy' },
  { text: { zh: '小朋友体重约', en: 'A child weighs about' }, value: 25, unit: 'kg', level: 'easy' },
  { text: { zh: '一头大象重约', en: 'An elephant weighs about' }, value: 5, unit: 't', level: 'medium' },
  { text: { zh: '一辆货车能装', en: 'A lorry can carry' }, value: 8, unit: 't', level: 'medium' },
  { text: { zh: '一枚邮票的面积约', en: 'A stamp covers about' }, value: 6, unit: 'cm2', level: 'medium' },
  { text: { zh: '课桌面的面积约', en: 'A desktop covers about' }, value: 24, unit: 'dm2', level: 'medium' },
  { text: { zh: '教室的面积约', en: 'A classroom covers about' }, value: 60, unit: 'm2', level: 'medium' },
  { text: { zh: '指甲盖的面积约', en: 'A fingernail covers about' }, value: 1, unit: 'cm2', level: 'medium' },
  { text: { zh: '一瓶矿泉水约', en: 'A bottle of water holds about' }, value: 550, unit: 'ml', level: 'medium' },
  { text: { zh: '一桶食用油约', en: 'A can of cooking oil holds about' }, value: 5, unit: 'l', level: 'medium' },
  { text: { zh: '一盒牛奶约', en: 'A carton of milk holds about' }, value: 250, unit: 'ml', level: 'medium' },
  { text: { zh: '一个浴缸能装水约', en: 'A bathtub holds about' }, value: 200, unit: 'l', level: 'medium' },
  { text: { zh: '一个大公园的面积约', en: 'A big park covers about' }, value: 50, unit: 'ha', level: 'hard' },
  { text: { zh: '一个县的面积约', en: 'A county covers about' }, value: 2000, unit: 'km2', level: 'hard' },
  { text: { zh: '足球场的面积约', en: 'A football pitch covers about' }, value: 7000, unit: 'm2', level: 'hard' },
  { text: { zh: '一块橡皮的体积约', en: 'An eraser takes up about' }, value: 8, unit: 'cm3', level: 'hard' },
  { text: { zh: '一个粉笔盒的体积约', en: 'A chalk box takes up about' }, value: 1, unit: 'dm3', level: 'hard' },
  { text: { zh: '一个衣柜的体积约', en: 'A wardrobe takes up about' }, value: 2, unit: 'm3', level: 'hard' },
]

// ---- 首次进入每个模式的引导 ----

export type GuideAction = 'drag' | 'object' | 'zoom' | 'weight' | 'balance' | 'paint' | 'fill' | 'pour' | 'layer' | 'scale'
export type GuideStep = { target: string; title: Text; text: Text; action?: GuideAction; done?: Text }

const SCALE_STEP = (text: Text): GuideStep => ({
  target: 'guide-scales',
  title: { zh: '换一组单位', en: 'Switch units' },
  text,
  action: 'scale',
  done: { zh: '换好了，刻度也跟着变了。', en: 'Switched. The scale changed too.' },
})

const LADDER_STEP: GuideStep = {
  target: 'guide-ladder',
  title: { zh: '单位家族', en: 'The unit family' },
  text: { zh: '从大到小排好，箭头上写着相邻两个单位的进率。点一个单位也能切过去。', en: 'Units from big to small. The arrows show how many of the smaller unit make one bigger unit.' },
}

const QUIZ_STEP: GuideStep = {
  target: 'guide-quiz',
  title: { zh: '来小测验吧', en: 'Take the quiz' },
  text: { zh: '学会以后点这里测一测，也可以打印练习题。右上角的「?」能再看一遍引导。', en: 'When you are ready, tap here to test yourself, or print a worksheet. The “?” replays this guide.' },
}

export const GUIDES: Record<Mode, GuideStep[]> = {
  length: [
    {
      target: 'guide-ruler',
      title: { zh: '拉一拉卷尺', en: 'Pull the tape' },
      text: { zh: '按住尺子往右拖，橙色的卷尺跟着拉出来，下面会读出有多长。', en: 'Press on the ruler and drag right. The orange tape follows and shows the length.' },
      action: 'drag',
      done: { zh: '看，同一个长度能用两种单位说。', en: 'See? The same length in two units.' },
    },
    {
      target: 'guide-objects',
      title: { zh: '量一量东西', en: 'Measure things' },
      text: { zh: '点一个东西，卷尺会拉到它的长度。', en: 'Tap an object and the tape stretches to its length.' },
      action: 'object',
    },
    {
      target: 'guide-zoom',
      title: { zh: '放大看一看', en: 'Zoom in' },
      text: { zh: '点「数一数」，看 1 个大单位里藏着几个小单位。', en: 'Tap “Count” to see how many small units fit in one big unit.' },
      action: 'zoom',
      done: { zh: '数出来了，这就是进率。', en: 'That number is the conversion rate.' },
    },
    SCALE_STEP({ zh: '毫米和厘米、厘米和分米、分米和米、米和千米，点一组试试。', en: 'Try mm & cm, cm & dm, dm & m, or m & km.' }),
    LADDER_STEP,
    QUIZ_STEP,
  ],
  mass: [
    {
      target: 'guide-weights',
      title: { zh: '放砝码', en: 'Add weights' },
      text: { zh: '左边放着要称的东西。点下面的砝码，它会落到右边的盘子里。', en: 'The thing to weigh is on the left. Tap a weight below to drop it on the right pan.' },
      action: 'weight',
      done: { zh: '天平动了，哪边重哪边就往下沉。', en: 'The heavier side sinks down.' },
    },
    {
      target: 'guide-balance',
      title: { zh: '让天平平衡', en: 'Balance it' },
      text: { zh: '继续加砝码；放多了就点盘子里的砝码拿下来。横梁平了，就知道它有多重。', en: 'Keep adding. Too many? Tap a weight on the pan to take it off. When the beam is level you know the weight.' },
      action: 'balance',
      done: { zh: '平衡啦！看看它有多重。', en: 'Balanced! Now you know its weight.' },
    },
    {
      target: 'guide-objects',
      title: { zh: '换一个东西称', en: 'Weigh something else' },
      text: { zh: '试试一袋面粉：它和几个 500 克一样重？', en: 'Try the bag of flour: how many 500 g weights balance it?' },
    },
    SCALE_STEP({ zh: '「千克·吨」那一组可以称奶牛、小汽车和大象。', en: 'The kg & t set weighs a cow, a car and an elephant.' }),
    LADDER_STEP,
    QUIZ_STEP,
  ],
  area: [
    {
      target: 'guide-grid',
      title: { zh: '用手指铺一铺', en: 'Tile with your finger' },
      text: { zh: '在方格上按住拖动，一格一格铺上颜色，上面会数出铺了多少。', en: 'Press and drag across the grid to colour squares. The count shows above.' },
      action: 'paint',
      done: { zh: '铺了几格，面积就是几个小单位。', en: 'The number of squares is the area in the small unit.' },
    },
    {
      target: 'guide-fill',
      title: { zh: '一行一行铺满', en: 'Fill row by row' },
      text: { zh: '点这里，看 10 行、每行 10 格，一共 100 格把大正方形铺满。', en: 'Tap here: 10 rows of 10 squares, 100 in all, fill the big square.' },
      action: 'fill',
      done: { zh: '100 个小正方形正好拼成 1 个大正方形。', en: '100 small squares make 1 big square.' },
    },
    SCALE_STEP({ zh: '平方米和公顷、公顷和平方千米也一样能铺。', en: 'm² & ha and ha & km² tile the same way.' }),
    LADDER_STEP,
    QUIZ_STEP,
  ],
  volume: [
    {
      target: 'guide-pours',
      title: { zh: '倒水', en: 'Pour water' },
      text: { zh: '点一杯水、一盒牛奶或一瓶水，倒进量杯里。', en: 'Tap a cup, a milk carton or a bottle to pour it into the jug.' },
      action: 'pour',
      done: { zh: '水面升高了，看看刻度。', en: 'The water rose. Check the marks.' },
    },
    {
      target: 'guide-jugs',
      title: { zh: '倒满 1 升', en: 'Fill up 1 litre' },
      text: { zh: '一个量杯正好装 1 升，也就是 1000 毫升。倒满了会接着倒进第二个。', en: 'One jug holds exactly 1 L, which is 1000 mL. Extra water goes into the second jug.' },
    },
    SCALE_STEP({ zh: '换成立方分米，看 1000 个小方块怎么搭成 1 个大方块。', en: 'Switch to dm³ to stack 1000 small cubes into one big cube.' }),
    LADDER_STEP,
    QUIZ_STEP,
  ],
}
