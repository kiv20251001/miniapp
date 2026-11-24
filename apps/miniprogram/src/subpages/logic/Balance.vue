<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  left: number[]
  right: number[]
  tray: number[]
  picked: number
  /** 度。左重为负，右重为正，平或还没称是 0 */
  tilt: number
  even: boolean
  landed: Record<number, number>
}>()

const emit = defineEmits<{
  pick: [id: number]
  place: [zone: 'left' | 'right' | 'tray']
}>()

/** 和单位换算的天平同一套：横梁一半约 205rpx，盘子跟着端点上下走 */
const HALF = 205
const lift = computed(() => Math.sin((props.tilt * Math.PI) / 180) * HALF)
const beamStyle = computed(() => `transform: rotate(${props.tilt}deg);`)
const leftStyle = computed(() => `transform: translateY(${-lift.value}rpx);`)
const rightStyle = computed(() => `transform: translateY(${lift.value}rpx);`)
const needleStyle = computed(() => `transform: rotate(${-props.tilt * 2}deg);`)
</script>

<template>
  <view class="stage">
    <view class="balance" :class="{ even }">
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

      <view class="pan left" :style="leftStyle" @click="emit('place', 'left')">
        <view class="hook" />
        <view class="strings" />
        <view class="load">
          <view
            v-for="id in left"
            :key="`${id}-${landed[id] ?? 0}`"
            class="ball drop press"
            :class="{ on: picked === id }"
            hover-class="press-on"
            hover-stay-time="80"
            @click.stop="emit('pick', id)"
          >
            <text class="ball-no">{{ id + 1 }}</text>
          </view>
        </view>
        <view class="plate" />
      </view>

      <view class="pan right" :style="rightStyle" @click="emit('place', 'right')">
        <view class="hook" />
        <view class="strings" />
        <view class="load">
          <view
            v-for="id in right"
            :key="`${id}-${landed[id] ?? 0}`"
            class="ball drop press"
            :class="{ on: picked === id }"
            hover-class="press-on"
            hover-stay-time="80"
            @click.stop="emit('pick', id)"
          >
            <text class="ball-no">{{ id + 1 }}</text>
          </view>
        </view>
        <view class="plate" />
      </view>
    </view>

    <view class="tray" @click="emit('place', 'tray')">
      <view
        v-for="id in tray"
        :key="`${id}-${landed[id] ?? 0}`"
        class="ball drop press"
        :class="{ on: picked === id }"
        hover-class="press-on"
        hover-stay-time="80"
        @click.stop="emit('pick', id)"
      >
        <text class="ball-no">{{ id + 1 }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.stage { margin-top: 4px; }
.balance { position: relative; width: 100%; height: 420rpx; }
.post { position: absolute; top: 80rpx; bottom: 34rpx; left: 50%; width: 16rpx; margin-left: -8rpx; border-radius: 8rpx; background: linear-gradient(90deg, #8a95ab, #c3c9d6 45%, #8a95ab); }
.foot { position: absolute; bottom: 14rpx; left: 50%; width: 200rpx; height: 28rpx; margin-left: -100rpx; border-radius: 16rpx 16rpx 8rpx 8rpx; background: linear-gradient(180deg, #9aa3b5, #6f7a90); }
.dial { position: absolute; bottom: 52rpx; left: 50%; width: 120rpx; height: 64rpx; margin-left: -60rpx; overflow: hidden; border-radius: 60rpx 60rpx 0 0; background: #ffffff; box-shadow: inset 0 0 0 3rpx #c3c9d6; }
.dial-mark { position: absolute; top: 6rpx; left: 50%; width: 4rpx; height: 16rpx; margin-left: -2rpx; border-radius: 2rpx; background: #34c77b; }
.needle { position: absolute; bottom: 0; left: 50%; width: 4rpx; height: 52rpx; margin-left: -2rpx; border-radius: 2rpx; background: #f15a36; transform-origin: 50% 100%; transition: transform 0.9s cubic-bezier(0.34, 1.5, 0.64, 1); }
.even .needle { background: #34c77b; }

.beam { position: absolute; top: 70rpx; left: 18%; right: 18%; height: 20rpx; transform-origin: 50% 50%; transition: transform 0.9s cubic-bezier(0.34, 1.5, 0.64, 1); }
.beam-bar { position: absolute; inset: 4rpx 0; border-radius: 8rpx; background: linear-gradient(180deg, #ffcf4d, #f2a93b); box-shadow: 0 6rpx 14rpx -6rpx rgba(120, 80, 20, 0.5); transition: background 0.4s ease; }
.even .beam-bar { background: linear-gradient(180deg, #7be0a8, #34c77b); }
.pivot { position: absolute; top: -6rpx; left: 50%; width: 32rpx; height: 32rpx; margin-left: -16rpx; border-radius: 50%; background: #2c3654; box-shadow: inset 0 0 0 8rpx #5b6680; }

.pan { position: absolute; top: 80rpx; width: 200rpx; height: 270rpx; margin-left: -100rpx; transition: transform 0.9s cubic-bezier(0.34, 1.5, 0.64, 1); }
.pan.left { left: 18%; }
.pan.right { left: 82%; }
.hook { position: absolute; top: -4rpx; left: 50%; width: 14rpx; height: 14rpx; margin-left: -7rpx; border-radius: 50%; background: #2c3654; }
.strings { position: absolute; top: 6rpx; left: 18rpx; right: 18rpx; height: 214rpx; }
.strings::before, .strings::after { content: ''; position: absolute; top: 0; width: 2rpx; height: 230rpx; background: #9aa3b5; }
.strings::before { left: 50%; transform-origin: 0 0; transform: rotate(21deg); }
.strings::after { left: 50%; transform-origin: 0 0; transform: rotate(-21deg); }
.plate { position: absolute; bottom: 14rpx; left: 4rpx; right: 4rpx; height: 22rpx; border-radius: 0 0 100rpx 100rpx; background: linear-gradient(180deg, #c3c9d6, #8a95ab); }
.load { position: absolute; right: 8rpx; bottom: 34rpx; left: 8rpx; display: flex; flex-flow: row wrap-reverse; align-items: flex-end; justify-content: center; gap: 6rpx; }

.ball {
  position: relative;
  display: flex;
  width: 56rpx;
  height: 48rpx;
  align-items: center;
  justify-content: center;
  margin-top: 14rpx;
  border-radius: 10rpx 10rpx 14rpx 14rpx;
  background: linear-gradient(160deg, #ffe08a 0%, #f2b13b 55%, #d48a1f 100%);
  box-shadow: inset 0 -4rpx 0 rgba(150, 90, 10, 0.35), 0 4rpx 8rpx -4rpx rgba(120, 80, 20, 0.6);
}
.ball::before { content: ''; position: absolute; top: -12rpx; left: 50%; width: 22rpx; height: 14rpx; margin-left: -11rpx; border-radius: 8rpx 8rpx 2rpx 2rpx; background: #d99a2b; }
.ball.on { box-shadow: inset 0 -4rpx 0 rgba(150, 90, 10, 0.35), 0 0 0 4rpx #ff6a33; }
.ball-no { color: #6b3f05; font-size: 22rpx; font-weight: 800; line-height: 1; }
.drop { animation: drop 0.45s cubic-bezier(0.34, 1.4, 0.64, 1); }
@keyframes drop {
  0% { opacity: 0; transform: translateY(-80rpx); }
  100% { opacity: 1; transform: translateY(0); }
}

.tray {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 72px;
  margin: 6px 8px 0;
  padding: 14px 10px 10px;
  border-radius: 18px;
  background: var(--paper);
}
</style>
