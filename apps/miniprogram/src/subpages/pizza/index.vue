<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { onLoad, onReady, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { TOOL_SHARE_TITLES, toolMoments, toolShare, useSearchTitle, type ToolShareKey } from '@/utils/share'
import { useFamilyPage } from '@/composables/useFamilyPage'
import { usePageBackground, useThemePage } from '@/utils/wx-theme'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import { isEn, t } from '@/i18n'
import { windowHeight } from '@/utils/system'
import PizzaView from './PizzaView.vue'
import PizzaPrint from './PizzaPrint.vue'
import {
  MAX_PARTS,
  cnFraction,
  comparePair,
  fractionKey,
  fractionOptions,
  randomFraction,
  sameFraction,
  simplify,
  type ComparePair,
  type Fraction,
  type Level,
  type Sign,
} from './fraction'

useFamilyPage()
const themeClass = useThemePage()
const pageBg = usePageBackground()

type Tab = 'explore' | 'quiz' | 'print'
const TAB_SHARE: Record<Tab, ToolShareKey> = { explore: 'pizza', quiz: 'pizzaQuiz', print: 'pizzaPrint' }
const tab = ref<Tab>('explore')
onShareAppMessage(() => toolShare(TAB_SHARE[tab.value], `/subpages/pizza/index?tab=${tab.value}`))
onShareTimeline(() => toolMoments(TAB_SHARE[tab.value], `tab=${tab.value}`))
useSearchTitle(() => t(TOOL_SHARE_TITLES[TAB_SHARE[tab.value]]))
onLoad((query) => {
  const value = query?.tab
  if (value === 'quiz' || value === 'print') setTab(value)
})

const QUESTIONS = 5

// ---- 探索 ----
const den = ref(4)
const filled = ref<boolean[]>([true, false, false, false])
const num = computed(() => filled.value.filter(Boolean).length)
const showNo = ref(false)
const numBump = ref(0)
const denBump = ref(0)

function readFraction(n: number, d: number) {
  return isEn() ? `${n} / ${d}` : cnFraction(n, d)
}

const reading = computed(() => readFraction(num.value, den.value))
const meaning = computed(() => {
  if (den.value === 1) return num.value ? t('没有切开，拿走的就是 1 整个披萨') : t('没有切开，一块也没拿，是 0')
  if (num.value === 0) return t('平均分成 {den} 份，一份也没拿，就是 0', { den: den.value })
  if (num.value === den.value) return t('{den} 份全部拿出来，{den} 分之 {den} 就是 1 个整披萨', { den: den.value })
  return t('把披萨平均分成 {den} 份，拿出其中 {num} 份', { den: den.value, num: num.value })
})
const same = computed(() => {
  if (num.value === 0 || num.value === den.value) return ''
  const reduced = simplify({ num: num.value, den: den.value })
  if (reduced.den === den.value) return ''
  return t('和 {den} 分之 {num} 一样大', reduced)
})
const rest = computed(() => {
  if (den.value < 2 || num.value === 0 || num.value === den.value) return ''
  return t('盘子里还剩 {den} 分之 {rest}', { den: den.value, rest: den.value - num.value })
})
const unitText = computed(() => (den.value > 1 ? t('每一份是整个披萨的 {den} 分之 1', { den: den.value }) : ''))
const barMarker = computed(() => ({ left: `${(num.value / den.value) * 100}%` }))
const UNIT_ROWS = [2, 3, 4, 5, 6, 8, 10, 12]

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function setNumTo(value: number) {
  const target = clamp(value, 0, den.value)
  if (target === num.value) return
  filled.value = Array.from({ length: den.value }, (_, index) => index < target)
  numBump.value += 1
}

function changeNum(delta: number) {
  const next = [...filled.value]
  if (delta > 0) {
    const index = next.findIndex((value) => !value)
    if (index < 0) return
    next[index] = true
  } else {
    const index = next.lastIndexOf(true)
    if (index < 0) return
    next[index] = false
  }
  filled.value = next
  numBump.value += 1
  uni.vibrateShort({ type: 'light' })
  passGuide('num')
}

function setDen(value: number) {
  const target = clamp(value, 1, MAX_PARTS)
  if (target === den.value) return
  const keep = Math.min(num.value, target)
  if (keep !== num.value) numBump.value += 1
  den.value = target
  filled.value = Array.from({ length: target }, (_, index) => index < keep)
  denBump.value += 1
  uni.vibrateShort({ type: 'light' })
}

function changeDen(delta: number) {
  setDen(den.value + delta)
  passGuide('den')
}

function onSlice(index: number) {
  const next = [...filled.value]
  next[index] = !next[index]
  filled.value = next
  numBump.value += 1
  passGuide('tap')
}

function onBarTap(index: number) {
  setNumTo(num.value === index + 1 ? index : index + 1)
}

// ---- 小测验 ----
type QuizMode = 'cut' | 'read' | 'compare'
const quizMode = ref<QuizMode>('cut')
const QUIZ_MODES: Array<{ value: QuizMode; label: string }> = [
  { value: 'cut', label: '拿一拿' },
  { value: 'read', label: '看一看' },
  { value: 'compare', label: '比一比' },
]
const level = ref<Level>('easy')
const LEVELS: Array<{ value: Level; label: string }> = [
  { value: 'easy', label: '简单' },
  { value: 'medium', label: '中等' },
  { value: 'hard', label: '困难' },
]
const index = ref(0)
const score = ref(0)
const results = ref<Array<'right' | 'wrong' | null>>([])
const target = ref<Fraction>({ num: 1, den: 4 })
const painted = ref<boolean[]>([])
const choices = ref<Fraction[]>([])
const picked = ref<Fraction | null>(null)
const pair = ref<ComparePair>({ left: { num: 1, den: 4 }, right: { num: 3, den: 4 }, answer: '<', rule: 'den' })
const pickedSign = ref<Sign | null>(null)
const answer = ref<'' | 'right' | 'wrong'>('')
const finished = ref(false)
let advanceTimer: ReturnType<typeof setTimeout> | null = null

const paintedCount = computed(() => painted.value.filter(Boolean).length)
const targetText = computed(() => t('{den} 分之 {num}', target.value))
const shown = computed(() => Array.from({ length: target.value.den }, (_, at) => at < target.value.num))
const leftFilled = computed(() => Array.from({ length: pair.value.left.den }, (_, at) => at < pair.value.left.num))
const rightFilled = computed(() => Array.from({ length: pair.value.right.den }, (_, at) => at < pair.value.right.num))
const SIGNS: Sign[] = ['>', '=', '<']
const ruleText = computed(() => {
  if (pair.value.rule === 'den') return t('分母相同，每份一样大，分子大的就大')
  if (pair.value.rule === 'num') return t('分子相同，分母越小，每份越大')
  return t('切的份数不同，但拿出来的一样多')
})
const compareAnswer = computed(() => `${t('{den} 分之 {num}', pair.value.left)} ${pair.value.answer} ${t('{den} 分之 {num}', pair.value.right)}`)
const resultText = computed(() => {
  if (score.value === QUESTIONS) return t('太棒了，全部答对！')
  if (score.value >= 3) return t('不错，继续加油！')
  return t('多练几次就会啦')
})
const quizIndicator = computed(() => `q-${quizMode.value}`)

function clearAdvance() {
  if (advanceTimer) clearTimeout(advanceTimer)
  advanceTimer = null
}

function nextQuestion() {
  clearAdvance()
  answer.value = ''
  picked.value = null
  pickedSign.value = null
  if (quizMode.value === 'compare') {
    pair.value = comparePair(level.value, pair.value)
    return
  }
  target.value = randomFraction(level.value, target.value)
  painted.value = Array(target.value.den).fill(false)
  if (quizMode.value === 'read') choices.value = fractionOptions(target.value)
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
    advanceTimer = setTimeout(advance, 1300)
  }
}

