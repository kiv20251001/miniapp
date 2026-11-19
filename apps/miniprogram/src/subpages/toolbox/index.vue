<script setup lang="ts">
import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { t } from '@/i18n'
import { TOOL_SHARE_TITLES, toolMoments, toolShare, useSearchTitle } from '@/utils/share'
import { useFamilyPage } from '@/composables/useFamilyPage'
import { usePageBackground, useThemePage } from '@/utils/wx-theme'
import ToolboxView from '@/views/ToolboxView.vue'

useFamilyPage()
const themeClass = useThemePage()
onShareAppMessage(() => toolShare('toolbox', '/subpages/toolbox/index'))
onShareTimeline(() => toolMoments('toolbox'))
useSearchTitle(() => t(TOOL_SHARE_TITLES.toolbox))
const pageBg = usePageBackground()
</script>

<template>
  <page-meta :page-style="pageBg.style" :background-color="pageBg.bg" :background-color-top="pageBg.bg" :background-color-bottom="pageBg.bg" :root-background-color="pageBg.bg" :background-text-style="pageBg.text" />
  <view class="theme-root" :class="themeClass">
    <ToolboxView back />
  </view>
</template>
