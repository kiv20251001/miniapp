<script setup lang="ts">
import { computed, getCurrentInstance, ref, watch } from 'vue'
import { t } from '@/i18n'
import { mod } from './time'

type Hand = 'hour' | 'minute' | 'second'
type Motion = 'spring' | 'tick' | 'linear' | 'none'

const props = withDefaults(defineProps<{
  total: number
  seconds?: boolean
  draggable?: boolean
  motion?: Motion
  /** 松手后对齐到多少秒，例如 60 是整分。 */
  snap?: number
  state?: '' | 'right' | 'wrong'
  size?: string
}>(), {
  seconds: true,
  draggable: false,
  motion: 'spring',
  snap: 60,
  state: '',
  size: '560rpx',
})

const emit = defineEmits<{
  'update:total': [value: number]
  dragstart: [hand: Hand]
  dragend: []
}>()

const instance = getCurrentInstance()
const activeHand = ref<Hand | null>(null)
let rect: { left: number; top: number; width: number; height: number } | null = null
let pending: { x: number; y: number } | null = null
let live = 0

const numbers = Array.from({ length: 12 }, (_, index) => {
  const value = index + 1
  const angle = (value * 30 * Math.PI) / 180
  return { value, x: 50 + 36.5 * Math.sin(angle), y: 50 - 36.5 * Math.cos(angle) }
})

const hourDeg = computed(() => (props.total / 120))
const minuteDeg = computed(() => (props.total / 10))
const secondDeg = computed(() => Math.floor(props.total) * 6)

/** 拖分针或秒针时，在指着的刻度外沿放大显示是第几格。 */
const loupe = computed(() => {
  const hand = activeHand.value
  if (hand !== 'minute' && hand !== 'second') return null
  const value = hand === 'minute' ? Math.floor(mod(props.total, 3600) / 60) : Math.floor(mod(props.total, 60))
  const angle = (value * 6 * Math.PI) / 180
  return {
    value,
    tick: value,
    unit: hand === 'minute' ? '分' : '秒',
    style: { left: `${50 + 50 * Math.sin(angle)}%`, top: `${50 - 50 * Math.cos(angle)}%` },
  }
})
/** 松手后泡泡原地淡出，不跳回 12 点。 */
const loupeShown = ref({ value: 0, unit: '分', style: { left: '50%', top: '0%' } })
watch(loupe, (value) => {
  if (value) loupeShown.value = value
})

const transition = computed(() => {
  if (activeHand.value) return 'none'
  if (props.motion === 'spring') return 'transform 0.6s cubic-bezier(0.34, 1.32, 0.64, 1)'
  if (props.motion === 'tick') return 'transform 0.24s cubic-bezier(0.34, 1.9, 0.64, 1)'
  if (props.motion === 'linear') return 'transform 0.06s linear'
  return 'none'
})

function handStyle(deg: number) {
  return { transform: `translateX(-50%) rotate(${deg}deg)`, transition: transition.value }
}

function wrap(delta: number, half: number) {
  if (delta > half) return delta - half * 2
  if (delta < -half) return delta + half * 2
  return delta
}

function polar(point: { x: number; y: number }) {
  const box = rect!
  const dx = point.x - (box.left + box.width / 2)
  const dy = point.y - (box.top + box.height / 2)
  const angle = mod((Math.atan2(dx, -dy) * 180) / Math.PI, 360)
  return { angle, radius: Math.hypot(dx, dy) / (box.width / 2) }
}

function gap(a: number, b: number) {
  const diff = Math.abs(mod(a, 360) - mod(b, 360))
  return Math.min(diff, 360 - diff)
}

