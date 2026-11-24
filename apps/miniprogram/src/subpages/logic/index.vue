<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onMounted, ref, watch } from 'vue'
import { onReady, onShareAppMessage, onShareTimeline, onUnload } from '@dcloudio/uni-app'
import { TOOL_SHARE_TITLES, toolMoments, toolShare, useSearchTitle } from '@/utils/share'
import { useFamilyPage } from '@/composables/useFamilyPage'
import { usePageBackground, useThemePage } from '@/utils/wx-theme'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import { isEn, t } from '@/i18n'
import { BRIEF, HOWTO, NAMES, NOTES, WEIGH, pick, type Text } from './lessons'
import LogicBalance from './Balance.vue'
import CipherLock from './CipherLock.vue'
import { hitAt, paint, stageHeight, type Scene } from './draw'
import {
  STAGES,
  applyMore,
  boardRider,
  boxStep,
  boxWon,
  canDrop,
  canSlide,
  crossRiver,
  edgeKey,
  frogMove,
  frogTargets,
  frogWon,
  hanoiWon,
  klotskiWon,
  lightTap,
  lightsOut,
  makeRound,
  moreWon,
  pipeWon,
  riverWon,
  slidePull,
  slideWon,
  solve,
  traceDegree,
  traceWon,
  weigh,
  type Block,
  type Dir,
  type Move,
  type Round,
} from './play'
import { type PackPiece } from './more'

useFamilyPage()
const themeClass = useThemePage()
const pageBg = usePageBackground()
const instance = getCurrentInstance()
const en = computed(() => isEn())

const SAVE_KEY = 'uday-logic-gate-v3'
const last = STAGES.length - 1

type Point = { x: number; y: number }
type TouchLike = { touches?: ArrayLike<Point & { clientX?: number; pageX?: number; clientY?: number; pageY?: number }>; changedTouches?: ArrayLike<Point & { clientX?: number; pageX?: number; clientY?: number; pageY?: number }> }
type Rect = { left: number; top: number; width: number; height: number }
type Canvas2D = {
  width: number
  height: number
  requestAnimationFrame?: (cb: () => void) => number
  cancelAnimationFrame?: (id: number) => void
  getContext: (type: '2d') => CanvasRenderingContext2D
}

onShareAppMessage(() => toolShare('logic', '/subpages/logic/index'))
onShareTimeline(() => toolMoments('logic'))
useSearchTitle(() => t(TOOL_SHARE_TITLES.logic))

function vibrate(type: 'light' | 'medium' | 'heavy' = 'light') {
  uni.vibrateShort({ type })
}

function pointOf(event: TouchLike): Point | null {
  const touch = event.touches?.[0] ?? event.changedTouches?.[0]
  if (!touch) return null
  return { x: touch.clientX ?? touch.pageX ?? touch.x ?? 0, y: touch.clientY ?? touch.pageY ?? touch.y ?? 0 }
}

function readCleared() {
  const raw = uni.getStorageSync(SAVE_KEY)
  const value = Number(raw)
  if (raw === '' || raw === null || raw === undefined || !Number.isInteger(value) || value < 0) return -1
  return Math.min(value, last)
}

let timers: Array<ReturnType<typeof setTimeout>> = []
function later(fn: () => void, ms: number) {
  timers.push(setTimeout(fn, ms))
}
function clearTimers() {
  timers.forEach(clearTimeout)
  timers = []
}

const cleared = ref(readCleared())
const at = ref(Math.min(cleared.value + 1, last))
const round = ref<Round>(makeRound(at.value))
const serial = ref(0)
const mark = ref<'' | 'right' | 'wrong'>('')
const shake = ref(false)
const busy = ref(false)
const advancing = ref(false)
const dirty = ref(false)
const stuck = ref(false)
const answering = ref(false)
const hintOpen = ref(false)
const moves = ref(0)
const note = ref<Text | null>(null)
const scrollLeft = ref(0)
const boatT = ref(0)
const hop = ref<Scene['hop']>(null)
const eat = ref<Scene['eat']>(null)
const dragId = ref(-1)
const dragX = ref(0)
const dragY = ref(0)
const landed = ref<Record<number, number>>({})
const cipherSeen = ref<boolean[]>([])

const stage = computed(() => STAGES[at.value])
const brief = computed(() => BRIEF[stage.value.id])
const howto = computed(() => HOWTO[stage.value.id] ?? [])
const boardHeight = computed(() => stageHeight(round.value.kind))
const stageHint = computed(() => t('第 {n} 关 · {name}', { n: at.value + 1, name: t(stage.value.name) }))
const progressText = computed(() => t('已过 {done}/{total} 关', { done: Math.max(0, cleared.value + 1), total: STAGES.length }))
const prompt = computed(() => pick(brief.value.prompt, en.value))
const praise = computed(() => pick(brief.value.praise, en.value))
const feedbackText = computed(() => {
  if (mark.value === 'right' && at.value === last && cleared.value === last) return `${praise.value} ${t('全部走完了')}`
  if (mark.value === 'right') return praise.value
  if (note.value && mark.value === 'wrong') return pick(note.value, en.value)
  if (mark.value === 'wrong') return t('再看看')
  return progressText.value
})
const canReset = computed(() => dirty.value && mark.value !== 'right' && !busy.value)
const moveText = computed(() => {
  const item = round.value
  if (item.kind === 'scale') return t('还能称 {n} 次', { n: Math.max(0, item.limit - item.used) })
  return t('已走 {n} 步', { n: moves.value })
})
const scaleView = computed(() => {
  const item = round.value
  if (item.kind !== 'scale') return null
  const tray = item.weights.map((_, id) => id).filter((id) => !item.left.includes(id) && !item.right.includes(id))
  const last = item.log[item.log.length - 1]
  const same = (a: number[], b: number[]) => a.length === b.length && a.every((id) => b.includes(id))
  const showing = !!last && same(last.left, item.left) && same(last.right, item.right)
  const tilt = !showing || !last ? 0 : last.result === 'L' ? -12 : last.result === 'R' ? 12 : 0
  return { left: item.left, right: item.right, tray, tilt, even: showing && last.result === '=' }
})
const sailing = computed(() => round.value.kind === 'river' && Math.abs(boatT.value - round.value.boat) > 0.04)
const sailText = computed(() => {
  if (round.value.kind !== 'river') return t('开到右岸')
  const goingTo = sailing.value ? round.value.boat : ((round.value.boat ^ 1) as 0 | 1)
  return goingTo === 1 ? t('开到右岸') : t('开到左岸')
})

