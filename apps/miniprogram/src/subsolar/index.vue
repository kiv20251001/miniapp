<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, ref, shallowRef, watch } from 'vue'
import { onHide, onReady, onShareAppMessage, onShareTimeline, onShow, onUnload } from '@dcloudio/uni-app'
import dayjs from 'dayjs'
import { toolMoments, toolShare } from '@/utils/share'
import { usePageBackground, useThemePage } from '@/utils/wx-theme'
import PageHeader from '@/components/PageHeader.vue'
import { isEn, t } from '@/i18n'
import { LATITUDE, OBLIQUITY, daysSinceJ2000, moonPhase, mod360, seasonInfo, type MoonPhase, type SeasonInfo } from './astro'
import { BODY_MAP, PICKER_ORDER, factsOf, lunarDayText, nameOf, type BodyKey } from './bodies'
import { GUIDES, MODE_HINTS, PHASE_LESSONS, SEASON_BETWEEN, SEASON_POINTS, pick, type GuideStep } from './lessons'
import { SolarScene, type CanvasNode, type Mode, type SceneInfo, type TouchPoint } from './scene'

onShareAppMessage(() => toolShare('solar', '/subsolar/index'))
onShareTimeline(() => toolMoments('solar'))

const themeClass = useThemePage()
const pageBg = usePageBackground()

const SPEEDS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 20]
const J2000 = Date.UTC(2000, 0, 1, 12)
const MODES: Array<{ key: Mode; label: string }> = [
  { key: 'system', label: '太阳系' },
  { key: 'compare', label: '大小对比' },
  { key: 'moon', label: '月相' },
  { key: 'seasons', label: '四季' },
]

const mode = ref<Mode>('system')
const selected = ref<BodyKey | null>(null)
const playing = ref(true)
const speedIndex = ref(3)
const loading = ref(true)
const failed = ref(false)
const dateText = ref('')
const phase = ref<MoonPhase | null>(null)
const season = ref<SeasonInfo | null>(null)
const scene = shallowRef<SolarScene | null>(null)
const instance = getCurrentInstance()
let lastInfoKey = ''

const en = computed(() => isEn())
const speedLabel = computed(() => `${SPEEDS[speedIndex.value]}x`)
const hint = computed(() => {
  if (loading.value) return t('正在生成星球…')
  if (failed.value) return t('当前设备不支持 3D 显示，可以换一台手机或升级微信后再试')
  return pick(MODE_HINTS[mode.value], en.value)
})
const card = computed(() => {
  const key = selected.value
  if (!key || (mode.value !== 'system' && mode.value !== 'compare')) return null
  const body = BODY_MAP[key]
  return {
    key,
    color: body.color,
    name: nameOf(key, en.value),
    tagline: en.value ? body.tagline.en : body.tagline.zh,
    intro: en.value ? body.intro.en : body.intro.zh,
    facts: factsOf(body, en.value),
  }
})

// ---- 月相 ----

/** 用两个半圆加一个椭圆拼出月亮的亮面。0~180° 右边亮（上半月），180~360° 左边亮。 */
function moonDisc(elongation: number) {
  const waxing = elongation < 180
  const cos = Math.cos((elongation * Math.PI) / 180)
  const lit = '#f4f1e6'
  const dark = '#262b3a'
  const ellipseLit = waxing ? elongation > 90 : elongation < 270
  return {
    left: { background: waxing ? dark : lit },
    right: { background: waxing ? lit : dark },
    ellipse: { width: `${Math.abs(cos) * 100}%`, background: ellipseLit ? lit : dark },
  }
}

const PHASE_DISCS = PHASE_LESSONS.map((lesson) => moonDisc(lesson.elongation))
const moonStyle = computed(() => (phase.value ? moonDisc(phase.value.elongation) : null))
const phaseIndex = computed(() => (phase.value ? PHASE_LESSONS.findIndex((lesson) => lesson.name === phase.value!.name) : -1))
const phaseLesson = computed(() => (phaseIndex.value >= 0 ? PHASE_LESSONS[phaseIndex.value] : null))
const lunarText = computed(() => (phase.value ? lunarDayText(phase.value.lunarDay, en.value) : ''))

