<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, ref, shallowRef, watch } from 'vue'
import { onHide, onLoad, onReady, onShareAppMessage, onShareTimeline, onShow, onUnload } from '@dcloudio/uni-app'
import { TOOL_SHARE_TITLES, toolMoments, toolShare, useSearchTitle, type ToolShareKey } from '@/utils/share'
import { useFamilyPage } from '@/composables/useFamilyPage'
import { usePageBackground, useThemePage, useThemeStore } from '@/utils/wx-theme'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import { isEn, t } from '@/i18n'
import { windowHeight } from '@/utils/system'
import { CubeScene, type CanvasNode, type SolidOptions, type TouchPoint } from './scene'
import { counts as solidParts, oppositeFace, polyhedron, SOLIDS, type Solid } from './solids'
import { CUBE_NETS, edgeSum, oppositeCell, overlapCells, paintCounts, surfaceArea, volume, type Box, type Stack, type View } from './geometry'
import { makeQuestion, type CalcQuestion, type Level, type Question, type QuizMode } from './quiz'
import {
  COMPARE_ROWS,
  CUBE_IS_CUBOID,
  EULER_TIP,
  FAMILY_NAMES,
  GUIDES,
  MEASURE_FACTS,
  MODE_HINTS,
  NET_RHYME,
  OPPOSITE_TIP,
  PAINT_FACTS,
  pick,
  SOLID_INFO,
  type GuideAction,
  type MarkKind,
  type Shape,
} from './lessons'
import NetThumb from './NetThumb.vue'
import ViewGrid from './ViewGrid.vue'
import CubePrint from './CubePrint.vue'

useFamilyPage()
const themeClass = useThemePage()
const pageBg = usePageBackground()
const theme = useThemeStore()
const instance = getCurrentInstance()
const en = computed(() => isEn())

type Tab = 'explore' | 'quiz' | 'print'
type ExploreMode = 'learn' | 'unfold' | 'measure' | 'paint'
const TAB_SHARE: Record<Tab, ToolShareKey> = { explore: 'cube', quiz: 'cubeQuiz', print: 'cubePrint' }
const tab = ref<Tab>('explore')
const mode = ref<ExploreMode>('learn')
onShareAppMessage(() => toolShare(TAB_SHARE[tab.value], `/subsolar/cube/index?tab=${tab.value}`))
onShareTimeline(() => toolMoments(TAB_SHARE[tab.value], `tab=${tab.value}`))
useSearchTitle(() => t(TOOL_SHARE_TITLES[TAB_SHARE[tab.value]]))
onLoad((query) => {
  const value = query?.tab
  if (value === 'quiz' || value === 'print') tab.value = value
})

const MODES: Array<{ value: ExploreMode; label: string }> = [
  { value: 'learn', label: '认识' },
  { value: 'unfold', label: '展开' },
  { value: 'measure', label: '体积' },
  { value: 'paint', label: '涂色' },
]
const SOLID_CHIPS = SOLIDS.map((value) => ({ value, info: SOLID_INFO[value] }))
const SHAPES: Array<{ value: Shape; label: string }> = [
  { value: 'cube', label: '正方体' },
  { value: 'cuboid', label: '长方体' },
]
const MARKS: Array<{ value: MarkKind; label: string }> = [
  { value: 'face', label: '面' },
  { value: 'edge', label: '棱' },
  { value: 'vertex', label: '顶点' },
]

const scene = shallowRef<CubeScene | null>(null)
const failed = ref(false)

function vibrate(type: 'light' | 'medium' | 'heavy' = 'light') {
  uni.vibrateShort({ type })
}

// ---- 认识：数面、棱、顶点 ----
const shape = ref<Solid>('cube')
const markKind = ref<MarkKind>('face')
const see = ref(false)
const pairs = ref(true)
const groups = ref(false)
const markCount = ref(0)
const markTotal = ref(6)
/** 每种图形的面、棱、顶点数全了就记下来，标签上亮出数字 */
const found = ref<Record<string, boolean>>({})
let lastMark = { kind: 'face' as MarkKind, count: 0 }

const isBox = computed(() => shape.value === 'cube' || shape.value === 'cuboid')
const info = computed(() => SOLID_INFO[shape.value])
const shapeName = computed(() => pick(info.value.name, en.value))
const solidCounts = computed(() => solidParts(polyhedron(shape.value)))
const isFound = (kind: MarkKind) => !!found.value[`${shape.value}-${kind}`]
const markTabs = computed(() => MARKS.map((item) => ({ ...item, total: solidCounts.value[item.value], found: isFound(item.value) })))
const allFound = computed(() => MARKS.every((item) => isFound(item.value)))
const eulerText = computed(() => {
  const { face, edge, vertex } = solidCounts.value
  return `${vertex} + ${face} − ${edge} = 2`
})

const markDone = computed(() => markCount.value > 0 && markCount.value === markTotal.value)
const markHint = computed(() => {
  if (markKind.value === 'face') return t('点面做标记')
  if (markKind.value === 'edge') return t('点棱做标记')
  return t('点顶点做标记')
})
const tallyText = computed(() => {
  if (markKind.value === 'face') return t('已找到 {n} 个面', { n: markCount.value })
  if (markKind.value === 'edge') return t('已找到 {n} 条棱', { n: markCount.value })
  return t('已找到 {n} 个顶点', { n: markCount.value })
})
const markDoneText = computed(() => {
  const name = en.value ? shapeName.value.toLowerCase() : shapeName.value
  if (markKind.value === 'face') return t('全找到了！{shape}有 {n} 个面', { shape: name, n: markTotal.value })
  if (markKind.value === 'edge') return t('全找到了！{shape}有 {n} 条棱', { shape: name, n: markTotal.value })
  return t('全找到了！{shape}有 {n} 个顶点', { shape: name, n: markTotal.value })
})

function solidOptions(): SolidOptions {
  return {
    shape: shape.value,
    kind: markKind.value,
    see: see.value,
    pairs: pairs.value,
    groups: groups.value,
    names: { length: t('长'), width: t('宽'), height: t('高') },
  }
}

function onMark(kind: MarkKind, count: number, total: number) {
  const grew = kind === lastMark.kind && count === lastMark.count + 1
  lastMark = { kind, count }
  markCount.value = count
  markTotal.value = total
  if (count > 0 && count === total) found.value = { ...found.value, [`${shape.value}-${kind}`]: true }
  if (!grew) return
  passGuide('mark')
  if (count === total) {
    vibrate('medium')
    scene.value?.celebrate()
  } else vibrate()
}

watch(shape, () => {
  if (!isBox.value) groups.value = false
})

watch([shape, markKind, see, pairs, groups], () => {
  if (tab.value === 'explore' && mode.value === 'learn') scene.value?.showSolid(solidOptions())
})

function clearMarks() {
  scene.value?.clearMarks()
}

function pickShape(value: Solid) {
  shape.value = value
  passGuide('shape')
}

function pickKind(value: MarkKind) {
  markKind.value = value
  passGuide('kind')
}

// ---- 展开 ----
const unfoldShape = ref<Solid>('cube')
const netIndex = ref(0)
const openPct = ref(0)
const netPairs = ref(true)
const pickedFace = ref(-1)
const net = computed(() => CUBE_NETS[netIndex.value])
const netFamily = computed(() => pick(FAMILY_NAMES[net.value.family], en.value))
const unfoldInfo = computed(() => SOLID_INFO[unfoldShape.value])

function showNet() {
  pickedFace.value = -1
  const colors = netPairs.value ? 'pairs' : 'plain'
  if (unfoldShape.value === 'cube') scene.value?.showNet({ cells: net.value.cells, colors, open: openPct.value / 100 })
  else scene.value?.showPolyNet({ shape: unfoldShape.value, colors, open: openPct.value / 100 })
}

/** 换图形或换展开图时，从立体慢慢摊开，看清它是怎么展开的。 */
function replayOpen() {
  openPct.value = 0
  showNet()
  setTimeout(() => scene.value?.animateOpen(1, 1.8), 250)
}

function pickUnfoldShape(value: Solid) {
  passGuide('shape')
  if (unfoldShape.value === value) return
  unfoldShape.value = value
  vibrate()
  replayOpen()
}

function pickNet(index: number) {
  if (netIndex.value === index) return
  netIndex.value = index
  vibrate()
  replayOpen()
}

function toggleFold() {
  scene.value?.animateOpen(openPct.value > 50 ? 0 : 1, 1.6)
  vibrate()
  passGuide('slide')
}

function onSlide(event: { detail: { value: number } }) {
  openPct.value = event.detail.value
  scene.value?.dragOpen(event.detail.value / 100)
  passGuide('slide')
}

function onOpen(open: number) {
  openPct.value = Math.round(open * 100)
}

watch(netPairs, () => {
  if (tab.value === 'explore' && mode.value === 'unfold') showNet()
})