let gesture = 0
let canvas: Canvas2D | null = null
let ctx: CanvasRenderingContext2D | null = null
let cssW = 0
let cssH = 0
let canvasRect: Rect | null = null
let clock = 0
let loopOn = false
let rafId = 0
let timerId: ReturnType<typeof setTimeout> | null = null
let touchMode: '' | 'tap' | 'trace' | 'box' | 'tilt' | 'flow' | 'scale' | 'klot' | 'pack' | 'hanoi' = ''
const CODE_COLORS = ['#f15a36', '#3db7e8', '#ffd15c', '#8b6cf0', '#3ecf8e', '#ff8fab']
let flowPath: number[] = []
let packHold: PackPiece | null = null
let startPt: Point | null = null
let pendingTap = ''
let klotOrigin: Block[] | null = null
let klotPoint: Point | null = null
let hanoiFrom = -1

function focusStone(index = at.value) {
  const next = Math.max(0, index * 64 - 80)
  scrollLeft.value = next === scrollLeft.value ? next + 1 : next
}

function locked() {
  return busy.value || answering.value || stuck.value || mark.value === 'right'
}

function scene(): Scene {
  const names: Record<string, string> = {}
  Object.keys(NAMES).forEach((id) => {
    names[id] = pick(NAMES[id], en.value)
  })
  const item = round.value
  if (item.kind === 'river') {
    item.riders.forEach((rider) => {
      if (rider.w > 1 && names[rider.id]) names[rider.id] = `${names[rider.id]} ${rider.w}`
    })
  }
  return {
    round: item,
    w: cssW,
    h: cssH,
    time: clock,
    boat: boatT.value,
    hop: hop.value,
    eat: eat.value,
    names,
    leftShore: t('左岸'),
    rightShore: t('右岸'),
    offBoat: t('下船'),
    dragId: dragId.value,
    dragX: dragX.value,
    dragY: dragY.value,
    flowPath: [...flowPath],
    carry: touchMode === 'scale',
  }
}

function stopLoop() {
  loopOn = false
  if (rafId && canvas?.cancelAnimationFrame) canvas.cancelAnimationFrame(rafId)
  if (timerId) clearTimeout(timerId)
  rafId = 0
  timerId = null
}

function startLoop() {
  if (loopOn) return
  loopOn = true
  const tick = () => {
    if (!loopOn) return
    frame()
    const canvasRaf = canvas?.requestAnimationFrame
    if (canvasRaf) rafId = canvasRaf.call(canvas, tick)
    else timerId = setTimeout(tick, 32)
  }
  tick()
}

function frame() {
  clock += 1
  const item = round.value
  if (item.kind === 'river') {
    const target = item.boat
    boatT.value += (target - boatT.value) * 0.12
    if (Math.abs(target - boatT.value) < 0.01) boatT.value = target
  }
  if (hop.value) {
    const next = hop.value.t + 0.08
    hop.value = next >= 1 ? null : { ...hop.value, t: next }
  }
  if (eat.value) {
    const next = eat.value.t + 0.025
    eat.value = next >= 1.45 ? null : { ...eat.value, t: next }
  }
  if (item.kind === 'scale' || item.kind === 'cipher' || !ctx || !cssW || !cssH) return
  paint(ctx, scene())
}

function bindCanvas(attempt = 0) {
  const proxy = instance?.proxy
  if (!proxy) return
  uni.createSelectorQuery().in(proxy).select('#logic-canvas').fields({ node: true, size: true }, () => {}).exec((res) => {
    const field = res?.[0] as { node?: Canvas2D; width?: number; height?: number } | undefined
    const node = field?.node
    if (!node || !field?.width || !field.height) {
      if (attempt < 6) setTimeout(() => bindCanvas(attempt + 1), 80)
      return
    }
    canvas = node
    cssW = field.width
    cssH = field.height
    const ratio = uni.getWindowInfo?.().pixelRatio || 2
    node.width = cssW * ratio
    node.height = cssH * ratio
    ctx = node.getContext('2d')
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    startLoop()
  })
}

function deal() {
  clearTimers()
  answering.value = false
  busy.value = false
  advancing.value = false
  mark.value = ''
  shake.value = false
  dirty.value = false
  stuck.value = false
  moves.value = 0
  note.value = null
  hop.value = null
  eat.value = null
  dragId.value = -1
  dragX.value = 0
  dragY.value = 0
  landed.value = {}
  cipherSeen.value = []
  touchMode = ''
  klotOrigin = null
  packHold = null
  flowPath = []
  hanoiFrom = -1
  serial.value += 1
  round.value = makeRound(at.value)
  boatT.value = round.value.kind === 'river' ? round.value.boat : 0
  if (round.value.kind === 'scale' || round.value.kind === 'cipher') {
    ctx = null
    canvas = null
  }
}

function openGate(index: number) {
  if (index < 0 || index > last || index > cleared.value + 1) return
  if (index === at.value && mark.value !== 'right') return
  at.value = index
  deal()
  focusStone(index)
}

function succeed() {
  if (busy.value || answering.value) return
  busy.value = true
  mark.value = 'right'
  note.value = null
  const isNew = at.value > cleared.value
  if (isNew) {
    cleared.value = at.value
    uni.setStorageSync(SAVE_KEY, cleared.value)
  }
  vibrate('light')
  if (isNew && at.value < last) {
    advancing.value = true
    const next = at.value + 1
    later(() => openGate(next), 1400)
  }
}