function goPhase(index: number) {
  // 月相模式里太阳固定在 0°，月球黄经就是它离太阳的角度
  scene.value?.goTo('moon', PHASE_LESSONS[index].elongation)
  reveal(phaseInto, `phase-${Math.max(0, index - 1)}`)
}

// ---- 四季 ----

const seasonPointIndex = computed(() => {
  const value = season.value
  if (!value) return -1
  return SEASON_POINTS.findIndex((point) => Math.abs(mod360(value.sunLon - point.sunLon + 180) - 180) < 6)
})
const seasonLesson = computed(() => {
  const value = season.value
  if (!value) return ''
  const point = SEASON_POINTS[seasonPointIndex.value]
  if (point) return pick(point.text, en.value)
  return pick(SEASON_BETWEEN[Math.floor(value.sunLon / 90) % 4], en.value)
})
const seasonText = computed(() => {
  const value = season.value
  if (!value) return null
  const day = value.dayHours
  const decl = value.declination
  const abs = Math.abs(decl).toFixed(1)
  return {
    term: `${t(value.term)} · ${t(value.season)}`,
    date: t('约 {date}', { date: dayjs().month(value.month - 1).date(value.day).format(t('M月D日')) }),
    dayPercent: `${(day / 24) * 100}%`,
    day: t('白天 {h} 小时', { h: day.toFixed(1) }),
    night: t('黑夜 {h} 小时', { h: (24 - day).toFixed(1) }),
    sun: Math.abs(decl) < 0.3 ? t('太阳直射赤道') : decl > 0 ? t('太阳直射北纬 {d}°', { d: abs }) : t('太阳直射南纬 {d}°', { d: abs }),
    /** 直射点在刻度条上的位置：顶端北回归线，底端南回归线 */
    sunTop: `${((OBLIQUITY - decl) / (OBLIQUITY * 2)) * 100}%`,
  }
})

function goSeason(index: number) {
  // 太阳黄经 λ 时，地球在日心黄经 λ + 180°
  scene.value?.goTo('earth', mod360(SEASON_POINTS[index].sunLon + 180))
}

function handleInfo(info: SceneInfo) {
  const sunLon = mod360(info.earthLon + 180)
  if (info.mode === 'system') {
    const date = dayjs(J2000 + info.days * 86400000).format(t('YYYY年M月D日'))
    if (date !== lastInfoKey) dateText.value = date
    lastInfoKey = date
    return
  }
  if (info.mode === 'moon') {
    const next = moonPhase(info.moonLon, sunLon)
    // 只有看得出变化时才更新界面，减少逻辑层到渲染层的数据传输
    const key = `m${Math.round(next.elongation)}`
    if (key === lastInfoKey) return
    lastInfoKey = key
    phase.value = next
    return
  }
  if (info.mode === 'seasons') {
    const next = seasonInfo(sunLon, LATITUDE)
    const key = `s${next.month}-${next.day}`
    if (key === lastInfoKey) return
    lastInfoKey = key
    season.value = next
  }
}

// ---- 列表自动滚动 ----

const pickerInto = ref('')
const phaseInto = ref('')

/** scroll-into-view 把目标贴到左边；对准前一项，被点中的那项右边就会露出后面的按钮。 */
function reveal(target: typeof pickerInto, id: string) {
  target.value = ''
  nextTick(() => {
    target.value = id
  })
}

function select(key: BodyKey | null) {
  selected.value = key
  scene.value?.focus(key)
  const index = key ? PICKER_ORDER.indexOf(key) : -1
  reveal(pickerInto, index <= 0 ? 'chip-all' : `chip-${PICKER_ORDER[index - 1]}`)
  if (key) passGuide('select')
}

function setMode(next: Mode) {
  if (mode.value === next) return
  if (guideIndex.value >= 0) endGuide()
  selected.value = null
  lastInfoKey = ''
  mode.value = next
  scene.value?.setMode(next)
  setTimeout(() => maybeGuide(next), 500)
}

function zoom(factor: number) {
  scene.value?.zoomBy(factor)
}

// ---- 画布 ----

function queryCanvas(callback: (result: { node?: CanvasNode; width?: number; height?: number } | null) => void) {
  const proxy = instance?.proxy
  if (!proxy) return
  uni.createSelectorQuery().in(proxy).select('#solar-canvas').fields({ node: true, size: true } as UniApp.NodeField, (res) => {
    callback(res as { node?: CanvasNode; width?: number; height?: number } | null)
  }).exec()
}

