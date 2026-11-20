<script setup lang="ts">
import { computed } from 'vue'
import { artImage, type ArtId } from './art'
import { rateOf, unitName, type UnitId } from './units'

const props = withDefaults(defineProps<{
  art: ArtId
  /** 左盘东西的重量，用 small 单位计 */
  load: number
  weights: number[]
  big: UnitId
  small: UnitId
  en: boolean
  interactive?: boolean
  /** 左盘上显示的重量牌，平衡前写「?」 */
  tag?: string
}>(), { interactive: false, tag: '?' })

const emit = defineEmits<{ remove: [index: number] }>()

/** 横梁一半大约 205rpx，盘子跟着横梁端点上下移动 */
const HALF = 205
const MAX_DEG = 12

const total = computed(() => props.weights.reduce((sum, value) => sum + value, 0))
const balanced = computed(() => total.value === props.load)
const angle = computed(() => {
  if (balanced.value) return 0
  const diff = (total.value - props.load) / Math.max(props.load, 1)
  const deg = Math.sign(diff) * Math.min(MAX_DEG, 4 + Math.abs(diff) * 14)
  return deg
})
const lift = computed(() => Math.sin((angle.value * Math.PI) / 180) * HALF)
const beamStyle = computed(() => `transform: rotate(${angle.value}deg);`)
const leftStyle = computed(() => `transform: translateY(${-lift.value}rpx);`)
const rightStyle = computed(() => `transform: translateY(${lift.value}rpx);`)
const needleStyle = computed(() => `transform: rotate(${-angle.value * 2}deg);`)

const rate = computed(() => rateOf(props.big, props.small))

function label(value: number) {
  return value >= rate.value ? `${value / rate.value}${unitName(props.big, props.en)}` : `${value}${unitName(props.small, props.en)}`
}

/** 砝码越重画得越大 */
function weightStyle(value: number) {
  const size = Math.round(46 + Math.log10(value / 10) * 20)
  return `width:${size}rpx;height:${Math.round(size * 0.8)}rpx;font-size:${value >= rate.value ? 20 : 17}rpx;`
}

function remove(index: number) {
  if (props.interactive) emit('remove', index)
}
</script>

<template>
  <view class="balance" :class="{ balanced }">
    <view class="post" />
    <view class="foot" />
    <view class="dial">
      <view class="dial-mark" />
      <view class="needle" :style="needleStyle" />
    </view>
    <view class="beam" :style="beamStyle">
      <view class="beam-bar" />
      <view class="pivot" />
    </view>

    <view class="pan left" :style="leftStyle">
      <view class="hook" />
      <view class="strings" />
      <view class="load">
        <view class="object" :style="{ backgroundImage: artImage(art) }" />
        <text :key="tag" class="tag pop">{{ tag }}</text>
      </view>
      <view class="plate" />
    </view>

    <view class="pan right" :style="rightStyle">
      <view class="hook" />
      <view class="strings" />
      <view class="load weights">
        <view
          v-for="(value, index) in weights"
          :key="`${index}-${value}`"
          class="weight drop"
          :class="{ press: interactive }"
          :style="weightStyle(value)"
          @click="remove(index)"
        >
          <text class="weight-text">{{ label(value) }}</text>
        </view>
      </view>
      <view class="plate" />
    </view>
  </view>
</template>