// ---- 体积 ----
const mShape = ref<Shape>('cube')
const edgeA = ref(3)
const dimL = ref(4)
const dimW = ref(3)
const dimH = ref(2)
const surface = ref(false)
const split = ref(false)
const layerText = ref('')
const box = computed<Box>(() => (mShape.value === 'cube' ? [edgeA.value, edgeA.value, edgeA.value] : [dimL.value, dimW.value, dimH.value]))
const formulas = computed(() => {
  const [l, w, h] = box.value
  const cube = mShape.value === 'cube'
  return [
    { key: 'edge', name: t('棱长总和'), expr: cube ? `${l} × 12` : `(${l} + ${w} + ${h}) × 4`, value: `${edgeSum(box.value)} cm` },
    { key: 'area', name: t('表面积'), expr: cube ? `${l} × ${l} × 6` : `(${l}×${w} + ${l}×${h} + ${w}×${h}) × 2`, value: `${surfaceArea(box.value)} cm²` },
    { key: 'volume', name: t('体积'), expr: `${l} × ${w} × ${h}`, value: `${volume(box.value)} cm³` },
  ]
})

function boxCells([l, w, h]: Box) {
  const cells: Array<[number, number, number]> = []
  for (let y = 0; y < h; y += 1) for (let z = 0; z < w; z += 1) for (let x = 0; x < l; x += 1) cells.push([x, y, z])
  return cells
}

function dimLabels([l, w, h]: Box, cube: boolean) {
  if (cube) return { length: `${l} cm`, width: `${w} cm`, height: `${h} cm` }
  return { length: t('长 {n} cm', { n: l }), width: t('宽 {n} cm', { n: w }), height: t('高 {n} cm', { n: h }) }
}

function showMeasure(build = false) {
  const [l, w, h] = box.value
  layerText.value = ''
  scene.value?.showBlocks({
    cubes: boxCells(box.value),
    size: [l, h, w],
    paint: surface.value ? 'pairs' : 'none',
    gap: split.value ? 1 : 0,
    dims: dimLabels(box.value, mShape.value === 'cube'),
    build,
  })
}

function buildLayers() {
  showMeasure(true)
  vibrate()
  passGuide('build')
}

function onLayer(layer: number) {
  const [l, w, h] = box.value
  if (layer < h) {
    layerText.value = t('第 {n} 层：{l} × {w} = {c} 个', { n: layer + 1, l, w, c: l * w })
    vibrate()
  } else {
    layerText.value = t('{h} 层，一共 {v} 个小正方体', { h, v: l * w * h })
  }
}

const STEPPERS = { a: edgeA, l: dimL, w: dimW, h: dimH }
type StepKey = keyof typeof STEPPERS | 'n'

function step(key: StepKey, delta: number) {
  const target = key === 'n' ? paintN : STEPPERS[key]
  const next = Math.max(key === 'n' ? 2 : 1, Math.min(5, target.value + delta))
  if (next === target.value) return
  target.value = next
  vibrate()
  passGuide('step')
}

watch([mShape, edgeA, dimL, dimW, dimH, surface], () => {
  if (tab.value === 'explore' && mode.value === 'measure') showMeasure()
})
watch(split, (value) => scene.value?.setGap(value ? 1 : 0))

// ---- 涂色 ----
const paintN = ref(3)
const cut = ref(false)
const paintFilter = ref<number | null>(null)
const blockInfo = ref('')
const counts = computed(() => paintCounts(paintN.value))
const paintRows = computed(() => {
  const n = paintN.value
  const [three, two, one, zero] = counts.value
  return [
    { faces: 3, name: t('三面涂色'), expr: '8', count: three, fact: pick(PAINT_FACTS[0], en.value) },
    { faces: 2, name: t('两面涂色'), expr: `12 × (${n} − 2)`, count: two, fact: pick(PAINT_FACTS[1], en.value) },
    { faces: 1, name: t('一面涂色'), expr: `6 × (${n} − 2)²`, count: one, fact: pick(PAINT_FACTS[2], en.value) },
    { faces: 0, name: t('没有涂色'), expr: `(${n} − 2)³`, count: zero, fact: pick(PAINT_FACTS[3], en.value) },
  ]
})

function showPaint() {
  blockInfo.value = ''
  const n = paintN.value
  scene.value?.showBlocks({ cubes: boxCells([n, n, n]), size: [n, n, n], paint: 'red', gap: cut.value ? 1 : 0, filter: paintFilter.value })
}

function setPaintFilter(value: number | null) {
  paintFilter.value = paintFilter.value === value ? null : value
  if (paintFilter.value !== null) cut.value = true
  scene.value?.setFilter(paintFilter.value)
  vibrate()
  passGuide('filter')
}

function onBlock(painted: number) {
  blockInfo.value = painted ? t('这块有 {n} 面涂了红色', { n: painted }) : t('这块一面也没涂到，它藏在最里面')
  vibrate()
  passGuide('block')
}

watch(paintN, () => {
  if (tab.value === 'explore' && mode.value === 'paint') showPaint()
})
watch(cut, (value) => scene.value?.setGap(value ? 1 : 0))

type ToolKey = 'see' | 'pairs' | 'groups' | 'netPairs' | 'surface' | 'split' | 'cut' | 'recenter'
type Tool = { key: ToolKey; icon: string; label: string; on: boolean }

const tools = computed<Tool[]>(() => {
  if (tab.value === 'quiz') return [{ key: 'recenter', icon: 'recenter', label: '摆正', on: false }]
  if (mode.value === 'learn') {
    const list: Tool[] = [
      { key: 'see', icon: 'xray', label: '透视', on: see.value },
      { key: 'pairs', icon: 'palette', label: '平行的面同色', on: pairs.value },
    ]
    if (isBox.value) list.push({ key: 'groups', icon: 'axes', label: '长宽高分色', on: groups.value })
    return list
  }
  if (mode.value === 'unfold') return [{ key: 'netPairs', icon: 'palette', label: '对面同色', on: netPairs.value }]
  if (mode.value === 'measure') {
    return [
      { key: 'surface', icon: 'palette', label: '表面涂色', on: surface.value },
      { key: 'split', icon: 'split', label: '拆开', on: split.value },
    ]
  }
  return [{ key: 'cut', icon: 'split', label: '切开', on: cut.value }]
})

const flash = ref('')
let flashTimer: ReturnType<typeof setTimeout> | null = null

function showFlash(text: string) {
  flash.value = text
  if (flashTimer) clearTimeout(flashTimer)
  flashTimer = setTimeout(() => (flash.value = ''), 1400)
}

function toggleTool(tool: Tool) {
  vibrate()
  if (tool.key === 'recenter') {
    scene.value?.resetView(-0.62, 0.62)
    return showFlash(t('摆正'))
  }
  const flags = { see, pairs, groups, netPairs, surface, split, cut }
  const flag = flags[tool.key]
  flag.value = !flag.value
  if (tool.key === 'groups' && flag.value) markKind.value = 'edge'
  showFlash(`${t(tool.label)} · ${flag.value ? t('开') : t('关')}`)
}

const stageHint = computed(() => {
  if (flash.value) return flash.value
  if (tab.value === 'quiz') return t('拖动可以转着看')
  if (mode.value === 'learn') return markHint.value
  if (mode.value === 'paint' && blockInfo.value) return blockInfo.value
  if (mode.value === 'measure' && layerText.value) return layerText.value
  return pick(MODE_HINTS[mode.value], en.value)
})

function setMode(value: ExploreMode) {
  if (mode.value === value) return
  mode.value = value
  if (value === 'unfold') openPct.value = 0
  pickedFace.value = -1
  syncScene()
  if (value === 'unfold') setTimeout(() => scene.value?.animateOpen(1, 1.8), 400)
  setTimeout(() => maybeGuide(value), 500)
}

// ---- 小测验 ----
const QUESTIONS = 5
const QUIZ_MODES: Array<{ value: QuizMode; label: string }> = [
  { value: 'fold', label: '折一折' },
  { value: 'opposite', label: '找对面' },
  { value: 'count', label: '数一数' },
  { value: 'views', label: '三视图' },
  { value: 'calc', label: '算一算' },
]
const LEVELS: Array<{ value: Level; label: string }> = [
  { value: 'easy', label: '简单' },
  { value: 'medium', label: '中等' },
  { value: 'hard', label: '困难' },
]
const quizMode = ref<QuizMode>('fold')
const level = ref<Level>('easy')
const index = ref(0)
const score = ref(0)
const results = ref<Array<'right' | 'wrong' | null>>([])
const question = shallowRef<Question | null>(null)
const picked = ref<number | null>(null)
const answer = ref<'' | 'right' | 'wrong'>('')
const reveal = ref('')
const finished = ref(false)
let advanceTimer: ReturnType<typeof setTimeout> | null = null
let revealTimer: ReturnType<typeof setTimeout> | null = null

const VIEW_NAMES: Record<View, string> = { front: '正面', top: '上面', left: '左面' }

