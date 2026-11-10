<script setup lang="ts">
import { openTab } from '@/utils/nav'
import { brandHeaderHeight, capsuleInset, statusBarHeight } from '@/utils/system'
import ThemeToggle from '@/components/ThemeToggle.vue'

const statusBar = statusBarHeight()
const barHeight = brandHeaderHeight()
const actionsRight = capsuleInset() + 6
</script>

<template>
  <view class="app-brand-header" :style="{ height: barHeight + 'px', paddingTop: statusBar + 'px' }">
    <view class="app-brand-inner" :style="{ paddingRight: actionsRight + 'px' }">
      <view class="brand press" hover-class="press-on" hover-stay-time="80" @click="openTab('today')">
        <view class="brand-mark"><image class="brand-glyph" src="/static/logo-u.svg" mode="aspectFit" /></view>
        <view class="brand-copy">
          <text>Uday</text>
          <text>Plan Your Day. Grow Your Way.</text>
        </view>
      </view>
      <view class="app-actions">
        <ThemeToggle />
      </view>
    </view>
  </view>
  <view class="app-brand-spacer" :style="{ height: barHeight + 'px' }" />
</template>
