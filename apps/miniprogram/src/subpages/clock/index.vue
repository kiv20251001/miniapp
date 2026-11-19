<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { onHide, onLoad, onReady, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { TOOL_SHARE_TITLES, toolMoments, toolShare, useSearchTitle, type ToolShareKey } from '@/utils/share'
import { useFamilyPage } from '@/composables/useFamilyPage'
import { usePageBackground, useThemePage } from '@/utils/wx-theme'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import { t } from '@/i18n'
import { windowHeight } from '@/utils/system'
import ClockFace from './ClockFace.vue'
import ClockPrint from './ClockPrint.vue'
import DayBar from './DayBar.vue'
import {
  celestialAt,
  DAY,
  formatClock,
  HALF_DAY,
  mod,
  nearestTotal,
  nowSeconds,
  pad,
  partsOf,
  periodOf,
  quizOptions,
  randomQuizTime,
  skyAt,
  type ClockTime,
  type Level,
} from './time'

useFamilyPage()
const themeClass = useThemePage()
const TAB_SHARE: Record<Tab, ToolShareKey> = { explore: 'clock', quiz: 'clockQuiz', print: 'clockPrint' }
onShareAppMessage(() => toolShare(TAB_SHARE[tab.value], `/subpages/clock/index?tab=${tab.value}`))
onShareTimeline(() => toolMoments(TAB_SHARE[tab.value], `tab=${tab.value}`))
onLoad((query) => {
  const value = query?.tab
  if (value === 'quiz' || value === 'print') setTab(value)
})
const pageBg = usePageBackground()

type Motion = 'spring' | 'tick' | 'linear' | 'none'
const QUESTIONS = 5

type Tab = 'explore' | 'quiz' | 'print'
const tab = ref<Tab>('explore')
useSearchTitle(() => t(TOOL_SHARE_TITLES[TAB_SHARE[tab.value]]))

// ---- 探索 ----
const total = ref(nowSeconds())
const motion = ref<Motion>('spring')
const showSeconds = ref(true)
const speed = ref<1 | 60>(1)
const playing = ref(false)
const dragging = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

const parts = computed(() => partsOf(total.value))
const hours = computed(() => mod(total.value, DAY) / 3600)
const period = computed(() => periodOf(parts.value.h24))
const sky = computed(() => skyAt(hours.value))
const orb = computed(() => {
  const { day, progress } = celestialAt(hours.value)
  return {
    day,
    style: {
      left: `${6 + progress * 82}%`,
      top: `${34 + (1 - Math.sin(Math.PI * progress)) * 120}rpx`,
    },
  }
})
const skyStyle = computed(() => ({ background: `linear-gradient(180deg, ${sky.value.top} 0%, ${sky.value.bottom} 100%)` }))
const STARS = [
  { x: 10, y: 8, s: 6 }, { x: 22, y: 20, s: 4 }, { x: 80, y: 10, s: 5 }, { x: 90, y: 26, s: 4 },
  { x: 14, y: 46, s: 4 }, { x: 86, y: 52, s: 6 }, { x: 70, y: 4, s: 4 }, { x: 34, y: 6, s: 5 },
]

function readingOf(h: number, m: number) {
  if (m === 0) return t('{h} 点整', { h })
  if (m === 30) return t('{h} 点半', { h })
  return t('{h} 点 {m} 分', { h, m })
}

const reading = computed(() => readingOf(parts.value.h12, parts.value.m))
const barMinutes = computed({
  get: () => Math.floor(mod(total.value, DAY) / 60),
  set: (value: number) => {
    total.value = total.value - mod(total.value, DAY) + value * 60
  },
})

function stopPlay() {
  playing.value = false
  if (timer) clearInterval(timer)
  timer = null
}

function startPlay() {
  stopPlay()
  playing.value = true
  if (speed.value === 1) {
    motion.value = 'tick'
    timer = setInterval(() => {
      total.value = Math.floor(total.value) + 1
    }, 1000)
  } else {
    motion.value = 'linear'
    timer = setInterval(() => {
      total.value += 3
    }, 50)
  }
}

function togglePlay() {
  if (playing.value) stopPlay()
  else startPlay()
}

function toggleSpeed() {
  speed.value = speed.value === 1 ? 60 : 1
  if (playing.value) startPlay()
}

function toNow() {
  stopPlay()
  motion.value = 'spring'
  total.value = nearestTotal(total.value, nowSeconds(), DAY)
}

let dragHand = ''

function onDragStart(hand: string) {
  stopPlay()
  dragging.value = true
  motion.value = 'spring'
  dragHand = hand
}

function onDragEnd() {
  dragging.value = false
  if (guideStep.value?.action === 'drag-minute' && dragHand === 'minute' && !guidePassed.value) {
    guidePassed.value = true
    const at = guideIndex.value
    setTimeout(() => {
      if (guideIndex.value === at) nextGuide()
    }, 1200)
  }
}

function onBarStart() {
  stopPlay()
  dragging.value = true
  motion.value = 'none'
}

function onBarEnd() {
  dragging.value = false
  motion.value = 'spring'
}

onHide(stopPlay)
onUnmounted(stopPlay)

// ---- 小测验 ----
const quizMode = ref<'set' | 'read'>('set')
const level = ref<Level>('easy')
const LEVELS: Array<{ value: Level; label: string }> = [
  { value: 'easy', label: '简单' },
  { value: 'medium', label: '中等' },
  { value: 'hard', label: '困难' },
]
const index = ref(0)
const score = ref(0)
const results = ref<Array<'right' | 'wrong' | null>>([])
const target = ref<ClockTime>({ h: 3, m: 0 })
const options = ref<ClockTime[]>([])
const picked = ref<ClockTime | null>(null)
const answer = ref<'' | 'right' | 'wrong'>('')
const finished = ref(false)
const setTotal = ref(0)
const readTotal = ref(0)
let advanceTimer: ReturnType<typeof setTimeout> | null = null

const snap = computed(() => (level.value === 'hard' ? 60 : 300))
const setParts = computed(() => partsOf(setTotal.value))
const targetText = computed(() => formatClock(target.value.h, target.value.m))
const resultText = computed(() => {
  if (score.value === QUESTIONS) return t('太棒了，全部答对！')
  if (score.value >= 3) return t('不错，继续加油！')
  return t('多练几次就会啦')
})

function targetSeconds(time: ClockTime) {
  return (time.h % 12) * 3600 + time.m * 60
}

function clearAdvance() {
  if (advanceTimer) clearTimeout(advanceTimer)
  advanceTimer = null
}

function nextQuestion() {
  clearAdvance()
  target.value = randomQuizTime(level.value, target.value)
  answer.value = ''
  picked.value = null
  if (quizMode.value === 'set') {
    setTotal.value = nearestTotal(setTotal.value, 0, HALF_DAY)
  } else {
    options.value = quizOptions(target.value, level.value)
    readTotal.value = nearestTotal(readTotal.value, targetSeconds(target.value), HALF_DAY)
  }
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

function settle(right: boolean) {
  answer.value = right ? 'right' : 'wrong'
  results.value[index.value] = answer.value
  uni.vibrateShort({ type: right ? 'light' : 'heavy' })
  if (right) {
    score.value += 1
    advanceTimer = setTimeout(advance, 1100)
  }
}

function checkSet() {
  if (answer.value) return
  const right = setParts.value.h12 === target.value.h && setParts.value.m === target.value.m
  settle(right)
  if (!right) {
    setTimeout(() => {
      setTotal.value = nearestTotal(setTotal.value, targetSeconds(target.value), HALF_DAY)
    }, 500)
  }
}

function resetSet() {
  if (answer.value) return
  setTotal.value = nearestTotal(setTotal.value, 0, HALF_DAY)
}

function pick(option: ClockTime) {
  if (answer.value) return
  picked.value = option
  settle(option.h === target.value.h && option.m === target.value.m)
}

function optionClass(option: ClockTime) {
  if (!answer.value) return ''
  const isAnswer = option.h === target.value.h && option.m === target.value.m
  if (isAnswer) return 'right'
  if (picked.value === option) return 'wrong'
  return 'dim'
}

function setQuizMode(value: 'set' | 'read') {
  if (quizMode.value === value) return
  quizMode.value = value
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
  if (value !== 'explore') stopPlay()
  if (value === 'quiz' && !results.value.length) newRound()
}

onUnmounted(clearAdvance)

// ---- 首次进入的引导 ----
type Rect = { left: number; top: number; width: number; height: number }
type GuideStep = { target: string; round?: boolean; title: string; text: string; action?: 'drag-minute' }

const GUIDE_KEY = 'uday-clock-guide-v1'
const GUIDE: GuideStep[] = [
  { target: 'guide-clock', round: true, title: '认识三根指针', text: '短而粗的是时针，长而细的是分针，红色细细的是秒针。' },
  { target: 'guide-clock', round: true, title: '拨一拨分针', text: '按住长长的分针，顺着小圆点的方向拖动，看看时针怎么跟着走。', action: 'drag-minute' },
  { target: 'guide-digital', title: '看时间变化', text: '拨动指针时，这里会跟着显示几点几分，还有读法。' },
  { target: 'guide-bar', title: '一天的时间', text: '拖动时间条可以快速换时间，天空会从白天慢慢变到黑夜。' },
  { target: 'guide-quiz', title: '来小测验吧', text: '学会以后点这里，拨一拨、看一看，检验一下自己。' },
]
const guideIndex = ref(-1)
const guideRect = ref<Rect | null>(null)
const guidePassed = ref(false)
const viewH = ref(667)
const guideStep = computed(() => (guideIndex.value >= 0 ? GUIDE[guideIndex.value] : null))

const holeStyle = computed(() => {
  const rect = guideRect.value
  if (!rect) return {}
  const pad = guideStep.value?.round ? 6 : 8
  return {
    left: `${rect.left - pad}px`,
    top: `${rect.top - pad}px`,
    width: `${rect.width + pad * 2}px`,
    height: `${rect.height + pad * 2}px`,
  }
})

/** 镂空四周的挡板：挡住页面滚动和点击，只留中间的区域可以操作。 */
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

const cardStyle = computed(() => {
  const rect = guideRect.value
  if (!rect) return {}
  const below = rect.top + rect.height + 20
  if (below + 190 < viewH.value) return { top: `${below}px` }
  return { bottom: `${viewH.value - rect.top + 20}px` }
})

const fingerStyle = computed(() => {
  const rect = guideRect.value
  if (!rect) return {}
  return {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    transform: `rotate(${mod(total.value / 10, 360)}deg)`,
  }
})

function noop() {}

function onHoleTap() {
  if (guideStep.value?.target === 'guide-quiz') setTab('quiz')
}

function measure(id: string) {
  return new Promise<{ rect: Rect; scrollTop: number } | null>((resolve) => {
    uni.createSelectorQuery()
      .select(`#${id}`).boundingClientRect()
      .selectViewport().scrollOffset(noop)
      .exec((result) => {
        const box = result?.[0]
        if (!box) return resolve(null)
        resolve({
          rect: { left: box.left, top: box.top, width: box.width, height: box.height },
          scrollTop: result?.[1]?.scrollTop ?? 0,
        })
      })
  })
}

async function focusGuide() {
  const step = guideStep.value
  if (!step) return
  guidePassed.value = false
  showSeconds.value = step.action !== 'drag-minute'
  const first = await measureRetry(step.target)
  if (guideStep.value !== step) return
  // 量不到目标（页面还没渲染好）就跳过这一步，不能留下一层没有卡片的遮罩把页面挡死
  if (!first) {
    nextGuide()
    return
  }
  const wanted = Math.max(0, first.scrollTop + first.rect.top - (viewH.value - first.rect.height) / 2 + 60)
  if (Math.abs(wanted - first.scrollTop) > 4) {
    uni.pageScrollTo({ scrollTop: wanted, duration: 260 })
    await new Promise((resolve) => setTimeout(resolve, 320))
  }
  const settled = (await measure(step.target)) ?? first
  if (guideStep.value === step) guideRect.value = settled.rect
}

async function measureRetry(id: string) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = await measure(id)
    if (result) return result
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  return null
}

function startGuide() {
  stopPlay()
  tab.value = 'explore'
  showSeconds.value = true
  viewH.value = windowHeight()
  guideIndex.value = 0
  setTimeout(focusGuide, 60)
}

function nextGuide() {
  if (guideIndex.value < 0) return
  if (guideIndex.value + 1 >= GUIDE.length) {
    endGuide()
    return
  }
  guideIndex.value += 1
  focusGuide()
}

function endGuide() {
  guideIndex.value = -1
  guideRect.value = null
  showSeconds.value = true
  uni.setStorageSync(GUIDE_KEY, 1)
  uni.pageScrollTo({ scrollTop: 0, duration: 260 })
}

onReady(() => {
  if (tab.value === 'explore' && !uni.getStorageSync(GUIDE_KEY)) setTimeout(startGuide, 450)
})
</script>

<template>
  <page-meta :page-style="pageBg.style" :background-color="pageBg.bg" :background-color-top="pageBg.bg" :background-color-bottom="pageBg.bg" :root-background-color="pageBg.bg" :background-text-style="pageBg.text" />
  <view class="theme-root page sub clock-page" :class="themeClass">
    <PageHeader safe show-back :title="t('认识时钟')" :caption="t('拨一拨指针，看看时间怎么走')" />

    <view class="seg three">
      <view class="seg-indicator" :class="tab" />
      <text class="seg-item" :class="{ active: tab === 'explore' }" @click="setTab('explore')">{{ t('探索') }}</text>
      <text id="guide-quiz" class="seg-item" :class="{ active: tab === 'quiz' }" @click="setTab('quiz')">{{ t('小测验') }}</text>
      <text class="seg-item" :class="{ active: tab === 'print' }" @click="setTab('print')">{{ t('打印题目') }}</text>
    </view>

    <ClockPrint v-if="tab === 'print'" />

    <view v-if="tab === 'explore'" class="explore">
      <view class="sky-card" :class="{ night: sky.night }" :style="skyStyle">
        <view
          v-for="(star, at) in STARS"
          :key="at"
          class="star"
          :style="{ left: star.x + '%', top: star.y + '%', width: star.s + 'rpx', height: star.s + 'rpx', opacity: sky.stars }"
        />
        <view class="orb" :class="orb.day ? 'sun' : 'moon'" :style="orb.style" />
        <view class="clock-wrap">
          <view id="guide-clock" class="clock-anchor">
            <ClockFace
              v-model:total="total"
              draggable
              :seconds="showSeconds"
              :motion="motion"
              :snap="showSeconds ? 1 : 60"
              @dragstart="onDragStart"
              @dragend="onDragEnd"
            />
          </view>
        </view>
        <view id="guide-digital" class="digital-block">
          <view class="digital">
            <text class="digital-time">{{ parts.h12 }}:{{ pad(parts.m) }}<text v-if="showSeconds" class="digital-sec">:{{ pad(parts.s) }}</text></text>
            <text class="period-chip">{{ t(period) }}</text>
          </view>
          <text class="reading">{{ reading }} · {{ t('24 小时制') }} {{ pad(parts.h24) }}:{{ pad(parts.m) }}</text>
        </view>
      </view>

      <view class="card panel">
        <view class="panel-head">
          <text class="panel-title">{{ t('一天的时间') }}</text>
          <text class="guide-again press" @click="startGuide">{{ t('再看一遍引导') }}</text>
        </view>
        <view id="guide-bar">
          <DayBar v-model:minutes="barMinutes" :animate="!dragging && !playing" @dragstart="onBarStart" @dragend="onBarEnd" />
        </view>
        <view class="control-row">
          <view class="ctl press" hover-class="press-on" hover-stay-time="80" @click="toNow">
            <AppIcon name="clock" tone="ink" :size="15" />
            <text>{{ t('现在') }}</text>
          </view>
          <view class="ctl press" :class="{ on: playing }" hover-class="press-on" hover-stay-time="80" @click="togglePlay">
            <text class="ctl-glyph">{{ playing ? '❚❚' : '▶' }}</text>
            <text>{{ playing ? t('暂停') : t('走起来') }}</text>
          </view>
          <view class="ctl press" :class="{ on: speed === 60 }" hover-class="press-on" hover-stay-time="80" @click="toggleSpeed">
            <text>{{ t('快进') }} ×60</text>
          </view>
          <view class="ctl press" :class="{ on: showSeconds }" hover-class="press-on" hover-stay-time="80" @click="showSeconds = !showSeconds">
            <text>{{ t('秒针') }}</text>
          </view>
        </view>
        <view class="legend">
          <view class="legend-item"><view class="legend-hand hour" /><text>{{ t('时针：短而粗，指几点') }}</text></view>
          <view class="legend-item"><view class="legend-hand minute" /><text>{{ t('分针：长而细，指几分') }}</text></view>
          <view class="legend-item"><view class="legend-hand second" /><text>{{ t('秒针：红色，走一圈是 1 分钟') }}</text></view>
        </view>
        <text class="tip">{{ t('试试拖动分针转一整圈，时针正好走一大格，就是 1 小时。') }}</text>
      </view>
    </view>

    <view v-else-if="tab === 'quiz'" class="card quiz">
      <view class="seg small">
        <view class="seg-indicator" :class="quizMode === 'set' ? 'explore' : 'quiz'" />
        <text class="seg-item" :class="{ active: quizMode === 'set' }" @click="setQuizMode('set')">{{ t('拨时间') }}</text>
        <text class="seg-item" :class="{ active: quizMode === 'read' }" @click="setQuizMode('read')">{{ t('看时间') }}</text>
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

      <view v-if="!finished" class="question">
        <view class="progress">
          <view v-for="(item, at) in results" :key="at" class="dot" :class="[item, { current: at === index && !item }]" />
          <text class="progress-text">{{ t('第 {n}/{total} 题 · 得分 {score}', { n: index + 1, total: QUESTIONS, score }) }}</text>
        </view>
        <template v-if="quizMode === 'set'">
          <text class="prompt">{{ t('请把时钟拨到') }}</text>
          <text class="target">{{ targetText }}</text>
        </template>
        <text v-else class="prompt big">{{ t('这个时钟显示几点？') }}</text>

        <view class="clock-wrap quiz-clock">
          <ClockFace
            v-if="quizMode === 'set'"
            v-model:total="setTotal"
            :draggable="!answer"
            :seconds="false"
            :snap="snap"
            :state="answer"
            size="520rpx"
          />
          <ClockFace v-else :total="readTotal" :seconds="false" :state="answer" size="520rpx" />
        </view>

        <template v-if="quizMode === 'set'">
          <view class="feedback" :class="answer">
            <text v-if="answer === 'right'">{{ t('答对了，真棒！') }}</text>
            <text v-else-if="answer === 'wrong'">{{ t('再想想，正确答案是 {time}', { time: targetText }) }}</text>
            <text v-else>{{ t('拖动时针和分针，拨好后点检查') }}</text>
          </view>
          <view class="action-row">
            <view class="icon-btn press" hover-class="press-on" hover-stay-time="80" @click="resetSet">
              <AppIcon name="undo" tone="ink" :size="18" />
            </view>
            <button v-if="answer === 'wrong'" hover-class="press-on" hover-stay-time="80" class="btn grow" @click="advance">{{ t('下一题') }}</button>
            <button v-else hover-class="press-on" hover-stay-time="80" class="btn grow" :disabled="Boolean(answer)" @click="checkSet">{{ t('检查答案') }}</button>
          </view>
        </template>
        <template v-else>
          <view class="options">
            <view
              v-for="option in options"
              :key="formatClock(option.h, option.m)"
              class="option press"
              :class="optionClass(option)"
              hover-class="press-on"
              hover-stay-time="80"
              @click="pick(option)"
            >{{ formatClock(option.h, option.m) }}</view>
          </view>
          <view class="feedback" :class="answer">
            <text v-if="answer === 'right'">{{ t('答对了，真棒！') }}</text>
            <text v-else-if="answer === 'wrong'">{{ t('再想想，正确答案是 {time}', { time: targetText }) }}</text>
            <text v-else>{{ t('先看短的时针，再看长的分针') }}</text>
          </view>
          <button v-if="answer === 'wrong'" hover-class="press-on" hover-stay-time="80" class="btn block" @click="advance">{{ t('下一题') }}</button>
        </template>
      </view>

      <view v-else class="result">
        <text class="result-score">{{ score }}<text class="result-total">/{{ QUESTIONS }}</text></text>
        <view class="result-dots">
          <view v-for="(item, at) in results" :key="at" class="dot" :class="item" />
        </view>
        <text class="result-text">{{ resultText }}</text>
        <button hover-class="press-on" hover-stay-time="80" class="btn block" @click="newRound">{{ t('再来一轮') }}</button>
      </view>
    </view>

    <view v-if="guideStep" class="guide" :class="{ ready: guideRect }">
      <view v-if="!guideRect" class="guide-mask" @touchmove.stop.prevent="noop" />
      <template v-else>
        <view v-for="(block, at) in blockers" :key="at" class="guide-block" :style="block" @touchmove.stop.prevent="noop" />
        <view class="guide-hole" :class="{ round: guideStep.round }" :style="holeStyle" />
        <view v-if="!guideStep.action" class="guide-block" :style="holeStyle" @click="onHoleTap" @touchmove.stop.prevent="noop" />
        <view v-if="guideStep.action === 'drag-minute' && !guidePassed && !dragging" class="guide-finger" :style="fingerStyle">
          <view class="guide-swing">
            <view class="guide-dot" />
          </view>
        </view>
      </template>
      <view v-if="guideRect" class="guide-card" :style="cardStyle" @touchmove.stop.prevent="noop">
        <view class="guide-top">
          <text class="guide-count">{{ guideIndex + 1 }}/{{ GUIDE.length }}</text>
          <text class="guide-skip press" @click="endGuide">{{ t('跳过') }}</text>
        </view>
        <text class="guide-title">{{ guidePassed ? t('做得好！') : t(guideStep.title) }}</text>
        <text class="guide-text">{{ guidePassed ? t('分针走一圈，时针就走一大格。') : t(guideStep.text) }}</text>
        <view class="guide-foot">
          <view class="guide-dots">
            <view v-for="(item, at) in GUIDE" :key="at" class="guide-pip" :class="{ on: at === guideIndex }" />
          </view>
          <view class="guide-next press" hover-class="press-on" hover-stay-time="80" @click="nextGuide">
            {{ guideIndex + 1 >= GUIDE.length ? t('知道了') : t('下一步') }}
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.clock-page { padding-bottom: calc(40px + var(--safe-bottom)); }
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
  width: calc(50% - 4px);
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 6px 14px -8px rgba(40, 52, 88, 0.45), inset 0 1px 0 #fff;
  transition: transform 0.42s cubic-bezier(0.34, 1.3, 0.64, 1);
}
.seg-indicator.quiz { transform: translateX(100%); }
.seg.three .seg-indicator { width: calc((100% - 8px) / 3); }
.seg-indicator.print { transform: translateX(200%); }
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
  transition: color 0.2s ease;
}
.seg-item.active { color: var(--accent-text); }
.seg.small .seg-item { height: 34px; font-size: 13px; line-height: 34px; }
.theme-dark .seg {
  border-color: var(--line);
  background: var(--paper);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 10px 24px -16px rgba(0, 0, 0, 0.6);
}
.theme-dark .seg-indicator {
  background: var(--surface-2);
  box-shadow: 0 6px 14px -8px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.06);
}
.theme-dark .seg-item.active { color: var(--accent-text); }
.theme-dark .seg.small { border-color: transparent; background: var(--surface-2); box-shadow: none; }
.theme-dark .seg.small .seg-indicator { background: var(--paper); }

