<script setup lang="ts">
import { computed, getCurrentInstance, ref, watch } from 'vue'
import { onLoad, onReady, onShareAppMessage, onShareTimeline, onUnload } from '@dcloudio/uni-app'
import { TOOL_SHARE_TITLES, toolMoments, toolShare, useSearchTitle, type ToolShareKey } from '@/utils/share'
import { useFamilyPage } from '@/composables/useFamilyPage'
import { usePageBackground, useThemePage } from '@/utils/wx-theme'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import { isEn, t } from '@/i18n'
import { windowHeight } from '@/utils/system'
import BalanceView from './BalanceView.vue'
import UnitsPrint from './UnitsPrint.vue'
import { artImage, cubeImage } from './art'
import {
  AREA_SCALES,
  GUIDES,
  JUGS,
  LADDER_TIPS,
  LADDERS,
  LENGTH_SCALES,
  MASS_SCALES,
  POURS,
  VOLUME_SCALES,
  type GuideAction,
  type LengthObject,
  type Mode,
  type Pour,
  type Rung,
} from './lessons'
import { makeQuestion, sameParts, type Level, type QuizMode, type Question, type Sign } from './quiz'
import { formatParts, pick, rateOf, split, UNITS, unitName, type Part, type UnitId } from './units'

useFamilyPage()
const themeClass = useThemePage()
const pageBg = usePageBackground()
const instance = getCurrentInstance()
const en = computed(() => isEn())

type Tab = 'explore' | 'quiz' | 'print'
const TAB_SHARE: Record<Tab, ToolShareKey> = { explore: 'units', quiz: 'unitsQuiz', print: 'unitsPrint' }
const tab = ref<Tab>('explore')
const mode = ref<Mode>('length')
onShareAppMessage(() => toolShare(TAB_SHARE[tab.value], `/subpages/units/index?tab=${tab.value}`))
onShareTimeline(() => toolMoments(TAB_SHARE[tab.value], `tab=${tab.value}`))
useSearchTitle(() => t(TOOL_SHARE_TITLES[TAB_SHARE[tab.value]]))
onLoad((query) => {
  const value = query?.tab
  if (value === 'quiz' || value === 'print') setTab(value)
})

const MODES: Array<{ value: Mode; label: string }> = [
  { value: 'length', label: '长度' },
  { value: 'mass', label: '重量' },
  { value: 'area', label: '面积' },
  { value: 'volume', label: '容积' },
]

function vibrate(type: 'light' | 'medium' | 'heavy' = 'light') {
  uni.vibrateShort({ type })
}

const name = (unit: UnitId) => unitName(unit, en.value)
const parts = (list: Part[]) => formatParts(list, en.value)
const amount = (value: number, big: UnitId, small: UnitId) => parts(split(value, big, small))
const small = (value: number, unit: UnitId) => `${value} ${name(unit)}`
const ruleText = (big: UnitId, smallUnit: UnitId) => `1 ${name(big)} = ${rateOf(big, smallUnit)} ${name(smallUnit)}`

let timers: Array<ReturnType<typeof setTimeout>> = []
function later(fn: () => void, ms: number) {
  timers.push(setTimeout(fn, ms))
}
function clearTimers() {
  timers.forEach(clearTimeout)
  timers = []
}

// ---- 刻度：每种量有几组相邻单位 ----
const scaleIndex = ref<Record<Mode, number>>({ length: 0, mass: 0, area: 0, volume: 0 })
const SCALES: Record<Mode, Array<{ big: UnitId; small: UnitId }>> = { length: LENGTH_SCALES, mass: MASS_SCALES, area: AREA_SCALES, volume: VOLUME_SCALES }
const scaleChips = computed(() => SCALES[mode.value].map((item, index) => ({ index, label: `${name(item.small)} · ${name(item.big)}` })))
const current = computed(() => SCALES[mode.value][scaleIndex.value[mode.value]])
const feel = computed(() => {
  const at = scaleIndex.value[mode.value]
  if (mode.value === 'length') return LENGTH_SCALES[at].feel
  if (mode.value === 'mass') return MASS_SCALES[at].feel
  if (mode.value === 'area') return AREA_SCALES[at].feel
  return VOLUME_SCALES[at].feel
})

function pickScale(index: number) {
  if (scaleIndex.value[mode.value] === index) return
  clearTimers()
  scaleIndex.value = { ...scaleIndex.value, [mode.value]: index }
  resetMode()
  vibrate()
  passGuide('scale')
}

function resetMode() {
  clearTimers()
  tick.value = 0
  lengthObject.value = null
  zoomCount.value = 0
  // 数一数、铺格子、搭方块都靠定时器收尾。定时器被清掉后，这里也要把进行中的标记放下，否则下次点击会被拦住
  zooming.value = false
  filling.value = false
  pan.value = []
  massObject.value = 0
  cells.value = Array(100).fill(false)
  rowText.value = ''
  ml.value = 0
  layers.value = 0
  building.value = false
}

const ladder = computed(() => LADDERS[mode.value])
function rungOn(rung: Rung) {
  return [rung.unit, rung.also].some((unit) => unit === current.value.big || unit === current.value.small)
}

function pickRung(rung: Rung) {
  const list = SCALES[mode.value]
  const index = list.findIndex((item) => item.big === rung.unit || item.small === rung.unit)
  if (index >= 0) pickScale(index)
}

function setMode(value: Mode) {
  if (mode.value === value) return
  mode.value = value
  resetMode()
  later(() => maybeGuide(value), 400)
}

// ---- 长度：拉卷尺 ----
const tick = ref(0)
const dragging = ref(false)
const lengthObject = ref<LengthObject | null>(null)
const zoomCount = ref(0)
const zooming = ref(false)
const lengthScale = computed(() => LENGTH_SCALES[scaleIndex.value.length])
const ticks = computed(() => lengthScale.value.count * 10)
const tickMarks = computed(() => Array.from({ length: ticks.value + 1 }, (_, at) => ({
  at,
  left: `${(at / ticks.value) * 100}%`,
  kind: at % 10 === 0 ? 'major' : at % 5 === 0 ? 'mid' : 'minor',
})))
const majorMarks = computed(() => tickMarks.value.filter((mark) => mark.kind === 'major'))
const tapeStyle = computed(() => `width:${(tick.value / ticks.value) * 100}%;`)
const lengthSmall = computed(() => tick.value * lengthScale.value.step)
const lengthReading = computed(() => {
  const s = lengthScale.value
  if (!tick.value) return { left: small(0, s.small), right: '' }
  const left = amount(lengthSmall.value, s.big, s.small)
  const right = small(lengthSmall.value, s.small)
  return { left, right: left === right ? '' : right }
})
const zoomCells = computed(() => {
  const s = lengthScale.value
  return Array.from({ length: 10 }, (_, at) => ({ at, label: s.step > 1 ? String(s.step) : '' }))
})
const zoomText = computed(() => {
  const s = lengthScale.value
  if (zoomCount.value < 10) return zoomCount.value ? small(zoomCount.value * s.step, s.small) : t('1 个大单位里有几个小单位？')
  if (s.step > 1) return t('10 个 {step} {unit}，就是 {rule}', { step: s.step, unit: name(s.small), rule: ruleText(s.big, s.small) })
  return ruleText(s.big, s.small)
})