const prompt = computed(() => {
  const q = question.value
  if (!q) return ''
  if (q.mode === 'fold') return t('这个展开图能折成正方体吗？')
  if (q.mode === 'opposite') return t('折成正方体后，和 ★ 相对的是哪个面？')
  if (q.mode === 'count') return t('一共有几个小正方体？')
  if (q.mode === 'views') return t('从{view}看，看到的是哪个图形？', { view: t(VIEW_NAMES[q.view]) })
  return calcPrompt(q)
})

function calcPrompt(q: CalcQuestion) {
  const name = en.value ? (q.cube ? 'cube' : 'cuboid') : q.cube ? '正方体' : '长方体'
  if (q.ask === 'edge') return t('这个{shape}的棱长总和是多少？', { shape: name })
  if (q.ask === 'area') return t('这个{shape}的表面积是多少？', { shape: name })
  if (q.ask === 'volume') return t('这个{shape}的体积是多少？', { shape: name })
  if (q.ask === 'edgeFromSum') return t('正方体的棱长总和是 {sum} cm，棱长是多少？', { sum: q.given ?? 0 })
  if (q.ask === 'paint3') return t('表面涂红后切开，三面涂色的有几块？')
  if (q.ask === 'paint2') return t('表面涂红后切开，两面涂色的有几块？')
  if (q.ask === 'paint1') return t('表面涂红后切开，一面涂色的有几块？')
  return t('表面涂红后切开，没有涂色的有几块？')
}

const quizTip = computed(() => {
  const q = question.value
  if (!q) return ''
  if (q.mode === 'fold') return t('想一想：有没有「田」字形或「凹」字形？')
  if (q.mode === 'opposite') return t('相对的面不挨着，同一行隔一个')
  if (q.mode === 'count') return t('转一转，别漏了下面和后面藏着的')
  if (q.mode === 'views') return t('红色「正面」标签那边就是正面')
  if (q.ask.startsWith('paint')) return t('三面在顶点，两面在棱上，一面在面中间')
  if (q.ask === 'edgeFromSum') return t('正方体有 12 条一样长的棱')
  const key = q.ask === 'edge' ? 'edge' : q.ask === 'area' ? 'area' : 'volume'
  return pick(MEASURE_FACTS[key][q.cube ? 'cube' : 'cuboid'], en.value)
})

function unitOf(q: Question) {
  if (q.mode === 'count') return t('个')
  if (q.mode !== 'calc') return ''
  if (q.ask === 'area') return 'cm²'
  if (q.ask === 'volume') return 'cm³'
  if (q.ask === 'edge' || q.ask === 'edgeFromSum') return 'cm'
  return t('块')
}

const numberChoices = computed(() => {
  const q = question.value
  if (!q || (q.mode !== 'count' && q.mode !== 'calc')) return []
  const unit = unitOf(q)
  return q.options.map((value) => ({ value, text: `${value}${unit.startsWith('cm') ? ' ' : ''}${unit}` }))
})

const answerText = computed(() => {
  const q = question.value
  if (!q) return ''
  if (q.mode === 'fold') return q.valid ? t('能') : t('不能')
  if (q.mode === 'opposite') return q.letters[q.answer]
  if (q.mode === 'views') return t('第 {n} 个', { n: q.answer + 1 })
  const unit = unitOf(q)
  return `${q.answer}${unit.startsWith('cm') ? ' ' : ''}${unit}`
})

const wrongText = computed(() => {
  const main = t('再想想，正确答案是 {answer}', { answer: answerText.value })
  return reveal.value ? `${main}\n${reveal.value}` : main
})

const resultText = computed(() => {
  if (score.value === QUESTIONS) return t('太棒了，全部答对！')
  if (score.value >= 3) return t('不错，继续加油！')
  return t('多练几次就会啦')
})
const quizIndicator = computed(() => `q-${quizMode.value}`)

function clearTimers() {
  if (advanceTimer) clearTimeout(advanceTimer)
  if (revealTimer) clearTimeout(revealTimer)
  advanceTimer = null
  revealTimer = null
}

function stackCells(stack: Stack) {
  const cells: Array<[number, number, number]> = []
  stack.forEach((row, z) => row.forEach((h, x) => {
    for (let y = 0; y < h; y += 1) cells.push([x, y, z])
  }))
  return cells
}

function showQuestion() {
  const q = question.value
  const s = scene.value
  if (!q || !s) return
  if (q.mode === 'fold') s.showNet({ cells: q.cells, colors: 'plain', open: 1 })
  else if (q.mode === 'opposite') s.showNet({ cells: q.cells, letters: q.letters, colors: 'plain', open: 1 })
  else if (q.mode === 'count' || q.mode === 'views') {
    const width = q.stack[0].length
    const depth = q.stack.length
    const height = Math.max(...q.stack.flat())
    s.showBlocks({ cubes: stackCells(q.stack), size: [width, height, depth], paint: 'none', color: 'blue', front: t('正面') })
  } else {
    const [l, w, h] = q.box
    const paint = q.ask.startsWith('paint')
    const dims = q.ask === 'edgeFromSum' ? { length: '? cm', width: '? cm', height: '? cm' } : paint ? null : dimLabels(q.box, q.cube)
    s.showBlocks({ cubes: boxCells(q.box), size: [l, h, w], paint: paint ? 'red' : 'none', dims })
  }
}

function nextQuestion() {
  clearTimers()
  answer.value = ''
  picked.value = null
  reveal.value = ''
  question.value = makeQuestion(quizMode.value, level.value, question.value)
  showQuestion()
}

function newRound() {
  index.value = 0
  score.value = 0
  results.value = Array.from({ length: QUESTIONS }, () => null)
  finished.value = false
  nextQuestion()
}

function advance() {
  clearTimers()
  if (index.value + 1 >= QUESTIONS) {
    finished.value = true
    return
  }
  index.value += 1
  nextQuestion()
}

function settle(right: boolean, delay: number) {
  answer.value = right ? 'right' : 'wrong'
  results.value[index.value] = answer.value
  vibrate(right ? 'light' : 'heavy')
  if (right) {
    score.value += 1
    advanceTimer = setTimeout(advance, delay)
  } else scene.value?.shake()
}

function answerFold(yes: boolean) {
  const q = question.value
  if (!q || q.mode !== 'fold' || answer.value) return
  picked.value = yes ? 1 : 0
  const right = yes === q.valid
  settle(right, 2900)
  scene.value?.animateOpen(0, 1.6)
  revealTimer = setTimeout(() => {
    if (question.value !== q) return
    if (q.valid) {
      reveal.value = t('能！6 个面正好围成一个正方体')
      if (right) scene.value?.celebrate()
    } else {
      reveal.value = t('不能，红色的面叠在一起了，正方体还缺一个面')
      scene.value?.highlightFaces(overlapCells(q.cells), 'bad')
    }
  }, 1700)
}

function pickCell(cell: number) {
  const q = question.value
  if (!q || q.mode !== 'opposite' || answer.value) return
  picked.value = cell
  const right = cell === q.answer
  settle(right, 3000)
  scene.value?.highlightFaces([q.star, q.answer])
  revealTimer = setTimeout(() => scene.value?.animateOpen(0, 1.6), 350)
  reveal.value = pick(OPPOSITE_TIP, en.value)
}

function pickNumber(value: number) {
  const q = question.value
  if (!q || (q.mode !== 'count' && q.mode !== 'calc') || answer.value) return
  picked.value = value
  const right = value === q.answer
  settle(right, 2200)
  if (q.mode === 'count') {
    scene.value?.setGap(1)
    reveal.value = t('拆开看看：一共 {n} 个', { n: q.answer })
  }
  if (right) scene.value?.celebrate()
}

function pickView(at: number) {
  const q = question.value
  if (!q || q.mode !== 'views' || answer.value) return
  picked.value = at
  settle(at === q.answer, 2600)
  scene.value?.viewFrom(q.view)
  reveal.value = t('相机转到{view}，和你选的一样吗？', { view: t(VIEW_NAMES[q.view]) })
}

function optionClass(value: number, correct: number) {
  if (!answer.value) return ''
  if (value === correct) return 'is-right'
  if (picked.value === value) return 'is-wrong'
  return 'is-dim'
}

function foldClass(yes: boolean) {
  const q = question.value
  if (!answer.value || !q || q.mode !== 'fold') return ''
  if (yes === q.valid) return 'is-right'
  if (picked.value === (yes ? 1 : 0)) return 'is-wrong'
  return 'is-dim'
}

function setQuizMode(value: QuizMode) {
  if (quizMode.value === value) return
  quizMode.value = value
  question.value = null
  newRound()
}

function setLevel(value: Level) {
  if (level.value === value) return
  level.value = value
  newRound()
}

// ---- 画布 ----

function measure(id: string) {
  return new Promise<{ width: number; height: number } | null>((resolve) => {
    const proxy = instance?.proxy
    if (!proxy) return resolve(null)
    uni.createSelectorQuery().in(proxy).select(`#${id}`).boundingClientRect((rect) => {
      const box = rect as { width?: number; height?: number } | null
      resolve(box?.width && box.height ? { width: box.width, height: box.height } : null)
    }).exec()
  })
}

