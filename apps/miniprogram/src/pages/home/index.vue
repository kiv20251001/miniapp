<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { onLoad, onPageScroll, onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import { appShare, momentsShare } from '@/utils/share'
import { syncFamily, useFamilyPage } from '@/composables/useFamilyPage'
import { useUiStore } from '@/stores/ui'
import { HOME_PATH, isTabKey, type TabKey } from '@/utils/nav'
import { usePageBackground, useThemePage } from '@/utils/wx-theme'
import AppHeader from '@/components/AppHeader.vue'
import TabBar from '@/components/TabBar.vue'
import TodayView from '@/views/TodayView.vue'
import CalendarView from '@/views/CalendarView.vue'
import CoursesView from '@/views/CoursesView.vue'
import StatsView from '@/views/StatsView.vue'

/**
 * 今日、日历、课程、统计四个视图都挂在这一个页面里。
 * 切 tab 只是在同一个 WebView 里换显示的那块，不新建页面，所以没有新页面首帧的底色闪烁；
 * 换肤也直接作用到全部视图，不再有“缓存页还是旧主题”的问题。
 */
useFamilyPage()
const themeClass = useThemePage()
onShareAppMessage(appShare)
onShareTimeline(momentsShare)
const pageBg = usePageBackground()
const ui = useUiStore()

/** 视图第一次被打开后保留在树里，之后只用 hidden 切换，回来时还是原样。 */
const mounted = reactive<Record<TabKey, boolean>>({ today: true, calendar: false, courses: false, stats: false })
const covers = reactive<Record<TabKey, boolean>>({ today: false, calendar: false, courses: false, stats: false })
const covered = computed(() => covers[ui.tab])
/** 两个一样的 keyframes 轮流用，才能让每次切换都重新播放淡入。 */
const enterTick = ref(0)
const stageClass = computed(() => (enterTick.value ? `enter-${enterTick.value % 2}` : ''))

const scrollTops: Record<TabKey, number> = { today: 0, calendar: 0, courses: 0, stats: 0 }
let scrollTop = 0

onPageScroll((event) => {
  scrollTop = event.scrollTop
})

function setCover(tab: TabKey, value: boolean) {
  covers[tab] = value
}

onLoad((query) => {
  const tab = query?.tab
  if (isTabKey(tab)) ui.tab = tab
  if (query?.add === '1') ui.pendingAdd = true
  mounted[ui.tab] = true
})

onShow(() => {
  ui.homeShown += 1
})

function isTopPage() {
  return `/${getCurrentPages().slice(-1)[0]?.route}` === HOME_PATH
}

watch(() => ui.tab, (tab, previous) => {
  if (previous) scrollTops[previous] = scrollTop
  mounted[tab] = true
  enterTick.value += 1
  syncFamily()
  // 子页面的底栏也会改 ui.tab，这时主页面在后台，pageScrollTo 会滚到子页面上去。
  if (!isTopPage()) {
    scrollTop = 0
    return
  }
  nextTick(() => {
    uni.pageScrollTo({ scrollTop: scrollTops[tab] || 0, duration: 0 })
  })
})
</script>

<template>
  <page-meta :page-style="pageBg.style" :background-color="pageBg.bg" :background-color-top="pageBg.bg" :background-color-bottom="pageBg.bg" :root-background-color="pageBg.bg" :background-text-style="pageBg.text" />
  <view class="theme-root" :class="themeClass">
    <AppHeader />
    <view class="tab-stage" :class="stageClass">
      <view v-if="mounted.today" v-show="ui.tab === 'today'">
        <TodayView :active="ui.tab === 'today'" @cover="setCover('today', $event)" />
      </view>
      <view v-if="mounted.calendar" v-show="ui.tab === 'calendar'">
        <CalendarView :active="ui.tab === 'calendar'" @cover="setCover('calendar', $event)" />
      </view>
      <view v-if="mounted.courses" v-show="ui.tab === 'courses'">
        <CoursesView :active="ui.tab === 'courses'" @cover="setCover('courses', $event)" />
      </view>
      <view v-if="mounted.stats" v-show="ui.tab === 'stats'">
        <StatsView :active="ui.tab === 'stats'" />
      </view>
    </view>
    <TabBar :hidden="covered" />
  </view>
</template>

<style scoped>
/* 只做淡入，不位移，避免切换时内容抖动。 */
@keyframes stage-in-0 {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes stage-in-1 {
  from { opacity: 0; }
  to { opacity: 1; }
}
.tab-stage.enter-0 { animation: stage-in-0 0.18s ease-out; }
.tab-stage.enter-1 { animation: stage-in-1 0.18s ease-out; }
</style>
