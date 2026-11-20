/**
 * 「3D 几何体」的知识点，按小学数学（一年级认识图形、四年级观察物体、五年级长方体和正方体）的口径原创编写，
 * 棱柱、棱锥和正多面体作为拓展，只讲面、棱、顶点和面的形状。
 * 中英文写在一起，页面按语言取，不走 i18n 词表。
 */
import type { Text } from '../lessons'
import type { NetFamily } from './geometry'
import type { Solid } from './solids'

export { pick, type Text } from '../lessons'

/** 体积、涂色、小测验只用正方体和长方体 */
export type Shape = 'cube' | 'cuboid'
export type MarkKind = 'face' | 'edge' | 'vertex'

export type SolidInfo = {
  name: Text
  /** 归类：长方体家族、棱柱、棱锥、正多面体 */
  kind: Text
  /** 由哪些面围成 */
  faces: Text
  /** 生活里像它的东西 */
  like: Text
}

const BOX: Text = { zh: '长方体家族', en: 'Cuboid family' }
const PRISM: Text = { zh: '棱柱', en: 'Prism' }
const PYRAMID: Text = { zh: '棱锥', en: 'Pyramid' }
const PLATONIC: Text = { zh: '正多面体', en: 'Platonic solid' }

export const SOLID_INFO: Record<Solid, SolidInfo> = {
  cube: { name: { zh: '正方体', en: 'Cube' }, kind: BOX, faces: { zh: '6 个完全相同的正方形', en: '6 identical squares' }, like: { zh: '骰子、魔方', en: 'Dice, a Rubik’s cube' } },
  cuboid: { name: { zh: '长方体', en: 'Cuboid' }, kind: BOX, faces: { zh: '6 个长方形，相对的面完全相同', en: '6 rectangles, opposite faces identical' }, like: { zh: '牙膏盒、砖头', en: 'A toothpaste box, a brick' } },
  prism3: { name: { zh: '三棱柱', en: 'Triangular prism' }, kind: PRISM, faces: { zh: '2 个三角形 + 3 个长方形', en: '2 triangles + 3 rectangles' }, like: { zh: '三角形的帐篷、巧克力盒', en: 'A ridge tent, a chocolate bar box' } },
  prism5: { name: { zh: '五棱柱', en: 'Pentagonal prism' }, kind: PRISM, faces: { zh: '2 个五边形 + 5 个长方形', en: '2 pentagons + 5 rectangles' }, like: { zh: '五边形的铅笔盒', en: 'A pentagon pencil case' } },
  prism6: { name: { zh: '六棱柱', en: 'Hexagonal prism' }, kind: PRISM, faces: { zh: '2 个六边形 + 6 个长方形', en: '2 hexagons + 6 rectangles' }, like: { zh: '六角铅笔、螺母', en: 'A hexagonal pencil, a nut' } },
  pyramid: { name: { zh: '四棱锥', en: 'Square pyramid' }, kind: PYRAMID, faces: { zh: '1 个正方形 + 4 个三角形', en: '1 square + 4 triangles' }, like: { zh: '金字塔', en: 'The pyramids of Egypt' } },
  tetra: { name: { zh: '正四面体', en: 'Tetrahedron' }, kind: PLATONIC, faces: { zh: '4 个一样的正三角形', en: '4 identical equilateral triangles' }, like: { zh: '三角包装的牛奶盒', en: 'A tetra-pack milk carton' } },
  octa: { name: { zh: '正八面体', en: 'Octahedron' }, kind: PLATONIC, faces: { zh: '8 个一样的正三角形', en: '8 identical equilateral triangles' }, like: { zh: '钻石的形状、八面骰子', en: 'A diamond shape, an 8-sided die' } },
  dodeca: { name: { zh: '正十二面体', en: 'Dodecahedron' }, kind: PLATONIC, faces: { zh: '12 个一样的正五边形', en: '12 identical regular pentagons' }, like: { zh: '十二面骰子', en: 'A 12-sided die' } },
  icosa: { name: { zh: '正二十面体', en: 'Icosahedron' }, kind: PLATONIC, faces: { zh: '20 个一样的正三角形', en: '20 identical equilateral triangles' }, like: { zh: '二十面骰子', en: 'A 20-sided die' } },
}