/** 画布的显示尺寸。原生画布不跟着百分比高度变，必须写成具体像素，否则底部会留出一块白底。 */
const canvasBox = ref<{ width: number; height: number } | null>(null)
const canvasStyle = computed(() => (canvasBox.value ? `width:${canvasBox.value.width}px;height:${canvasBox.value.height}px;` : ''))

function fitCanvas() {
  measure('guide-stage').then((rect) => {
    if (!rect?.width || !rect.height) return
    const width = Math.round(rect.width)
    const height = Math.round(rect.height)
    const same = canvasBox.value?.width === width && canvasBox.value?.height === height
    canvasBox.value = { width, height }
    // 先让组件按这个像素尺寸排好，再改绘图缓冲区，避免缓冲区比组件矮
    nextTick(() => setTimeout(() => scene.value?.resize(width, height), same ? 0 : 30))
  })
}

// 下面的面板高度随模式和介绍卡片变化，画布跟着变高变矮。引导卡片插入后要等排版结束再量。
watch(() => [mode.value, Boolean(card.value), Boolean(phase.value), Boolean(season.value), guideIndex.value >= 0], () => {
  nextTick(() => setTimeout(fitCanvas, 160))
})

function togglePlay() {
  playing.value = !playing.value
  scene.value?.setPlaying(playing.value)
}

function changeSpeed(event: { detail: { value: number } }) {
  speedIndex.value = event.detail.value
  scene.value?.setSpeed(SPEEDS[speedIndex.value])
}

function backToToday() {
  lastInfoKey = ''
  scene.value?.resetToday()
}

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
}

function onTouchEnd(event: CanvasTouchEvent) {
  scene.value?.touchEnd(pointsOf(event))
}

function names() {
  return Object.fromEntries(PICKER_ORDER.map((key) => [key, nameOf(key, en.value)])) as Record<BodyKey, string>
}

function initScene() {
  queryCanvas((result) => {
    const canvas = result?.node
    if (!canvas || !result?.width || !result?.height) {
      failed.value = true
      loading.value = false
      return
    }
    const info = typeof uni.getWindowInfo === 'function' ? uni.getWindowInfo() : uni.getSystemInfoSync()
    // 先让「正在生成星球」显示出来，再开始烘焙表面
    setTimeout(() => {
      try {
        const solar = new SolarScene({
          canvas,
          width: result.width!,
          height: result.height!,
          pixelRatio: Math.min(info.pixelRatio || 2, 2),
          names: names(),
          seasonMarks: [t('春分'), t('夏至'), t('秋分'), t('冬至')],
          phaseMarks: [t('新月'), t('上弦月'), t('满月'), t('下弦月')],
          sunlight: t('阳光'),
          onSelect: select,
          onInfo: handleInfo,
          onDrag: (body) => passGuide(body === 'moon' ? 'drag-moon' : 'drag-earth'),
        })
        solar.setSpeed(SPEEDS[speedIndex.value])
        scene.value = solar
        solar.start()
        setTimeout(() => maybeGuide('system'), 500)
      } catch (error) {
        console.error('[solar] init failed', error)
        failed.value = true
      }
      loading.value = false
    }, 30)
  })
}

// ---- 首次进入的引导 ----
// 画布在开发者工具里是最上层，盖在它上面的东西（包括 cover-view）都看不见，
// 所以引导卡片放在画布上方、跟着排版走，只用挡板把要操作的区域以外压暗。

type Rect = { left: number; top: number; width: number; height: number }

const guideSteps = ref<GuideStep[]>([])
const guideIndex = ref(-1)
const guideRect = ref<Rect | null>(null)
const guidePassed = ref(false)
const guideStep = computed(() => (guideIndex.value >= 0 ? guideSteps.value[guideIndex.value] ?? null : null))
const guideTitle = computed(() => {
  const step = guideStep.value
  if (!step) return ''
  return guidePassed.value ? t('做得好！') : pick(step.title, en.value)
})
const guideText = computed(() => {
  const step = guideStep.value
  if (!step) return ''
  return guidePassed.value && step.done ? pick(step.done, en.value) : pick(step.text, en.value)
})

