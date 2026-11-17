<script setup lang="ts">
import { computed, getCurrentInstance, ref } from 'vue'
import { t } from '@/i18n'

const props = defineProps<{
  /** 一天中的分钟数，0–1440。 */
  minutes: number
  animate: boolean
}>()

const emit = defineEmits<{
  'update:minutes': [value: number]
  dragstart: []
  dragend: []
}>()

const instance = getCurrentInstance()
const dragging = ref(false)
let rect: { left: number; width: number } | null = null
let pendingX: number | null = null

const MARKS = [
  { at: 0, label: '凌晨 0 点' },
  { at: 25, label: '早上 6 点' },
  { at: 50, label: '中午 12 点' },
  { at: 75, label: '傍晚 6 点' },
  { at: 100, label: '午夜 12 点' },
]

const percent = computed(() => (props.minutes / 1440) * 100)
const thumbStyle = computed(() => ({
  left: `${percent.value}%`,
  transition: dragging.value || !props.animate ? 'none' : 'left 0.6s cubic-bezier(0.34, 1.32, 0.64, 1)',
}))
const night = computed(() => props.minutes < 360 || props.minutes >= 1110)

function update(x: number) {
  if (!rect) return
  const ratio = Math.min(1, Math.max(0, (x - rect.left) / rect.width))
  emit('update:minutes', Math.round(ratio * 1440))
}

function onStart(event: TouchEvent) {
  pendingX = event.touches[0].clientX
  dragging.value = true
  emit('dragstart')
  uni.createSelectorQuery().in(instance?.proxy).select('.track').boundingClientRect((box) => {
    if (!box || Array.isArray(box) || pendingX === null) return
    rect = { left: box.left ?? 0, width: box.width || 1 }
    update(pendingX)
  }).exec()
}

function onMove(event: TouchEvent) {
  const x = event.touches[0].clientX
  if (!rect) {
    pendingX = x
    return
  }
  update(x)
}

function onEnd() {
  pendingX = null
  if (!dragging.value) return
  dragging.value = false
  emit('dragend')
}
</script>

<template>
  <view class="day-bar">
    <view class="track-area" @touchstart="onStart" @touchmove.stop.prevent="onMove" @touchend="onEnd" @touchcancel="onEnd">
      <view class="track" />
      <view class="thumb" :class="{ night, dragging }" :style="thumbStyle"><view class="thumb-core" /></view>
    </view>
    <view class="marks">
      <text v-for="mark in MARKS" :key="mark.at" class="mark" :style="{ left: mark.at + '%' }">{{ t(mark.label) }}</text>
    </view>
  </view>
</template>

<style scoped>
.day-bar { padding: 0 22rpx; }
.track-area { position: relative; height: 64rpx; display: flex; align-items: center; }
.track {
  width: 100%;
  height: 26rpx;
  border-radius: 999rpx;
  background: linear-gradient(90deg, #1d2348 0%, #3a3f74 18%, #f3a27e 25%, #ffe3b0 31%, #fff7e2 50%, #ffe3b0 69%, #f3a27e 76%, #6b5ca5 82%, #2a3160 90%, #1d2348 100%);
  box-shadow: inset 0 2rpx 6rpx rgba(30, 36, 60, 0.25);
}
.thumb {
  position: absolute;
  top: 50%;
  display: flex;
  width: 52rpx;
  height: 52rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 6rpx 16rpx rgba(30, 36, 60, 0.28), inset 0 2rpx 0 #ffffff;
  transform: translate(-50%, -50%);
}
.thumb.dragging { transform: translate(-50%, -50%) scale(1.15); }
.thumb-core {
  width: 26rpx;
  height: 26rpx;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #ffd66b, #ff9f43);
  box-shadow: 0 0 10rpx rgba(255, 170, 60, 0.8);
}
.thumb.night .thumb-core {
  background: transparent;
  box-shadow: inset -8rpx -2rpx 0 0 #8e95c9;
  transform: rotate(-20deg);
}
.marks { position: relative; height: 34rpx; margin-top: 4rpx; }
.mark {
  position: absolute;
  top: 0;
  color: var(--muted);
  font-size: 20rpx;
  white-space: nowrap;
  transform: translateX(-50%);
}
.mark:first-child { transform: none; }
.mark:last-child { transform: translateX(-100%); }
</style>