function queryCanvas(callback: (result: { node?: CanvasNode; width?: number; height?: number } | null) => void) {
  const proxy = instance?.proxy
  if (!proxy) return
  uni.createSelectorQuery().in(proxy).select('#cube-canvas').fields({ node: true, size: true } as UniApp.NodeField, (res) => {
    callback(res as { node?: CanvasNode; width?: number; height?: number } | null)
  }).exec()
}

/** 原生画布要写成具体像素。 */
const canvasBox = ref<{ width: number; height: number } | null>(null)
const canvasStyle = computed(() => (canvasBox.value ? `width:${canvasBox.value.width}px;height:${canvasBox.value.height}px;` : ''))

function syncScene() {
  const s = scene.value
  if (!s) return
  if (tab.value === 'quiz') return showQuestion()
  if (mode.value === 'learn') s.showSolid(solidOptions())
  else if (mode.value === 'unfold') showNet()
  else if (mode.value === 'measure') showMeasure()
  else showPaint()
}

function initScene() {
  if (scene.value || tab.value === 'print') return
  queryCanvas((result) => {
    const canvas = result?.node
    if (!canvas || !result?.width || !result?.height) {
      failed.value = true
      return
    }
    const info = typeof uni.getWindowInfo === 'function' ? uni.getWindowInfo() : uni.getSystemInfoSync()
    try {
      const cube = new CubeScene({
        canvas,
        width: result.width,
        height: result.height,
        pixelRatio: Math.min(info.pixelRatio || 2, 2),
        background: theme.colors.paper,
        dark: theme.isDark,
        onMark,
        onFace,
        onOpen,
        onBlock,
        onLayer,
      })
      scene.value = cube
      syncScene()
      cube.start()
      if (tab.value === 'explore' && mode.value === 'unfold') setTimeout(() => cube.animateOpen(1, 1.8), 400)
    } catch (error) {
      console.error('[cube] init failed', error)
      failed.value = true
    }
  })
}

function onFace(index: number) {
  if (tab.value !== 'explore' || mode.value !== 'unfold') return
  if (index < 0) {
    pickedFace.value = -1
    scene.value?.highlightFaces([])
    return
  }
  pickedFace.value = index
  const opposite = unfoldShape.value === 'cube' ? oppositeCell(net.value.cells, index) : oppositeFace(polyhedron(unfoldShape.value), index)
  scene.value?.highlightFaces(opposite >= 0 ? [index, opposite] : [index])
  vibrate()
  passGuide('face')
}

async function mountStage() {
  const rect = await measure('cube-stage')
  if (!rect) return
  const width = Math.round(rect.width)
  const height = Math.round(rect.height)
  canvasBox.value = { width, height }
  await nextTick()
  setTimeout(() => {
    if (scene.value) scene.value.resize(width, height)
    else initScene()
  }, 60)
}

function setTab(value: Tab) {
  if (tab.value === value) return
  if (guideIndex.value >= 0) endGuide()
  const from = tab.value
  tab.value = value
  clearTimers()
  if (value === 'print') {
    // 画布只是藏起来，不销毁：重新建 WebGL 画布在部分手机上会拿不到上下文，回来就是白的
    scene.value?.stop()
    return
  }
  if (value === 'quiz') {
    // 切走时停掉了自动下一题，回来时答过的题直接往下走
    if (!results.value.length) newRound()
    else if (!finished.value && answer.value) advance()
  }
  if (from === 'print' && !scene.value) {
    nextTick(mountStage)
    return
  }
  scene.value?.start()
  syncScene()
  if (value === 'explore') setTimeout(() => maybeGuide(mode.value), 400)
}

watch(() => theme.isDark, () => scene.value?.setBackground(theme.colors.paper, theme.isDark))

/** 画布触摸事件的 touches 自带相对画布的 x、y，旧版本基础库没有时退回 clientX、clientY。 */
type CanvasTouchEvent = { touches?: ArrayLike<object> }

function pointsOf(event: CanvasTouchEvent): TouchPoint[] {
  return Array.from(event.touches ?? [], (item) => {
    const touch = item as Record<string, number>
    return { x: touch.x ?? touch.clientX, y: touch.y ?? touch.clientY }
  })
}

function onTouchStart(event: CanvasTouchEvent) {
  scene.value?.touchStart(pointsOf(event))
}

function onTouchMove(event: CanvasTouchEvent) {
  scene.value?.touchMove(pointsOf(event))
  passGuide('drag')
}

function onTouchEnd(event: CanvasTouchEvent) {
  scene.value?.touchEnd(pointsOf(event))
}

// ---- 每个模式第一次进来时的引导 ----
type Rect = { left: number; top: number; width: number; height: number }

const guideMode = ref<ExploreMode>('learn')
const guideIndex = ref(-1)
const guideRect = ref<Rect | null>(null)
const guidePassed = ref(false)
const viewH = ref(667)
const guideSteps = computed(() => GUIDES[guideMode.value])
const guideStep = computed(() => (guideIndex.value >= 0 ? guideSteps.value[guideIndex.value] ?? null : null))
const guideKey = (value: ExploreMode) => `uday-cube-guide-${value}-v1`
/** 真机上 WebGL 画布盖在所有视图上面，引导卡片压不住它；不圈画布的那几步先把画布藏起来 */
const hideCanvas = computed(() => !!guideStep.value && guideStep.value.target !== 'cube-stage')

function passGuide(action: GuideAction) {
  if (guideStep.value?.action !== action || guidePassed.value) return
  guidePassed.value = true
  const at = guideIndex.value
  setTimeout(() => {
    if (guideIndex.value === at) nextGuide()
  }, 1300)
}

const holeStyle = computed(() => {
  const rect = guideRect.value
  if (!rect) return {}
  const pad = 8
  return { left: `${rect.left - pad}px`, top: `${rect.top - pad}px`, width: `${rect.width + pad * 2}px`, height: `${rect.height + pad * 2}px` }
})

const blockers = computed(() => {
  const rect = guideRect.value
  if (!rect) return []
  const pad = 8
  const top = rect.top - pad
  const bottom = rect.top + rect.height + pad
  const left = rect.left - pad
  const right = rect.left + rect.width + pad
  return [
    { top: '0px', left: '0px', right: '0px', height: `${Math.max(0, top)}px` },
    { top: `${bottom}px`, left: '0px', right: '0px', bottom: '0px' },
    { top: `${top}px`, left: '0px', width: `${Math.max(0, left)}px`, height: `${bottom - top}px` },
    { top: `${top}px`, left: `${right}px`, right: '0px', height: `${bottom - top}px` },
  ]
})

/** 卡片放在目标下方，放不下就放上方；圈画布时两边都放不下也不能压到画布，放在空间大的一边。 */
const cardStyle = computed(() => {
  const rect = guideRect.value
  if (!rect) return {}
  const cardH = 220
  const below = rect.top + rect.height + 16
  const above = rect.top - 16
  if (below + cardH < viewH.value) return { top: `${below}px` }
  if (above - cardH > 0) return { bottom: `${viewH.value - above}px` }
  if (guideStep.value?.target !== 'cube-stage') return { bottom: '24px' }
  return viewH.value - below >= above ? { top: `${below}px` } : { bottom: `${viewH.value - above}px` }
})

function noop() {}

function onHoleTap() {
  if (guideStep.value?.target === 'guide-quiz') setTab('quiz')
  else nextGuide()
}

function guideMeasure(id: string) {
  return new Promise<{ rect: Rect; scrollTop: number } | null>((resolve) => {
    const proxy = instance?.proxy
    if (!proxy) return resolve(null)
    uni.createSelectorQuery().in(proxy)
      .select(`#${id}`).boundingClientRect()
      .selectViewport().scrollOffset(noop)
      .exec((result) => {
        const box = result?.[0]
        if (!box) return resolve(null)
        resolve({ rect: { left: box.left, top: box.top, width: box.width, height: box.height }, scrollTop: result?.[1]?.scrollTop ?? 0 })
      })
  })
}

async function focusGuide() {
  const step = guideStep.value
  if (!step) return
  guidePassed.value = false
  guideRect.value = null
  let first = null
  for (let attempt = 0; attempt < 4 && !first; attempt += 1) {
    first = await guideMeasure(step.target)
    if (!first) await new Promise((resolve) => setTimeout(resolve, 150))
  }
  if (guideStep.value !== step) return
  // 量不到目标就跳过这一步，不能留下一层没有卡片的遮罩把页面挡死
  if (!first) return nextGuide()
  const wanted = Math.max(0, first.scrollTop + first.rect.top - Math.max(90, (viewH.value - first.rect.height - 230) / 2))
  if (Math.abs(wanted - first.scrollTop) > 4) {
    uni.pageScrollTo({ scrollTop: wanted, duration: 260 })
    await new Promise((resolve) => setTimeout(resolve, 320))
  }
  const settled = (await guideMeasure(step.target)) ?? first
  if (guideStep.value === step) guideRect.value = settled.rect
}