const guideKey = (value: Mode) => `uday-solar-guide-${value}-v1`

/**
 * 镂空四周的半透明挡板，中间留出要操作的区域。
 * 挡板比屏幕多伸出一截：小程序里 bottom:0 会停在安全区上方，底部会露出页面的白底，挡板盖不住。
 * 也不向外扩镂空，否则会扩进卡片左右的浅色页边。
 */
const blockers = computed(() => {
  const rect = guideRect.value
  if (!rect) return []
  const top = Math.max(0, rect.top)
  const bottom = rect.top + rect.height
  const left = Math.max(0, rect.left)
  const right = rect.left + rect.width
  return [
    { top: '-80px', left: '-80px', width: '140vw', height: `${top + 80}px` },
    { top: `${bottom}px`, left: '-80px', width: '140vw', height: '140vh' },
    { top: `${top}px`, left: '-80px', width: `${left + 80}px`, height: `${bottom - top}px` },
    { top: `${top}px`, left: `${right}px`, width: '140vw', height: `${bottom - top}px` },
  ]
})

function measure(id: string) {
  return new Promise<Rect | null>((resolve) => {
    const proxy = instance?.proxy
    if (!proxy) return resolve(null)
    uni.createSelectorQuery().in(proxy).select(`#${id}`).boundingClientRect((box) => {
      const rect = box as UniApp.NodeInfo | null
      if (!rect || rect.width == null) return resolve(null)
      resolve({ left: rect.left!, top: rect.top!, width: rect.width!, height: rect.height! })
    }).exec()
  })
}

async function focusGuide() {
  const step = guideStep.value
  if (!step) return
  guidePassed.value = false
  // 量新位置时留着上一块挡板。先清掉的话，下一步之间遮罩会整屏闪一下。
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 160))
  fitCanvas()
  await new Promise((resolve) => setTimeout(resolve, 40))
  const rect = await measure(step.target)
  if (guideStep.value !== step) return
  if (!rect) {
    nextGuide()
    return
  }
  guideRect.value = rect
}

function startGuide(value: Mode = mode.value) {
  const steps = GUIDES[value]
  if (!steps?.length || loading.value || failed.value) return
  guideSteps.value = steps
  guideIndex.value = 0
  focusGuide()
}

function maybeGuide(value: Mode) {
  if (mode.value !== value || guideIndex.value >= 0) return
  if (!uni.getStorageSync(guideKey(value))) startGuide(value)
}

function noop() {}

function passGuide(action: GuideStep['action']) {
  if (guideStep.value?.action !== action || guidePassed.value) return
  guidePassed.value = true
}

function nextGuide() {
  if (guideIndex.value < 0) return
  if (guideIndex.value + 1 >= guideSteps.value.length) {
    endGuide()
    return
  }
  guideIndex.value += 1
  focusGuide()
}

function endGuide() {
  uni.setStorageSync(guideKey(mode.value), 1)
  guideIndex.value = -1
  guideRect.value = null
}

onReady(() => {
  dateText.value = dayjs(J2000 + daysSinceJ2000() * 86400000).format(t('YYYY年M月D日'))
  initScene()
})

onShow(() => scene.value?.start())
onHide(() => {
  scene.value?.stop()
})
onUnload(() => {
  scene.value?.dispose()
  scene.value = null
})
</script>

