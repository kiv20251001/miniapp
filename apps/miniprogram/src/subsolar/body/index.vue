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
import { BodyScene, type CanvasNode, type TouchPoint, type View } from './scene'
import { loadBodyModel } from './realistic'
import type { BodyModel } from './model'
import { FOOD_STAGES, LAYERS, PART_IDS, PART_ORDER, PARTS, SYSTEMS, type DemoId, type Layer, type PartId, type System } from './anatomy'
import {
  DEMO_LINES,
  DEMO_NAMES,
  FOOD_DONE,
  FOOD_LESSONS,
  FOODS,
  GUIDES,
  HEART_FACTS,
  HEART_RUN,
  LAYER_HINTS,
  LAYER_NAMES,
  LUNG_TEXT,
  PART_LESSONS,
  pick,
  SYSTEM_LESSONS,
  type GuideAction,
  type GuideKey,
} from './lessons'

useFamilyPage()
const themeClass = useThemePage()
const pageBg = usePageBackground()
const theme = useThemeStore()
const instance = getCurrentInstance()
const en = computed(() => isEn())

type Tab = 'explore' | 'demo'
const DEMOS: DemoId[] = ['heart', 'lungs', 'food']
const TAB_SHARE: Record<Tab, ToolShareKey> = { explore: 'body', demo: 'bodyDemo' }
const tab = ref<Tab>('explore')
const demo = ref<DemoId>('heart')
onShareAppMessage(() => toolShare(TAB_SHARE[tab.value], `/subsolar/body/index?tab=${tab.value}&demo=${demo.value}`))
onShareTimeline(() => toolMoments(TAB_SHARE[tab.value], `tab=${tab.value}&demo=${demo.value}`))
useSearchTitle(() => t(TOOL_SHARE_TITLES[TAB_SHARE[tab.value]]))
onLoad((query) => {
  if (query?.tab === 'demo') tab.value = 'demo'
  const value = query?.demo as DemoId | undefined
  if (value && DEMOS.includes(value)) demo.value = value
  if (!modelJob) modelJob = loadBodyModel()
})

const scene = shallowRef<BodyScene | null>(null)
const failed = ref(false)

function vibrate(type: 'light' | 'medium' | 'heavy' = 'light') {
  uni.vibrateShort({ type })
}

// ---- 身体探索 ----
const layer = ref<Layer>('organ')
const system = ref<System | null>(null)
const selected = ref<PartId | null>(null)
const explode = ref(0)
const cutOn = ref(false)

const lesson = computed(() => (selected.value ? PART_LESSONS[selected.value] : null))
const selectedMeta = computed(() => (selected.value ? PARTS[selected.value] : null))
const systemLesson = computed(() => (system.value ? SYSTEM_LESSONS[system.value] : null))
const available = ref<PartId[]>(PART_ORDER)
const partChips = computed(() =>
  available.value.map((id) => ({ id, name: pick(PART_LESSONS[id].name, en.value), color: PARTS[id].color, dim: !!system.value && PARTS[id].system !== system.value })),
)

function setLayer(value: Layer) {
  if (layer.value === value) return
  layer.value = value
  if (value === 'skin' || value === 'muscle') explode.value = 0
  scene.value?.setLayer(value)
  vibrate()
  passGuide('layer')
}

function setSystem(value: System | null) {
  system.value = system.value === value ? null : value
  if (system.value && (layer.value === 'skin' || layer.value === 'muscle')) setLayer('organ')
  if (system.value && selected.value && PARTS[selected.value].system !== system.value) choose(null)
  scene.value?.setSystem(system.value)
  vibrate()
}

/** 选中的部位要露出来：器官至少剖到骨骼，骨头、肌肉、皮肤各自剖到那一层。 */
function layerFor(id: PartId): Layer {
  const own = PARTS[id].layer
  if (own === 'organ') return layer.value === 'bone' ? 'bone' : 'organ'
  return own
}

function choose(id: PartId | null) {
  cutOn.value = false
  if (id === null || id === selected.value) {
    selected.value = null
    scene.value?.select(null)
    return
  }
  const want = layerFor(id)
  if (want !== layer.value) {
    layer.value = want
    if (want === 'skin' || want === 'muscle') explode.value = 0
    scene.value?.setLayer(want)
  }
  if (system.value && PARTS[id].system !== system.value) {
    system.value = null
    scene.value?.setSystem(null)
  }
  selected.value = id
  scene.value?.select(id)
  vibrate()
}