function startGuide(value: ExploreMode = mode.value) {
  if (tab.value !== 'explore') return
  guideMode.value = value
  viewH.value = windowHeight()
  guideIndex.value = 0
  setTimeout(focusGuide, 60)
}

function maybeGuide(value: ExploreMode) {
  if (tab.value !== 'explore' || mode.value !== value || guideIndex.value >= 0 || failed.value) return
  if (!uni.getStorageSync(guideKey(value))) startGuide(value)
}

function nextGuide() {
  if (guideIndex.value < 0) return
  if (guideIndex.value + 1 >= guideSteps.value.length) return endGuide()
  guideIndex.value += 1
  focusGuide()
}

function endGuide() {
  uni.setStorageSync(guideKey(guideMode.value), 1)
  guideIndex.value = -1
  guideRect.value = null
  uni.pageScrollTo({ scrollTop: 0, duration: 260 })
}

onReady(() => {
  if (tab.value === 'quiz') newRound()
  if (tab.value !== 'print') mountStage()
  if (tab.value === 'explore') setTimeout(() => maybeGuide(mode.value), 900)
})
onShow(() => {
  if (tab.value !== 'print') scene.value?.start()
})
onHide(() => scene.value?.stop())
onUnload(() => {
  clearTimers()
  if (flashTimer) clearTimeout(flashTimer)
  scene.value?.dispose()
  scene.value = null
})
</script>