function say(code: string) {
  note.value = NOTES[code] ?? null
  mark.value = 'wrong'
  shake.value = true
  vibrate('heavy')
  later(() => {
    shake.value = false
  }, 400)
}

function fail(code: string) {
  if (code === 'fox' || code === 'hen') {
    eat.value = { who: code, t: 0, text: t(code === 'fox' ? '狐狸吃鸡了' : '鸡吃米了') }
  }
  say(code)
}

function moved() {
  dirty.value = true
  note.value = null
  if (mark.value !== 'right') mark.value = ''
  moves.value += 1
  vibrate('light')
}

function resetStage() {
  if (!canReset.value) return
  deal()
  vibrate()
}

function showHint() {
  hintOpen.value = true
}

function keepHint() {}

function apply(move: Move): number | string {
  const item = round.value
  if (move.op === 'frog' && item.kind === 'frog') {
    const next = frogMove(item.pads, move.from, move.to)
    if (!next) return 'frog'
    hop.value = { from: move.from, to: move.to, t: 0 }
    item.pads = next
    moved()
    if (frogWon(item)) succeed()
    return 420
  }
  if (move.op === 'board' && item.kind === 'river') {
    const next = boardRider(item, move.id)
    if (typeof next === 'string') return next
    round.value = next
    dirty.value = true
    note.value = null
    if (mark.value !== 'right') mark.value = ''
    return 280
  }
  if (move.op === 'cross' && item.kind === 'river') {
    const next = crossRiver(item)
    if (typeof next === 'string') return next
    round.value = next
    moved()
    if (riverWon(next)) succeed()
    return 780
  }
  if (move.op === 'light' && item.kind === 'lights') {
    item.on = lightTap(item.on, move.index, item.n)
    moved()
    if (lightsOut(item.on)) succeed()
    return 380
  }
  if (move.op === 'pipe' && item.kind === 'pipes') {
    if (item.tiles[move.index]?.lock) return ''
    item.tiles = item.tiles.map((tile, index) => (index === move.index ? { ...tile, rot: (tile.rot + 1) % 4 } : tile))
    moved()
    if (pipeWon(item)) succeed()
    return 380
  }
  if (move.op === 'trace' && item.kind === 'trace') {
    const index = move.node
    if (!item.path.length) {
      if (item.oddStart && traceDegree(item, index) % 2 === 0) return 'start'
      item.path = [index]
      dirty.value = true
      note.value = null
      if (mark.value !== 'right') mark.value = ''
      vibrate('light')
      return 280
    }
    const lastNode = item.path[item.path.length - 1]
    if (lastNode === index) return ''
    const key = edgeKey(lastNode, index)
    const exists = item.edges.some((edge) => edgeKey(edge[0], edge[1]) === key)
    if (!exists || item.used.includes(key)) return 'trace'
    item.path = [...item.path, index]
    item.used = [...item.used, key]
    moved()
    if (traceWon(item)) succeed()
    return 280
  }
  if (move.op === 'pan' && item.kind === 'scale') {
    const left = item.left.filter((id) => id !== move.id)
    const right = item.right.filter((id) => id !== move.id)
    if (move.zone === 'left') left.push(move.id)
    if (move.zone === 'right') right.push(move.id)
    item.left = left
    item.right = right
    dirty.value = true
    note.value = null
    if (mark.value !== 'right') mark.value = ''
    dragId.value = move.id
    landed.value = { ...landed.value, [move.id]: (landed.value[move.id] ?? 0) + 1 }
    return 280
  }
  if (move.op === 'weigh' && item.kind === 'scale') {
    const result = weigh(item)
    if (result === 'same' || result === 'limit') return result
    item.log = [...item.log, { left: [...item.left], right: [...item.right], result }]
    item.used += 1
    dirty.value = true
    note.value = null
    if (mark.value !== 'right') mark.value = ''
    vibrate('medium')
    return 450
  }
  if (move.op === 'accuse' && item.kind === 'scale') {
    if (move.id < 0) return ''
    if (move.id === item.heavy) {
      succeed()
      return 380
    }
    stuck.value = true
    dirty.value = true
    return 'nope'
  }
  if (move.op === 'box' && item.kind === 'box') {
    const next = boxStep(item, move.dir)
    if (!next) return 'wall'
    round.value = next
    moved()
    if (boxWon(next)) succeed()
    return 380
  }
  if (move.op === 'slide' && item.kind === 'slide') {
    const next = slidePull(item.tiles, move.index)
    if (!next) return ''
    item.tiles = next
    moved()
    if (slideWon(next)) succeed()
    return 380
  }
  if (move.op === 'klot' && item.kind === 'klotski') {
    if (!canSlide(item, move.id, move.dir)) return 'wall'
    const blocks = item.blocks.map((block) => ({ ...block }))
    const block = blocks.find((entry) => entry.id === move.id)
    if (!block) return 'wall'
    if (move.dir === 'up') block.r -= 1
    if (move.dir === 'down') block.r += 1
    if (move.dir === 'left') block.c -= 1
    if (move.dir === 'right') block.c += 1
    item.blocks = blocks
    moved()
    if (klotskiWon(item)) succeed()
    return 380
  }
  if (move.op === 'hanoi' && item.kind === 'hanoi') {
    if (!canDrop(item.pegs, move.from, move.to) || move.from === move.to) return 'disk'
    const pegs = item.pegs.map((peg) => [...peg])
    const disk = pegs[move.from].pop()
    if (disk === undefined) return 'disk'
    pegs[move.to].push(disk)
    item.pegs = pegs
    moved()
    if (hanoiWon(pegs)) succeed()
    return 380
  }
  const more = applyMore(item as Round, move)
  if (more) {
    if (more.err) return more.err
    round.value = more.round
    dragId.value = -1
    if (move.op === 'cipher') {
      const seen = cipherSeen.value.slice()
      seen[move.index] = true
      cipherSeen.value = seen
    }
    moved()
    if (moreWon(more.round)) succeed()
    if (move.op === 'tilt' || move.op === 'flow') return 420
    if (move.op === 'peg' || move.op === 'knight') return 320
    return 380
  }
  return ''
}