.sky-card {
  position: relative;
  overflow: hidden;
  padding: 44rpx 24rpx 32rpx;
  border-radius: 24px;
  color: #1c2430;
  box-shadow: var(--elev-md);
  transition: color 0.4s ease;
}
.sky-card.night { color: #f3f5fa; }
.star { position: absolute; border-radius: 50%; background: #fffbe6; box-shadow: 0 0 8rpx #fff6c8; transition: opacity 0.4s ease; }
.orb { position: absolute; width: 60rpx; height: 60rpx; border-radius: 50%; transform: translateX(-50%); }
.orb.sun {
  background: radial-gradient(circle at 38% 36%, #fff3b0 0%, #ffd25e 45%, #ffa53c 100%);
  box-shadow: 0 0 30rpx 10rpx rgba(255, 196, 80, 0.55);
}
.orb.moon { background: transparent; box-shadow: inset -18rpx -6rpx 0 0 #f5f1d2; transform: translateX(-50%) rotate(-18deg); }
.clock-wrap { position: relative; z-index: 1; display: flex; justify-content: center; padding-top: 40rpx; }
.clock-anchor { border-radius: 50%; }
.digital-block { position: relative; z-index: 1; padding-bottom: 4px; }
.digital { position: relative; z-index: 1; display: flex; align-items: baseline; justify-content: center; gap: 10px; margin-top: 30rpx; }
.digital-time { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 64rpx; font-weight: 800; letter-spacing: 1px; font-variant-numeric: tabular-nums; }
.digital-sec { font-size: 36rpx; font-weight: 700; opacity: 0.55; }
.period-chip {
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.6);
  color: #e85b2a;
  font-size: 13px;
  font-weight: 700;
}
.sky-card.night .period-chip { background: rgba(255, 255, 255, 0.14); color: #ffd9a8; }
.reading { position: relative; z-index: 1; display: block; margin-top: 6px; font-size: 12px; text-align: center; opacity: 0.75; font-variant-numeric: tabular-nums; }

.panel { margin-top: 14px; }
.panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.panel-title { display: block; color: var(--ink); font-size: 14px; font-weight: 750; }
.guide-again { color: var(--muted); font-size: 12px; }
.control-row { display: flex; gap: 8px; margin-top: 10px; }
.ctl {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 36px;
  border-radius: 12px;
  background: var(--surface-2);
  color: var(--ink);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  transition: background 0.2s ease, color 0.2s ease;
}
.ctl.on { background: var(--accent-soft); color: var(--accent-text); }
.ctl-glyph { font-size: 10px; }
.legend { display: flex; flex-direction: column; gap: 6px; margin-top: 14px; }
.legend-item { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 12px; }
.legend-hand { flex: none; height: 6px; border-radius: 99px; background: #2b3340; }
.legend-hand.hour { width: 18px; height: 7px; }
.legend-hand.minute { width: 28px; height: 4px; }
.legend-hand.second { width: 30px; height: 2px; background: #f15a36; }
.tip { display: block; margin-top: 12px; padding: 10px 12px; border-radius: 12px; background: var(--surface-2); color: var(--muted); font-size: 12px; line-height: 1.5; }

.level-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.level-label { color: var(--ink); font-size: 14px; font-weight: 650; }
.question { display: flex; flex-direction: column; align-items: center; }
.progress { display: flex; align-items: center; gap: 6px; margin-top: 10px; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--track); transition: background 0.3s ease, transform 0.3s ease; }
.dot.current { background: #ffb08d; transform: scale(1.25); }
.dot.right { background: #34c77b; }
.dot.wrong { background: #f15a36; }
.progress-text { margin-left: 6px; color: var(--muted); font-size: 12px; }
.prompt { margin-top: 14px; color: var(--ink); font-size: 15px; font-weight: 700; }
.prompt.big { font-size: 17px; }
.target { margin-top: 2px; color: var(--ink); font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 72rpx; font-weight: 800; }
.quiz-clock { padding-top: 24rpx; padding-bottom: 8rpx; }
.feedback {
  margin-top: 12px;
  padding: 8px 14px;
  border-radius: 12px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 650;
  text-align: center;
  transition: background 0.25s ease, color 0.25s ease;
}
.quiz-clock + .feedback { margin-top: 20px; }
.feedback.right { background: rgba(52, 199, 123, 0.14); color: #1f9d5c; }
.feedback.wrong { background: rgba(241, 90, 54, 0.12); color: #d9482a; }
.action-row { display: flex; align-self: stretch; gap: 10px; margin-top: 14px; }
.icon-btn {
  display: flex;
  width: 46px;
  height: 46px;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: var(--surface-2);
}
.grow { flex: 1; }
.options { display: flex; flex-wrap: wrap; justify-content: space-between; align-self: stretch; gap: 10px; margin-top: 18px; }
.option {
  width: calc(50% - 5px);
  height: 52px;
  border: 1px solid var(--line);
  border-radius: 14px;
  box-sizing: border-box;
  background: #ffffff;
  color: var(--ink);
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 20px;
  font-weight: 750;
  line-height: 50px;
  text-align: center;
  box-shadow: 0 8px 18px -14px rgba(40, 52, 88, 0.5);
  transition: background 0.25s ease, color 0.25s ease, opacity 0.25s ease, transform 0.25s ease;
}
.option.right { border-color: #34c77b; background: #34c77b; color: #fff; transform: scale(1.03); }
.option.wrong { border-color: #f15a36; background: #f15a36; color: #fff; }
.option.dim { opacity: 0.45; }
.question .btn.block { align-self: stretch; margin-top: 14px; }
.result { display: flex; flex-direction: column; align-items: center; padding: 26px 0 6px; }
.result-score { color: var(--ink); font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 112rpx; font-weight: 800; }
.result-total { color: var(--muted); font-size: 48rpx; }
.result-dots { display: flex; gap: 8px; margin-top: 8px; }
.result-dots .dot { width: 12px; height: 12px; }
.result-text { margin: 14px 0 18px; color: var(--ink); font-size: 15px; font-weight: 700; }
.result .btn.block { align-self: stretch; }
.theme-dark .option { background: var(--surface-2); }

.guide { position: fixed; inset: 0; z-index: 70; pointer-events: none; animation: guide-in 0.25s ease; }
.guide-mask { position: absolute; inset: 0; background: rgba(15, 18, 30, 0.62); pointer-events: auto; }
.guide-block { position: fixed; pointer-events: auto; }
.guide-hole {
  position: fixed;
  border-radius: 18px;
  box-shadow: 0 0 0 3000px rgba(15, 18, 30, 0.62), 0 0 0 2px rgba(255, 255, 255, 0.9);
  pointer-events: none;
  transition: left 0.3s ease, top 0.3s ease, width 0.3s ease, height 0.3s ease, border-radius 0.3s ease;
}
.guide-hole.round { border-radius: 50%; }
.guide-finger { position: fixed; pointer-events: none; }
.guide-swing { position: absolute; inset: 0; animation: guide-swing 1.8s ease-in-out infinite; }
.guide-dot {
  position: absolute;
  top: 13%;
  left: 50%;
  width: 26px;
  height: 26px;
  margin: -13px 0 0 -13px;
  border: 3px solid #fff;
  border-radius: 50%;
  background: rgba(255, 122, 69, 0.85);
  box-shadow: 0 0 0 8px rgba(255, 122, 69, 0.25);
}
.guide-card {
  position: fixed;
  left: 20px;
  right: 20px;
  padding: 16px 18px 14px;
  border-radius: 20px;
  background: #ffffff;
  box-shadow: 0 18px 40px -16px rgba(15, 18, 30, 0.5);
  pointer-events: auto;
  transition: top 0.3s ease, bottom 0.3s ease;
}
.guide-top { display: flex; align-items: center; justify-content: space-between; }
.guide-count { color: #ff7a45; font-size: 12px; font-weight: 750; font-variant-numeric: tabular-nums; }
.guide-skip { padding: 2px 0 2px 12px; color: #8a93a3; font-size: 13px; }
.guide-title { display: block; margin-top: 6px; color: #1c2430; font-size: 17px; font-weight: 800; }
.guide-text { display: block; margin-top: 6px; color: #4a5363; font-size: 14px; line-height: 1.6; }
.guide-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 14px; }
.guide-dots { display: flex; gap: 5px; }
.guide-pip { width: 6px; height: 6px; border-radius: 3px; background: #dde2ea; transition: width 0.25s ease, background 0.25s ease; }
.guide-pip.on { width: 16px; background: #ff7a45; }
.guide-next {
  padding: 8px 18px;
  border-radius: 999px;
  background: #1c2430;
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
}
@keyframes guide-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes guide-swing {
  0% { transform: rotate(0deg); opacity: 0; }
  15% { opacity: 1; }
  70% { transform: rotate(60deg); opacity: 1; }
  100% { transform: rotate(60deg); opacity: 0; }
}
</style>
