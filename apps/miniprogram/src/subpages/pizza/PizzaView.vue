<script setup lang="ts">
/**
 * 一张披萨。每块是一层带 SVG 背景的 view，取出的块（分子）沿半径弹出来并高亮，其余变淡。
 * 份数变化时小刀绕一圈，新切好的块依次从中心转出来；点一块，那块弹出或弹回。
 */
import { computed, getCurrentInstance, ref, watch } from 'vue'
import { sliceImage } from './pizza-svg'

const props = withDefaults(defineProps<{
  parts: number
  filled: boolean[]
  /** 为 false 时画一整块没切开的披萨。 */
  divided?: boolean
  interactive?: boolean
  /** 在每块上写编号，方便数一共几份。 */
  labels?: boolean
  /** 有块被取出时，没取出的块变淡。 */
  dim?: boolean
  state?: '' | 'right' | 'wrong'
  size?: string
}>(), { divided: true, interactive: false, labels: false, dim: true, state: '', size: '280px' })

const emit = defineEmits<{ toggle: [index: number] }>()

const instance = getCurrentInstance()
const cid = `pz-${Math.random().toString(36).slice(2, 8)}`
const count = computed(() => (props.divided ? Math.max(1, props.parts) : 1))
const pops = ref<number[]>([])
const cutSeq = ref(0)

watch(count, (next, prev) => {
  pops.value = Array(next).fill(0)
  if (prev && props.interactive) cutSeq.value += 1
}, { immediate: true })

watch(() => props.filled.slice(0, count.value).join(','), (next, prev) => {
  if (!prev) return
  const now = next.split(',')
  const before = prev.split(',')
  if (now.length !== before.length) return
  const bumped = [...pops.value]
  now.forEach((value, index) => {
    if (value !== before[index]) bumped[index] = (bumped[index] || 0) + 1
  })
  pops.value = bumped
})

const anyOut = computed(() => props.divided && count.value > 1 && props.filled.slice(0, count.value).some(Boolean))

const slices = computed(() => {
  const total = count.value
  const span = (Math.PI * 2) / total
  return Array.from({ length: total }, (_, index) => {
    const mid = -Math.PI / 2 + (index + 0.5) * span
    const out = props.divided && Boolean(props.filled[index]) && total > 1
    const push = (total > 1 ? 1.6 : 0) + (out ? 7.5 : 0)
    const dx = Math.cos(mid) * push
    const dy = Math.sin(mid) * push
    const labelR = total > 8 ? 33 : 30
    return {
      key: `${total}-${index}`,
      out,
      pop: pops.value[index] || 0,
      move: { transform: `translate(${dx.toFixed(2)}%, ${dy.toFixed(2)}%) scale(${out ? 1.03 : 1})` },
      bg: { backgroundImage: sliceImage(total, index), animationDelay: `${index * 38}ms` },
      label: { left: `${(50 + Math.cos(mid) * labelR).toFixed(2)}%`, top: `${(50 + Math.sin(mid) * labelR).toFixed(2)}%` },
    }
  })
})

type TapEvent = {
  changedTouches?: ArrayLike<{ clientX?: number; clientY?: number }>
  touches?: ArrayLike<{ clientX?: number; clientY?: number }>
  detail?: { x?: number; y?: number }
}

function onTap(event: TapEvent) {
  if (!props.interactive || !props.divided || count.value < 1) return
  const touch = event.changedTouches?.[0] ?? event.touches?.[0]
  const x = touch?.clientX ?? event.detail?.x
  const y = touch?.clientY ?? event.detail?.y
  if (typeof x !== 'number' || typeof y !== 'number') return
  uni.createSelectorQuery()
    .in(instance?.proxy)
    .select(`#${cid}`)
    .boundingClientRect((box) => {
      const rect = box as { left: number; top: number; width: number; height: number } | null
      if (!rect?.width) return
      const dx = x - (rect.left + rect.width / 2)
      const dy = y - (rect.top + rect.height / 2)
      if (Math.hypot(dx, dy) > rect.width * 0.52) return
      let angle = Math.atan2(dy, dx) + Math.PI / 2
      if (angle < 0) angle += Math.PI * 2
      const index = Math.min(count.value - 1, Math.floor((angle / (Math.PI * 2)) * count.value))
      uni.vibrateShort({ type: 'light' })
      emit('toggle', index)
    })
    .exec()
}
</script>