export const EULER_TIP: Text = {
  zh: '每一种都满足：顶点 + 面 − 棱 = 2',
  en: 'Every one of them: vertices + faces − edges = 2',
}

/** 长方体和正方体比一比。 */
export const COMPARE_ROWS: Array<{ name: Text; cuboid: Text; cube: Text }> = [
  { name: { zh: '面', en: 'Faces' }, cuboid: { zh: '6 个，一般是长方形', en: '6, usually rectangles' }, cube: { zh: '6 个完全相同的正方形', en: '6 identical squares' } },
  { name: { zh: '棱', en: 'Edges' }, cuboid: { zh: '12 条，分 3 组', en: '12, in 3 groups' }, cube: { zh: '12 条都相等', en: '12, all equal' } },
  { name: { zh: '顶点', en: 'Vertices' }, cuboid: { zh: '8 个', en: '8' }, cube: { zh: '8 个', en: '8' } },
]

export const CUBE_IS_CUBOID: Text = {
  zh: '长、宽、高都相等的长方体就是正方体，正方体是特殊的长方体。',
  en: 'A cuboid whose length, width and height are all equal is a cube. A cube is a special cuboid.',
}

export const FAMILY_NAMES: Record<NetFamily, Text> = {
  '141': { zh: '1-4-1 型', en: '1-4-1' },
  '231': { zh: '2-3-1 型', en: '2-3-1' },
  '222': { zh: '2-2-2 型', en: '2-2-2' },
  '33': { zh: '3-3 型', en: '3-3' },
}

/** 展开图口诀。 */
export const NET_RHYME: Text[] = [
  { zh: '中间四个面，上下各一面', en: 'Four in a row, one above and one below' },
  { zh: '中间三个面，一二隔河见', en: 'Three in a row, then two and one on opposite banks' },
  { zh: '中间两个面，楼梯天天见', en: 'Two at a time, climbing like stairs' },
  { zh: '中间没有面，三三连一线', en: 'Two rows of three, joined in a line' },
  { zh: '整体无「田」「凹」，才能折成正方体', en: 'No 2×2 square and no U shape, or it will not fold' },
]

export const OPPOSITE_TIP: Text = {
  zh: '相对的面在展开图里不挨着：同一行隔一个，或者在「Z」字的两头。',
  en: 'Opposite faces never touch on a net: they are one apart in a line, or at the two ends of a Z.',
}

export const MEASURE_FACTS: Record<'edge' | 'area' | 'volume', Record<Shape, Text>> = {
  edge: {
    cube: { zh: '12 条棱一样长，棱长总和 = 棱长 × 12', en: '12 equal edges: total edge length = edge × 12' },
    cuboid: { zh: '长、宽、高各 4 条，棱长总和 = (长 + 宽 + 高) × 4', en: '4 of each: total edge length = (l + w + h) × 4' },
  },
  area: {
    cube: { zh: '6 个面一样大，表面积 = 棱长 × 棱长 × 6', en: '6 equal faces: surface area = edge × edge × 6' },
    cuboid: { zh: '相对的面一样大，表面积 = (长×宽 + 长×高 + 宽×高) × 2', en: 'Opposite faces match: surface area = (lw + lh + wh) × 2' },
  },
  volume: {
    cube: { zh: '体积 = 棱长 × 棱长 × 棱长，就是能摆多少个 1 立方厘米的小正方体', en: 'Volume = edge × edge × edge: how many 1 cm³ cubes fit inside' },
    cuboid: { zh: '每层摆 长 × 宽 个，摆 高 层：体积 = 长 × 宽 × 高', en: 'Each layer holds l × w cubes, stacked h layers: volume = l × w × h' },
  },
}