function paint(at: number) {
  if (answer.value) return
  const next = [...painted.value]
  next[at] = !next[at]
  painted.value = next
}

function checkCut() {
  if (answer.value) return
  const right = paintedCount.value === target.value.num
  settle(right)
  if (!right) {
    setTimeout(() => {
      painted.value = Array.from({ length: target.value.den }, (_, at) => at < target.value.num)
    }, 500)
  }
}

function resetCut() {
  if (answer.value) return
  painted.value = Array(target.value.den).fill(false)
}

function pick(option: Fraction) {
  if (answer.value) return
  picked.value = option
  settle(sameFraction(option, target.value))
}

function optionClass(option: Fraction) {
  if (!answer.value) return ''
  if (sameFraction(option, target.value)) return 'right'
  if (picked.value && sameFraction(picked.value, option)) return 'wrong'
  return 'dim'
}

function pickSign(sign: Sign) {
  if (answer.value) return
  pickedSign.value = sign
  settle(sign === pair.value.answer)
}

function signClass(sign: Sign) {
  if (!answer.value) return ''
  if (sign === pair.value.answer) return 'right'
  if (sign === pickedSign.value) return 'wrong'
  return 'dim'
}

function setQuizMode(value: QuizMode) {
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
  if (value === 'quiz' && !results.value.length) newRound()
}