function playAnswer() {
  if (answering.value || busy.value || mark.value === 'right') return
  clearTimers()
  mark.value = ''
  note.value = null
  shake.value = false
  stuck.value = false
  hop.value = null
  eat.value = null
  dragId.value = -1
  dragX.value = 0
  dragY.value = 0
  moves.value = 0
  dirty.value = true
  cipherSeen.value = []
  round.value = makeRound(at.value)
  boatT.value = round.value.kind === 'river' ? round.value.boat : 0
  const steps = solve(round.value)
  if (!steps.length) return
  answering.value = true
  let index = 0
  const step = () => {
    if (!answering.value) return
    if (index >= steps.length) {
      answering.value = false
      succeed()
      return
    }
    const result = apply(steps[index])
    index += 1
    if (typeof result === 'string') {
      answering.value = false
      if (result) say(result)
      return
    }
    later(step, result)
  }
  later(step, 240)
}

function onSail() {
  if (locked() || sailing.value || round.value.kind !== 'river') return
  const result = apply({ op: 'cross' })
  if (typeof result === 'string' && result) fail(result)
}

function onWeigh() {
  if (locked() || round.value.kind !== 'scale') return
  const result = apply({ op: 'weigh' })
  if (typeof result === 'string' && result) say(result)
}

function onAccuse() {
  if (locked() || round.value.kind !== 'scale' || dragId.value < 0) return
  const result = apply({ op: 'accuse', id: dragId.value })
  if (typeof result === 'string' && result) say(result)
}

function onCipherTurn(index: number, to: number) {
  if (locked() || round.value.kind !== 'cipher') return
  if (round.value.dials[index] === to) return
  apply({ op: 'cipher', index, to })
}

function onScalePick(id: number) {
  if (locked() || round.value.kind !== 'scale') return
  const item = round.value
  if (dragId.value >= 0 && dragId.value !== id) {
    const zone = item.left.includes(id) ? 'left' : item.right.includes(id) ? 'right' : 'tray'
    const now = item.left.includes(dragId.value) ? 'left' : item.right.includes(dragId.value) ? 'right' : 'tray'
    if (now !== zone) {
      onScalePlace(zone)
      return
    }
  }
  dragId.value = dragId.value === id ? -1 : id
}

function onScalePlace(zone: 'left' | 'right' | 'tray') {
  if (locked() || round.value.kind !== 'scale' || dragId.value < 0) return
  const item = round.value
  const id = dragId.value
  const now = item.left.includes(id) ? 'left' : item.right.includes(id) ? 'right' : 'tray'
  if (now === zone) return
  apply({ op: 'pan', id, zone })
}

function onTap(name: string) {
  const item = round.value
  if (item.kind === 'frog' && name.startsWith('frog:')) {
    const index = Number(name.slice(5))
    if (item.pads[index] === '.') return
    const targets = frogTargets(item.pads, index)
    if (targets.length !== 1) {
      say('frog')
      return
    }
    const result = apply({ op: 'frog', from: index, to: targets[0] })
    if (typeof result === 'string' && result) say(result)
    return
  }
  if (item.kind === 'river' && name.startsWith('rider:')) {
    const result = apply({ op: 'board', id: name.slice(6) })
    if (typeof result === 'string' && result) say(result)
    return
  }
  if (item.kind === 'lights' && name.startsWith('light:')) {
    const result = apply({ op: 'light', index: Number(name.slice(6)) })
    if (typeof result === 'string' && result) say(result)
    return
  }
  if (item.kind === 'pipes' && name.startsWith('pipe:')) {
    const result = apply({ op: 'pipe', index: Number(name.slice(5)) })
    if (typeof result === 'string' && result) say(result)
    return
  }
  if (item.kind === 'slide' && name.startsWith('cell:')) {
    const result = apply({ op: 'slide', index: Number(name.slice(5)) })
    if (typeof result === 'string' && result) say(result)
    return
  }
  if (item.kind === 'scale' && name.startsWith('ball:')) {
    const id = Number(name.slice(5))
    dragId.value = dragId.value === id ? -1 : id
    return
  }
  if (item.kind === 'scale' && dragId.value >= 0 && (name === 'pan:left' || name === 'pan:right' || name === 'tray')) {
    const zone = name === 'pan:left' ? 'left' : name === 'pan:right' ? 'right' : 'tray'
    apply({ op: 'pan', id: dragId.value, zone })
    return
  }
  if (item.kind === 'peg' && name.startsWith('peg:')) {
    const index = Number(name.slice(4))
    if (dragId.value < 0) {
      if (item.pegs[index]) dragId.value = index
      return
    }
    const result = apply({ op: 'peg', from: dragId.value, to: index })
    dragId.value = -1
    if (typeof result === 'string' && result) say(result)
    return
  }
  if (item.kind === 'match' && name.startsWith('stick:')) {
    const index = Number(name.slice(6))
    if (dragId.value < 0) {
      if (item.on[index]) dragId.value = index
      return
    }
    const result = apply({ op: 'match', from: dragId.value, to: index })
    dragId.value = -1
    if (typeof result === 'string' && result) say(result)
    return
  }
  if (item.kind === 'bridge' && name.startsWith('island:')) {
    const index = Number(name.slice(7))
    if (dragId.value < 0 || dragId.value === index) {
      dragId.value = dragId.value === index ? -1 : index
      if (item.kind === 'bridge') item.pick = dragId.value
      dirty.value = true
      return
    }
    const result = apply({ op: 'bridge', a: dragId.value, b: index })
    dragId.value = -1
    if (typeof result === 'string' && result) say(result)
    return
  }
  if (item.kind === 'sky' && name.startsWith('cell:')) {
    const result = apply({ op: 'sky', index: Number(name.slice(5)) })
    if (typeof result === 'string' && result) say(result)
    return
  }
  if (item.kind === 'knight' && name.startsWith('cell:')) {
    const result = apply({ op: 'knight', to: Number(name.slice(5)) })
    if (typeof result === 'string' && result) say(result)
    return
  }
  if (item.kind === 'queen' && name.startsWith('cell:')) {
    const result = apply({ op: 'queen', index: Number(name.slice(5)) })
    if (typeof result === 'string' && result) say(result)
    return
  }
  if (item.kind === 'akari' && name.startsWith('cell:')) {
    const result = apply({ op: 'akari', index: Number(name.slice(5)) })
    if (typeof result === 'string' && result) say(result)
    return
  }
  if (item.kind === 'mine' && name.startsWith('cell:')) {
    const result = apply({ op: 'mine', index: Number(name.slice(5)) })
    if (typeof result === 'string' && result) say(result)
    return
  }
  if (item.kind === 'domino' && name.startsWith('cell:')) {
    const index = Number(name.slice(5))
    if (dragId.value < 0 || dragId.value === index) {
      dragId.value = dragId.value === index ? -1 : index
      item.pick = dragId.value
      dirty.value = true
      return
    }
    const result = apply({ op: 'domino', a: dragId.value, b: index })
    dragId.value = -1
    if (typeof result === 'string' && result) say(result)
    return
  }
  if (item.kind === 'gear' && name.startsWith('gear:')) {
    const result = apply({ op: 'gear', index: Number(name.slice(5)) })
    if (typeof result === 'string' && result) say(result)
    return
  }
  if (item.kind === 'slither' && (name.startsWith('h:') || name.startsWith('v:'))) {
    const result = apply({ op: 'slither', axis: name.startsWith('h:') ? 'h' : 'v', index: Number(name.slice(2)) })
    if (typeof result === 'string' && result) say(result)
    return
  }
  if (item.kind === 'cipher' && name.startsWith('dial:')) {
    const result = apply({ op: 'cipher', index: Number(name.slice(5)) })
    if (typeof result === 'string' && result) say(result)
    return
  }
  if (item.kind === 'code' && name.startsWith('color:')) {
    const result = apply({ op: 'code-set', index: item.cursor, color: Number(name.slice(6)) })
    if (typeof result === 'string' && result) say(result)
    return
  }
  if (item.kind === 'code' && name.startsWith('slot:')) {
    item.cursor = Number(name.slice(5))
    dirty.value = true
    return
  }
  if (item.kind === 'pack' && name.startsWith('piece:')) {
    const id = Number(name.slice(6))
    const piece = item.pieces.find((entry) => entry.id === id)
    if (!piece) return
    packHold = { ...piece }
    dragId.value = id
    return
  }
  if (item.kind === 'pack' && name.startsWith('cell:') && packHold) {
    const index = Number(name.slice(5))
    const r = Math.floor(index / item.cols)
    const c = index % item.cols
    const result = apply({ op: 'pack', id: packHold.id, r, c, rot: packHold.rot })
    packHold = null
    dragId.value = -1
    if (typeof result === 'string' && result) say(result)
  }
}