<template>
  <!-- 窗口底色用星空色：原生画布盖不住的缝会透出窗口底色，浅色主题下就是一条白边 -->
  <page-meta :page-style="pageBg.style" background-color="#03040a" background-color-top="#03040a" background-color-bottom="#03040a" root-background-color="#03040a" :background-text-style="pageBg.text" />
  <view class="theme-root solar-page" :class="themeClass">
    <PageHeader safe show-back :title="t('3D 太阳系')" :caption="t('看行星、比大小，动手玩月相和四季')" />
    <view class="solar">
      <view class="topbar">
        <view class="top-row">
          <view id="guide-modes" class="modes">
            <view
              v-for="item in MODES"
              :key="item.key"
              class="mode"
              :class="{ on: mode === item.key }"
              @click="setMode(item.key)"
            >
              {{ t(item.label) }}
            </view>
          </view>
          <view class="help press" hover-class="press-on" @click="startGuide()">?</view>
        </view>
        <view class="hint-row">
          <text class="hint">{{ hint }}</text>
          <view class="zoom-btn press" hover-class="press-on" @click="zoom(1.33)">−</view>
          <view class="zoom-btn press" hover-class="press-on" @click="zoom(0.75)">+</view>
        </view>
      </view>

      <view v-if="guideStep" class="guide-card">
        <view class="guide-top">
          <text class="guide-count">{{ guideIndex + 1 }}/{{ guideSteps.length }}</text>
          <text class="guide-skip press" @click="endGuide">{{ t('跳过') }}</text>
        </view>
        <text class="guide-title">{{ guideTitle }}</text>
        <text class="guide-text">{{ guideText }}</text>
        <view class="guide-foot">
          <text class="guide-try">{{ guideStep.action && !guidePassed ? t('试一试') : '' }}</text>
          <view class="guide-next press" hover-class="press-on" @click="nextGuide">
            {{ guideIndex + 1 >= guideSteps.length ? t('知道了') : t('下一步') }}
          </view>
        </view>
      </view>

      <view id="guide-stage" class="stage-box">
        <canvas
          id="solar-canvas"
          class="stage"
          :style="canvasStyle"
          type="webgl"
          disable-scroll
          @touchstart="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
          @touchcancel="onTouchEnd"
        />
      </view>

      <view class="bottom">
        <!-- 星球介绍 -->
        <view v-if="card" class="panel card">
          <view class="card-head">
            <view class="card-dot" :style="{ background: card.color }" />
            <view class="card-title">
              <text class="card-name">{{ card.name }}</text>
              <text class="card-tag">{{ card.tagline }}</text>
            </view>
            <view class="card-close press" hover-class="press-on" @click="select(null)">×</view>
          </view>
          <view class="facts">
            <view v-for="fact in card.facts" :key="fact.label" class="fact">
              <text class="fact-label">{{ fact.label }}</text>
              <text class="fact-value">{{ fact.value }}</text>
            </view>
          </view>
          <scroll-view scroll-y class="intro-box">
            <text class="intro">{{ card.intro }}</text>
          </scroll-view>
        </view>

        <!-- 月相 -->
        <view v-if="mode === 'moon' && phase && moonStyle" class="panel">
          <view id="guide-moon-view" class="lesson-head">
            <view class="moon-disc big">
              <view class="moon-half left" :style="moonStyle.left" />
              <view class="moon-half right" :style="moonStyle.right" />
              <view class="moon-ellipse" :style="moonStyle.ellipse" />
            </view>
            <view class="lesson-main">
              <text class="lesson-caption">{{ t('地球上看到的月亮') }}</text>
              <text class="lesson-name">{{ t(phase.name) }}</text>
              <text class="lesson-sub">{{ lunarText }}</text>
            </view>
          </view>
          <scroll-view scroll-y class="lesson-box">
            <text class="lesson-text">{{ phaseLesson ? pick(phaseLesson.text, en) : '' }}</text>
          </scroll-view>
          <scroll-view
            id="guide-phase-row"
            scroll-x
            class="steps"
            :show-scrollbar="false"
            enhanced
            scroll-with-animation
            :scroll-into-view="phaseInto"
          >
            <view class="steps-row">
              <view
                v-for="(lesson, index) in PHASE_LESSONS"
                :id="`phase-${index}`"
                :key="lesson.name"
                class="step"
                :class="{ on: index === phaseIndex }"
                @click="goPhase(index)"
              >
                <view class="moon-disc small">
                  <view class="moon-half left" :style="PHASE_DISCS[index].left" />
                  <view class="moon-half right" :style="PHASE_DISCS[index].right" />
                  <view class="moon-ellipse" :style="PHASE_DISCS[index].ellipse" />
                </view>
                <text class="step-name">{{ t(lesson.name) }}</text>
              </view>
            </view>
          </scroll-view>
        </view>

        <!-- 四季 -->
        <view v-if="mode === 'seasons' && season && seasonText" class="panel">
          <view id="guide-season-view" class="lesson-head">
            <view class="gauge">
              <view class="gauge-bar">
                <view class="gauge-line top" />
                <view class="gauge-line mid" />
                <view class="gauge-line end" />
                <view class="gauge-sun" :style="{ top: seasonText.sunTop }" />
              </view>
              <view class="gauge-labels">
                <text class="gauge-label">{{ t('北回归线') }}</text>
                <text class="gauge-label">{{ t('赤道') }}</text>
                <text class="gauge-label">{{ t('南回归线') }}</text>
              </view>
            </view>
            <view class="lesson-main">
              <text class="lesson-name">{{ seasonText.term }}</text>
              <text class="lesson-sub">{{ seasonText.date }} · {{ seasonText.sun }}</text>
              <text class="lesson-caption gap">{{ t('北京的白天和黑夜') }}</text>
              <view class="day-bar">
                <view class="day-fill" :style="{ width: seasonText.dayPercent }" />
              </view>
              <view class="day-legend">
                <text class="lesson-sub">{{ seasonText.day }}</text>
                <text class="lesson-sub">{{ seasonText.night }}</text>
              </view>
            </view>
          </view>
          <scroll-view scroll-y class="lesson-box">
            <text class="lesson-text">{{ seasonLesson }}</text>
          </scroll-view>
          <view id="guide-term-row" class="terms">
            <view
              v-for="(point, index) in SEASON_POINTS"
              :key="point.name"
              class="term"
              :class="{ on: index === seasonPointIndex }"
              @click="goSeason(index)"
            >
              <text class="term-name">{{ t(point.name) }}</text>
              <text class="term-date">{{ pick(point.date, en) }}</text>
            </view>
          </view>
        </view>

        <scroll-view
          v-if="mode === 'system' || mode === 'compare'"
          id="guide-picker"
          scroll-x
          class="picker"
          :show-scrollbar="false"
          enhanced
          scroll-with-animation
          :scroll-into-view="pickerInto"
        >
          <view class="picker-row">
            <view id="chip-all" class="chip" :class="{ on: !selected }" @click="select(null)">{{ t('全景') }}</view>
            <view
              v-for="key in PICKER_ORDER"
              :id="`chip-${key}`"
              :key="key"
              class="chip"
              :class="{ on: selected === key }"
              @click="select(selected === key ? null : key)"
            >
              <view class="chip-dot" :style="{ background: BODY_MAP[key].color }" />
              {{ nameOf(key, en) }}
            </view>
          </view>
        </scroll-view>

        <view v-if="mode !== 'compare'" id="guide-controls" class="controls">
          <view class="play press" hover-class="press-on" @click="togglePlay">
            <view v-if="playing" class="pause-icon"><view /><view /></view>
            <view v-else class="play-icon" />
          </view>
          <text class="speed">{{ speedLabel }}</text>
          <slider
            class="slider"
            :min="0"
            :max="SPEEDS.length - 1"
            :step="1"
            :value="speedIndex"
            active-color="#7cc4ff"
            background-color="rgba(255,255,255,0.18)"
            block-color="#ffffff"
            :block-size="18"
            @changing="changeSpeed"
            @change="changeSpeed"
          />
          <view class="today press" hover-class="press-on" @click="backToToday">{{ t('今天') }}</view>
        </view>
        <text v-if="mode === 'system'" class="date">{{ dateText }}</text>
      </view>

    </view>

    <!-- 挡板：把要操作的区域以外压暗，引导卡片在挡板上面 -->
    <template v-if="guideStep && guideRect">
      <view v-for="(block, at) in blockers" :key="at" class="guide-block" :style="block" @touchmove.stop.prevent="noop" />
    </template>
  </view>