let rulerRect: { left: number; width: number } | null = null

function touchX(event: { touches?: ArrayLike<{ clientX?: number; pageX?: number }> }) {
  const touch = event.touches?.[0]
  return touch?.clientX ?? touch?.pageX ?? 0
}

function measureBox(id: string) {
  return new Promise<{ left: number; top: number; width: number; height: number } | null>((resolve) => {
    const proxy = instance?.proxy
    if (!proxy) return resolve(null)
    uni.createSelectorQuery().in(proxy).select(`#${id}`).boundingClientRect((rect) => {
      const box = rect as { left?: number; top?: number; width?: number; height?: number } | null
      resolve(box?.width ? { left: box.left ?? 0, top: box.top ?? 0, width: box.width, height: box.height ?? 0 } : null)
    }).exec()
  })
}

function setTickFromX(x: number) {
  if (!rulerRect) return
  const next = Math.max(0, Math.min(ticks.value, Math.round(((x - rulerRect.left) / rulerRect.width) * ticks.value)))
  if (next === tick.value) return
  tick.value = next
  if (next % 10 === 0 && next) vibrate()
  if (lengthObject.value && lengthObject.value.ticks !== next) lengthObject.value = null
  passGuide('drag')
}

async function onRulerStart(event: { touches?: ArrayLike<{ clientX?: number }> }) {
  const x = touchX(event)
  dragging.value = true
  const box = await measureBox('ruler-track')
  rulerRect = box ? { left: box.left, width: box.width } : null
  setTickFromX(x)
}

function onRulerMove(event: { touches?: ArrayLike<{ clientX?: number }> }) {
  setTickFromX(touchX(event))
}

function onRulerEnd() {
  dragging.value = false
}

function pickLength(item: LengthObject) {
  lengthObject.value = item
  tick.value = item.ticks
  vibrate()
  passGuide('object')
}

function startZoom() {
  if (zooming.value) return
  clearTimers()
  zooming.value = true
  zoomCount.value = 0
  for (let at = 1; at <= 10; at += 1) {
    later(() => {
      zoomCount.value = at
      vibrate(at === 10 ? 'medium' : 'light')
      if (at === 10) {
        zooming.value = false
        passGuide('zoom')
      }
    }, at * 180)
  }
}

// ---- 重量：天平 ----
const MAX_WEIGHTS = 14
const massObject = ref(0)
const pan = ref<number[]>([])
const massScale = computed(() => MASS_SCALES[scaleIndex.value.mass])
const massItem = computed(() => massScale.value.objects[massObject.value])
const panTotal = computed(() => pan.value.reduce((sum, value) => sum + value, 0))
const balanced = computed(() => panTotal.value === massItem.value.weight)
const massText = (value: number) => {
  const s = massScale.value
  const big = amount(value, s.big, s.small)
  const smallText = small(value, s.small)
  return big === smallText ? big : `${big} = ${smallText}`
}
const massTag = computed(() => (balanced.value ? amount(massItem.value.weight, massScale.value.big, massScale.value.small) : '?'))
const massStatus = computed(() => {
  if (balanced.value) return t('平衡啦！{name}重 {weight}', { name: pick(massItem.value.name, en.value), weight: massText(massItem.value.weight) })
  if (!pan.value.length) return t('点下面的砝码，放到右边的盘子里')
  if (panTotal.value < massItem.value.weight) return t('右边轻了，再加砝码')
  return t('右边重了，点盘里的砝码拿下来')
})

function weightLabel(value: number) {
  const s = massScale.value
  const rate = rateOf(s.big, s.small)
  return value >= rate ? `${value / rate}${name(s.big)}` : `${value}${name(s.small)}`
}

function weightStyle(value: number) {
  const size = Math.round(46 + Math.log10(value / 10) * 20)
  const rate = rateOf(massScale.value.big, massScale.value.small)
  return `width:${size}rpx;height:${Math.round(size * 0.8)}rpx;font-size:${value >= rate ? 20 : 17}rpx;`
}

function addWeight(value: number) {
  if (pan.value.length >= MAX_WEIGHTS) {
    uni.showToast({ title: t('盘子放不下啦'), icon: 'none' })
    return
  }
  const wasBalanced = balanced.value
  pan.value = [...pan.value, value]
  vibrate()
  passGuide('weight')
  if (balanced.value && !wasBalanced) onBalanced()
}

function removeWeight(index: number) {
  pan.value = pan.value.filter((_, at) => at !== index)
  vibrate()
  if (balanced.value) onBalanced()
}

function onBalanced() {
  later(() => vibrate('medium'), 500)
  passGuide('balance')
}

function pickMass(index: number) {
  if (massObject.value === index) return
  massObject.value = index
  pan.value = []
  vibrate()
}

function clearPan() {
  pan.value = []
  vibrate()
}

// ---- 面积：铺方格 ----
const cells = ref<boolean[]>(Array(100).fill(false))
const rowText = ref('')
const filling = ref(false)
let paintValue = true
let gridRect: { left: number; top: number; width: number; height: number } | null = null
const areaScale = computed(() => AREA_SCALES[scaleIndex.value.area])
const filled = computed(() => cells.value.filter(Boolean).length)
const areaFull = computed(() => filled.value === 100)
const areaReading = computed(() => {
  const s = areaScale.value
  if (areaFull.value) return `${small(100 * s.cell, s.small)} = 1 ${name(s.big)}`
  if (rowText.value) return rowText.value
  return t('铺了 {n} 格 = {area}', { n: filled.value, area: small(filled.value * s.cell, s.small) })
})

function cellAt(event: { touches?: ArrayLike<{ clientX?: number; clientY?: number }> }) {
  const touch = event.touches?.[0]
  if (!touch || !gridRect) return -1
  const col = Math.floor((((touch.clientX ?? 0) - gridRect.left) / gridRect.width) * 10)
  const row = Math.floor((((touch.clientY ?? 0) - gridRect.top) / gridRect.height) * 10)
  if (col < 0 || col > 9 || row < 0 || row > 9) return -1
  return row * 10 + col
}

function paintCell(index: number) {
  if (index < 0 || cells.value[index] === paintValue) return
  const next = [...cells.value]
  next[index] = paintValue
  cells.value = next
  rowText.value = ''
  if (filled.value === 100) celebrateArea()
  else passGuide('paint')
}

async function onGridStart(event: { touches?: ArrayLike<{ clientX?: number; clientY?: number }> }) {
  if (filling.value) return
  const touch = event.touches?.[0]
  const snapshot = touch ? { touches: [{ clientX: touch.clientX, clientY: touch.clientY }] } : event
  gridRect = await measureBox('area-grid')
  const index = cellAt(snapshot)
  if (index < 0) return
  paintValue = !cells.value[index]
  paintCell(index)
}

function onGridMove(event: { touches?: ArrayLike<{ clientX?: number; clientY?: number }> }) {
  if (filling.value) return
  paintCell(cellAt(event))
}