function onCodeColor(color: number) {
  if (locked() || round.value.kind !== 'code') return
  const result = apply({ op: 'code-set', index: round.value.cursor, color })
  if (typeof result === 'string' && result) say(result)
}

function onCodeGo() {
  if (locked() || round.value.kind !== 'code') return
  const result = apply({ op: 'code-go' })
  if (typeof result === 'string' && result) say(result)
}

function onPackRotate() {
  if (locked() || round.value.kind !== 'pack' || !packHold) return
  packHold = { ...packHold, rot: (packHold.rot + 1) % 4 }
  dirty.value = true
}

function nearestNode(local: Point) {
  const item = round.value
  if (item.kind !== 'trace' || !cssW || !cssH) return -1
  let best = -1
  let dist = 28
  item.nodes.forEach((node, index) => {
    const gap = Math.hypot((node.x / 100) * cssW - local.x, (node.y / 100) * cssH - local.y)
    if (gap < dist) {
      dist = gap
      best = index
    }
  })
  return best
}

function extendTrace(local: Point) {
  const index = nearestNode(local)
  if (index < 0) return
  const result = apply({ op: 'trace', node: index })
  if (typeof result === 'string' && result) say(result)
}

function room(blocks: Block[], id: number, dir: Dir) {
  const item = round.value
  if (item.kind !== 'klotski') return 0
  const sim = { ...item, blocks: blocks.map((block) => ({ ...block })) }
  let steps = 0
  while (steps < 4 && canSlide(sim, id, dir)) {
    const block = sim.blocks.find((entry) => entry.id === id)
    if (!block) break
    if (dir === 'up') block.r -= 1
    if (dir === 'down') block.r += 1
    if (dir === 'left') block.c -= 1
    if (dir === 'right') block.c += 1
    steps += 1
  }
  return steps
}

function beginKlot(name: string, local: Point) {
  const item = round.value
  if (item.kind !== 'klotski' || !name.startsWith('block:')) return
  klotOrigin = item.blocks.map((block) => ({ ...block }))
  klotPoint = local
  dragId.value = Number(name.slice(6))
  dragX.value = 0
  dragY.value = 0
  touchMode = 'klot'
}

function moveKlot(local: Point) {
  const origin = klotOrigin
  if (!origin || !klotPoint || dragId.value < 0) return
  const dx = local.x - klotPoint.x
  const dy = local.y - klotPoint.y
  const horizontal = Math.abs(dx) >= Math.abs(dy)
  const cell = Math.min(52, (cssW - 16) / 4)
  const id = dragId.value
  dragX.value = horizontal ? Math.max(-room(origin, id, 'left') * cell, Math.min(room(origin, id, 'right') * cell, dx)) : 0
  dragY.value = horizontal ? 0 : Math.max(-room(origin, id, 'up') * cell, Math.min(room(origin, id, 'down') * cell, dy))
}