/** 按手指落点挑指针：角度最近的那根；两根靠得很近时，靠里选时针、靠外选分针。 */
function pickHand(angle: number, radius: number): Hand {
  const hands: Array<{ hand: Hand; deg: number }> = [
    { hand: 'minute', deg: minuteDeg.value },
    { hand: 'hour', deg: hourDeg.value },
  ]
  if (props.seconds) hands.push({ hand: 'second', deg: secondDeg.value })
  const ranked = hands.map((item) => ({ ...item, gap: gap(angle, item.deg) })).sort((a, b) => a.gap - b.gap)
  if (ranked[0].gap > 40) return 'minute'
  const close = ranked.filter((item) => item.gap - ranked[0].gap < 14)
  if (close.length > 1) {
    if (radius < 0.5 && close.some((item) => item.hand === 'hour')) return 'hour'
    if (close.some((item) => item.hand === 'minute')) return 'minute'
  }
  return ranked[0].hand
}

function apply(angle: number) {
  const hand = activeHand.value
  if (!hand) return
  if (hand === 'minute') live += wrap(angle - mod(live / 10, 360), 180) * 10
  else if (hand === 'hour') live += wrap(angle - mod(live / 120, 360), 180) * 120
  else live += wrap(angle - mod(live * 6, 360), 180) / 6
  emit('update:total', live)
}

function begin(point: { x: number; y: number }) {
  const { angle, radius } = polar(point)
  live = props.total
  activeHand.value = pickHand(angle, radius)
  emit('dragstart', activeHand.value)
  apply(angle)
}

function onStart(event: TouchEvent) {
  const touch = event.touches[0]
  pending = { x: touch.clientX, y: touch.clientY }
  uni.createSelectorQuery().in(instance?.proxy).select('.dial').boundingClientRect((box) => {
    if (!box || Array.isArray(box) || !pending) return
    rect = { left: box.left ?? 0, top: box.top ?? 0, width: box.width ?? 1, height: box.height ?? 1 }
    begin(pending)
  }).exec()
}

function onMove(event: TouchEvent) {
  const touch = event.touches[0]
  const point = { x: touch.clientX, y: touch.clientY }
  if (!activeHand.value || !rect) {
    pending = point
    return
  }
  apply(polar(point).angle)
}

function onEnd() {
  pending = null
  if (!activeHand.value) return
  activeHand.value = null
  emit('update:total', Math.round(live / props.snap) * props.snap)
  emit('dragend')
}
</script>

<template>
  <view class="clock-shell" :class="state" :style="{ width: size, height: size }">
    <view class="dial">
      <view v-for="index in 60" :key="index" class="tick-wrap" :style="{ transform: `rotate(${index * 6}deg)` }">
        <view class="tick" :class="{ major: index % 5 === 0, hot: loupe && loupe.tick === index % 60 }" />
      </view>
      <text v-for="item in numbers" :key="item.value" class="num" :style="{ left: item.x + '%', top: item.y + '%' }">{{ item.value }}</text>
      <view class="hand hour" :class="{ active: activeHand === 'hour' }" :style="handStyle(hourDeg)" />
      <view class="hand minute" :class="{ active: activeHand === 'minute' }" :style="handStyle(minuteDeg)" />
      <view v-if="seconds" class="hand second" :class="{ active: activeHand === 'second' }" :style="handStyle(secondDeg)" />
      <view class="cap"><view class="cap-dot" /></view>
      <view
        v-if="draggable"
        class="touch-layer"
        @touchstart="onStart"
        @touchmove.stop.prevent="onMove"
        @touchend="onEnd"
        @touchcancel="onEnd"
      />
    </view>
    <view class="loupe" :class="{ show: loupe }" :style="loupeShown.style">
      <text class="loupe-value">{{ loupeShown.value }}</text>
      <text class="loupe-unit">{{ t(loupeShown.unit) }}</text>
    </view>
  </view>
</template>

