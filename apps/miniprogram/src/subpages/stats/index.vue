<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import { appShare, momentsShare } from '@/utils/share'
import { useFamilyPage } from '@/composables/useFamilyPage'
import { usePageBackground, useThemePage } from '@/utils/wx-theme'
import TabBar from '@/components/TabBar.vue'
import StatsView from './StatsView.vue'

useFamilyPage()
const themeClass = useThemePage()
onShareAppMessage(appShare)
onShareTimeline(momentsShare)
const pageBg = usePageBackground()
const ready = ref(false)
const date = ref('')
const active = ref(false)

onLoad((query) => {
  date.value = typeof query?.date === 'string' ? query.date : ''
  ready.value = true
})

onShow(() => {
  active.value = true
})
</script>

<template>
  <page-meta :page-style="pageBg.style" :background-color="pageBg.bg" :background-color-top="pageBg.bg" :background-color-bottom="pageBg.bg" :root-background-color="pageBg.bg" :background-text-style="pageBg.text" />
  <view class="theme-root" :class="themeClass">
    <StatsView v-if="ready" :active="active" :initial-date="date" />
    <TabBar active="today" />
  </view>
</template>