export const PAINT_FACTS: Text[] = [
  { zh: '三面涂色的在 8 个顶点上，永远是 8 块', en: '3 painted faces: the 8 corners, always 8' },
  { zh: '两面涂色的在 12 条棱上（去掉两头）：12 × (n − 2)', en: '2 painted faces: along the 12 edges minus the ends: 12 × (n − 2)' },
  { zh: '一面涂色的在 6 个面的中间：6 × (n − 2)²', en: '1 painted face: the middle of the 6 faces: 6 × (n − 2)²' },
  { zh: '没有涂色的藏在最里面：(n − 2)³', en: 'No paint: hidden in the core: (n − 2)³' },
]

export const MODE_HINTS: Record<'learn' | 'unfold' | 'measure' | 'paint', Text> = {
  learn: { zh: '转一转，点一点', en: 'Turn it, tap it' },
  unfold: { zh: '拖滑块展开，点面找对面', en: 'Slide to unfold, tap a face' },
  measure: { zh: '要多少个小正方体？', en: 'How many unit cubes?' },
  paint: { zh: '涂红后切开，每块涂了几面？', en: 'Painted red, then cut. How many red faces?' },
}

// ---- 首次进入每个模式的引导 ----

export type GuideAction = 'drag' | 'mark' | 'kind' | 'shape' | 'slide' | 'face' | 'step' | 'build' | 'filter' | 'block'
export type GuideStep = {
  /** 要圈出来的元素 id */
  target: string
  title: Text
  text: Text
  /** 要动手做一下才算完成；没有的点圈出来的区域或「下一步」继续 */
  action?: GuideAction
  done?: Text
}

const SHAPE_STEP: GuideStep = {
  target: 'guide-shapes',
  title: { zh: '换一个几何体', en: 'Try another shape' },
  text: { zh: '左右滑动这一排，还有棱柱、棱锥和正多面体，点一个试试。', en: 'Swipe this row for prisms, pyramids and Platonic solids. Tap one.' },
  action: 'shape',
  done: { zh: '换好了，每种几何体都可以转着看。', en: 'Done. Every shape can be turned around.' },
}