<template>
  <page-meta :page-style="pageBg.style" :background-color="pageBg.bg" :background-color-top="pageBg.bg" :background-color-bottom="pageBg.bg" :root-background-color="pageBg.bg" :background-text-style="pageBg.text" />
  <view class="theme-root page sub cube-page" :class="themeClass">
    <PageHeader safe show-back :title="t('3D 几何体')" :caption="t('转一转、数一数，展开看看')" />

    <view class="seg three">
      <view class="seg-indicator" :class="tab" />
      <text class="seg-item" :class="{ active: tab === 'explore' }" @click="setTab('explore')">{{ t('探索') }}</text>
      <text id="guide-quiz" class="seg-item" :class="{ active: tab === 'quiz' }" @click="setTab('quiz')">{{ t('小测验') }}</text>
      <text class="seg-item" :class="{ active: tab === 'print' }" @click="setTab('print')">{{ t('打印题目') }}</text>
    </view>

    <view v-if="tab === 'explore'" id="guide-modes" class="seg small four">
      <view class="seg-indicator" :class="`m-${mode}`" />
      <text v-for="item in MODES" :key="item.value" class="seg-item" :class="{ active: mode === item.value }" @click="setMode(item.value)">{{ t(item.label) }}</text>
    </view>

    <view v-else-if="tab === 'quiz'" class="quiz-head">
      <view class="seg small five">
        <view class="seg-indicator" :class="quizIndicator" />
        <text v-for="item in QUIZ_MODES" :key="item.value" class="seg-item" :class="{ active: quizMode === item.value }" @click="setQuizMode(item.value)">{{ t(item.label) }}</text>
      </view>
      <view class="level-row">
        <text class="level-label">{{ t('难度') }}</text>
        <view class="chip-row tight">
          <text
            v-for="item in LEVELS"
            :key="item.value"
            class="chip press"
            :class="{ active: level === item.value }"
            hover-class="press-on"
            hover-stay-time="80"
            @click="setLevel(item.value)"
          >{{ t(item.label) }}</text>
        </view>
      </view>
    </view>

    <view v-show="tab !== 'print'" class="card stage">
      <view class="stage-top">
        <text :key="stageHint" class="stage-hint fade-up" :class="{ flash }">{{ stageHint }}</text>
        <view class="tools">
          <view id="guide-tools" class="tools">
            <view v-for="tool in tools" :key="tool.key" class="tool press" :class="{ on: tool.on }" hover-class="press-on" hover-stay-time="80" @click="toggleTool(tool)">
              <AppIcon :name="tool.icon" :tone="tool.on ? 'accent' : 'muted'" :size="18" />
            </view>
          </view>
          <view v-if="tab === 'explore'" class="tool help press" hover-class="press-on" hover-stay-time="80" @click="startGuide()">
            <text>?</text>
          </view>
        </view>
      </view>
      <view id="cube-stage" class="stage-box">
        <canvas
          v-show="!hideCanvas"
          id="cube-canvas"
          class="stage-canvas"
          :style="canvasStyle"
          type="webgl"
          disable-scroll
          @touchstart="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
          @touchcancel="onTouchEnd"
        />
        <view v-if="failed" class="stage-fail">
          <text>{{ t('这台手机暂时显示不了 3D 画面') }}</text>
        </view>
      </view>

      <!-- 认识 -->
      <view v-if="tab === 'explore' && mode === 'learn'" class="controls">
        <scroll-view id="guide-shapes" scroll-x class="shape-scroll" :show-scrollbar="false">
          <view class="shape-list">
            <text v-for="item in SOLID_CHIPS" :key="item.value" class="chip press" :class="{ active: shape === item.value }" hover-class="press-on" hover-stay-time="80" @click="pickShape(item.value)">{{ pick(item.info.name, en) }}</text>
          </view>
        </scroll-view>
        <view id="guide-marks" class="mark-tabs">
          <view v-for="item in markTabs" :key="item.value" class="mark-tab press" :class="{ active: markKind === item.value, found: item.found }" hover-class="press-on" hover-stay-time="80" @click="pickKind(item.value)">
            <text class="mark-name">{{ t(item.label) }}</text>
            <text :key="`${shape}-${item.found}`" class="mark-total" :class="{ bump: item.found }">{{ item.found ? item.total : '?' }}</text>
          </view>
        </view>
        <view class="tally" :class="{ done: markDone }">
          <text :key="`${markKind}-${markCount}`" class="tally-num bump">{{ markCount }}</text>
          <text class="tally-text">{{ markDone ? markDoneText : tallyText }}</text>
          <view v-if="markCount > 0" class="icon-btn small press" hover-class="press-on" hover-stay-time="80" @click="clearMarks">
            <AppIcon name="eraser" tone="muted" :size="17" />
          </view>
        </view>
      </view>

      <!-- 展开 -->
      <view v-else-if="tab === 'explore' && mode === 'unfold'" class="controls">
        <scroll-view id="guide-shapes" scroll-x class="shape-scroll" :show-scrollbar="false">
          <view class="shape-list">
            <text v-for="item in SOLID_CHIPS" :key="item.value" class="chip press" :class="{ active: unfoldShape === item.value }" hover-class="press-on" hover-stay-time="80" @click="pickUnfoldShape(item.value)">{{ pick(item.info.name, en) }}</text>
          </view>
        </scroll-view>
        <view id="guide-fold" class="fold-row">
          <view class="play press" hover-class="press-on" hover-stay-time="80" @click="toggleFold">
            <text>{{ openPct > 50 ? t('折起来') : t('展开') }}</text>
          </view>
          <slider class="fold-slider" :value="openPct" :min="0" :max="100" activeColor="#ff7a45" backgroundColor="#eceef4" block-size="22" @changing="onSlide" @change="onSlide" />
        </view>
        <template v-if="unfoldShape === 'cube'">
          <view class="net-head">
            <text class="net-title">{{ t('第 {n} 种 / 共 11 种', { n: netIndex + 1 }) }}</text>
            <text class="net-family">{{ netFamily }}</text>
          </view>
          <scroll-view scroll-x class="net-scroll" :show-scrollbar="false">
            <view class="net-list">
              <view v-for="(item, at) in CUBE_NETS" :key="item.id" class="net-item press" :class="{ active: at === netIndex }" @click="pickNet(at)">
                <NetThumb :cells="item.cells" :unit="item.family === '33' ? 9 : 11" :pairs="netPairs" :active="at === netIndex" />
                <text class="net-no">{{ at + 1 }}</text>
              </view>
            </view>
          </scroll-view>
        </template>
      </view>

      <!-- 体积 -->
      <view v-else-if="tab === 'explore' && mode === 'measure'" class="controls">
        <view class="row">
          <view class="chip-row tight">
            <text v-for="item in SHAPES" :key="item.value" class="chip press" :class="{ active: mShape === item.value }" hover-class="press-on" hover-stay-time="80" @click="mShape = item.value">{{ t(item.label) }}</text>
          </view>
        </view>
        <view id="guide-steppers" class="steppers">
          <template v-if="mShape === 'cube'">
            <view class="stepper">
              <text class="step-tag">{{ t('棱长') }}</text>
              <view class="step-btn press" :class="{ off: edgeA <= 1 }" @click="step('a', -1)">−</view>
              <text :key="`a-${edgeA}`" class="step-value bump">{{ edgeA }}</text>
              <view class="step-btn press" :class="{ off: edgeA >= 5 }" @click="step('a', 1)">+</view>
            </view>
          </template>
          <template v-else>
            <view class="stepper">
              <text class="step-tag">{{ t('长') }}</text>
              <view class="step-btn press" :class="{ off: dimL <= 1 }" @click="step('l', -1)">−</view>
              <text :key="`l-${dimL}`" class="step-value bump len">{{ dimL }}</text>
              <view class="step-btn press" :class="{ off: dimL >= 5 }" @click="step('l', 1)">+</view>
            </view>
            <view class="stepper">
              <text class="step-tag">{{ t('宽') }}</text>
              <view class="step-btn press" :class="{ off: dimW <= 1 }" @click="step('w', -1)">−</view>
              <text :key="`w-${dimW}`" class="step-value bump wid">{{ dimW }}</text>
              <view class="step-btn press" :class="{ off: dimW >= 5 }" @click="step('w', 1)">+</view>
            </view>
            <view class="stepper">
              <text class="step-tag">{{ t('高') }}</text>
              <view class="step-btn press" :class="{ off: dimH <= 1 }" @click="step('h', -1)">−</view>
              <text :key="`h-${dimH}`" class="step-value bump hei">{{ dimH }}</text>
              <view class="step-btn press" :class="{ off: dimH >= 5 }" @click="step('h', 1)">+</view>
            </view>
          </template>
        </view>
        <button id="guide-build" hover-class="press-on" hover-stay-time="80" class="btn block build" @click="buildLayers">{{ t('一层一层搭出来') }}</button>
      </view>

      <!-- 涂色 -->
      <view v-else-if="tab === 'explore' && mode === 'paint'" class="controls">
        <view class="row">
          <view class="stepper">
            <text class="step-tag">{{ t('棱长') }}</text>
            <view class="step-btn press" :class="{ off: paintN <= 2 }" @click="step('n', -1)">−</view>
            <text :key="`n-${paintN}`" class="step-value bump">{{ paintN }}</text>
            <view class="step-btn press" :class="{ off: paintN >= 5 }" @click="step('n', 1)">+</view>
          </view>
          <text class="cut-note">{{ t('切成 {n} 块', { n: paintN * paintN * paintN }) }}</text>
        </view>
        <view id="guide-paint-grid" class="paint-grid">
          <view v-for="row in paintRows" :key="row.faces" class="paint-cell press" :class="{ active: paintFilter === row.faces }" hover-class="press-on" hover-stay-time="80" @click="setPaintFilter(row.faces)">
            <text class="paint-name">{{ row.name }}</text>
            <text class="paint-count">{{ paintFilter === row.faces ? row.count : '?' }}</text>
          </view>
        </view>
      </view>

      <!-- 小测验 -->
      <template v-else-if="tab === 'quiz'">
        <view v-if="!finished && question" class="question">
          <view class="progress">
            <view v-for="(item, at) in results" :key="at" class="dot" :class="[item, { current: at === index && !item }]" />
            <text class="progress-text">{{ t('第 {n}/{total} 题 · 得分 {score}', { n: index + 1, total: QUESTIONS, score }) }}</text>
          </view>
          <text class="prompt">{{ prompt }}</text>

          <view v-if="question.mode === 'fold'" class="fold-answers">
            <view class="big-option press" :class="foldClass(true)" hover-class="press-on" hover-stay-time="80" @click="answerFold(true)">
              <text class="big-mark">✓</text>
              <text>{{ t('能') }}</text>
            </view>
            <view class="big-option press" :class="foldClass(false)" hover-class="press-on" hover-stay-time="80" @click="answerFold(false)">
              <text class="big-mark">✗</text>
              <text>{{ t('不能') }}</text>
            </view>
          </view>

          <view v-else-if="question.mode === 'opposite'" class="letters">
            <view v-for="cell in question.choices" :key="cell" class="letter press" :class="optionClass(cell, question.answer)" hover-class="press-on" hover-stay-time="80" @click="pickCell(cell)">{{ question.letters[cell] }}</view>
          </view>

          <view v-else-if="question.mode === 'views'" class="options">
            <view v-for="(grid, at) in question.options" :key="at" class="option view-option press" :class="optionClass(at, question.answer)" hover-class="press-on" hover-stay-time="80" @click="pickView(at)">
              <ViewGrid :grid="grid" :unit="16" />
            </view>
          </view>

          <view v-else class="options">
            <view v-for="item in numberChoices" :key="item.value" class="option press" :class="optionClass(item.value, question.answer)" hover-class="press-on" hover-stay-time="80" @click="pickNumber(item.value)">
              <text class="option-num">{{ item.text }}</text>
            </view>
          </view>

          <view class="feedback" :class="answer">
            <text v-if="answer === 'right'">{{ reveal || t('答对了，真棒！') }}</text>
            <text v-else-if="answer === 'wrong'">{{ wrongText }}</text>
            <text v-else>{{ quizTip }}</text>
          </view>
          <button v-if="answer === 'wrong'" hover-class="press-on" hover-stay-time="80" class="btn block" @click="advance">{{ t('下一题') }}</button>
        </view>
        <view v-else-if="finished" class="result">
          <text class="result-score">{{ score }}<text class="result-total">/{{ QUESTIONS }}</text></text>
          <view class="result-dots">
            <view v-for="(item, at) in results" :key="at" class="dot" :class="item" />
          </view>
          <text class="result-text">{{ resultText }}</text>
          <button hover-class="press-on" hover-stay-time="80" class="btn block" @click="newRound">{{ t('再来一轮') }}</button>
        </view>
      </template>
    </view>

    <!-- 认识：知识卡片 -->
    <view v-if="tab === 'explore' && mode === 'learn'" class="card panel">
      <view class="panel-head">
        <text class="panel-title">{{ shapeName }}</text>
        <text class="kind-tag">{{ pick(info.kind, en) }}</text>
      </view>
      <view class="info-rows">
        <view class="info-row">
          <text class="info-key">{{ t('面') }}</text>
          <text class="info-val">{{ pick(info.faces, en) }}</text>
        </view>
        <view class="info-row">
          <text class="info-key">{{ t('像') }}</text>
          <text class="info-val">{{ pick(info.like, en) }}</text>
        </view>
      </view>
      <view class="euler" :class="{ done: allFound }">
        <text :key="`${shape}-${allFound}`" class="euler-expr" :class="{ bump: allFound }">{{ allFound ? eulerText : t('顶点 + 面 − 棱 = ?') }}</text>
        <text class="euler-tip">{{ allFound ? pick(EULER_TIP, en) : t('面、棱、顶点都数完就揭晓') }}</text>
      </view>
      <template v-if="isBox">
        <view class="table">
          <view class="tr head">
            <text class="td name" />
            <text class="td">{{ t('长方体') }}</text>
            <text class="td">{{ t('正方体') }}</text>
          </view>
          <view v-for="row in COMPARE_ROWS" :key="row.name.zh" class="tr">
            <text class="td name">{{ pick(row.name, en) }}</text>
            <text class="td">{{ pick(row.cuboid, en) }}</text>
            <text class="td">{{ pick(row.cube, en) }}</text>
          </view>
        </view>
        <text class="tip">{{ pick(CUBE_IS_CUBOID, en) }}</text>
      </template>
    </view>

    <view v-else-if="tab === 'explore' && mode === 'unfold' && unfoldShape === 'cube'" class="card panel">
      <text class="panel-title">{{ t('展开图口诀') }}</text>
      <view class="rhyme">
        <text v-for="(line, at) in NET_RHYME" :key="at" class="rhyme-line" :class="{ warn: at === NET_RHYME.length - 1 }">{{ pick(line, en) }}</text>
      </view>
      <text class="tip">{{ pick(OPPOSITE_TIP, en) }}</text>
    </view>

    <view v-else-if="tab === 'explore' && mode === 'unfold'" class="card panel">
      <view class="panel-head">
        <text class="panel-title">{{ pick(unfoldInfo.name, en) }}</text>
        <text class="kind-tag">{{ pick(unfoldInfo.kind, en) }}</text>
      </view>
      <view class="info-rows">
        <view class="info-row">
          <text class="info-key">{{ t('面') }}</text>
          <text class="info-val">{{ pick(unfoldInfo.faces, en) }}</text>
        </view>
      </view>
    </view>

    <view v-else-if="tab === 'explore' && mode === 'measure'" class="card panel">
      <text class="panel-title">{{ t('算一算') }}</text>
      <view class="formulas">
        <view v-for="item in formulas" :key="item.key" class="formula">
          <view class="formula-top">
            <text class="formula-name">{{ item.name }}</text>
            <text :key="item.value" class="formula-value fade-up">{{ item.value }}</text>
          </view>
          <text class="formula-expr">{{ item.expr }} = {{ item.value }}</text>
        </view>
      </view>
    </view>

    <view v-else-if="tab === 'explore' && mode === 'paint'" class="card panel">
      <text class="panel-title">{{ t('涂色的规律') }}</text>
      <view class="formulas">
        <view v-for="row in paintRows" :key="row.faces" class="formula">
          <view class="formula-top">
            <text class="formula-name">{{ row.name }}</text>
            <text class="formula-value">{{ row.expr }} = {{ row.count }}</text>
          </view>
          <text class="formula-fact">{{ row.fact }}</text>
        </view>
      </view>
      <text class="tip">{{ t('四类加起来正好是 {n}³ = {total} 块。', { n: paintN, total: paintN * paintN * paintN }) }}</text>
    </view>

    <CubePrint v-if="tab === 'print'" />

    <view v-if="guideStep" class="guide">
      <view v-if="!guideRect" class="guide-mask" @touchmove.stop.prevent="noop" />
      <template v-else>
        <view v-for="(block, at) in blockers" :key="at" class="guide-block" :style="block" @touchmove.stop.prevent="noop" />
        <view class="guide-hole" :style="holeStyle" />
        <view v-if="!guideStep.action" class="guide-block" :style="holeStyle" @click="onHoleTap" @touchmove.stop.prevent="noop" />
      </template>
      <view v-if="guideRect" class="guide-card" :style="cardStyle" @touchmove.stop.prevent="noop">
        <view class="guide-top">
          <text class="guide-count">{{ guideIndex + 1 }}/{{ guideSteps.length }}</text>
          <text class="guide-skip press" @click="endGuide">{{ t('跳过') }}</text>
        </view>
        <text class="guide-title">{{ guidePassed ? t('做得好！') : pick(guideStep.title, en) }}</text>
        <text class="guide-text">{{ guidePassed && guideStep.done ? pick(guideStep.done, en) : pick(guideStep.text, en) }}</text>
        <view class="guide-foot">
          <view class="guide-dots">
            <view v-for="(item, at) in guideSteps" :key="at" class="guide-pip" :class="{ on: at === guideIndex }" />
          </view>
          <view class="guide-next press" hover-class="press-on" hover-stay-time="80" @click="nextGuide">
            {{ guideIndex + 1 >= guideSteps.length ? t('知道了') : t('下一步') }}
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.cube-page { padding-bottom: calc(40px + var(--safe-bottom)); }
.seg {
  position: relative;
  display: flex;
  margin-bottom: 14px;
  padding: 4px;
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.6);
  box-shadow: inset 0 1px 0 #fff, 0 10px 24px -16px rgba(40, 52, 88, 0.35);
}
.seg.small { margin-bottom: 12px; border-radius: 14px; background: var(--surface-2); box-shadow: none; border-color: transparent; }
.seg-indicator {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 4px;
  width: calc((100% - 8px) / 3);
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 6px 14px -8px rgba(40, 52, 88, 0.45), inset 0 1px 0 #fff;
  transition: transform 0.42s cubic-bezier(0.34, 1.3, 0.64, 1);
}
.seg.four .seg-indicator { width: calc((100% - 8px) / 4); }
.seg.five .seg-indicator { width: calc((100% - 8px) / 5); }
.seg-indicator.quiz, .seg-indicator.m-unfold, .seg-indicator.q-opposite { transform: translateX(100%); }
.seg-indicator.print, .seg-indicator.m-measure, .seg-indicator.q-count { transform: translateX(200%); }
.seg-indicator.m-paint, .seg-indicator.q-views { transform: translateX(300%); }
.seg-indicator.q-calc { transform: translateX(400%); }
.seg-item {
  position: relative;
  z-index: 1;
  flex: 1;
  height: 38px;
  color: var(--muted);
  font-size: 14px;
  font-weight: 700;
  line-height: 38px;
  text-align: center;
  white-space: nowrap;
}
.seg-item.active { color: var(--accent-text); }
.seg.small .seg-item { height: 34px; font-size: 13px; line-height: 34px; }
.theme-dark .seg { border-color: var(--line); background: var(--paper); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 10px 24px -16px rgba(0, 0, 0, 0.6); }
.theme-dark .seg-indicator { background: var(--surface-2); box-shadow: 0 6px 14px -8px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.06); }
.theme-dark .seg.small { border-color: transparent; background: var(--surface-2); box-shadow: none; }
.theme-dark .seg.small .seg-indicator { background: var(--paper); }