function onPick(id: PartId | null) {
  if (tab.value !== 'explore') return
  cutOn.value = false
  selected.value = id
  if (id) {
    vibrate()
    passGuide('pick')
  }
}

function setExplode(value: number) {
  if (value > 0 && (layer.value === 'skin' || layer.value === 'muscle')) {
    layer.value = 'organ'
    scene.value?.setLayer('organ')
  }
  explode.value = value
  cutOn.value = false
  scene.value?.setExplode(value / 100)
  passGuide('explode')
}

function toggleExplode() {
  setExplode(explode.value > 50 ? 0 : 100)
  vibrate()
}

function onExplodeSlide(event: { detail: { value: number } }) {
  setExplode(event.detail.value)
}

function toggleCut() {
  if (!selected.value) return
  cutOn.value = !cutOn.value
  if (cutOn.value) explode.value = 0
  scene.value?.setCut(cutOn.value ? selected.value : null)
  vibrate()
}

function watchItWork() {
  const target = selectedMeta.value?.demo
  if (!target) return
  demo.value = target
  setTab('demo')
}

// ---- 工作演示 ----
const bpm = ref(80)
const beat = ref(0)
const running = ref(false)
let runTimer: ReturnType<typeof setTimeout> | null = null

const breath = ref(0)
const breaths = ref(0)
const breathPhase = ref<'idle' | 'in' | 'out'>('idle')
const holding = ref(false)
let lastBreath = 0

const foodKey = ref(FOODS[0].key)
const foodStage = ref(0)
const foodPlaying = ref(true)
const foodDone = ref(false)

const lungText = computed(() => {
  if (breathPhase.value === 'in') return pick(LUNG_TEXT.in, en.value)
  if (breathPhase.value === 'out') return pick(LUNG_TEXT.out, en.value)
  return pick(LUNG_TEXT.idle, en.value)
})
const foodLesson = computed(() => FOOD_LESSONS[FOOD_STAGES[foodStage.value]])
const foodStops = computed(() => FOOD_STAGES.map((stage, at) => ({ at, name: pick(FOOD_LESSONS[stage].name, en.value), time: pick(FOOD_LESSONS[stage].time, en.value) })))
const breathDots = computed(() => Math.min(breaths.value, 10))
const ringStyle = computed(() => `transform: scale(${1 + 0.28 * breath.value});`)

function clearRun() {
  if (runTimer) clearTimeout(runTimer)
  runTimer = null
  running.value = false
}

function runHeart() {
  if (running.value) return
  running.value = true
  scene.value?.setHeartRate(135)
  vibrate('medium')
  runTimer = setTimeout(() => {
    scene.value?.setHeartRate(80)
    running.value = false
    runTimer = null
  }, 7000)
}

function onBeat() {
  const s = scene.value
  if (!s || tab.value !== 'demo' || demo.value !== 'heart') return
  bpm.value = s.getHeartRate()
  beat.value += 1
}

function onBreath(value: number, count: number) {
  const delta = value - lastBreath
  lastBreath = value
  breath.value = value
  breaths.value = count
  if (delta > 0.002) breathPhase.value = 'in'
  else if (delta < -0.002) breathPhase.value = 'out'
  if (holding.value && value > 0.8) passGuide('breathe')
}

function holdStart() {
  holding.value = true
  scene.value?.setBreathing(true)
  vibrate()
}

function holdEnd() {
  if (!holding.value) return
  holding.value = false
  scene.value?.setBreathing(false)
}

function pickFood(key: string) {
  const food = FOODS.find((item) => item.key === key)
  if (!food) return
  foodKey.value = key
  scene.value?.setFoodColor(food.color)
  playStage(0)
  passGuide('food')
}

function playStage(at: number) {
  foodDone.value = false
  foodPlaying.value = true
  foodStage.value = at
  scene.value?.playFood(at)
  vibrate()
}

function toggleFood() {
  if (foodDone.value) return playStage(0)
  foodPlaying.value = !foodPlaying.value
  scene.value?.pauseFood(!foodPlaying.value)
  vibrate()
}

function onFoodStage(stage: number) {
  foodStage.value = stage
}