</template>

<style scoped>
.solar-page {
  display: flex;
  height: 100vh;
  box-sizing: border-box;
  flex-direction: column;
  padding-top: 18px;
}
.solar {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  margin: 0 12px calc(10px + env(safe-area-inset-bottom));
  overflow: hidden;
  border-radius: 22px;
  background: #03040a;
  color: #fff;
}
.topbar {
  flex: 0 0 auto;
  padding: 8px 10px 6px;
}
.top-row {
  display: flex;
  align-items: center;
  justify-content: center;
}
.modes {
  display: flex;
  padding: 3px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 20px;
  background: rgba(20, 22, 34, 0.72);
}
.mode {
  padding: 6px 13px;
  border-radius: 17px;
  color: rgba(255, 255, 255, 0.78);
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}
.mode.on {
  background: #fff;
  color: #11131c;
}
.help {
  width: 28px;
  height: 28px;
  margin-left: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 14px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 15px;
  font-weight: 700;
  line-height: 26px;
  text-align: center;
}
.hint-row {
  display: flex;
  align-items: center;
  margin-top: 6px;
}
.hint {
  flex: 1;
  min-width: 0;
  color: rgba(255, 255, 255, 0.55);
  font-size: 11px;
  line-height: 1.5;
}
.zoom-btn {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  margin-left: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 15px;
  background: rgba(20, 22, 34, 0.85);
  font-size: 18px;
  line-height: 28px;
  text-align: center;
}
.stage-box {
  position: relative;
  flex: 1;
  min-height: 0;
}
.stage {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  /* 原生画布默认白底，没铺满时先垫上和星空一样的颜色，挡板盖不住这一层 */
  background: #03040a;
}