function endKlot() {
  const origin = klotOrigin
  const id = dragId.value
  const dx = dragX.value
  const dy = dragY.value
  klotOrigin = null
  klotPoint = null
  dragId.value = -1
  dragX.value = 0
  dragY.value = 0
  const item = round.value
  if (!origin || item.kind !== 'klotski' || id < 0 || !cssW) return
  const cell = Math.min(52, (cssW - 16) / 4) || 1
  const horizontal = Math.abs(dx) >= Math.abs(dy)
  const steps = Math.round((horizontal ? dx : dy) / cell)
  if (!steps) return
  const dir: Dir = horizontal ? (steps < 0 ? 'left' : 'right') : (steps < 0 ? 'up' : 'down')
  for (let step = 0; step < Math.abs(steps); step += 1) {
    if (busy.value) break
    const result = apply({ op: 'klot', id, dir })
    if (typeof result === 'string') break
  }
}

function beginHanoi(local: Point) {
  const item = round.value
  if (item.kind !== 'hanoi' || !cssW) return
  const from = Math.min(2, Math.max(0, Math.floor(local.x / (cssW / 3))))
  const disk = item.pegs[from][item.pegs[from].length - 1]
  if (disk === undefined) return
  hanoiFrom = from
  dragId.value = disk
  dragX.value = local.x
  dragY.value = local.y
  touchMode = 'hanoi'
}

function endHanoi(local: Point) {
  const from = hanoiFrom
  dragId.value = -1
  hanoiFrom = -1
  const item = round.value
  if (item.kind !== 'hanoi' || from < 0 || !cssW) return
  const to = Math.min(2, Math.max(0, Math.floor(local.x / (cssW / 3))))
  if (to === from) return
  const result = apply({ op: 'hanoi', from, to })
  if (typeof result === 'string' && result) say(result)
}

function localOf(event: TouchLike) {
  const point = pointOf(event)
  if (!point || !canvasRect) return null
  return { x: point.x - canvasRect.left, y: point.y - canvasRect.top }
}

function measure(id: string) {
  return new Promise<Rect | null>((resolve) => {
    const proxy = instance?.proxy
    if (!proxy) return resolve(null)
    uni.createSelectorQuery().in(proxy).select(`#${id}`).boundingClientRect().exec((result) => {
      const box = result?.[0]
      if (!box) return resolve(null)
      resolve({ left: box.left, top: box.top, width: box.width, height: box.height })
    })
  })
}

async function onTouchStart(event: TouchLike) {
  if (locked()) return
  const token = ++gesture
  const point = pointOf(event)
  const rect = await measure('logic-canvas')
  if (token !== gesture || !point || !rect) return
  canvasRect = rect
  if (!cssW) {
    cssW = rect.width
    cssH = rect.height
  }
  const local = { x: point.x - rect.left, y: point.y - rect.top }
  startPt = local
  pendingTap = ''
  const item = round.value
  if (item.kind === 'trace') {
    touchMode = 'trace'
    extendTrace(local)
    return
  }
  if (item.kind === 'scale') {
    const name = hitAt(scene(), local.x, local.y)
    if (name.startsWith('ball:')) {
      dragId.value = Number(name.slice(5))
      dragX.value = local.x
      dragY.value = local.y
      touchMode = 'scale'
      return
    }
    touchMode = 'tap'
    pendingTap = name
    return
  }
  if (item.kind === 'box') {
    touchMode = 'box'
    return
  }
  if (item.kind === 'tilt') {
    touchMode = 'tilt'
    return
  }
  if (item.kind === 'flow') {
    touchMode = 'flow'
    const name = hitAt(scene(), local.x, local.y)
    if (name.startsWith('flow:')) {
      const index = Number(name.slice(5))
      const color = item.ends[index]
      if (color) {
        flowPath = [index]
        dragId.value = color
      }
    }
    return
  }
  const name = hitAt(scene(), local.x, local.y)
  if (item.kind === 'klotski') {
    beginKlot(name, local)
    return
  }
  if (item.kind === 'hanoi') {
    beginHanoi(local)
    return
  }
  touchMode = 'tap'
  pendingTap = name
}

function onTouchMove(event: TouchLike) {
  if (locked()) return
  const local = localOf(event)
  if (!local || !startPt) return
  if (touchMode === 'trace') {
    extendTrace(local)
    return
  }
  if (touchMode === 'klot') {
    moveKlot(local)
    return
  }
  if (touchMode === 'flow' && dragId.value > 0) {
    const name = hitAt(scene(), local.x, local.y)
    if (!name.startsWith('flow:')) return
    const index = Number(name.slice(5))
    const last = flowPath[flowPath.length - 1]
    if (index === last) return
    if (flowPath.includes(index)) {
      flowPath = flowPath.slice(0, flowPath.indexOf(index) + 1)
      dirty.value = true
      return
    }
    const item = round.value
    if (item.kind !== 'flow') return
    const ar = Math.floor(last / item.n)
    const ac = last % item.n
    const br = Math.floor(index / item.n)
    const bc = index % item.n
    if (Math.abs(ar - br) + Math.abs(ac - bc) !== 1) return
    flowPath.push(index)
    dirty.value = true
    return
  }
  if (touchMode === 'hanoi' || touchMode === 'scale') {
    dragX.value = local.x
    dragY.value = local.y
    return
  }
  if (touchMode === 'tap' && Math.hypot(local.x - startPt.x, local.y - startPt.y) > 12) pendingTap = ''
}