function onFoodDone() {
  foodPlaying.value = false
  foodDone.value = true
  vibrate('medium')
}

function startDemo(value: DemoId) {
  clearRun()
  holdEnd()
  breaths.value = 0
  breathPhase.value = 'idle'
  bpm.value = 80
  foodStage.value = 0
  foodPlaying.value = true
  foodDone.value = false
  const s = scene.value
  if (!s) return
  s.setDemo(value)
  if (value === 'food') s.setFoodColor(FOODS.find((item) => item.key === foodKey.value)?.color ?? FOODS[0].color)
}

function setDemo(value: DemoId) {
  if (demo.value === value) return
  demo.value = value
  startDemo(value)
  vibrate()
  setTimeout(() => maybeGuide(value), 500)
}

// ---- 画布上方的提示和工具 ----
const VIEWS: View[] = ['front', 'side', 'back']
let viewAt = 0
const flash = ref('')
let flashTimer: ReturnType<typeof setTimeout> | null = null

function showFlash(text: string) {
  flash.value = text
  if (flashTimer) clearTimeout(flashTimer)
  flashTimer = setTimeout(() => (flash.value = ''), 1400)
}

function recenter() {
  vibrate()
  viewAt = 0
  if (tab.value === 'explore') {
    cutOn.value = false
    selected.value = null
    scene.value?.select(null)
  } else startDemo(demo.value)
  showFlash(t('摆正'))
}

const VIEW_NAMES: Record<View, string> = { front: '正面', side: '侧面', back: '背面' }

function turnView() {
  vibrate()
  viewAt = (viewAt + 1) % VIEWS.length
  scene.value?.viewFrom(VIEWS[viewAt])
  showFlash(t(VIEW_NAMES[VIEWS[viewAt]]))
}

const stageHint = computed(() => {
  if (flash.value) return flash.value
  if (tab.value === 'demo') return pick(DEMO_LINES[demo.value], en.value)
  if (cutOn.value && lesson.value) return t('切开了，看看{name}里面', { name: pick(lesson.value.name, en.value) })
  if (lesson.value) return t('再点一下空白处回到全身')
  return pick(LAYER_HINTS[layer.value], en.value)
})

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
  uni.createSelectorQuery().in(proxy).select('#body-canvas').fields({ node: true, size: true } as UniApp.NodeField, (res) => {
    callback(res as { node?: CanvasNode; width?: number; height?: number } | null)
  }).exec()
}

/** 原生画布要写成具体像素。 */
const canvasBox = ref<{ width: number; height: number } | null>(null)
const canvasStyle = computed(() => (canvasBox.value ? `width:${canvasBox.value.width}px;height:${canvasBox.value.height}px;` : ''))

function partNames() {
  return Object.fromEntries(PART_IDS.map((id) => [id, pick(PART_LESSONS[id].name, en.value)])) as Record<PartId, string>
}

/** 写实人体第一次要从云存储下载，下载期间画布上显示提示；下载不下来用代码生成的人体 */
const modelState = ref<'loading' | 'realistic' | 'simple'>('loading')
let modelJob: Promise<BodyModel | null> | null = null

function initScene() {
  if (scene.value) return
  if (!modelJob) modelJob = loadBodyModel()
  queryCanvas(async (result) => {
    const canvas = result?.node
    if (!canvas || !result?.width || !result?.height) {
      failed.value = true
      return
    }
    const model = await modelJob
    if (unloaded || scene.value) {
      model?.dispose()
      return
    }
    modelState.value = model ? 'realistic' : 'simple'
    const info = typeof uni.getWindowInfo === 'function' ? uni.getWindowInfo() : uni.getSystemInfoSync()
    try {
      const body = new BodyScene({
        model: model ?? undefined,
        canvas,
        width: result.width,
        height: result.height,
        pixelRatio: Math.min(info.pixelRatio || 2, 2),
        background: theme.colors.paper,
        dark: theme.isDark,
        onPick,
        onTouch: () => passGuide('drag'),
        onBeat,
        onBreath,
        onFoodStage,
        onFoodDone,
      })
      body.setNames(partNames())
      available.value = PART_ORDER.filter((id) => body.hasPart(id))
      scene.value = body
      if (tab.value === 'demo') startDemo(demo.value)
      body.start()
    } catch (error) {
      console.error('[body] init failed', error)
      failed.value = true
    }
  })
}