function fillRows() {
  if (filling.value) return
  clearTimers()
  filling.value = true
  cells.value = Array(100).fill(false)
  const s = areaScale.value
  for (let row = 0; row < 10; row += 1) {
    later(() => {
      const next = [...cells.value]
      for (let col = 0; col < 10; col += 1) next[row * 10 + col] = true
      cells.value = next
      rowText.value = t('第 {n} 行，一共 {count} 格 = {area}', { n: row + 1, count: (row + 1) * 10, area: small((row + 1) * 10 * s.cell, s.small) })
      vibrate()
      if (row === 9) {
        filling.value = false
        rowText.value = ''
        celebrateArea()
        passGuide('fill')
      }
    }, 200 + row * 260)
  }
}

function celebrateArea() {
  later(() => vibrate('medium'), 200)
}

function clearGrid() {
  if (filling.value) return
  cells.value = Array(100).fill(false)
  rowText.value = ''
  vibrate()
}

// ---- 容积：倒水、搭方块 ----
const ml = ref(0)
const pouring = ref<Pour | null>(null)
const pourJug = ref(0)
const spill = ref(false)
const layers = ref(0)
const building = ref(false)
const volumeScale = computed(() => VOLUME_SCALES[scaleIndex.value.volume])
const isJug = computed(() => volumeScale.value.kind === 'jug')
const jugLevels = computed(() => Array.from({ length: JUGS }, (_, at) => Math.max(0, Math.min(1000, ml.value - at * 1000)) / 1000))
const JUG_MARKS = [1000, 900, 800, 700, 600, 500, 400, 300, 200, 100]
const volumeReading = computed(() => {
  const s = volumeScale.value
  if (s.kind === 'jug') {
    if (!ml.value) return t('倒点水进去看看')
    const big = amount(ml.value, 'l', 'ml')
    const smallText = small(ml.value, 'ml')
    if (ml.value % 1000 === 0) return t('正好 {big} = {small}', { big, small: smallText })
    return big === smallText ? big : `${big} = ${smallText}`
  }
  if (!layers.value) return t('点「一层一层搭」，看小方块怎么搭成大方块')
  const count = layers.value * 100
  if (layers.value === 10) {
    const tail = s.big === 'dm3' ? ` = 1 ${name('l')}` : ''
    return `${small(1000, s.small)} = 1 ${name(s.big)}${tail}`
  }
  return t('{n} 层 = {count} 个 1 {unit}', { n: layers.value, count, unit: name(s.small) })
})
const cubeArt = computed(() => cubeImage(layers.value))

function pour(item: Pour) {
  if (pouring.value) return
  if (ml.value + item.ml > JUGS * 1000) {
    spill.value = true
    later(() => (spill.value = false), 500)
    uni.showToast({ title: t('量杯装不下啦'), icon: 'none' })
    vibrate('heavy')
    return
  }
  const before = ml.value
  pouring.value = item
  pourJug.value = Math.min(JUGS - 1, Math.floor(before / 1000))
  vibrate()
  later(() => {
    ml.value = before + item.ml
    passGuide('pour')
    if (Math.floor(ml.value / 1000) > Math.floor(before / 1000)) later(() => vibrate('medium'), 500)
  }, 250)
  later(() => (pouring.value = null), 900)
}

function emptyJugs() {
  ml.value = 0
  vibrate()
}

function stepLayer(delta: number) {
  if (building.value) return
  const next = Math.max(0, Math.min(10, layers.value + delta))
  if (next === layers.value) return
  layers.value = next
  vibrate(next === 10 ? 'medium' : 'light')
  passGuide('layer')
}

function buildCube() {
  if (building.value) return
  clearTimers()
  building.value = true
  layers.value = 0
  for (let at = 1; at <= 10; at += 1) {
    later(() => {
      layers.value = at
      vibrate(at === 10 ? 'medium' : 'light')
      if (at === 10) {
        building.value = false
        passGuide('layer')
      }
    }, at * 300)
  }
}

// ---- 舞台上方的提示和工具按钮 ----
const stageHint = computed(() => {
  if (mode.value === 'length') return t('按住尺子往右拖，拉出卷尺')
  if (mode.value === 'mass') return t('放砝码，让天平平衡')
  if (mode.value === 'area') return t('手指在方格上拖一拖，铺上颜色')
  return isJug.value ? t('点下面的杯子和瓶子倒水') : t('一层一层搭小方块')
})
const canReset = computed(() => {
  if (mode.value === 'length') return tick.value > 0
  if (mode.value === 'mass') return pan.value.length > 0
  if (mode.value === 'area') return filled.value > 0 && !filling.value
  return isJug.value ? ml.value > 0 : layers.value > 0 && !building.value
})

function resetStage() {
  if (mode.value === 'length') {
    tick.value = 0
    lengthObject.value = null
  } else if (mode.value === 'mass') clearPan()
  else if (mode.value === 'area') clearGrid()
  else if (isJug.value) emptyJugs()
  else layers.value = 0
  vibrate()
}

// ---- 小测验 ----
const QUESTIONS = 5
const QUIZ_MODES: Array<{ value: QuizMode; label: string }> = [
  { value: 'convert', label: '换一换' },
  { value: 'compare', label: '比一比' },
  { value: 'unit', label: '填单位' },
  { value: 'weigh', label: '称一称' },
]
const LEVELS: Array<{ value: Level; label: string }> = [
  { value: 'easy', label: '简单' },
  { value: 'medium', label: '中等' },
  { value: 'hard', label: '困难' },
]
const SIGNS: Sign[] = ['>', '=', '<']
const quizMode = ref<QuizMode>('convert')
const level = ref<Level>('easy')
const index = ref(0)
const score = ref(0)
const results = ref<Array<'right' | 'wrong' | null>>([])
const question = ref<Question | null>(null)
const picked = ref<number | null>(null)
const answer = ref<'' | 'right' | 'wrong'>('')
const finished = ref(false)
let advanceTimer: ReturnType<typeof setTimeout> | null = null