function onTouchEnd(event: TouchLike) {
  gesture += 1
  const local = localOf(event)
  const mode = touchMode
  const tap = pendingTap
  const start = startPt
  touchMode = ''
  pendingTap = ''
  startPt = null
  if (locked() && mode !== 'klot' && mode !== 'hanoi') return
  if ((mode === 'box' || mode === 'tilt') && start && local) {
    const dx = local.x - start.x
    const dy = local.y - start.y
    if (Math.hypot(dx, dy) < 18) return
    const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')
    const result = apply(mode === 'box' ? { op: 'box', dir } : { op: 'tilt', dir })
    if (typeof result === 'string' && result) say(result)
    return
  }
  if (mode === 'flow') {
    const color = dragId.value
    const path = [...flowPath]
    flowPath = []
    dragId.value = -1
    if (color > 0 && path.length >= 2) {
      const result = apply({ op: 'flow', color, path })
      if (typeof result === 'string' && result) say(result)
    }
    return
  }
  if (mode === 'klot') {
    endKlot()
    return
  }
  if (mode === 'hanoi' && local) {
    endHanoi(local)
    return
  }
  if (mode === 'scale') {
    const item = round.value
    const id = dragId.value
    dragId.value = -1
    if (item.kind !== 'scale' || id < 0 || !local) return
    const name = hitAt(scene(), local.x, local.y)
    let zone: 'left' | 'right' | 'tray' | '' = name === 'pan:left' ? 'left' : name === 'pan:right' ? 'right' : name === 'tray' ? 'tray' : ''
    if (name.startsWith('ball:')) {
      const other = Number(name.slice(5))
      if (item.left.includes(other)) zone = 'left'
      else if (item.right.includes(other)) zone = 'right'
      else zone = 'tray'
    }
    if (!zone || (start && Math.hypot(local.x - start.x, local.y - start.y) < 8)) {
      dragId.value = id
      return
    }
    apply({ op: 'pan', id, zone })
    return
  }
  if (mode === 'tap' && tap) onTap(tap)
}

watch(boardHeight, () => nextTick(() => bindCanvas()))

onMounted(() => nextTick(() => bindCanvas()))
onReady(() => {
  focusStone()
  nextTick(() => bindCanvas())
})
onUnload(() => {
  clearTimers()
  answering.value = false
  busy.value = false
  advancing.value = false
  stopLoop()
})
</script>

<template>
  <page-meta :page-style="pageBg.style" :background-color="pageBg.bg" :background-color-top="pageBg.bg" :background-color-bottom="pageBg.bg" :root-background-color="pageBg.bg" :background-text-style="pageBg.text" />
  <view class="theme-root page sub logic-page" :class="themeClass">
    <PageHeader safe show-back :title="t('逻辑思维')" :caption="t('拖一拖、画一画、称一称')" />

    <scroll-view id="logic-road" scroll-x class="road" :scroll-left="scrollLeft" scroll-with-animation :show-scrollbar="false">
      <view class="road-row">
        <view
          v-for="(item, index) in STAGES"
          :id="`gate-${index}`"
          :key="item.id"
          class="stone press"
          :class="{ now: index === at, done: index <= cleared, lock: index > cleared + 1 }"
          hover-class="press-on"
          hover-stay-time="80"
          @click="openGate(index)"
        >
          <text class="stone-no">{{ index + 1 }}</text>
          <text class="stone-name">{{ t(item.name) }}</text>
        </view>
      </view>
    </scroll-view>

    <view class="card stage">
      <view class="stage-top">
        <text class="stage-hint">{{ stageHint }}</text>
        <view class="tools">
          <view v-if="canReset" class="tool press" hover-class="press-on" hover-stay-time="80" @click="resetStage">
            <AppIcon name="eraser" tone="muted" :size="17" />
          </view>
          <view class="tool help press" hover-class="press-on" hover-stay-time="80" @click="showHint">
            <text>?</text>
          </view>
        </view>
      </view>
      <text :key="`${at}-${serial}`" class="prompt fade-up">{{ prompt }}</text>

      <canvas
        v-if="round.kind !== 'scale' && round.kind !== 'cipher'"
        id="logic-canvas"
        type="2d"
        class="board"
        :class="{ shake }"
        :style="{ height: `${boardHeight}px` }"
        disable-scroll
        @touchstart="onTouchStart"
        @touchmove.stop.prevent="onTouchMove"
        @touchend="onTouchEnd"
        @touchcancel="onTouchEnd"
      />
      <LogicBalance
        v-else-if="scaleView"
        :class="{ shake }"
        :left="scaleView.left"
        :right="scaleView.right"
        :tray="scaleView.tray"
        :picked="dragId"
        :tilt="scaleView.tilt"
        :even="scaleView.even"
        :landed="landed"
        @pick="onScalePick"
        @place="onScalePlace"
      />
      <CipherLock
        v-else-if="round.kind === 'cipher'"
        :class="{ shake }"
        :dials="round.dials"
        :clues="round.clues"
        :seen="cipherSeen"
        :disabled="locked()"
        @turn="onCipherTurn"
      />

      <view v-if="round.kind === 'river'" class="choices">
        <view class="choice press" :class="{ off: sailing || answering }" hover-class="press-on" hover-stay-time="80" @click="onSail">
          <text>{{ sailText }}</text>
        </view>
      </view>

      <view v-else-if="round.kind === 'code'" class="code-pad">
        <view class="choices">
          <view v-for="color in 6" :key="color" class="swatch press" :style="{ background: CODE_COLORS[color - 1] }" hover-class="press-on" hover-stay-time="80" @click="onCodeColor(color - 1)" />
        </view>
        <view class="choices">
          <view class="choice press" :class="{ off: answering }" hover-class="press-on" hover-stay-time="80" @click="onCodeGo"><text>{{ t('核对') }}</text></view>
        </view>
      </view>

      <view v-else-if="round.kind === 'pack'" class="choices">
        <view class="choice press" :class="{ off: dragId < 0 }" hover-class="press-on" hover-stay-time="80" @click="onPackRotate"><text>{{ t('旋转') }}</text></view>
      </view>

      <view v-else-if="round.kind === 'scale'" class="scale-extra">
        <view v-if="round.log.length" class="logs">
          <text v-for="(item, index) in round.log" :key="index" class="log">{{ item.left.map((id) => id + 1).join(' ') }} : {{ item.right.map((id) => id + 1).join(' ') }} {{ pick(WEIGH[item.result], en) }}</text>
        </view>
        <view class="choices">
          <view class="choice press" hover-class="press-on" hover-stay-time="80" @click="onWeigh"><text>{{ t('称一称') }}</text></view>
          <view class="choice press" :class="{ off: dragId < 0 }" hover-class="press-on" hover-stay-time="80" @click="onAccuse"><text>{{ t('就是这颗') }}</text></view>
        </view>
      </view>

      <text class="moves">{{ moveText }}</text>
      <view class="feedback" :class="mark">
        <text :key="feedbackText">{{ feedbackText }}</text>
      </view>
      <button v-if="mark === 'right' && !advancing && at < last" hover-class="press-on" hover-stay-time="80" class="btn block" @click="openGate(at + 1)">{{ t('下一关') }}</button>
      <button v-else-if="mark === 'right' && at === last" hover-class="press-on" hover-stay-time="80" class="btn block" @click="openGate(0)">{{ t('再走一遍') }}</button>
    </view>

    <view class="card panel">
      <text class="panel-title">{{ t('怎么操作') }}</text>
      <text v-for="(line, index) in howto" :key="index" class="tip">{{ index + 1 }}. {{ pick(line, en) }}</text>
      <view class="choice answer press" :class="{ off: answering || mark === 'right' }" hover-class="press-on" hover-stay-time="80" @click="playAnswer">
        <text>{{ answering ? t('答案播放中') : t('看答案') }}</text>
      </view>
    </view>

    <view v-if="hintOpen" class="mask" @click="hintOpen = false" @touchmove.stop.prevent="keepHint">
      <view class="hint-card" @click.stop>
        <text class="hint-title">{{ t('怎么玩') }}</text>
        <text v-for="(line, index) in howto" :key="index" class="hint-line">{{ index + 1 }}. {{ pick(line, en) }}</text>
        <view class="hint-ok press" hover-class="press-on" hover-stay-time="80" @click="hintOpen = false">{{ t('知道了') }}</view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.logic-page { padding-bottom: calc(40px + var(--safe-bottom)); }