async function mountStage() {
  const rect = await measure('body-stage')
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
  tab.value = value
  viewAt = 0
  if (value === 'demo') {
    startDemo(demo.value)
    setTimeout(() => maybeGuide(demo.value), 500)
    return
  }
  clearRun()
  holdEnd()
  selected.value = null
  cutOn.value = false
  const s = scene.value
  if (!s) return
  s.setDemo(null)
  s.setLayer(layer.value)
  s.setSystem(system.value)
  if (explode.value > 0) s.setExplode(explode.value / 100)
  setTimeout(() => maybeGuide('explore'), 400)
}

watch(() => theme.isDark, () => scene.value?.setBackground(theme.colors.paper, theme.isDark))
watch(en, () => scene.value?.setNames(partNames()))

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
}

function onTouchEnd(event: CanvasTouchEvent) {
  scene.value?.touchEnd(pointsOf(event))
}

// ---- 第一次进来时的引导 ----
type Rect = { left: number; top: number; width: number; height: number }

const guideKeyNow = ref<GuideKey>('explore')
const guideIndex = ref(-1)
const guideRect = ref<Rect | null>(null)
const guidePassed = ref(false)
const viewH = ref(667)
const guideSteps = computed(() => GUIDES[guideKeyNow.value])
const guideStep = computed(() => (guideIndex.value >= 0 ? guideSteps.value[guideIndex.value] ?? null : null))
const storageKey = (key: GuideKey) => `uday-body-guide-${key}-v1`
/** 真机上 WebGL 画布盖在所有视图上面，引导卡片压不住它；不圈画布的那几步先把画布藏起来 */
const hideCanvas = computed(() => !!guideStep.value && guideStep.value.target !== 'body-stage')

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
  if (guideStep.value?.target !== 'body-stage') return { bottom: '24px' }
  return viewH.value - below >= above ? { top: `${below}px` } : { bottom: `${viewH.value - above}px` }
})

function noop() {}

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

function currentGuide(): GuideKey {
  return tab.value === 'explore' ? 'explore' : demo.value
}

function startGuide(key: GuideKey = currentGuide()) {
  guideKeyNow.value = key
  viewH.value = windowHeight()
  guideIndex.value = 0
  setTimeout(focusGuide, 60)
}

function maybeGuide(key: GuideKey) {
  if (currentGuide() !== key || guideIndex.value >= 0 || failed.value) return
  if (!uni.getStorageSync(storageKey(key))) startGuide(key)
}

function nextGuide() {
  if (guideIndex.value < 0) return
  if (guideIndex.value + 1 >= guideSteps.value.length) return endGuide()
  guideIndex.value += 1
  focusGuide()
}

function endGuide() {
  uni.setStorageSync(storageKey(guideKeyNow.value), 1)
  guideIndex.value = -1
  guideRect.value = null
  uni.pageScrollTo({ scrollTop: 0, duration: 260 })
}

onReady(() => {
  mountStage()
  setTimeout(() => maybeGuide(currentGuide()), 900)
})
onShow(() => scene.value?.start())
onHide(() => {
  holdEnd()
  scene.value?.stop()
})
let unloaded = false
onUnload(() => {
  unloaded = true
  clearRun()
  if (flashTimer) clearTimeout(flashTimer)
  scene.value?.dispose()
  scene.value = null
})
</script>