onUnmounted(clearAdvance)

// ---- 首次进入的引导 ----
type Rect = { left: number; top: number; width: number; height: number }
type GuideAction = 'tap' | 'num' | 'den'
type GuideStep = { target: string; round?: boolean; title: string; text: string; action?: GuideAction; done?: string }

const GUIDE_KEY = 'uday-fraction-guide-v3'
const GUIDE: GuideStep[] = [
  { target: 'guide-pizza', round: true, title: '点一块，拿出来', text: '点披萨上的任意一块，它会弹出来；再点一下就放回去。', action: 'tap', done: '弹出来的块数，就是分子。' },
  { target: 'guide-num', title: '分子：拿出几份', text: '按 + 或 −，披萨上弹出来的块跟着变。', action: 'num', done: '分子变了，弹出来的块数也变了。' },
  { target: 'guide-den', title: '分母：平均分成几份', text: '按 + 多切一刀，按 − 少切一刀。份数越多，每一块越小。', action: 'den', done: '分母变了，披萨重新切成一样大的块。' },
  { target: 'guide-bar', title: '换成线段图', text: '同一个分数画成从 0 到 1 的线段，看看它在哪儿。' },
  { target: 'guide-quiz', title: '来小测验吧', text: '学会以后点这里，拿一拿、看一看、比一比。' },
]
const guideIndex = ref(-1)
const guideRect = ref<Rect | null>(null)
const guidePassed = ref(false)
const viewH = ref(667)
const guideStep = computed(() => (guideIndex.value >= 0 ? GUIDE[guideIndex.value] : null))

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
  const pad = guideStep.value?.round ? 4 : 8
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

/** 卡片放在目标下方，放不下就放上方；两边都放不下（目标太高）时贴底部，盖住目标的下半截也比看不到强。 */
const cardStyle = computed(() => {
  const rect = guideRect.value
  if (!rect) return {}
  const cardH = 200
  const below = rect.top + rect.height + 16
  if (below + cardH < viewH.value) return { top: `${below}px` }
  if (rect.top - 16 - cardH > 0) return { bottom: `${viewH.value - rect.top + 16}px` }
  return { bottom: '24px' }
})

function noop() {}

function onHoleTap() {
  if (guideStep.value?.target === 'guide-quiz') setTab('quiz')
  else nextGuide()
}

function measure(id: string) {
  return new Promise<{ rect: Rect; scrollTop: number } | null>((resolve) => {
    uni.createSelectorQuery()
      .select(`#${id}`).boundingClientRect()
      .selectViewport().scrollOffset(noop)
      .exec((result) => {
        const box = result?.[0]
        if (!box) return resolve(null)
        resolve({ rect: { left: box.left, top: box.top, width: box.width, height: box.height }, scrollTop: result?.[1]?.scrollTop ?? 0 })
      })
  })
}

async function measureRetry(id: string) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = await measure(id)
    if (result) return result
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  return null
}

async function focusGuide() {
  const step = guideStep.value
  if (!step) return
  guidePassed.value = false
  guideRect.value = null
  const first = await measureRetry(step.target)
  if (guideStep.value !== step) return
  // 量不到目标就跳过这一步，不能留下一层没有卡片的遮罩把页面挡死
  if (!first) {
    nextGuide()
    return
  }
  const wanted = Math.max(0, first.scrollTop + first.rect.top - Math.max(90, (viewH.value - first.rect.height - 220) / 2))
  if (Math.abs(wanted - first.scrollTop) > 4) {
    uni.pageScrollTo({ scrollTop: wanted, duration: 260 })
    await new Promise((resolve) => setTimeout(resolve, 320))
  }
  const settled = (await measure(step.target)) ?? first
  if (guideStep.value === step) guideRect.value = settled.rect
}