.quiz-head { margin-bottom: 12px; }
.level-row { display: flex; align-items: center; justify-content: space-between; }
.level-label { color: var(--ink); font-size: 14px; font-weight: 650; }

.stage { padding: 12px 12px 16px; border-radius: 28px; }
.stage-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 28px; padding: 0 4px 8px; }
.stage-hint { flex: 1; min-width: 0; color: var(--muted); font-size: 13px; line-height: 1.4; }
.stage-hint.flash { color: var(--accent-text); font-weight: 700; }
.tools { display: flex; flex: none; gap: 6px; }
.tool { display: flex; width: 34px; height: 34px; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: 11px; background: var(--surface-2); box-sizing: border-box; transition: background 0.25s ease, border-color 0.25s ease, transform 0.25s ease; }
.tool.on { border-color: #ffb08d; background: var(--accent-soft); transform: translateY(-1px); }
.tool.help { color: var(--muted); font-size: 16px; font-weight: 800; }
.stage-box { position: relative; height: 620rpx; overflow: hidden; border-radius: 20px; background: var(--paper); }
.stage-canvas { display: block; width: 100%; height: 100%; }
.stage-fail { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 20px; color: var(--muted); font-size: 13px; text-align: center; }

.controls { margin-top: 10px; padding: 0 2px; }
.shape-scroll { width: 100%; white-space: nowrap; }
.shape-list { display: inline-flex; gap: 8px; padding: 2px 2px 4px; }
.shape-list .chip { flex: none; white-space: nowrap; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.icon-btn { display: flex; width: 40px; height: 40px; flex: none; align-items: center; justify-content: center; border-radius: 12px; background: var(--surface-2); }
.icon-btn.small { width: 34px; height: 34px; border-radius: 10px; }
.mark-tabs { display: flex; gap: 8px; margin-top: 12px; }
.mark-tab { display: flex; flex: 1; align-items: center; justify-content: center; gap: 8px; padding: 9px 0; border: 1px solid var(--line); border-radius: 14px; background: var(--paper); transition: background 0.25s ease, border-color 0.25s ease, transform 0.25s ease; }
.mark-tab.active { border-color: #ff9a6b; background: var(--accent-soft); transform: translateY(-1px); }
.mark-name { color: var(--ink); font-size: 15px; font-weight: 750; }
.mark-tab.active .mark-name { color: var(--accent-text); }
.mark-total { min-width: 22px; padding: 1px 6px; border-radius: 999px; background: var(--surface-2); color: var(--muted); font-size: 13px; font-weight: 800; text-align: center; }
.mark-tab.found .mark-total { background: #34c77b; color: #fff; }
.tally { display: flex; align-items: center; gap: 12px; margin-top: 12px; padding: 10px 14px; border-radius: 16px; background: var(--surface-2); transition: background 0.3s ease; }
.tally.done { background: rgba(52, 199, 123, 0.14); }
.tally-num { min-width: 40px; color: #ff6a33; font-size: 34px; font-weight: 800; line-height: 1.1; text-align: center; }
.tally.done .tally-num { color: #1f9d5c; }
.tally-text { flex: 1; color: var(--ink); font-size: 14px; font-weight: 700; line-height: 1.45; }

.fold-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
.play { flex: none; min-width: 68px; padding: 0 14px; height: 36px; border-radius: 12px; background: linear-gradient(135deg, #ffb45c 0%, #ff7a45 48%, #f15a36 100%); color: #fff; font-size: 13px; font-weight: 750; line-height: 36px; text-align: center; }
.fold-slider { flex: 1; margin: 0 4px; }
.net-head { display: flex; align-items: baseline; justify-content: space-between; margin-top: 10px; }
.net-title { color: var(--ink); font-size: 14px; font-weight: 750; }
.net-family { padding: 2px 10px; border-radius: 999px; background: var(--accent-soft); color: var(--accent-text); font-size: 12px; font-weight: 700; }
.net-scroll { width: 100%; margin-top: 8px; white-space: nowrap; }
.net-list { display: inline-flex; gap: 8px; padding: 2px 2px 4px; }
.net-item { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-width: 64px; height: 70px; padding: 0 8px; border: 1px solid var(--line); border-radius: 14px; background: var(--paper); box-sizing: border-box; transition: border-color 0.25s ease, background 0.25s ease, transform 0.25s ease; }
.net-item.active { border-color: #ff9a6b; background: var(--accent-soft); transform: translateY(-2px); }
.net-no { color: var(--muted); font-size: 11px; font-weight: 700; line-height: 1; }
.net-item.active .net-no { color: var(--accent-text); }

.steppers { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; padding: 12px; border-radius: 18px; background: var(--surface-2); }
.stepper { display: flex; align-items: center; gap: 8px; }
.step-tag { width: 40px; color: var(--muted); font-size: 12px; font-weight: 700; }
.step-btn { display: flex; width: 34px; height: 34px; align-items: center; justify-content: center; border-radius: 50%; background: var(--paper); color: var(--ink); font-size: 21px; line-height: 1; box-shadow: 0 4px 10px -6px rgba(40, 52, 88, 0.45); transition: opacity 0.2s ease; }
.step-btn.off { opacity: 0.3; pointer-events: none; }
.step-value { width: 44px; color: var(--ink); font-size: 26px; font-weight: 800; text-align: center; }
.step-value.len { color: #ff7a45; }
.step-value.wid { color: #1fae7e; }
.step-value.hei { color: #3b82f6; }
.btn.build { margin-top: 12px; }
.cut-note { color: var(--muted); font-size: 13px; font-weight: 650; }
.paint-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.paint-cell { display: flex; width: calc(50% - 4px); align-items: center; justify-content: space-between; padding: 10px 14px; border: 1px solid var(--line); border-radius: 14px; background: var(--paper); box-sizing: border-box; transition: border-color 0.25s ease, background 0.25s ease; }
.paint-cell.active { border-color: #f2553a; background: rgba(242, 85, 58, 0.1); }
.paint-name { color: var(--ink); font-size: 13px; font-weight: 700; }
.paint-count { color: #f2553a; font-size: 20px; font-weight: 800; }

.question { display: flex; flex-direction: column; align-items: center; margin-top: 8px; }
.progress { display: flex; align-items: center; gap: 6px; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--track); transition: background 0.3s ease, transform 0.3s ease; }
.dot.current { background: #ffb08d; transform: scale(1.25); }
.dot.right { background: #34c77b; }
.dot.wrong { background: #f15a36; }
.progress-text { margin-left: 6px; color: var(--muted); font-size: 12px; }
.prompt { margin-top: 12px; color: var(--ink); font-size: 16px; font-weight: 750; line-height: 1.5; text-align: center; }
.fold-answers { display: flex; align-self: stretch; gap: 10px; margin-top: 14px; }
.big-option { display: flex; flex: 1; height: 58px; align-items: center; justify-content: center; gap: 8px; border: 1px solid var(--line); border-radius: 16px; background: var(--paper); color: var(--ink); font-size: 17px; font-weight: 800; transition: background 0.25s ease, opacity 0.25s ease, transform 0.25s ease; }
.big-mark { font-size: 22px; }
.letters { display: flex; align-self: stretch; justify-content: space-between; gap: 8px; margin-top: 14px; }
.letter { display: flex; flex: 1; height: 52px; align-items: center; justify-content: center; border: 1px solid var(--line); border-radius: 14px; background: var(--paper); color: var(--ink); font-size: 22px; font-weight: 800; transition: background 0.25s ease, opacity 0.25s ease, transform 0.25s ease; }
.options { display: flex; flex-wrap: wrap; justify-content: space-between; align-self: stretch; gap: 10px; margin-top: 14px; }
.option { display: flex; width: calc(50% - 5px); min-height: 56px; align-items: center; justify-content: center; border: 1px solid var(--line); border-radius: 16px; box-sizing: border-box; background: var(--paper); transition: background 0.25s ease, opacity 0.25s ease, transform 0.25s ease; }
.view-option { min-height: 92px; padding: 10px; }
.option-num { color: var(--ink); font-size: 18px; font-weight: 800; }
.is-right { border-color: #34c77b; background: #34c77b; color: #fff; transform: scale(1.03); }
.is-wrong { border-color: #f15a36; background: #f15a36; color: #fff; }
.is-right .option-num, .is-wrong .option-num { color: #fff; }
.is-dim { opacity: 0.45; }
.feedback { align-self: stretch; margin-top: 12px; padding: 8px 14px; border-radius: 12px; color: var(--muted); font-size: 13px; font-weight: 650; line-height: 1.55; text-align: center; white-space: pre-line; transition: background 0.25s ease, color 0.25s ease; }
.feedback.right { background: rgba(52, 199, 123, 0.14); color: #1f9d5c; }
.feedback.wrong { background: rgba(241, 90, 54, 0.12); color: #d9482a; }
.question .btn.block { align-self: stretch; margin-top: 12px; }
.result { display: flex; flex-direction: column; align-items: center; padding: 18px 0 4px; }
.result-score { color: var(--ink); font-size: 52px; font-weight: 800; }
.result-total { color: var(--muted); font-size: 22px; }
.result-dots { display: flex; gap: 8px; margin-top: 8px; }
.result-dots .dot { width: 12px; height: 12px; }
.result-text { margin: 14px 0 18px; color: var(--ink); font-size: 15px; font-weight: 700; }
.result .btn.block { align-self: stretch; }

.panel { margin-top: 14px; }
.panel-title { display: block; color: var(--ink); font-size: 14px; font-weight: 750; }
.tip { display: block; margin-top: 10px; color: var(--muted); font-size: 12px; line-height: 1.6; }
.table { margin-top: 10px; overflow: hidden; border-radius: 14px; background: var(--surface-2); }
.tr { display: flex; border-top: 1px solid var(--line); }
.tr.head { border-top: none; }
.td { flex: 1; padding: 9px 8px; color: var(--ink); font-size: 12.5px; line-height: 1.45; }
.tr.head .td { color: var(--muted); font-weight: 750; }
.td.name { flex: none; width: 52px; color: var(--accent-text); font-weight: 750; }
.rhyme { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
.rhyme-line { padding: 8px 12px; border-radius: 12px; background: var(--surface-2); color: var(--ink); font-size: 13.5px; font-weight: 650; }
.rhyme-line.warn { background: var(--accent-soft); color: var(--accent-text); }
.formulas { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
.formula { padding: 10px 12px; border-radius: 14px; background: var(--surface-2); }
.formula-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.formula-name { color: var(--ink); font-size: 14px; font-weight: 750; }
.formula-value { color: var(--accent-text); font-size: 16px; font-weight: 800; }
.formula-expr { display: block; margin-top: 4px; color: var(--ink); font-size: 13px; font-family: Menlo, monospace; }
.formula-fact { display: block; margin-top: 4px; color: var(--muted); font-size: 12px; line-height: 1.5; }
.panel-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.kind-tag { padding: 2px 10px; border-radius: 999px; background: var(--accent-soft); color: var(--accent-text); font-size: 12px; font-weight: 700; }
.info-rows { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
.info-row { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 12px; background: var(--surface-2); }
.info-key { flex: none; min-width: 28px; color: var(--accent-text); font-size: 13px; font-weight: 800; }
.info-val { flex: 1; color: var(--ink); font-size: 13.5px; font-weight: 650; line-height: 1.45; }
.euler { display: flex; flex-direction: column; align-items: center; gap: 4px; margin-top: 10px; padding: 12px; border: 1px dashed var(--line); border-radius: 14px; transition: background 0.3s ease, border-color 0.3s ease; }
.euler.done { border-color: transparent; background: rgba(52, 199, 123, 0.14); }
.euler-expr { color: var(--ink); font-size: 20px; font-weight: 800; letter-spacing: 0.5px; }
.euler.done .euler-expr { color: #1f9d5c; }
.euler-tip { color: var(--muted); font-size: 12px; }
.panel .table { margin-top: 12px; }

.guide { position: fixed; inset: 0; z-index: 70; pointer-events: none; }
.guide-mask { position: absolute; inset: 0; background: rgba(15, 18, 30, 0.62); pointer-events: auto; }
.guide-block { position: fixed; pointer-events: auto; }
.guide-hole {
  position: fixed;
  border-radius: 18px;
  box-shadow: 0 0 0 3000px rgba(15, 18, 30, 0.62), 0 0 0 2px rgba(255, 255, 255, 0.9);
  pointer-events: none;
  transition: left 0.3s ease, top 0.3s ease, width 0.3s ease, height 0.3s ease;
}
.guide-card {
  position: fixed;
  left: 20px;
  right: 20px;
  z-index: 2;
  padding: 16px 18px 14px;
  border-radius: 20px;
  background: #ffffff;
  box-shadow: 0 18px 40px -16px rgba(15, 18, 30, 0.5);
  pointer-events: auto;
  animation: fade-up 0.3s ease;
}
.guide-top { display: flex; align-items: center; justify-content: space-between; }
.guide-count { color: #ff7a45; font-size: 12px; font-weight: 750; }
.guide-skip { padding: 2px 0 2px 12px; color: #8a93a3; font-size: 13px; }
.guide-title { display: block; margin-top: 6px; color: #1c2430; font-size: 17px; font-weight: 800; }
.guide-text { display: block; margin-top: 6px; color: #4a5363; font-size: 14px; line-height: 1.6; }
.guide-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 14px; }
.guide-dots { display: flex; gap: 5px; }
.guide-pip { width: 6px; height: 6px; border-radius: 3px; background: #dde2ea; transition: width 0.25s ease, background 0.25s ease; }
.guide-pip.on { width: 16px; background: #ff7a45; }
.guide-next { padding: 8px 18px; border-radius: 999px; background: #1c2430; color: #ffffff; font-size: 14px; font-weight: 700; }

.bump { animation: bump 0.45s cubic-bezier(0.34, 1.56, 0.64, 1); }
.fade-up { animation: fade-up 0.35s ease; }
@keyframes bump {
  0% { transform: scale(0.6); opacity: 0.4; }
  60% { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1); }
}
@keyframes fade-up {
  0% { opacity: 0; transform: translateY(6px); }
  100% { opacity: 1; transform: translateY(0); }
}
</style>