<template>
  <page-meta :page-style="pageBg.style" :background-color="pageBg.bg" :background-color-top="pageBg.bg" :background-color-bottom="pageBg.bg" :root-background-color="pageBg.bg" :background-text-style="pageBg.text" />
  <view class="theme-root page sub body-page" :class="themeClass">
    <PageHeader safe show-back :title="t('3D 人体器官')" :caption="t('一层层剖开，看看身体里有什么')" />

    <view class="seg two">
      <view class="seg-indicator" :class="tab" />
      <text class="seg-item" :class="{ active: tab === 'explore' }" @click="setTab('explore')">{{ t('身体探索') }}</text>
      <text class="seg-item" :class="{ active: tab === 'demo' }" @click="setTab('demo')">{{ t('工作演示') }}</text>
    </view>

    <view v-if="tab === 'demo'" class="seg small three">
      <view class="seg-indicator" :class="`d-${demo}`" />
      <text v-for="item in DEMOS" :key="item" class="seg-item" :class="{ active: demo === item }" @click="setDemo(item)">{{ pick(DEMO_NAMES[item], en) }}</text>
    </view>

    <view class="card stage">
      <view class="stage-top">
        <text :key="stageHint" class="stage-hint fade-up" :class="{ flash }">{{ stageHint }}</text>
        <view class="tools">
          <view class="tool press" hover-class="press-on" hover-stay-time="80" @click="turnView">
            <AppIcon name="axes" tone="muted" :size="18" />
          </view>
          <view class="tool press" hover-class="press-on" hover-stay-time="80" @click="recenter">
            <AppIcon name="recenter" tone="muted" :size="18" />
          </view>
          <view class="tool help press" hover-class="press-on" hover-stay-time="80" @click="startGuide()">
            <text>?</text>
          </view>
        </view>
      </view>
      <view id="body-stage" class="stage-box">
        <canvas
          v-show="!hideCanvas"
          id="body-canvas"
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
        <view v-else-if="modelState === 'loading'" class="stage-fail">
          <text>{{ t('正在准备人体模型…') }}</text>
        </view>
      </view>

      <!-- 探索 -->
      <view v-if="tab === 'explore'" class="controls">
        <view id="guide-layers" class="seg small four layers">
          <view class="seg-indicator" :class="`l-${layer}`" />
          <text v-for="item in LAYERS" :key="item" class="seg-item" :class="{ active: layer === item }" @click="setLayer(item)">{{ pick(LAYER_NAMES[item], en) }}</text>
        </view>
        <view id="guide-explode" class="fold-row">
          <view class="play press" hover-class="press-on" hover-stay-time="80" @click="toggleExplode">
            <text>{{ explode > 50 ? t('合起来') : t('展开') }}</text>
          </view>
          <slider class="fold-slider" :value="explode" :min="0" :max="100" activeColor="#ff7a45" backgroundColor="#eceef4" block-size="22" @changing="onExplodeSlide" @change="onExplodeSlide" />
        </view>
        <scroll-view id="guide-systems" scroll-x class="chip-scroll" :show-scrollbar="false">
          <view class="chip-list">
            <text class="chip press" :class="{ active: !system }" hover-class="press-on" hover-stay-time="80" @click="setSystem(null)">{{ t('全部') }}</text>
            <text v-for="item in SYSTEMS" :key="item" class="chip press" :class="{ active: system === item }" hover-class="press-on" hover-stay-time="80" @click="setSystem(item)">{{ pick(SYSTEM_LESSONS[item].name, en) }}</text>
          </view>
        </scroll-view>
      </view>

      <!-- 心脏 -->
      <view v-else-if="demo === 'heart'" id="guide-heart" class="controls demo-row">
        <view class="bpm">
          <text :key="beat" class="bpm-heart beat">♥</text>
          <text class="bpm-num">{{ bpm }}</text>
          <text class="bpm-unit">{{ t('次/分钟') }}</text>
        </view>
        <view class="play wide press" :class="{ off: running }" hover-class="press-on" hover-stay-time="80" @click="runHeart">
          <text>{{ running ? t('跑步中…') : t('跑一跑') }}</text>
        </view>
      </view>

      <!-- 肺 -->
      <view v-else-if="demo === 'lungs'" class="controls breathe-box">
        <view
          id="guide-breathe"
          class="breathe"
          :class="{ on: holding }"
          @touchstart.prevent="holdStart"
          @touchend="holdEnd"
          @touchcancel="holdEnd"
        >
          <view class="breathe-ring" :style="ringStyle" />
          <text class="breathe-text">{{ holding ? t('吸气…') : t('按住吸气') }}</text>
        </view>
        <view class="breath-count">
          <text class="breath-label">{{ t('已呼吸 {n} 次', { n: breaths }) }}</text>
          <view class="breath-dots">
            <view v-for="at in 10" :key="at" class="breath-dot" :class="{ on: at <= breathDots }" />
          </view>
        </view>
      </view>

      <!-- 食物旅行 -->
      <view v-else class="controls">
        <view class="food-row">
          <view id="guide-food" class="chip-row tight">
            <text v-for="item in FOODS" :key="item.key" class="chip press" :class="{ active: foodKey === item.key }" hover-class="press-on" hover-stay-time="80" @click="pickFood(item.key)">{{ pick(item.name, en) }}</text>
          </view>
          <view class="play press" hover-class="press-on" hover-stay-time="80" @click="toggleFood">
            <text>{{ foodDone ? t('再来一次') : foodPlaying ? t('暂停') : t('继续') }}</text>
          </view>
        </view>
        <view id="guide-timeline" class="timeline">
          <view v-for="stop in foodStops" :key="stop.at" class="stop press" :class="{ active: stop.at === foodStage, past: stop.at < foodStage }" @click="playStage(stop.at)">
            <view class="stop-dot" />
            <text class="stop-name">{{ stop.name }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 探索：介绍卡片 -->
    <template v-if="tab === 'explore'">
      <view v-if="lesson && selectedMeta" :key="selected ?? ''" class="card panel fade-up">
        <view class="panel-head">
          <view class="name-wrap">
            <view class="dot-color" :style="{ background: selectedMeta.color }" />
            <text class="panel-title">{{ pick(lesson.name, en) }}</text>
            <text v-if="!en" class="name-en">{{ lesson.name.en }}</text>
          </view>
          <text v-if="selectedMeta.system" class="kind-tag">{{ pick(SYSTEM_LESSONS[selectedMeta.system].name, en) }}</text>
        </view>
        <text class="part-line">{{ pick(lesson.line, en) }}</text>
        <view class="info-row">
          <text class="info-key">{{ t('知道吗') }}</text>
          <text class="info-val">{{ pick(lesson.like, en) }}</text>
        </view>
        <view v-if="selectedMeta.demo || selectedMeta.cut" class="part-actions">
          <button v-if="selectedMeta.demo" hover-class="press-on" hover-stay-time="80" class="btn block" @click="watchItWork">{{ t('看它工作') }}</button>
          <button v-if="selectedMeta.cut" hover-class="press-on" hover-stay-time="80" class="btn block ghost" :class="{ on: cutOn }" @click="toggleCut">{{ cutOn ? t('合上') : t('切开看看') }}</button>
        </view>
      </view>
      <view v-else-if="systemLesson" class="card panel fade-up">
        <text class="panel-title">{{ pick(systemLesson.name, en) }}</text>
        <text class="part-line">{{ pick(systemLesson.line, en) }}</text>
      </view>

      <view class="card panel">
        <text class="panel-title">{{ t('身体里有什么') }}</text>
        <view class="part-grid">
          <view v-for="item in partChips" :key="item.id" class="part-chip press" :class="{ active: selected === item.id, dim: item.dim }" hover-class="press-on" hover-stay-time="80" @click="choose(item.id)">
            <view class="dot-color small" :style="{ background: item.color }" />
            <text class="part-name">{{ item.name }}</text>
          </view>
        </view>
        <text v-if="modelState === 'realistic'" class="tip">{{ t('人体模型：BodyParts3D, © The Database Center for Life Science（CC BY 4.0），肺来自 HuBMAP 人体参考图谱（CC BY 4.0），经过简化、改色和对齐。') }}</text>
        <text v-else-if="modelState === 'simple'" class="tip">{{ t('写实人体模型没有下载下来，先显示简化的人体，下次打开会再试。') }}</text>
      </view>
    </template>

    <!-- 演示：讲解 -->
    <view v-else-if="demo === 'heart'" class="card panel">
      <text class="panel-title">{{ t('血液的旅行') }}</text>
      <view class="facts">
        <text v-for="(fact, at) in HEART_FACTS" :key="at" class="fact" :class="{ note: at === HEART_FACTS.length - 1 }">{{ pick(fact, en) }}</text>
        <text class="fact" :class="{ hot: running }">{{ pick(HEART_RUN, en) }}</text>
      </view>
    </view>

    <view v-else-if="demo === 'lungs'" class="card panel">
      <text class="panel-title">{{ t('一呼一吸') }}</text>
      <view class="facts">
        <text :key="breathPhase" class="fact hot fade-up">{{ lungText }}</text>
        <text class="fact">{{ pick(LUNG_TEXT.rate, en) }}</text>
      </view>
    </view>

    <view v-else class="card panel">
      <view class="panel-head">
        <text class="panel-title">{{ t('第 {n} 站：{name}', { n: foodStage + 1, name: pick(foodLesson.name, en) }) }}</text>
        <text class="kind-tag">{{ pick(foodLesson.time, en) }}</text>
      </view>
      <text :key="foodStage" class="part-line fade-up">{{ pick(foodLesson.text, en) }}</text>
      <text v-if="foodDone" class="tip">{{ pick(FOOD_DONE, en) }}</text>
    </view>

    <view v-if="guideStep" class="guide">
      <view v-if="!guideRect" class="guide-mask" @touchmove.stop.prevent="noop" />
      <template v-else>
        <view v-for="(block, at) in blockers" :key="at" class="guide-block" :style="block" @touchmove.stop.prevent="noop" />
        <view class="guide-hole" :style="holeStyle" />
        <view v-if="!guideStep.action" class="guide-block" :style="holeStyle" @click="nextGuide" @touchmove.stop.prevent="noop" />
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
.body-page { padding-bottom: calc(40px + var(--safe-bottom)); }
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
  width: calc((100% - 8px) / 2);
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 6px 14px -8px rgba(40, 52, 88, 0.45), inset 0 1px 0 #fff;
  transition: transform 0.42s cubic-bezier(0.34, 1.3, 0.64, 1);
}
.seg.three .seg-indicator { width: calc((100% - 8px) / 3); }
.seg.four .seg-indicator { width: calc((100% - 8px) / 4); }
.seg-indicator.demo, .seg-indicator.d-lungs, .seg-indicator.l-muscle { transform: translateX(100%); }
.seg-indicator.d-food, .seg-indicator.l-bone { transform: translateX(200%); }
.seg-indicator.l-organ { transform: translateX(300%); }
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