function startGuide() {
  tab.value = 'explore'
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
  uni.setStorageSync(GUIDE_KEY, 1)
  uni.pageScrollTo({ scrollTop: 0, duration: 260 })
}

onReady(() => {
  if (tab.value === 'explore' && !uni.getStorageSync(GUIDE_KEY)) setTimeout(startGuide, 500)
})
</script>

<template>
  <page-meta :page-style="pageBg.style" :background-color="pageBg.bg" :background-color-top="pageBg.bg" :background-color-bottom="pageBg.bg" :root-background-color="pageBg.bg" :background-text-style="pageBg.text" />
  <view class="theme-root page sub fraction-page" :class="themeClass">
    <PageHeader safe show-back :title="t('认识分数')" :caption="t('切开看看，分子和分母')" />

    <view class="seg three">
      <view class="seg-indicator" :class="tab" />
      <text class="seg-item" :class="{ active: tab === 'explore' }" @click="setTab('explore')">{{ t('探索') }}</text>
      <text id="guide-quiz" class="seg-item" :class="{ active: tab === 'quiz' }" @click="setTab('quiz')">{{ t('小测验') }}</text>
      <text class="seg-item" :class="{ active: tab === 'print' }" @click="setTab('print')">{{ t('打印题目') }}</text>
    </view>

    <PizzaPrint v-if="tab === 'print'" />

    <view v-if="tab === 'explore'" class="explore">
      <view class="card stage">
        <view class="stage-top">
          <text class="stage-hint">{{ t('点一块，把它拿出来') }}</text>
          <text class="pill press" :class="{ on: showNo }" @click="showNo = !showNo">{{ t('数一数') }}</text>
        </view>
        <view id="guide-pizza" class="pizza-anchor">
          <PizzaView :parts="den" :filled="filled" interactive :labels="showNo" size="600rpx" @toggle="onSlice" />
        </view>

        <view class="fraction-panel">
          <view class="stepper-col">
            <view id="guide-num" class="stepper">
              <text class="step-tag">{{ t('分子') }}</text>
              <view class="step-btn press" :class="{ off: num <= 0 }" hover-class="press-on" hover-stay-time="80" @click="changeNum(-1)">−</view>
              <text :key="`n-${numBump}`" class="step-value num bump">{{ num }}</text>
              <view class="step-btn press" :class="{ off: num >= den }" hover-class="press-on" hover-stay-time="80" @click="changeNum(1)">+</view>
            </view>
            <view class="frac-bar-row">
              <text class="step-tag">{{ t('分数线') }}</text>
              <view class="frac-rule" />
            </view>
            <view id="guide-den" class="stepper">
              <text class="step-tag">{{ t('分母') }}</text>
              <view class="step-btn press" :class="{ off: den <= 1 }" hover-class="press-on" hover-stay-time="80" @click="changeDen(-1)">−</view>
              <text :key="`d-${denBump}`" class="step-value den bump">{{ den }}</text>
              <view class="step-btn press" :class="{ off: den >= MAX_PARTS }" hover-class="press-on" hover-stay-time="80" @click="changeDen(1)">+</view>
            </view>
          </view>
          <view class="reading-box">
            <text class="reading-label">{{ t('读作') }}</text>
            <text :key="`r-${num}-${den}`" class="reading fade-up">{{ reading }}</text>
          </view>
        </view>

        <view class="meaning">
          <text class="meaning-main">{{ meaning }}</text>
          <view class="facts">
            <text v-if="unitText" class="fact">{{ unitText }}</text>
            <text v-if="rest" class="fact">{{ rest }}</text>
            <text v-if="same" class="fact accent">{{ same }}</text>
          </view>
        </view>
      </view>

      <view class="card panel">
        <view class="panel-head">
          <text class="panel-title">{{ t('线段图') }}</text>
          <text class="guide-again press" @click="startGuide">{{ t('再看一遍引导') }}</text>
        </view>
        <view id="guide-bar" class="number-line">
          <view class="line-track">
            <view
              v-for="cell in den"
              :key="`${den}-${cell}`"
              class="line-cell press"
              :class="{ on: cell <= num }"
              :style="{ transitionDelay: `${(cell - 1) * 25}ms` }"
              @click="onBarTap(cell - 1)"
            />
            <view class="line-marker" :style="barMarker" />
          </view>
          <view class="line-ends">
            <text>0</text>
            <text>1</text>
          </view>
        </view>
        <text class="tip">{{ t('线段从 0 到 1 表示 1 个整披萨，点格子也能改分子。') }}</text>
      </view>

      <view class="card panel">
        <text class="panel-title">{{ t('分母越大，每份越小') }}</text>
        <view class="units">
          <view
            v-for="row in UNIT_ROWS"
            :key="row"
            class="unit-row press"
            :class="{ on: row === den }"
            @click="setDen(row)"
          >
            <text class="unit-label">1/{{ row }}</text>
            <view class="unit-track">
              <view class="unit-fill" :style="{ width: `${100 / row}%` }" />
              <view v-for="cut in row - 1" :key="cut" class="unit-cut" :style="{ left: `${(cut * 100) / row}%` }" />
            </view>
          </view>
        </view>
        <text class="tip">{{ t('同一个披萨，切的份数越多，每一份就越小。点一行试试。') }}</text>
      </view>
    </view>

    <view v-else-if="tab === 'quiz'" class="card quiz">
      <view class="seg small three">
        <view class="seg-indicator" :class="quizIndicator" />
        <text
          v-for="item in QUIZ_MODES"
          :key="item.value"
          class="seg-item"
          :class="{ active: quizMode === item.value }"
          @click="setQuizMode(item.value)"
        >{{ t(item.label) }}</text>
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

        <template v-if="quizMode === 'cut'">
          <view class="prompt-row">
            <text class="prompt">{{ t('请拿出') }}</text>
            <view class="frac-mini big">
              <text>{{ target.num }}</text>
              <view class="frac-mini-line" />
              <text>{{ target.den }}</text>
            </view>
          </view>
          <view class="quiz-pizza">
            <PizzaView :parts="target.den" :filled="painted" :interactive="!answer" :state="answer" size="500rpx" @toggle="paint" />
          </view>
          <text class="count-line">{{ t('已拿出 {n} 份', { n: paintedCount }) }}</text>
          <view class="feedback" :class="answer">
            <text v-if="answer === 'right'">{{ t('答对了，真棒！') }}</text>
            <text v-else-if="answer === 'wrong'">{{ t('再想想，正确答案是 {answer}', { answer: targetText }) }}</text>
            <text v-else>{{ t('分母是几就有几块，分子是几就拿出几块') }}</text>
          </view>
          <view class="action-row">
            <view class="icon-btn press" hover-class="press-on" hover-stay-time="80" @click="resetCut">
              <AppIcon name="undo" tone="ink" :size="18" />
            </view>
            <button v-if="answer === 'wrong'" hover-class="press-on" hover-stay-time="80" class="btn grow" @click="advance">{{ t('下一题') }}</button>
            <button v-else hover-class="press-on" hover-stay-time="80" class="btn grow" :disabled="Boolean(answer)" @click="checkCut">{{ t('检查答案') }}</button>
          </view>
        </template>

        <template v-else-if="quizMode === 'read'">
          <text class="prompt big">{{ t('拿出来的是几分之几？') }}</text>
          <view class="quiz-pizza">
            <PizzaView :parts="target.den" :filled="shown" :state="answer" labels size="500rpx" />
          </view>
          <view class="options">
            <view
              v-for="option in choices"
              :key="fractionKey(option)"
              class="option press"
              :class="optionClass(option)"
              hover-class="press-on"
              hover-stay-time="80"
              @click="pick(option)"
            >
              <view class="frac-mini">
                <text>{{ option.num }}</text>
                <view class="frac-mini-line" />
                <text>{{ option.den }}</text>
              </view>
            </view>
          </view>
          <view class="feedback" :class="answer">
            <text v-if="answer === 'right'">{{ t('答对了，真棒！') }}</text>
            <text v-else-if="answer === 'wrong'">{{ t('再想想，正确答案是 {answer}', { answer: targetText }) }}</text>
            <text v-else>{{ t('先数一共几块是分母，再数弹出几块是分子') }}</text>
          </view>
          <button v-if="answer === 'wrong'" hover-class="press-on" hover-stay-time="80" class="btn block" @click="advance">{{ t('下一题') }}</button>
        </template>

        <template v-else>
          <text class="prompt big">{{ t('哪边拿出来的多？') }}</text>
          <view class="compare-row">
            <view class="compare-side">
              <PizzaView :parts="pair.left.den" :filled="leftFilled" :state="answer" size="250rpx" />
              <view class="frac-mini">
                <text>{{ pair.left.num }}</text>
                <view class="frac-mini-line" />
                <text>{{ pair.left.den }}</text>
              </view>
            </view>
            <view :key="pickedSign || 'q'" class="compare-sign pop-in" :class="answer">{{ answer ? pair.answer : pickedSign || '?' }}</view>
            <view class="compare-side">
              <PizzaView :parts="pair.right.den" :filled="rightFilled" :state="answer" size="250rpx" />
              <view class="frac-mini">
                <text>{{ pair.right.num }}</text>
                <view class="frac-mini-line" />
                <text>{{ pair.right.den }}</text>
              </view>
            </view>
          </view>
          <view class="signs">
            <view
              v-for="sign in SIGNS"
              :key="sign"
              class="sign-btn press"
              :class="signClass(sign)"
              hover-class="press-on"
              hover-stay-time="80"
              @click="pickSign(sign)"
            >{{ sign }}</view>
          </view>
          <view class="feedback" :class="answer">
            <text v-if="answer === 'right'">{{ t('答对了！{rule}', { rule: ruleText }) }}</text>
            <text v-else-if="answer === 'wrong'">{{ t('应该是 {answer}。{rule}', { answer: compareAnswer, rule: ruleText }) }}</text>
            <text v-else>{{ t('看看谁弹出来的部分更大') }}</text>
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

    <view v-if="guideStep" class="guide">
      <view v-if="!guideRect" class="guide-mask" @touchmove.stop.prevent="noop" />
      <template v-else>
        <view v-for="(block, at) in blockers" :key="at" class="guide-block" :style="block" @touchmove.stop.prevent="noop" />
        <view class="guide-hole" :class="{ round: guideStep.round }" :style="holeStyle" />
        <view v-if="!guideStep.action" class="guide-block" :style="holeStyle" @click="onHoleTap" @touchmove.stop.prevent="noop" />
      </template>
      <view v-if="guideRect" class="guide-card" :style="cardStyle" @touchmove.stop.prevent="noop">
        <view class="guide-top">
          <text class="guide-count">{{ guideIndex + 1 }}/{{ GUIDE.length }}</text>
          <text class="guide-skip press" @click="endGuide">{{ t('跳过') }}</text>
        </view>
        <text class="guide-title">{{ guidePassed ? t('做得好！') : t(guideStep.title) }}</text>
        <text class="guide-text">{{ guidePassed && guideStep.done ? t(guideStep.done) : t(guideStep.text) }}</text>
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
.fraction-page { padding-bottom: calc(40px + var(--safe-bottom)); }
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
.seg.three .seg-indicator { width: calc((100% - 8px) / 3); }
.seg-indicator.quiz, .seg-indicator.q-read { transform: translateX(100%); }
.seg-indicator.print, .seg-indicator.q-compare { transform: translateX(200%); }
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
}
.seg-item.active { color: var(--accent-text); }
.seg.small .seg-item { height: 34px; font-size: 13px; line-height: 34px; }
.theme-dark .seg { border-color: var(--line); background: var(--paper); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 10px 24px -16px rgba(0, 0, 0, 0.6); }
.theme-dark .seg-indicator { background: var(--surface-2); box-shadow: 0 6px 14px -8px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.06); }
.theme-dark .seg.small { border-color: transparent; background: var(--surface-2); box-shadow: none; }
.theme-dark .seg.small .seg-indicator { background: var(--paper); }