<template>
  <view :id="cid" class="pizza" :class="[state, { tappable: interactive && divided }]" :style="{ width: size, height: size }" @tap="onTap">
    <view class="plate" />
    <view class="pie">
      <view
        v-for="(slice, at) in slices"
        :key="slice.key"
        class="slice"
        :class="{ out: slice.out, faded: dim && anyOut && !slice.out }"
        :style="slice.move"
      >
        <view :key="`${slice.key}-${slice.pop}`" class="slice-bg" :class="slice.pop ? 'pop' : 'enter'" :style="slice.bg" />
        <text v-if="labels && count > 1" class="slice-no" :class="{ on: slice.out }" :style="slice.label">{{ at + 1 }}</text>
      </view>
    </view>
    <view v-if="cutSeq > 0 && count > 1" :key="`knife-${cutSeq}`" class="knife-orbit">
      <view class="knife">
        <view class="knife-handle" />
        <view class="knife-blade" />
      </view>
    </view>
  </view>
</template>

<style scoped>
.pizza { position: relative; margin: 0 auto; }
.plate {
  position: absolute;
  inset: 2%;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 42%, #ffffff 0%, #f4efe8 70%, #ebe3d8 100%);
  box-shadow: 0 18px 34px -22px rgba(90, 60, 30, 0.55), inset 0 0 0 1px rgba(120, 90, 60, 0.06);
}
.pie { position: absolute; inset: 8%; }
.slice {
  position: absolute;
  inset: 0;
  transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.35s ease, filter 0.35s ease;
}
.slice.out { filter: drop-shadow(0 10px 10px rgba(180, 70, 20, 0.32)); }
.slice.faded { opacity: 0.7; filter: saturate(0.6) brightness(1.04); }
.slice-bg { position: absolute; inset: 0; background-size: 100% 100%; background-repeat: no-repeat; transform-origin: 50% 50%; }
.slice-bg.enter { animation: slice-in 0.55s cubic-bezier(0.34, 1.45, 0.64, 1) backwards; }
.slice-bg.pop { animation: slice-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
.slice-no {
  position: absolute;
  width: 40rpx;
  height: 40rpx;
  margin: -20rpx 0 0 -20rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.86);
  color: #6b4a2a;
  font-size: 22rpx;
  font-weight: 700;
  line-height: 40rpx;
  text-align: center;
  box-shadow: 0 2px 6px rgba(90, 50, 20, 0.2);
  transition: background 0.3s ease, color 0.3s ease;
}
.slice-no.on { background: #ff7a45; color: #fff; }
.pizza.wrong .pie { animation: pie-shake 0.45s ease; }
.pizza.right .pie { animation: pie-cheer 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }

.knife-orbit { position: absolute; inset: 0; pointer-events: none; animation: knife-spin 0.75s cubic-bezier(0.45, 0, 0.25, 1) forwards; }
.knife { position: absolute; left: 50%; top: 0; width: 6%; height: 44%; margin-left: -3%; }
.knife-handle { height: 30%; border-radius: 30rpx 30rpx 6rpx 6rpx; background: linear-gradient(90deg, #7a4f2e, #a87146 55%, #6b4426); }
.knife-blade {
  height: 70%;
  border-radius: 4rpx 4rpx 50% 50% / 4rpx 4rpx 30% 30%;
  background: linear-gradient(90deg, #c9d2da 0%, #ffffff 45%, #aeb8c2 100%);
  box-shadow: 0 6rpx 14rpx rgba(40, 50, 60, 0.25);
}

@keyframes slice-in {
  0% { opacity: 0; transform: scale(0.7) rotate(-14deg); }
  100% { opacity: 1; transform: scale(1) rotate(0); }
}
@keyframes slice-pop {
  0% { transform: scale(1); }
  35% { transform: scale(1.1) rotate(2deg); }
  100% { transform: scale(1) rotate(0); }
}
@keyframes knife-spin {
  0% { opacity: 0; transform: rotate(-30deg); }
  12% { opacity: 1; }
  85% { opacity: 1; }
  100% { opacity: 0; transform: rotate(360deg); }
}
@keyframes pie-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-4%); }
  40% { transform: translateX(3.5%); }
  60% { transform: translateX(-2.5%); }
  80% { transform: translateX(1.5%); }
}
@keyframes pie-cheer {
  0% { transform: scale(1) rotate(0); }
  40% { transform: scale(1.06) rotate(-4deg); }
  100% { transform: scale(1) rotate(0); }
}
</style>