<style scoped>
.balance { position: relative; width: 100%; height: 400rpx; }
.post { position: absolute; top: 80rpx; bottom: 34rpx; left: 50%; width: 16rpx; margin-left: -8rpx; border-radius: 8rpx; background: linear-gradient(90deg, #8a95ab, #c3c9d6 45%, #8a95ab); }
.foot { position: absolute; bottom: 14rpx; left: 50%; width: 200rpx; height: 28rpx; margin-left: -100rpx; border-radius: 16rpx 16rpx 8rpx 8rpx; background: linear-gradient(180deg, #9aa3b5, #6f7a90); }
.dial { position: absolute; bottom: 52rpx; left: 50%; width: 120rpx; height: 64rpx; margin-left: -60rpx; overflow: hidden; border-radius: 60rpx 60rpx 0 0; background: #ffffff; box-shadow: inset 0 0 0 3rpx #c3c9d6; }
.dial-mark { position: absolute; top: 6rpx; left: 50%; width: 4rpx; height: 16rpx; margin-left: -2rpx; border-radius: 2rpx; background: #34c77b; }
.needle { position: absolute; bottom: 0; left: 50%; width: 4rpx; height: 52rpx; margin-left: -2rpx; border-radius: 2rpx; background: #f15a36; transform-origin: 50% 100%; transition: transform 0.9s cubic-bezier(0.34, 1.5, 0.64, 1); }
.balanced .needle { background: #34c77b; }

.beam { position: absolute; top: 70rpx; left: 18%; right: 18%; height: 20rpx; transform-origin: 50% 50%; transition: transform 0.9s cubic-bezier(0.34, 1.5, 0.64, 1); }
.beam-bar { position: absolute; inset: 4rpx 0; border-radius: 8rpx; background: linear-gradient(180deg, #ffcf4d, #f2a93b); box-shadow: 0 6rpx 14rpx -6rpx rgba(120, 80, 20, 0.5); transition: background 0.4s ease; }
.balanced .beam-bar { background: linear-gradient(180deg, #7be0a8, #34c77b); }
.pivot { position: absolute; top: -6rpx; left: 50%; width: 32rpx; height: 32rpx; margin-left: -16rpx; border-radius: 50%; background: #2c3654; box-shadow: inset 0 0 0 8rpx #5b6680; }

.pan { position: absolute; top: 80rpx; width: 200rpx; height: 250rpx; margin-left: -100rpx; transition: transform 0.9s cubic-bezier(0.34, 1.5, 0.64, 1); }
.pan.left { left: 18%; }
.pan.right { left: 82%; }
.hook { position: absolute; top: -4rpx; left: 50%; width: 14rpx; height: 14rpx; margin-left: -7rpx; border-radius: 50%; background: #2c3654; }
.strings { position: absolute; top: 6rpx; left: 18rpx; right: 18rpx; height: 214rpx; }
.strings::before, .strings::after { content: ''; position: absolute; top: 0; width: 2rpx; height: 230rpx; background: #9aa3b5; }
.strings::before { left: 50%; transform-origin: 0 0; transform: rotate(21deg); }
.strings::after { left: 50%; transform-origin: 0 0; transform: rotate(-21deg); }
.plate { position: absolute; bottom: 14rpx; left: 4rpx; right: 4rpx; height: 22rpx; border-radius: 0 0 100rpx 100rpx; background: linear-gradient(180deg, #c3c9d6, #8a95ab); }
.load { position: absolute; bottom: 34rpx; left: 10rpx; right: 10rpx; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; }
.object { width: 120rpx; height: 120rpx; background-size: contain; background-repeat: no-repeat; background-position: center bottom; }
.tag { position: absolute; top: -34rpx; padding: 2rpx 14rpx; border-radius: 999rpx; background: #2c3654; color: #ffffff; font-size: 22rpx; font-weight: 800; white-space: nowrap; }
.balanced .tag { background: #34c77b; }
.weights { flex-direction: row; flex-wrap: wrap-reverse; align-items: flex-end; justify-content: center; gap: 4rpx; }
.weight {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 12rpx;
  border-radius: 10rpx 10rpx 14rpx 14rpx;
  background: linear-gradient(160deg, #ffe08a 0%, #f2b13b 55%, #d48a1f 100%);
  box-shadow: inset 0 -4rpx 0 rgba(150, 90, 10, 0.35), 0 4rpx 8rpx -4rpx rgba(120, 80, 20, 0.6);
}
.weight::before { content: ''; position: absolute; top: -12rpx; left: 50%; width: 22rpx; height: 14rpx; margin-left: -11rpx; border-radius: 8rpx 8rpx 2rpx 2rpx; background: #d99a2b; }
.weight-text { color: #6b3f05; font-weight: 800; line-height: 1; white-space: nowrap; }
.drop { animation: drop 0.45s cubic-bezier(0.34, 1.4, 0.64, 1); }
.pop { animation: pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes drop {
  0% { opacity: 0; transform: translateY(-80rpx); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes pop {
  0% { transform: scale(0.5); }
  60% { transform: scale(1.18); }
  100% { transform: scale(1); }
}
</style>