.stage { padding: 14px 14px 18px; border-radius: 28px; }
.stage-top { display: flex; align-items: center; justify-content: space-between; padding: 0 4px; }
.stage-hint { color: var(--muted); font-size: 13px; }
.pill { padding: 5px 12px; border-radius: 999px; background: var(--surface-2); color: var(--muted); font-size: 12px; font-weight: 700; transition: background 0.25s ease, color 0.25s ease; }
.pill.on { background: var(--accent-soft); color: var(--accent-text); }
.pizza-anchor { display: flex; justify-content: center; margin-top: 4px; }

.fraction-panel { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 10px; padding: 14px 12px; border-radius: 22px; background: var(--surface-2); }
.stepper-col { display: flex; flex-direction: column; align-items: stretch; }
.stepper { display: flex; align-items: center; gap: 8px; }
.step-tag { width: 40px; color: var(--muted); font-size: 11px; font-weight: 700; letter-spacing: 0.06em; }
.step-btn {
  display: flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--paper);
  color: var(--ink);
  font-size: 22px;
  font-weight: 500;
  line-height: 1;
  box-shadow: 0 4px 10px -6px rgba(40, 52, 88, 0.45);
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.step-btn.off { opacity: 0.3; pointer-events: none; }
.step-value { width: 52px; color: var(--ink); font-size: 38px; font-weight: 700; line-height: 1.1; text-align: center; letter-spacing: -0.03em; }
.step-value.num { color: #ff6a33; }
.bump { animation: bump 0.45s cubic-bezier(0.34, 1.56, 0.64, 1); }
.frac-bar-row { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
.frac-rule { width: 140px; height: 3px; border-radius: 2px; background: var(--ink); }
.reading-box { display: flex; flex: 1; flex-direction: column; align-items: center; min-width: 0; height: 52px; }
.reading-label { color: var(--muted); font-size: 11px; font-weight: 700; line-height: 16px; }
.reading { margin-top: 4px; color: var(--ink); font-size: 16px; font-weight: 800; line-height: 24px; white-space: nowrap; }
.fade-up { animation: fade-up 0.4s ease; }

/* 文案长短随数字变化，固定高度，免得整页跟着跳 */
.meaning { margin-top: 12px; padding: 0 4px; }
.meaning-main { display: block; height: 45px; overflow: hidden; color: var(--ink); font-size: 15px; font-weight: 700; line-height: 22.5px; }
.facts { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; height: 84px; margin-top: 8px; }
.fact { padding: 0 10px; border-radius: 999px; background: var(--surface-2); color: var(--muted); font-size: 12px; font-weight: 600; line-height: 24px; max-width: 100%; box-sizing: border-box; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; animation: fade-up 0.3s ease; }
.fact.accent { background: var(--accent-soft); color: var(--accent-text); }

.panel { margin-top: 14px; }
.panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.panel-title { display: block; color: var(--ink); font-size: 14px; font-weight: 750; }
.guide-again { color: var(--muted); font-size: 12px; }
.tip { display: block; margin-top: 10px; color: var(--muted); font-size: 12px; line-height: 1.6; }
.number-line { padding: 14px 4px 0; }
.line-track { position: relative; display: flex; gap: 3px; height: 26px; }
.line-cell { flex: 1; border-radius: 6px; background: var(--track); transition: background 0.35s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
.line-cell.on { background: linear-gradient(180deg, #ffb45c, #ff7a45); transform: scaleY(1.12); }
.line-marker {
  position: absolute;
  top: -12px;
  width: 0;
  height: 0;
  margin-left: -6px;
  border-top: 8px solid #ff6a33;
  border-right: 6px solid transparent;
  border-left: 6px solid transparent;
  transition: left 0.5s cubic-bezier(0.34, 1.4, 0.64, 1);
}
.line-ends { display: flex; justify-content: space-between; margin-top: 6px; color: var(--muted); font-size: 12px; font-weight: 700; }
.units { display: flex; flex-direction: column; gap: 7px; margin-top: 10px; }
.unit-row { display: flex; align-items: center; gap: 10px; padding: 2px 0; border-radius: 8px; transition: opacity 0.25s ease; }
.unit-label { width: 36px; color: var(--muted); font-size: 12px; font-weight: 700; }
.unit-track { position: relative; flex: 1; height: 14px; overflow: hidden; border-radius: 7px; background: var(--track); }
.unit-fill { position: absolute; top: 0; bottom: 0; left: 0; background: #f7c873; transition: width 0.4s ease; }
.unit-cut { position: absolute; top: 0; bottom: 0; width: 1.5px; background: var(--paper); }
.unit-row.on .unit-label { color: var(--accent-text); }
.unit-row.on .unit-fill { background: linear-gradient(90deg, #ffb45c, #ff7a45); }

.level-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.level-label { color: var(--ink); font-size: 14px; font-weight: 650; }
.question { display: flex; flex-direction: column; align-items: center; }
.progress { display: flex; align-items: center; gap: 6px; margin-top: 10px; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--track); transition: background 0.3s ease, transform 0.3s ease; }
.dot.current { background: #ffb08d; transform: scale(1.25); }
.dot.right { background: #34c77b; }
.dot.wrong { background: #f15a36; }
.progress-text { margin-left: 6px; color: var(--muted); font-size: 12px; }
.prompt-row { display: flex; align-items: center; gap: 12px; margin-top: 14px; }
.prompt { color: var(--ink); font-size: 15px; font-weight: 700; }
.prompt.big { margin-top: 14px; font-size: 17px; }
.frac-mini { display: flex; flex-direction: column; align-items: center; color: var(--ink); font-size: 18px; font-weight: 750; line-height: 1.15; }
.frac-mini.big { font-size: 26px; }
.frac-mini-line { width: 1.4em; height: 2px; margin: 2px 0; border-radius: 1px; background: currentColor; }
.quiz-pizza { padding: 16rpx 0 4rpx; }
.count-line { color: var(--muted); font-size: 13px; font-weight: 650; }
.feedback { margin-top: 12px; padding: 8px 14px; border-radius: 12px; color: var(--muted); font-size: 13px; font-weight: 650; line-height: 1.5; text-align: center; transition: background 0.25s ease, color 0.25s ease; }
.feedback.right { background: rgba(52, 199, 123, 0.14); color: #1f9d5c; }
.feedback.wrong { background: rgba(241, 90, 54, 0.12); color: #d9482a; }
.action-row { display: flex; align-self: stretch; gap: 10px; margin-top: 14px; }
.icon-btn { display: flex; width: 46px; height: 46px; flex: none; align-items: center; justify-content: center; border-radius: 14px; background: var(--surface-2); }
.btn.grow { flex: 1; }
.options { display: flex; flex-wrap: wrap; justify-content: space-between; align-self: stretch; gap: 10px; margin-top: 14px; }
.option {
  display: flex;
  width: calc(50% - 5px);
  height: 64px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line);
  border-radius: 16px;
  box-sizing: border-box;
  background: var(--paper);
  transition: background 0.25s ease, opacity 0.25s ease, transform 0.25s ease;
}
.option.right { border-color: #34c77b; background: #34c77b; transform: scale(1.03); }
.option.right .frac-mini, .option.wrong .frac-mini { color: #fff; }
.option.wrong { border-color: #f15a36; background: #f15a36; }
.option.dim { opacity: 0.45; }
.compare-row { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 14px; }
.compare-side { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.compare-sign {
  display: flex;
  width: 44px;
  height: 44px;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--surface-2);
  color: var(--ink);
  font-size: 22px;
  font-weight: 800;
}
.compare-sign.right { background: #34c77b; color: #fff; }
.compare-sign.wrong { background: #f15a36; color: #fff; }
.pop-in { animation: bump 0.45s cubic-bezier(0.34, 1.56, 0.64, 1); }
.signs { display: flex; align-self: stretch; gap: 10px; margin-top: 16px; }
.sign-btn {
  display: flex;
  flex: 1;
  height: 52px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--paper);
  color: var(--ink);
  font-size: 26px;
  font-weight: 800;
  transition: background 0.25s ease, opacity 0.25s ease, transform 0.25s ease;
}
.sign-btn.right { border-color: #34c77b; background: #34c77b; color: #fff; transform: scale(1.04); }
.sign-btn.wrong { border-color: #f15a36; background: #f15a36; color: #fff; }
.sign-btn.dim { opacity: 0.45; }
.question .btn.block { align-self: stretch; margin-top: 14px; }
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
.guide-hole.round { border-radius: 50%; }
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

@keyframes bump {
  0% { transform: scale(0.6); opacity: 0.4; }
  60% { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1); }
}
@keyframes fade-up {
  0% { opacity: 0; transform: translateY(8px); }
  100% { opacity: 1; transform: translateY(0); }
}
</style>