.road { width: 100%; margin-bottom: 12px; white-space: nowrap; }
.road-row { display: flex; gap: 8px; padding: 2px 2px 8px; }
.stone { display: inline-flex; width: 56px; flex: none; flex-direction: column; align-items: center; }
.stone-no {
  display: flex; width: 36px; height: 36px; align-items: center; justify-content: center;
  border-radius: 50%; background: var(--surface-2); color: var(--muted); font-size: 14px; font-weight: 800;
}
.stone-name { width: 56px; margin-top: 4px; color: var(--muted); font-size: 10px; font-weight: 700; text-align: center; }
.stone.now .stone-no { background: #ff6a33; color: #fff; transform: translateY(-2px); }
.stone.now .stone-name { color: var(--accent-text); }
.stone.done .stone-no { background: #34c77b; color: #fff; }
.stone.done.now .stone-no { box-shadow: 0 0 0 3px rgba(255, 106, 51, 0.35); }
.stone.lock { opacity: 0.38; }
.stage { padding: 12px 14px 16px; border-radius: 28px; }
.stage-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 28px; padding: 0 2px 8px; }
.stage-hint { flex: 1; min-width: 0; color: var(--muted); font-size: 13px; line-height: 1.4; }
.tools { display: flex; flex: none; gap: 6px; }
.tool { display: flex; width: 34px; height: 34px; align-items: center; justify-content: center; border-radius: 11px; background: var(--surface-2); }
.tool.help { color: var(--muted); font-size: 16px; font-weight: 800; }
.prompt { display: block; margin-top: 8px; color: var(--ink); font-size: 16px; font-weight: 800; line-height: 1.45; text-align: center; }
.board { display: block; width: 100%; margin-top: 6px; }
.moves { display: block; margin-top: 10px; color: var(--muted); font-size: 12px; font-weight: 700; text-align: center; }
.choices { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 12px; }
.swatch { width: 36px; height: 36px; border-radius: 50%; }
.choice {
  display: flex; min-width: 88px; min-height: 44px; align-items: center; justify-content: center;
  padding: 6px 12px; border: 1px solid var(--line); border-radius: 16px; background: var(--paper);
  color: var(--ink); font-size: 15px; font-weight: 800;
}
.choice text { font-weight: 800; }
.choice.off { opacity: 0.35; }
.choice.answer { margin-top: 12px; }
.logs { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
.log { color: var(--ink); font-size: 12px; font-weight: 700; text-align: center; }
.feedback { margin-top: 14px; padding: 8px 14px; border-radius: 12px; color: var(--muted); font-size: 13px; font-weight: 650; line-height: 1.55; text-align: center; }
.feedback.right { background: rgba(52, 199, 123, 0.14); color: #1f9d5c; }
.feedback.wrong { background: rgba(241, 90, 54, 0.12); color: #d9482a; }
.btn.block { margin-top: 12px; }
.panel { margin-top: 14px; }
.panel-title { display: block; color: var(--ink); font-size: 14px; font-weight: 750; }
.tip { display: block; margin-top: 8px; color: var(--muted); font-size: 13px; line-height: 1.55; }
.hint-card {
  flex: 1; min-width: 0; box-sizing: border-box;
  margin: 0 16px calc(16px + var(--safe-bottom));
  padding: 18px 16px 16px; border-radius: 22px; background: var(--paper);
  box-shadow: var(--elev-lg);
}
.hint-title { display: block; color: var(--ink); font-size: 17px; font-weight: 800; }
.hint-line { display: block; margin-top: 8px; color: var(--muted); font-size: 14px; line-height: 1.55; }
.hint-ok { margin-top: 16px; padding: 12px 18px; border-radius: 999px; background: #1c2430; color: #fff; font-size: 15px; font-weight: 700; text-align: center; }
.fade-up { animation: fade-up 0.35s ease; }
.shake { animation: shake 0.4s ease; }
@keyframes fade-up {
  0% { opacity: 0; transform: translateY(6px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-8px); }
  75% { transform: translateX(8px); }
}
</style>