.bottom {
  flex: 0 0 auto;
  padding: 6px 10px 10px;
}
.panel {
  margin-bottom: 8px;
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 16px;
  background: rgba(16, 18, 30, 0.95);
}
.card-head {
  display: flex;
  align-items: center;
}
.card-dot {
  width: 12px;
  height: 12px;
  flex: 0 0 auto;
  border-radius: 6px;
}
.card-title {
  flex: 1;
  min-width: 0;
  margin-left: 8px;
}
.card-name {
  display: block;
  font-size: 18px;
  font-weight: 800;
}
.card-tag {
  display: block;
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
}
.card-close {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.1);
  font-size: 20px;
  line-height: 28px;
  text-align: center;
}
.facts {
  display: flex;
  flex-wrap: wrap;
  margin-top: 6px;
}
.fact {
  width: 33.33%;
  margin-top: 6px;
}
.fact-label {
  display: block;
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
}
.fact-value {
  display: block;
  font-size: 13px;
  font-weight: 700;
}
.intro-box {
  max-height: 84px;
  margin-top: 8px;
}
.intro {
  color: rgba(255, 255, 255, 0.86);
  font-size: 13px;
  line-height: 1.6;
}

.lesson-head {
  display: flex;
  align-items: center;
}
.lesson-main {
  flex: 1;
  min-width: 0;
  margin-left: 12px;
}
.lesson-caption {
  display: block;
  color: rgba(255, 255, 255, 0.55);
  font-size: 11px;
}
.lesson-caption.gap {
  margin-top: 6px;
}
.lesson-name {
  display: block;
  font-size: 18px;
  font-weight: 800;
}
.lesson-sub {
  display: block;
  margin-top: 2px;
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
}
.lesson-box {
  height: 64px;
  margin-top: 8px;
}
.lesson-text {
  display: block;
  color: rgba(255, 255, 255, 0.88);
  font-size: 13px;
  line-height: 1.6;
}
.moon-disc {
  position: relative;
  flex: 0 0 auto;
  overflow: hidden;
  border-radius: 50%;
}
.moon-disc.big {
  width: 60px;
  height: 60px;
  box-shadow: 0 0 16px rgba(244, 241, 230, 0.25);
}
.moon-disc.small {
  width: 24px;
  height: 24px;
}
.moon-half {
  position: absolute;
  top: 0;
  width: 50%;
  height: 100%;
}
.moon-half.left {
  left: 0;
}
.moon-half.right {
  right: 0;
}
.moon-ellipse {
  position: absolute;
  top: 0;
  left: 50%;
  height: 100%;
  border-radius: 50%;
  transform: translateX(-50%);
}
.steps {
  width: 100%;
  margin-top: 10px;
  white-space: nowrap;
}
.steps-row {
  display: inline-flex;
}
.step {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  min-width: 56px;
  margin-right: 6px;
  padding: 6px 6px 5px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
}
.step.on {
  border-color: rgba(191, 225, 255, 0.85);
  background: rgba(191, 225, 255, 0.16);
}
.step-name {
  margin-top: 4px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 11px;
}
.gauge {
  display: flex;
  flex: 0 0 auto;
  height: 76px;
}
.gauge-bar {
  position: relative;
  width: 8px;
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(180deg, #ff9f5a, #3f6fd8 50%, #ff9f5a);
}
.gauge-line {
  position: absolute;
  left: -3px;
  width: 14px;
  height: 1px;
  background: rgba(255, 255, 255, 0.6);
}
.gauge-line.top {
  top: 0;
}
.gauge-line.mid {
  top: 50%;
}
.gauge-line.end {
  bottom: 0;
}
.gauge-sun {
  position: absolute;
  left: 50%;
  width: 14px;
  height: 14px;
  margin: -7px 0 0 -7px;
  border-radius: 50%;
  background: #ffd27a;
  box-shadow: 0 0 10px #ffb340;
}
.gauge-labels {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  margin: -6px 0;
  padding-left: 8px;
}
.gauge-label {
  color: rgba(255, 255, 255, 0.6);
  font-size: 10px;
}
.day-bar {
  height: 8px;
  margin-top: 4px;
  overflow: hidden;
  border-radius: 4px;
  background: #2a3150;
}
.day-fill {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, #ffd27a, #ffb340);
}
.day-legend {
  display: flex;
  justify-content: space-between;
}
.terms {
  display: flex;
  margin-top: 10px;
}
.term {
  flex: 1;
  margin-right: 6px;
  padding: 6px 0;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  text-align: center;
}
.term:last-child {
  margin-right: 0;
}
.term.on {
  border-color: rgba(255, 210, 138, 0.85);
  background: rgba(255, 210, 138, 0.16);
}
.term-name {
  display: block;
  font-size: 13px;
  font-weight: 700;
}
.term-date {
  display: block;
  color: rgba(255, 255, 255, 0.55);
  font-size: 10px;
}

.picker {
  width: 100%;
  white-space: nowrap;
}
.picker-row {
  display: inline-flex;
  padding: 2px 0;
}
.chip {
  display: inline-flex;
  align-items: center;
  margin-right: 8px;
  padding: 7px 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 16px;
  background: rgba(20, 22, 34, 0.78);
  color: rgba(255, 255, 255, 0.86);
  font-size: 13px;
  font-weight: 600;
}
.chip.on {
  border-color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.22);
  color: #fff;
}
.chip-dot {
  width: 8px;
  height: 8px;
  margin-right: 6px;
  border-radius: 4px;
}
.picker + .controls {
  margin-top: 8px;
}
.controls {
  display: flex;
  align-items: center;
  padding: 4px 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 24px;
  background: rgba(20, 22, 34, 0.78);
}
.play {
  display: flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
}
.pause-icon {
  display: flex;
}
.pause-icon view {
  width: 4px;
  height: 14px;
  margin: 0 2px;
  border-radius: 1px;
  background: #fff;
}
.play-icon {
  width: 0;
  height: 0;
  margin-left: 3px;
  border-top: 8px solid transparent;
  border-bottom: 8px solid transparent;
  border-left: 13px solid #fff;
}
.speed {
  width: 40px;
  font-size: 13px;
  font-weight: 700;
  text-align: center;
}
.slider {
  flex: 1;
  margin: 0 8px;
}
.today {
  padding: 5px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.14);
  font-size: 13px;
  font-weight: 600;
}
.date {
  display: block;
  margin-top: 6px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  text-align: center;
}

.guide-block {
  position: fixed;
  z-index: 70;
  background: rgba(5, 7, 15, 0.72);
}
.guide-card {
  position: relative;
  z-index: 71;
  flex: 0 0 auto;
  margin: 2px 10px 8px;
  padding: 12px 14px 10px;
  border-radius: 16px;
  background: #ffffff;
}
.guide-top {
  display: flex;
  justify-content: space-between;
}
.guide-count {
  color: #ff7a45;
  font-size: 12px;
  font-weight: 700;
}
.guide-skip {
  color: #8a93a3;
  font-size: 13px;
}
.guide-title {
  display: block;
  margin-top: 4px;
  color: #1c2430;
  font-size: 16px;
  font-weight: 800;
}
.guide-text {
  display: block;
  margin-top: 4px;
  color: #4a5363;
  font-size: 13px;
  line-height: 1.6;
}
.guide-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}
.guide-try {
  color: #ff7a45;
  font-size: 13px;
  font-weight: 700;
}
.guide-next {
  padding: 6px 16px;
  border-radius: 16px;
  background: #1c2430;
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
}
</style>