.stage { padding: 12px 12px 16px; border-radius: 28px; }
.stage-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 28px; padding: 0 4px 8px; }
.stage-hint { flex: 1; min-width: 0; color: var(--muted); font-size: 13px; line-height: 1.4; }
.stage-hint.flash { color: var(--accent-text); font-weight: 700; }
.tools { display: flex; flex: none; gap: 6px; }
.tool { display: flex; width: 34px; height: 34px; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: 11px; background: var(--surface-2); box-sizing: border-box; }
.tool.help { color: var(--muted); font-size: 16px; font-weight: 800; }
.stage-box { position: relative; height: 760rpx; overflow: hidden; border-radius: 20px; background: var(--paper); }
.stage-canvas { display: block; width: 100%; height: 100%; }
.stage-fail { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 20px; color: var(--muted); font-size: 13px; text-align: center; }

.controls { margin-top: 10px; padding: 0 2px; }
.layers { margin-bottom: 10px; }
.fold-row { display: flex; align-items: center; gap: 10px; }
.play { flex: none; min-width: 68px; height: 36px; padding: 0 14px; border-radius: 12px; background: linear-gradient(135deg, #ffb45c 0%, #ff7a45 48%, #f15a36 100%); color: #fff; font-size: 13px; font-weight: 750; line-height: 36px; text-align: center; transition: opacity 0.25s ease; }
.play.wide { min-width: 120px; height: 44px; border-radius: 14px; font-size: 15px; line-height: 44px; }
.play.off { opacity: 0.55; }
.fold-slider { flex: 1; margin: 0 4px; }
.chip-scroll { width: 100%; margin-top: 10px; white-space: nowrap; }
.chip-list { display: inline-flex; gap: 8px; padding: 2px 2px 4px; }
.chip-list .chip { flex: none; white-space: nowrap; }

.demo-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 4px 6px 0; }
.bpm { display: flex; align-items: baseline; gap: 6px; }
.bpm-heart { color: #ff4f66; font-size: 26px; }
.bpm-num { color: var(--ink); font-size: 34px; font-weight: 800; }
.bpm-unit { color: var(--muted); font-size: 12px; font-weight: 700; }
.beat { animation: beat 0.4s ease; }

.breathe-box { display: flex; align-items: center; gap: 16px; padding: 6px 6px 0; }
.breathe { position: relative; display: flex; width: 108px; height: 108px; flex: none; align-items: center; justify-content: center; }
.breathe-ring { position: absolute; inset: 10px; border-radius: 50%; background: radial-gradient(circle at 50% 40%, #8fd8ff 0%, #3fb6ff 70%); box-shadow: 0 10px 24px -10px rgba(63, 182, 255, 0.8); transition: transform 0.08s linear; }
.breathe.on .breathe-ring { background: radial-gradient(circle at 50% 40%, #b8e8ff 0%, #2aa4f4 70%); }
.breathe-text { position: relative; color: #fff; font-size: 14px; font-weight: 800; }
.breath-count { flex: 1; }
.breath-label { color: var(--ink); font-size: 14px; font-weight: 750; }
.breath-dots { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.breath-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--track); transition: background 0.3s ease, transform 0.3s ease; }
.breath-dot.on { background: #3fb6ff; transform: scale(1.1); }

.food-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.timeline { position: relative; display: flex; justify-content: space-between; margin-top: 14px; }
.timeline::before { content: ''; position: absolute; top: 6px; left: 8%; right: 8%; height: 2px; background: var(--track); }
.stop { position: relative; display: flex; flex: 1; flex-direction: column; align-items: center; gap: 6px; }
.stop-dot { width: 14px; height: 14px; border: 2px solid var(--track); border-radius: 50%; background: var(--paper); box-sizing: border-box; transition: background 0.3s ease, border-color 0.3s ease, transform 0.3s ease; }
.stop.past .stop-dot { border-color: #ffb08d; background: #ffb08d; }
.stop.active .stop-dot { border-color: #ff7a45; background: #ff7a45; transform: scale(1.3); }
.stop-name { color: var(--muted); font-size: 11.5px; font-weight: 700; text-align: center; }
.stop.active .stop-name { color: var(--accent-text); }

.panel { margin-top: 14px; }
.panel-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.panel-title { display: block; color: var(--ink); font-size: 15px; font-weight: 800; }
.name-wrap { display: flex; align-items: center; gap: 8px; min-width: 0; }
.name-en { color: var(--muted); font-size: 12px; font-weight: 650; }
.dot-color { width: 12px; height: 12px; flex: none; border-radius: 50%; }
.dot-color.small { width: 9px; height: 9px; }
.kind-tag { flex: none; padding: 2px 10px; border-radius: 999px; background: var(--accent-soft); color: var(--accent-text); font-size: 12px; font-weight: 700; }
.part-line { display: block; margin-top: 10px; color: var(--ink); font-size: 14px; font-weight: 650; line-height: 1.6; }
.info-row { display: flex; align-items: flex-start; gap: 10px; margin-top: 10px; padding: 9px 12px; border-radius: 12px; background: var(--surface-2); }
.info-key { flex: none; color: var(--accent-text); font-size: 13px; font-weight: 800; line-height: 1.55; }
.info-val { flex: 1; color: var(--ink); font-size: 13px; font-weight: 600; line-height: 1.55; }
.part-actions { display: flex; gap: 10px; margin-top: 12px; }
.part-actions .btn { flex: 1; }
.btn.ghost { border: 1px solid #ffb08d; background: var(--accent-soft); color: var(--accent-text); }
.btn.ghost.on { background: #ff7a45; color: #fff; }
.tip { display: block; margin-top: 10px; color: var(--muted); font-size: 12px; line-height: 1.6; }
.part-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.part-chip { display: flex; width: calc((100% - 16px) / 3); align-items: center; gap: 6px; padding: 9px 10px; border: 1px solid var(--line); border-radius: 12px; background: var(--paper); box-sizing: border-box; transition: border-color 0.25s ease, background 0.25s ease, opacity 0.25s ease; }
.part-chip.active { border-color: #ff9a6b; background: var(--accent-soft); }
.part-chip.dim { opacity: 0.4; }
.part-name { overflow: hidden; color: var(--ink); font-size: 13px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.part-chip.active .part-name { color: var(--accent-text); }
.facts { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
.fact { padding: 10px 12px; border-radius: 12px; background: var(--surface-2); color: var(--ink); font-size: 13.5px; font-weight: 600; line-height: 1.6; transition: background 0.3s ease; }
.fact.note { color: var(--muted); font-size: 12.5px; }
.fact.hot { background: var(--accent-soft); color: var(--accent-text); }

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

.fade-up { animation: fade-up 0.35s ease; }
@keyframes beat {
  0% { transform: scale(1); }
  30% { transform: scale(1.35); }
  100% { transform: scale(1); }
}
@keyframes fade-up {
  0% { opacity: 0; transform: translateY(6px); }
  100% { opacity: 1; transform: translateY(0); }
}
</style>