const quizIndicator = computed(() => `q-${quizMode.value}`)
const optionTexts = computed(() => {
  const q = question.value
  if (!q) return []
  if (q.mode === 'convert' || q.mode === 'weigh') return q.options.map(parts)
  if (q.mode === 'unit') return q.options.map(name)
  return SIGNS
})
const rightIndex = computed(() => {
  const q = question.value
  if (!q) return -1
  if (q.mode === 'convert' || q.mode === 'weigh') return q.options.findIndex((option) => sameParts(option, q.answer))
  if (q.mode === 'unit') return q.options.indexOf(q.fact.unit)
  return SIGNS.indexOf(q.answer)
})
const prompt = computed(() => {
  const q = question.value
  if (!q) return ''
  if (q.mode === 'convert') return `${parts(q.given)} = ${q.target.map((unit) => `(  ) ${name(unit)}`).join(' ')}`
  if (q.mode === 'compare') return ''
  if (q.mode === 'unit') return `${pick(q.fact.text, en.value)} ${q.fact.value} (  )`
  return t('{name}有多重？', { name: en.value ? q.object.name.en.toLowerCase() : q.object.name.zh })
})
const quizRule = computed(() => {
  const q = question.value
  if (!q) return ''
  if (q.mode === 'convert') {
    const units = [...q.given.map((part) => part.unit), ...q.target]
    const big = units.reduce((a, b) => (UNITS[a].base >= UNITS[b].base ? a : b))
    const smallUnit = units.reduce((a, b) => (UNITS[a].base <= UNITS[b].base ? a : b))
    return ruleText(big, smallUnit)
  }
  if (q.mode === 'compare') {
    const units = [...q.left, ...q.right].map((part) => part.unit)
    const big = units.reduce((a, b) => (UNITS[a].base >= UNITS[b].base ? a : b))
    const smallUnit = units.reduce((a, b) => (UNITS[a].base <= UNITS[b].base ? a : b))
    return t('先换成同一个单位再比：{rule}', { rule: ruleText(big, smallUnit) })
  }
  if (q.mode === 'unit') return t('想一想它在生活里有多大')
  return t('把右盘的砝码加起来')
})
const answerText = computed(() => {
  const q = question.value
  if (!q || rightIndex.value < 0) return ''
  if (q.mode === 'compare') return `${parts(q.left)} ${q.answer} ${parts(q.right)}`
  return optionTexts.value[rightIndex.value]
})
const weighTag = computed(() => {
  const q = question.value
  if (!q || q.mode !== 'weigh') return '?'
  return answer.value ? parts(q.answer) : '?'
})
const resultText = computed(() => {
  if (score.value === QUESTIONS) return t('太棒了，全部答对！')
  if (score.value >= 3) return t('不错，继续加油！')
  return t('多练几次就会啦')
})

function clearAdvance() {
  if (advanceTimer) clearTimeout(advanceTimer)
  advanceTimer = null
}

function nextQuestion() {
  clearAdvance()
  answer.value = ''
  picked.value = null
  question.value = makeQuestion(quizMode.value, level.value, question.value)
}

function newRound() {
  index.value = 0
  score.value = 0
  results.value = Array.from({ length: QUESTIONS }, () => null)
  finished.value = false
  nextQuestion()
}

function advance() {
  clearAdvance()
  if (index.value + 1 >= QUESTIONS) {
    finished.value = true
    return
  }
  index.value += 1
  nextQuestion()
}

function choose(at: number) {
  if (answer.value || !question.value) return
  picked.value = at
  const right = at === rightIndex.value
  answer.value = right ? 'right' : 'wrong'
  results.value[index.value] = answer.value
  vibrate(right ? 'light' : 'heavy')
  if (right) {
    score.value += 1
    advanceTimer = setTimeout(advance, 1600)
  }
}