<style scoped>
.clock-shell {
  position: relative;
  padding: 26rpx;
  border-radius: 50%;
  box-sizing: border-box;
  background: linear-gradient(145deg, #ffffff 0%, #eceef4 100%);
  box-shadow:
    18rpx 22rpx 44rpx rgba(110, 122, 160, 0.28),
    -14rpx -14rpx 34rpx rgba(255, 255, 255, 0.85),
    inset 0 2rpx 0 rgba(255, 255, 255, 1);
  transition: box-shadow 0.3s ease, transform 0.3s ease;
}
.clock-shell.right {
  animation: pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 0 0 8rpx rgba(52, 199, 123, 0.35), 18rpx 22rpx 44rpx rgba(110, 122, 160, 0.28);
}
.clock-shell.wrong {
  animation: shake 0.45s ease;
  box-shadow: 0 0 0 8rpx rgba(241, 90, 54, 0.3), 18rpx 22rpx 44rpx rgba(110, 122, 160, 0.28);
}
@keyframes pop {
  0% { transform: scale(1); }
  40% { transform: scale(1.05); }
  100% { transform: scale(1); }
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-14rpx); }
  40% { transform: translateX(12rpx); }
  60% { transform: translateX(-8rpx); }
  80% { transform: translateX(5rpx); }
}
.dial {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 40%, #ffffff 0%, #ffffff 58%, #f4f5f9 100%);
  box-shadow: inset 0 4rpx 12rpx rgba(110, 122, 160, 0.22), inset 0 -2rpx 6rpx rgba(255, 255, 255, 0.9);
}
.tick-wrap { position: absolute; top: 0; left: 0; right: 0; bottom: 0; }
.tick {
  position: absolute;
  top: 3%;
  left: 50%;
  width: 3rpx;
  height: 12rpx;
  margin-left: -1.5rpx;
  border-radius: 2rpx;
  background: #9aa1b2;
}
.tick.major {
  width: 6rpx;
  height: 24rpx;
  margin-left: -3rpx;
  background: #2b3340;
}
.num {
  position: absolute;
  color: #2b3340;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 40rpx;
  font-weight: 700;
  line-height: 1;
  transform: translate(-50%, -50%);
}
.hand {
  position: absolute;
  left: 50%;
  bottom: 50%;
  transform-origin: 50% 100%;
  border-radius: 999rpx;
  box-shadow: 0 6rpx 10rpx rgba(30, 36, 60, 0.2);
}
.hand.hour { width: 16rpx; height: 25%; background: #2b3340; }
.hand.minute { width: 10rpx; height: 37%; background: #2b3340; }
.hand.second { width: 4rpx; height: 41%; background: #f15a36; box-shadow: none; }
.hand.active.hour,
.hand.active.minute { background: #ff7a45; }
.hand.active.second { background: #ff7a45; }
.cap {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  width: 32rpx;
  height: 32rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #2b3340;
  transform: translate(-50%, -50%);
}
.cap-dot { width: 12rpx; height: 12rpx; border-radius: 50%; background: #f15a36; }
.touch-layer { position: absolute; top: 0; left: 0; right: 0; bottom: 0; border-radius: 50%; }
.tick.hot {
  width: 6rpx;
  height: 30rpx;
  margin-left: -3rpx;
  background: #ff7a45;
  box-shadow: 0 0 8rpx rgba(255, 122, 69, 0.7);
}
.loupe {
  position: absolute;
  z-index: 3;
  display: flex;
  width: 84rpx;
  height: 84rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 4rpx solid #ff7a45;
  border-radius: 50%;
  box-sizing: border-box;
  background: radial-gradient(circle at 35% 30%, #ffffff 0%, #fff7f2 100%);
  box-shadow: 0 10rpx 24rpx rgba(255, 122, 69, 0.35), inset 0 2rpx 0 #ffffff;
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, -50%) scale(0.4);
  transition: opacity 0.18s ease, transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), left 0.08s linear, top 0.08s linear;
}
.loupe.show { opacity: 1; transform: translate(-50%, -50%) scale(1); }
.loupe-value {
  color: #e85b2a;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 34rpx;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.loupe-unit { margin-top: 2rpx; color: #e85b2a; font-size: 16rpx; font-weight: 700; line-height: 1; }
</style>