export const GUIDES: Record<'learn' | 'unfold' | 'measure' | 'paint', GuideStep[]> = {
  learn: [
    {
      target: 'cube-stage',
      title: { zh: '拖一拖，转着看', en: 'Drag to turn it' },
      text: { zh: '手指在画面上拖动，几何体跟着转；两根手指捏合可以放大缩小。', en: 'Drag on the picture to turn the shape. Pinch with two fingers to zoom.' },
      action: 'drag',
      done: { zh: '转起来了！背面也能看到。', en: 'It turns! You can see the back too.' },
    },
    {
      target: 'cube-stage',
      title: { zh: '点一点，做标记', en: 'Tap to mark' },
      text: { zh: '点一个面，它会变红并标上号码。一边转一边点，数数一共有几个面。', en: 'Tap a face: it turns red and gets a number. Turn and tap to count all the faces.' },
      action: 'mark',
      done: { zh: '标上了！再点一下可以取消。', en: 'Marked! Tap again to unmark it.' },
    },
    {
      target: 'guide-marks',
      title: { zh: '数面、数棱、数顶点', en: 'Faces, edges, vertices' },
      text: { zh: '点「棱」或「顶点」换着数。全部找到后，标签上会亮出绿色的数字。', en: 'Tap “Edges” or “Vertices” to count those. When all are found, a green number appears.' },
      action: 'kind',
      done: { zh: '换好了，点画面里的棱或顶点试试。', en: 'Switched. Now tap edges or vertices in the picture.' },
    },
    {
      target: 'guide-tools',
      title: { zh: '三个小按钮', en: 'Three little buttons' },
      text: { zh: '透视：看到背面的棱和顶点。调色盘：平行的面涂成同一种颜色。长方体还有长宽高按钮，三组棱分三种颜色。', en: 'See-through shows the back edges and vertices. The palette colours parallel faces alike. Cuboids also get a button that colours length, width and height.' },
    },
    SHAPE_STEP,
    {
      target: 'guide-modes',
      title: { zh: '还有更多玩法', en: 'More to explore' },
      text: { zh: '「展开」看几何体怎么摊成展开图，「体积」一层层搭小方块，「涂色」切开大正方体看每块涂了几面。', en: '“Unfold” flattens shapes into nets, “Volume” stacks unit cubes, and “Paint” cuts up a painted cube.' },
    },
    {
      target: 'guide-quiz',
      title: { zh: '来小测验吧', en: 'Take the quiz' },
      text: { zh: '学会以后点这里测一测，也可以打印练习题。右上角的「?」能再看一遍引导。', en: 'When you are ready, tap here to test yourself, or print a worksheet. The “?” at the top right replays this guide.' },
    },
  ],
  unfold: [
    {
      target: 'guide-fold',
      title: { zh: '拖滑块，展开它', en: 'Slide to unfold' },
      text: { zh: '往右拖慢慢摊开，往左拖再折回去；点「展开」按钮可以看动画。', en: 'Drag right to flatten it, left to fold it back. Tap the button to watch it play.' },
      action: 'slide',
      done: { zh: '看，每个面都绕着一条棱转开了。', en: 'See how each face swings open around an edge.' },
    },
    {
      target: 'cube-stage',
      title: { zh: '点一个面', en: 'Tap a face' },
      text: { zh: '点展开图上的一个面，折起来后和它相对的那个面会一起亮起来。', en: 'Tap a face on the net. The face opposite it after folding lights up too.' },
      action: 'face',
      done: { zh: '亮起来的两个面，折好后正好面对面。', en: 'The two glowing faces end up facing each other.' },
    },
    { ...SHAPE_STEP, text: { zh: '每种几何体都能展开。正方体有 11 种展开图，选正方体后在下面一个个换。', en: 'Every shape can unfold. A cube has 11 nets: pick the cube and switch between them below.' } },
  ],
  measure: [
    {
      target: 'guide-steppers',
      title: { zh: '改一改大小', en: 'Change the size' },
      text: { zh: '按 + 或 −，画面里的方块跟着变，下面的棱长总和、表面积、体积也会重新算。', en: 'Tap + or − and the blocks change. The totals below are worked out again.' },
      action: 'step',
      done: { zh: '变了！看看下面的算式。', en: 'Changed! Look at the sums below.' },
    },
    {
      target: 'guide-build',
      title: { zh: '一层一层搭', en: 'Build layer by layer' },
      text: { zh: '点这里，看小正方体一层一层摆满。一共摆了多少个，体积就是多少。', en: 'Tap here to stack the unit cubes layer by layer. The number of cubes is the volume.' },
      action: 'build',
    },
    {
      target: 'guide-tools',
      title: { zh: '涂色和拆开', en: 'Paint and pull apart' },
      text: { zh: '调色盘给表面涂上颜色，方块按钮把小正方体拆开来数。', en: 'The palette paints the surface. The blocks button pulls the cubes apart to count them.' },
    },
  ],
  paint: [
    {
      target: 'guide-paint-grid',
      title: { zh: '选一类方块', en: 'Pick one kind' },
      text: { zh: '点「三面涂色」这样的格子，画面里只留下这一类，块数也会揭晓。', en: 'Tap a box such as “3 faces”. Only that kind stays in the picture and the count is revealed.' },
      action: 'filter',
      done: { zh: '它们都藏在同一类位置上，看出规律了吗？', en: 'They all sit in the same kind of spot. See the pattern?' },
    },
    {
      target: 'cube-stage',
      title: { zh: '拿出一块看看', en: 'Pull one out' },
      text: { zh: '点画面里的一个小方块，它会弹出来，告诉你涂了几面。', en: 'Tap a small cube in the picture. It pops out and tells you how many faces are red.' },
      action: 'block',
    },
  ],
}