function optionClass(at: number) {
  if (!answer.value) return ''
  if (at === rightIndex.value) return 'is-right'
  if (at === picked.value) return 'is-wrong'
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

function setTab(value: Tab) {
  if (tab.value === value) return
  if (guideIndex.value >= 0) endGuide()
  tab.value = value
  clearTimers()
  zooming.value = false
  filling.value = false
  building.value = false
  if (value === 'quiz' && !results.value.length) newRound()
  if (value === 'explore') later(() => maybeGuide(mode.value), 400)
}

// ---- 每个模式第一次进来时的引导 ----
type Rect = { left: number; top: number; width: number; height: number }

const guideMode = ref<Mode>('length')
const guideIndex = ref(-1)
const guideRect = ref<Rect | null>(null)
const guidePassed = ref(false)
const viewH = ref(667)
const guideSteps = computed(() => GUIDES[guideMode.value])
const guideStep = computed(() => (guideIndex.value >= 0 ? guideSteps.value[guideIndex.value] ?? null : null))
const guideKey = (value: Mode) => `uday-units-guide-${value}-v1`

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

/** 卡片放在目标下方，放不下就放上方，都放不下贴底部。 */
const cardStyle = computed(() => {
  const rect = guideRect.value
  if (!rect) return {}
  const cardH = 220
  const below = rect.top + rect.height + 16
  const above = rect.top - 16
  if (below + cardH < viewH.value) return { top: `${below}px` }
  if (above - cardH > 0) return { bottom: `${viewH.value - above}px` }
  return { bottom: '24px' }
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

function startGuide(value: Mode = mode.value) {
  if (tab.value !== 'explore') return
  guideMode.value = value
  viewH.value = windowHeight()
  guideIndex.value = 0
  setTimeout(focusGuide, 60)
}

function maybeGuide(value: Mode) {
  if (tab.value !== 'explore' || mode.value !== value || guideIndex.value >= 0) return
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

watch(mode, () => {
  rulerRect = null
  gridRect = null
})

onReady(() => {
  if (tab.value === 'explore') setTimeout(() => maybeGuide(mode.value), 600)
})
onUnload(() => {
  clearTimers()
  clearAdvance()
})
</script>

<template>
  <page-meta :page-style="pageBg.style" :background-color="pageBg.bg" :background-color-top="pageBg.bg" :background-color-bottom="pageBg.bg" :root-background-color="pageBg.bg" :background-text-style="pageBg.text" />
  <view class="theme-root page sub units-page" :class="themeClass">
    <PageHeader safe show-back :title="t('单位换算')" :caption="t('量一量、称一称、铺一铺、倒一倒')" />

    <view class="seg three">
      <view class="seg-indicator" :class="tab" />
      <text class="seg-item" :class="{ active: tab === 'explore' }" @click="setTab('explore')">{{ t('探索') }}</text>
      <text id="guide-quiz" class="seg-item" :class="{ active: tab === 'quiz' }" @click="setTab('quiz')">{{ t('小测验') }}</text>
      <text class="seg-item" :class="{ active: tab === 'print' }" @click="setTab('print')">{{ t('打印题目') }}</text>
    </view>

    <UnitsPrint v-if="tab === 'print'" />

    <template v-else-if="tab === 'explore'">
      <view class="seg small four">
        <view class="seg-indicator" :class="`m-${mode}`" />
        <text v-for="item in MODES" :key="item.value" class="seg-item" :class="{ active: mode === item.value }" @click="setMode(item.value)">{{ t(item.label) }}</text>
      </view>

      <view class="card stage">
        <view class="stage-top">
          <text class="stage-hint">{{ stageHint }}</text>
          <view class="tools">
            <view v-if="canReset" class="tool press" hover-class="press-on" hover-stay-time="80" @click="resetStage">
              <AppIcon name="eraser" tone="muted" :size="17" />
            </view>
            <view class="tool help press" hover-class="press-on" hover-stay-time="80" @click="startGuide()">
              <text>?</text>
            </view>
          </view>
        </view>

        <scroll-view id="guide-scales" scroll-x class="chip-scroll" :show-scrollbar="false">
          <view class="chip-list">
            <text v-for="item in scaleChips" :key="item.index" class="chip press" :class="{ active: scaleIndex[mode] === item.index }" hover-class="press-on" hover-stay-time="80" @click="pickScale(item.index)">{{ item.label }}</text>
          </view>
        </scroll-view>

        <!-- 长度 -->
        <template v-if="mode === 'length'">
          <view id="guide-ruler" class="ruler-box" @touchstart="onRulerStart" @touchmove.stop.prevent="onRulerMove" @touchend="onRulerEnd" @touchcancel="onRulerEnd">
            <view class="tape-row">
              <view class="tape" :class="{ live: dragging }" :style="tapeStyle">
                <view v-if="lengthObject" :key="lengthObject.art" class="tape-object pop" :style="{ backgroundImage: artImage(lengthObject.art) }" />
                <view class="tape-handle" />
              </view>
            </view>
            <view id="ruler-track" class="ruler">
              <view v-for="mark in tickMarks" :key="`${lengthScale.id}-${mark.at}`" class="tick" :class="mark.kind" :style="{ left: mark.left }" />
              <text v-for="mark in majorMarks" :key="`l-${lengthScale.id}-${mark.at}`" class="tick-label" :style="{ left: mark.left }">{{ mark.at / 10 }}</text>
              <text class="ruler-unit">{{ name(lengthScale.big) }}</text>
            </view>
          </view>
          <view class="reading">
            <text :key="lengthReading.left" class="reading-main bump">{{ lengthReading.left }}</text>
            <text v-if="lengthReading.right" class="reading-eq">=</text>
            <text v-if="lengthReading.right" :key="lengthReading.right" class="reading-alt fade-up">{{ lengthReading.right }}</text>
          </view>
          <view id="guide-objects" class="objects">
            <view v-for="item in lengthScale.objects" :key="item.art" class="object-chip press" :class="{ active: lengthObject?.art === item.art }" hover-class="press-on" hover-stay-time="80" @click="pickLength(item)">
              <view class="object-art" :style="{ backgroundImage: artImage(item.art) }" />
              <text class="object-name">{{ pick(item.name, en) }}</text>
            </view>
          </view>
        </template>

        <!-- 重量 -->
        <template v-else-if="mode === 'mass'">
          <view id="guide-balance" class="balance-box">
            <BalanceView :art="massItem.art" :load="massItem.weight" :weights="pan" :big="massScale.big" :small="massScale.small" :en="en" :tag="massTag" interactive @remove="removeWeight" />
          </view>
          <view class="status" :class="{ done: balanced }">
            <text :key="massStatus" class="status-text fade-up">{{ massStatus }}</text>
            <text v-if="pan.length && !balanced" class="status-sum">{{ t('右盘一共 {sum}', { sum: massText(panTotal) }) }}</text>
          </view>
          <view id="guide-weights" class="tray">
            <view v-for="value in massScale.weights" :key="value" class="tray-item press" hover-class="press-on" hover-stay-time="80" @click="addWeight(value)">
              <view class="weight" :style="weightStyle(value)">
                <text class="weight-text">{{ weightLabel(value) }}</text>
              </view>
            </view>
          </view>
          <view id="guide-objects" class="objects">
            <view v-for="(item, at) in massScale.objects" :key="item.art" class="object-chip press" :class="{ active: massObject === at }" hover-class="press-on" hover-stay-time="80" @click="pickMass(at)">
              <view class="object-art" :style="{ backgroundImage: artImage(item.art) }" />
              <text class="object-name">{{ pick(item.name, en) }}</text>
            </view>
          </view>
        </template>

        <!-- 面积 -->
        <template v-else-if="mode === 'area'">
          <view class="area-wrap">
            <text class="edge top">{{ pick(areaScale.edge, en) }}</text>
            <view class="area-row">
              <text class="edge side">{{ pick(areaScale.edge, en) }}</text>
              <view id="guide-grid" class="grid-frame" :class="{ full: areaFull }">
                <view id="area-grid" class="grid" @touchstart="onGridStart" @touchmove.stop.prevent="onGridMove">
                  <view v-for="(on, at) in cells" :key="at" class="cell" :class="{ on }" />
                </view>
              </view>
            </view>
            <text class="cell-note">{{ pick(areaScale.cellText, en) }}</text>
          </view>
          <view class="reading" :class="{ done: areaFull }">
            <text :key="areaReading" class="reading-main small bump">{{ areaReading }}</text>
          </view>
          <button id="guide-fill" hover-class="press-on" hover-stay-time="80" class="btn block" :disabled="filling" @click="fillRows">{{ t('一行一行铺满') }}</button>
        </template>

        <!-- 容积 -->
        <template v-else>
          <template v-if="isJug">
            <view id="guide-jugs" class="jugs" :class="{ spill }">
              <view v-for="(levelValue, at) in jugLevels" :key="at" class="jug">
                <view class="jug-glass">
                  <view class="water" :style="{ height: `${levelValue * 100}%` }">
                    <view class="wave" />
                  </view>
                  <view v-for="mark in JUG_MARKS" :key="mark" class="jug-mark" :class="{ major: mark % 500 === 0 }" :style="{ bottom: `${mark / 10}%` }">
                    <text v-if="mark % 200 === 0 || mark === 500" class="jug-num">{{ mark }}</text>
                  </view>
                  <view v-if="pouring && at === pourJug" class="stream" />
                </view>
                <text class="jug-cap">{{ at + 1 }} {{ name('l') }}</text>
              </view>
            </view>
            <view class="reading" :class="{ done: ml > 0 && ml % 1000 === 0 }">
              <text :key="volumeReading" class="reading-main small bump">{{ volumeReading }}</text>
            </view>
            <view id="guide-pours" class="objects">
              <view v-for="item in POURS" :key="item.art" class="object-chip press" :class="{ active: pouring?.art === item.art }" hover-class="press-on" hover-stay-time="80" @click="pour(item)">
                <view class="object-art" :style="{ backgroundImage: artImage(item.art) }" />
                <text class="object-name">{{ pick(item.name, en) }}</text>
                <text class="object-sub">{{ item.ml }} {{ name('ml') }}</text>
              </view>
            </view>
          </template>
          <template v-else>
            <view class="cube-box">
              <view class="cube-art" :style="{ backgroundImage: cubeArt }" />
              <text class="cube-note">{{ t('蓝色小方块是 1 {unit}，棱长 10 个排成一条棱', { unit: name(volumeScale.small) }) }}</text>
            </view>
            <view class="reading" :class="{ done: layers === 10 }">
              <text :key="volumeReading" class="reading-main small bump">{{ volumeReading }}</text>
            </view>
            <view class="layer-row">
              <view class="step-btn press" :class="{ off: layers <= 0 || building }" @click="stepLayer(-1)">−</view>
              <text :key="layers" class="step-value bump">{{ layers }}</text>
              <view class="step-btn press" :class="{ off: layers >= 10 || building }" @click="stepLayer(1)">+</view>
              <button hover-class="press-on" hover-stay-time="80" class="btn grow" :disabled="building" @click="buildCube">{{ t('一层一层搭') }}</button>
            </view>
          </template>
        </template>
      </view>

      <!-- 长度：放大镜 -->
      <view v-if="mode === 'length'" id="guide-zoom" class="card panel">
        <view class="panel-head">
          <text class="panel-title">{{ t('放大看 1 {unit}', { unit: name(lengthScale.big) }) }}</text>
          <text class="panel-link press" @click="startZoom">{{ t('数一数') }}</text>
        </view>
        <view class="zoom-bar">
          <view v-for="cell in zoomCells" :key="`${lengthScale.id}-${cell.at}`" class="zoom-cell" :class="{ on: cell.at < zoomCount }">
            <text v-if="cell.at < zoomCount" class="zoom-num pop">{{ cell.label || cell.at + 1 }}</text>
          </view>
        </view>
        <view class="zoom-ends">
          <text>0</text>
          <text>1 {{ name(lengthScale.big) }}</text>
        </view>
        <text :key="zoomText" class="zoom-text fade-up" :class="{ done: zoomCount === 10 }">{{ zoomText }}</text>
      </view>

      <!-- 单位家族 -->
      <view id="guide-ladder" class="card panel">
        <text class="panel-title">{{ t('单位家族') }}</text>
        <view class="ladder">
          <template v-for="(rung, at) in ladder" :key="rung.unit">
            <view class="rung press" :class="{ on: rungOn(rung) }" @click="pickRung(rung)">
              <text class="rung-name">{{ name(rung.unit) }}</text>
              <text v-if="rung.also" class="rung-also">= {{ name(rung.also) }}</text>
            </view>
            <view v-if="at < ladder.length - 1" class="rung-arrow" :class="{ on: rungOn(rung) && rungOn(ladder[at + 1]) }">
              <text class="rung-rate">×{{ rung.rate }}</text>
              <view class="rung-line" />
            </view>
          </template>
        </view>
        <text class="tip">{{ pick(LADDER_TIPS[mode], en) }}</text>
        <view class="feel">
          <text class="feel-text">{{ pick(feel, en) }}</text>
        </view>
      </view>
    </template>

    <view v-else class="card quiz">
      <view class="seg small four">
        <view class="seg-indicator" :class="quizIndicator" />
        <text v-for="item in QUIZ_MODES" :key="item.value" class="seg-item" :class="{ active: quizMode === item.value }" @click="setQuizMode(item.value)">{{ t(item.label) }}</text>
      </view>
      <view class="level-row">
        <text class="level-label">{{ t('难度') }}</text>
        <view class="chip-row tight">
          <text v-for="item in LEVELS" :key="item.value" class="chip press" :class="{ active: level === item.value }" hover-class="press-on" hover-stay-time="80" @click="setLevel(item.value)">{{ t(item.label) }}</text>
        </view>
      </view>

      <view v-if="!finished && question" class="question">
        <view class="progress">
          <view v-for="(item, at) in results" :key="at" class="dot" :class="[item, { current: at === index && !item }]" />
          <text class="progress-text">{{ t('第 {n}/{total} 题 · 得分 {score}', { n: index + 1, total: QUESTIONS, score }) }}</text>
        </view>

        <view v-if="question.mode === 'weigh'" class="quiz-balance">
          <BalanceView :art="question.object.art" :load="question.weight" :weights="question.weights" :big="question.big" :small="question.small" :en="en" :tag="weighTag" />
        </view>

        <view v-if="question.mode === 'compare'" class="compare">
          <text class="compare-side">{{ parts(question.left) }}</text>
          <view :key="answer || 'q'" class="compare-sign pop" :class="answer">{{ answer ? question.answer : picked !== null ? SIGNS[picked] : '?' }}</view>
          <text class="compare-side">{{ parts(question.right) }}</text>
        </view>
        <text v-else :key="prompt" class="prompt fade-up">{{ prompt }}</text>

        <view class="options" :class="{ signs: question.mode === 'compare', three: question.mode === 'unit' }">
          <view v-for="(text, at) in optionTexts" :key="`${index}-${at}`" class="option press" :class="optionClass(at)" hover-class="press-on" hover-stay-time="80" @click="choose(at)">
            <text class="option-text">{{ text }}</text>
          </view>
        </view>

        <view class="feedback" :class="answer">
          <text v-if="answer === 'right'">{{ t('答对了，真棒！') }} {{ quizRule }}</text>
          <text v-else-if="answer === 'wrong'">{{ t('再想想，正确答案是 {answer}', { answer: answerText }) }}</text>
          <text v-else>{{ quizRule }}</text>
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
    </view>

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
.units-page { padding-bottom: calc(40px + var(--safe-bottom)); }
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
.seg-indicator.quiz, .seg-indicator.m-mass, .seg-indicator.q-compare { transform: translateX(100%); }
.seg-indicator.print, .seg-indicator.m-area, .seg-indicator.q-unit { transform: translateX(200%); }
.seg-indicator.m-volume, .seg-indicator.q-weigh { transform: translateX(300%); }
.seg-item { position: relative; z-index: 1; flex: 1; height: 38px; color: var(--muted); font-size: 14px; font-weight: 700; line-height: 38px; text-align: center; white-space: nowrap; }
.seg-item.active { color: var(--accent-text); }
.seg.small .seg-item { height: 34px; font-size: 13px; line-height: 34px; }
.theme-dark .seg { border-color: var(--line); background: var(--paper); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 10px 24px -16px rgba(0, 0, 0, 0.6); }
.theme-dark .seg-indicator { background: var(--surface-2); box-shadow: 0 6px 14px -8px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.06); }
.theme-dark .seg.small { border-color: transparent; background: var(--surface-2); box-shadow: none; }
.theme-dark .seg.small .seg-indicator { background: var(--paper); }

.stage { padding: 12px 14px 16px; border-radius: 28px; }
.stage-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 28px; padding: 0 2px 8px; }
.stage-hint { flex: 1; min-width: 0; color: var(--muted); font-size: 13px; line-height: 1.4; }
.tools { display: flex; flex: none; gap: 6px; }
.tool { display: flex; width: 34px; height: 34px; align-items: center; justify-content: center; border-radius: 11px; background: var(--surface-2); }
.tool.help { color: var(--muted); font-size: 16px; font-weight: 800; }
.chip-scroll { width: 100%; white-space: nowrap; }
.chip-list { display: inline-flex; gap: 8px; padding: 2px 2px 4px; }
.chip-list .chip { flex: none; white-space: nowrap; }

.reading { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: center; gap: 8px; min-height: 44px; margin-top: 12px; padding: 10px 14px; border-radius: 16px; background: var(--surface-2); transition: background 0.3s ease; }
.reading.done { background: rgba(52, 199, 123, 0.14); }
.reading-main { color: #ff6a33; font-size: 24px; font-weight: 800; line-height: 1.3; text-align: center; }
.reading-main.small { font-size: 17px; }
.reading.done .reading-main { color: #1f9d5c; }
.reading-eq { color: var(--muted); font-size: 18px; font-weight: 700; }
.reading-alt { color: var(--ink); font-size: 20px; font-weight: 800; }

.objects { display: flex; gap: 8px; margin-top: 12px; }
.object-chip { display: flex; flex: 1; flex-direction: column; align-items: center; gap: 2px; padding: 8px 4px; border: 1px solid var(--line); border-radius: 16px; background: var(--paper); transition: border-color 0.25s ease, background 0.25s ease, transform 0.25s ease; }
.object-chip.active { border-color: #ff9a6b; background: var(--accent-soft); transform: translateY(-2px); }
.object-art { width: 40px; height: 40px; background-size: contain; background-repeat: no-repeat; background-position: center; }
.object-name { color: var(--ink); font-size: 12px; font-weight: 700; text-align: center; }
.object-sub { color: var(--muted); font-size: 11px; font-weight: 650; }

/* 长度 */
.ruler-box { margin-top: 10px; padding: 34px 16px 6px; border-radius: 20px; background: var(--paper); }
.tape-row { position: relative; height: 26px; }
.tape { position: relative; height: 18px; margin-top: 4px; border-radius: 4px 9px 9px 4px; background: repeating-linear-gradient(90deg, #ffb45c 0, #ffb45c 10px, #ff9a4d 10px, #ff9a4d 20px); box-shadow: 0 4px 10px -6px rgba(241, 90, 54, 0.8); transition: width 0.7s cubic-bezier(0.34, 1.3, 0.64, 1); }
.tape.live { transition: none; }
.tape-handle { position: absolute; top: -6px; right: -8px; width: 16px; height: 30px; border-radius: 6px; background: #f15a36; box-shadow: 0 3px 8px -3px rgba(241, 90, 54, 0.9); }
.tape-object { position: absolute; right: -18px; bottom: 22px; width: 36px; height: 36px; background-size: contain; background-repeat: no-repeat; background-position: center bottom; }
.ruler { position: relative; height: 54px; margin-top: 4px; border-radius: 6px; background: linear-gradient(180deg, #fff6d9, #ffe9a8); box-shadow: inset 0 0 0 1px #f0cf74; }
.tick { position: absolute; top: 0; width: 1px; margin-left: -0.5px; background: #6b5313; }
.tick.minor { height: 9px; opacity: 0.7; }
.tick.mid { height: 14px; }
.tick.major { height: 20px; width: 2px; margin-left: -1px; }
.tick-label { position: absolute; top: 22px; width: 30px; margin-left: -15px; color: #6b5313; font-size: 12px; font-weight: 800; text-align: center; }
.ruler-unit { position: absolute; right: 4px; bottom: 2px; color: #a3842c; font-size: 10px; font-weight: 700; }

.zoom-bar { display: flex; gap: 3px; margin-top: 12px; }
.zoom-cell { display: flex; flex: 1; height: 44px; align-items: center; justify-content: center; border-radius: 8px; background: var(--track); transition: background 0.3s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.zoom-cell.on { background: linear-gradient(180deg, #ffb45c, #ff7a45); transform: scaleY(1.08); }
.zoom-num { color: #fff; font-size: 13px; font-weight: 800; }
.zoom-ends { display: flex; justify-content: space-between; margin-top: 6px; color: var(--muted); font-size: 12px; font-weight: 700; }
.zoom-text { display: block; margin-top: 10px; color: var(--ink); font-size: 15px; font-weight: 750; text-align: center; }
.zoom-text.done { color: #1f9d5c; }

/* 重量 */
.balance-box { margin-top: 8px; padding-top: 10px; border-radius: 20px; background: var(--paper); }
.status { display: flex; flex-direction: column; align-items: center; gap: 4px; min-height: 44px; margin-top: 10px; padding: 10px 14px; border-radius: 16px; background: var(--surface-2); transition: background 0.3s ease; }
.status.done { background: rgba(52, 199, 123, 0.14); }
.status-text { color: var(--ink); font-size: 15px; font-weight: 750; line-height: 1.45; text-align: center; }
.status.done .status-text { color: #1f9d5c; }
.status-sum { color: var(--muted); font-size: 12px; font-weight: 650; }
.tray { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: center; gap: 6px 10px; margin-top: 12px; padding: 14px 8px 10px; border-radius: 18px; background: var(--surface-2); }
.tray-item { display: flex; padding-top: 8px; }
.weight {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10rpx 10rpx 14rpx 14rpx;
  background: linear-gradient(160deg, #ffe08a 0%, #f2b13b 55%, #d48a1f 100%);
  box-shadow: inset 0 -4rpx 0 rgba(150, 90, 10, 0.35), 0 4rpx 8rpx -4rpx rgba(120, 80, 20, 0.6);
}
.weight::before { content: ''; position: absolute; top: -12rpx; left: 50%; width: 22rpx; height: 14rpx; margin-left: -11rpx; border-radius: 8rpx 8rpx 2rpx 2rpx; background: #d99a2b; }
.weight-text { color: #6b3f05; font-weight: 800; line-height: 1; white-space: nowrap; }

/* 面积 */
.area-wrap { display: flex; flex-direction: column; align-items: center; margin-top: 10px; padding: 12px 10px 10px; border-radius: 20px; background: var(--paper); }
.edge { color: #3b82f6; font-size: 12px; font-weight: 750; }
.edge.top { margin-bottom: 6px; padding-left: 26px; }
.area-row { display: flex; align-items: center; }
.edge.side { width: 22px; writing-mode: vertical-rl; text-align: center; }
.grid-frame { padding: 3px; border-radius: 10px; background: #3b82f6; transition: background 0.4s ease, box-shadow 0.4s ease; }
.grid-frame.full { background: #34c77b; box-shadow: 0 0 0 6px rgba(52, 199, 123, 0.2); }
.grid { display: flex; flex-wrap: wrap; width: 500rpx; height: 500rpx; overflow: hidden; border-radius: 7px; background: #ffffff; }
.cell { width: 10%; height: 10%; box-sizing: border-box; border-right: 1px solid #dbe5f5; border-bottom: 1px solid #dbe5f5; background: #ffffff; transition: background 0.25s ease, transform 0.25s ease; }
.cell.on { background: #ffcf4d; border-color: #f2b636; }
.grid-frame.full .cell.on { background: #7be0a8; border-color: #4fcd8a; }
.cell-note { margin-top: 8px; color: var(--muted); font-size: 12px; font-weight: 650; }
.area-wrap + .reading + .btn { margin-top: 12px; }

/* 容积 */
.jugs { display: flex; justify-content: center; gap: 28px; margin-top: 10px; padding: 16px 10px 10px; border-radius: 20px; background: var(--paper); }
.jugs.spill { animation: shake 0.4s ease; }
.jug { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.jug-glass { position: relative; width: 120px; height: 190px; overflow: hidden; border: 3px solid #b8cbe4; border-top-width: 0; border-radius: 0 0 22px 22px; background: rgba(214, 234, 255, 0.35); }
.water { position: absolute; right: 0; bottom: 0; left: 0; background: linear-gradient(180deg, #8fd0ff, #4fa3ff); transition: height 0.8s cubic-bezier(0.34, 1.2, 0.64, 1); }
.wave { position: absolute; top: -4px; right: 0; left: 0; height: 8px; border-radius: 50%; background: #b5e0ff; }
.jug-mark { position: absolute; left: 0; width: 14px; height: 1.5px; background: #6b7f9e; }
.jug-mark.major { width: 24px; height: 2px; }
.jug-num { position: absolute; top: -8px; left: 28px; color: #5b6f8e; font-size: 10px; font-weight: 700; }
.stream { position: absolute; top: 0; left: 50%; width: 10px; height: 100%; margin-left: -5px; border-radius: 5px; background: linear-gradient(180deg, rgba(79, 163, 255, 0.9), rgba(79, 163, 255, 0.4)); animation: stream 0.9s ease forwards; }
.jug-cap { color: var(--muted); font-size: 12px; font-weight: 700; }

.cube-box { display: flex; flex-direction: column; align-items: center; margin-top: 10px; padding: 14px 10px 10px; border-radius: 20px; background: var(--paper); }
.cube-art { width: 440rpx; height: 440rpx; background-size: contain; background-repeat: no-repeat; background-position: center; }
.cube-note { margin-top: 6px; color: var(--muted); font-size: 12px; font-weight: 650; text-align: center; }
.layer-row { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
.step-btn { display: flex; width: 38px; height: 38px; flex: none; align-items: center; justify-content: center; border-radius: 50%; background: var(--surface-2); color: var(--ink); font-size: 22px; line-height: 1; transition: opacity 0.2s ease; }
.step-btn.off { opacity: 0.3; pointer-events: none; }
.step-value { width: 34px; color: var(--ink); font-size: 24px; font-weight: 800; text-align: center; }
.btn.grow { flex: 1; }

/* 单位家族 */
.panel { margin-top: 14px; }
.panel-head { display: flex; align-items: center; justify-content: space-between; }
.panel-title { display: block; color: var(--ink); font-size: 14px; font-weight: 750; }
.panel-link { padding: 4px 12px; border-radius: 999px; background: var(--accent-soft); color: var(--accent-text); font-size: 12px; font-weight: 750; }
.ladder { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 0; margin-top: 12px; }
.rung { display: flex; flex-direction: column; align-items: center; padding: 6px 10px; border: 1px solid var(--line); border-radius: 12px; background: var(--paper); transition: background 0.25s ease, border-color 0.25s ease, transform 0.25s ease; }
.rung.on { border-color: #ff9a6b; background: var(--accent-soft); transform: translateY(-2px); }
.rung-name { color: var(--ink); font-size: 13px; font-weight: 750; white-space: nowrap; }
.rung.on .rung-name { color: var(--accent-text); }
.rung-also { color: var(--muted); font-size: 10px; font-weight: 650; }
.rung-arrow { display: flex; flex-direction: column; align-items: center; min-width: 40px; padding: 0 2px; }
.rung-rate { color: var(--muted); font-size: 11px; font-weight: 800; }
.rung-arrow.on .rung-rate { color: #ff6a33; }
.rung-line { position: relative; width: 100%; height: 2px; margin-top: 2px; background: var(--line); }
.rung-line::after { content: ''; position: absolute; top: -3px; right: -1px; border-top: 4px solid transparent; border-bottom: 4px solid transparent; border-left: 6px solid var(--line); }
.rung-arrow.on .rung-line { background: #ff9a6b; }
.rung-arrow.on .rung-line::after { border-left-color: #ff9a6b; }
.tip { display: block; margin-top: 12px; color: var(--muted); font-size: 12px; line-height: 1.6; }
.feel { margin-top: 10px; padding: 10px 12px; border-radius: 12px; background: var(--surface-2); }
.feel-text { color: var(--ink); font-size: 13px; font-weight: 650; line-height: 1.55; }

/* 小测验 */
.level-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.level-label { color: var(--ink); font-size: 14px; font-weight: 650; }
.question { display: flex; flex-direction: column; align-items: center; }
.progress { display: flex; align-items: center; gap: 6px; margin-top: 10px; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--track); transition: background 0.3s ease, transform 0.3s ease; }
.dot.current { background: #ffb08d; transform: scale(1.25); }
.dot.right { background: #34c77b; }
.dot.wrong { background: #f15a36; }
.progress-text { margin-left: 6px; color: var(--muted); font-size: 12px; }
.quiz-balance { align-self: stretch; margin-top: 12px; padding-top: 10px; border-radius: 20px; background: var(--surface-2); }
.prompt { margin-top: 16px; color: var(--ink); font-size: 19px; font-weight: 800; line-height: 1.5; text-align: center; }
.compare { display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 18px; }
.compare-side { color: var(--ink); font-size: 18px; font-weight: 800; text-align: center; }
.compare-sign { display: flex; width: 44px; height: 44px; flex: none; align-items: center; justify-content: center; border-radius: 50%; background: var(--surface-2); color: var(--ink); font-size: 22px; font-weight: 800; }
.compare-sign.right { background: #34c77b; color: #fff; }
.compare-sign.wrong { background: #f15a36; color: #fff; }
.options { display: flex; flex-wrap: wrap; justify-content: space-between; align-self: stretch; gap: 10px; margin-top: 16px; }
.option { display: flex; width: calc(50% - 5px); min-height: 56px; align-items: center; justify-content: center; padding: 6px 8px; border: 1px solid var(--line); border-radius: 16px; box-sizing: border-box; background: var(--paper); transition: background 0.25s ease, opacity 0.25s ease, transform 0.25s ease; }
.options.signs .option, .options.three .option { width: calc((100% - 20px) / 3); }
.options.signs .option-text { font-size: 26px; }
.option-text { color: var(--ink); font-size: 16px; font-weight: 800; text-align: center; }
.is-right { border-color: #34c77b; background: #34c77b; transform: scale(1.03); }
.is-wrong { border-color: #f15a36; background: #f15a36; }
.is-right .option-text, .is-wrong .option-text { color: #fff; }
.is-dim { opacity: 0.45; }
.feedback { align-self: stretch; margin-top: 12px; padding: 8px 14px; border-radius: 12px; color: var(--muted); font-size: 13px; font-weight: 650; line-height: 1.55; text-align: center; transition: background 0.25s ease, color 0.25s ease; }
.feedback.right { background: rgba(52, 199, 123, 0.14); color: #1f9d5c; }
.feedback.wrong { background: rgba(241, 90, 54, 0.12); color: #d9482a; }
.question .btn.block { align-self: stretch; margin-top: 12px; }
.result { display: flex; flex-direction: column; align-items: center; padding: 26px 0 6px; }
.result-score { color: var(--ink); font-size: 56px; font-weight: 800; }
.result-total { color: var(--muted); font-size: 24px; }
.result-dots { display: flex; gap: 8px; margin-top: 8px; }
.result-dots .dot { width: 12px; height: 12px; }
.result-text { margin: 14px 0 18px; color: var(--ink); font-size: 15px; font-weight: 700; }
.result .btn.block { align-self: stretch; }

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
.pop { animation: bump 0.45s cubic-bezier(0.34, 1.56, 0.64, 1); }
.fade-up { animation: fade-up 0.35s ease; }
@keyframes bump {
  0% { transform: scale(0.6); opacity: 0.4; }
  60% { transform: scale(1.12); opacity: 1; }
  100% { transform: scale(1); }
}
@keyframes fade-up {
  0% { opacity: 0; transform: translateY(6px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-8px); }
  75% { transform: translateX(8px); }
}
@keyframes stream {
  0% { transform: scaleY(0); transform-origin: top; opacity: 1; }
  40% { transform: scaleY(1); transform-origin: top; opacity: 1; }
  100% { transform: scaleY(1); opacity: 0; }
}
</style>
