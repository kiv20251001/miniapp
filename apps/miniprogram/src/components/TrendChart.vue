<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useThemeStore } from '@/utils/wx-theme'
import { currentMixBase, isDarkMix, mix } from '@/utils/color'

const props = withDefaults(defineProps<{
  title: string
  caption: string
  points: Array<{ label: string; value: number }>
  color: string
  valueFormatter: (value: number) => string
  /** 所在视图是否正在显示。藏起来时量不到画布宽度，等显示出来再画。 */
  visible?: boolean
}>(), { visible: true })

const canvasId = `trend-${props.color.replace('#', '')}`
const instance = getCurrentInstance()
const theme = useThemeStore()
const { mode } = storeToRefs(theme)
const drawn = ref(false)
const maxValue = computed(() => Math.max(1, ...props.points.map((item) => item.value)))
const total = computed(() => props.points.reduce((sum, item) => sum + item.value, 0))

function coordinates(width: number) {
  const left = 12
  const right = Math.max(left + 20, width - 12)
  return props.points.map((item, index) => {
    const x = props.points.length <= 1 ? (left + right) / 2 : left + (index / (props.points.length - 1)) * (right - left)
    const y = 96 - (item.value / maxValue.value) * 72
    return { ...item, x, y }
  })
}

type Canvas2D = {
  width: number
  height: number
  getContext: (type: '2d') => CanvasRenderingContext2D
}

let stale = false

function draw() {
  if (!props.visible) {
    stale = true
    return
  }
  const query = uni.createSelectorQuery().in(instance?.proxy)
  query.select(`#${canvasId}`).fields({ node: true, size: true }, () => {}).exec((res) => {
    const field = res?.[0] as { node?: Canvas2D; width?: number } | undefined
    const canvas = field?.node
    if (!canvas) return
    if (!field?.width) {
      stale = true
      return
    }
    stale = false
    const width = field.width
    const height = 128
    const ratio = uni.getWindowInfo?.().pixelRatio || 2
    canvas.width = width * ratio
    canvas.height = height * ratio
    const ctx = canvas.getContext('2d')
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    const points = coordinates(width)
    ctx.clearRect(0, 0, width, height)
    ctx.strokeStyle = isDarkMix() ? '#2d3546' : '#e6e8f0'
    ctx.lineWidth = 1
    for (const y of [32, 64, 96]) {
      ctx.beginPath()
      ctx.moveTo(12, y)
      ctx.lineTo(width - 12, y)
      ctx.stroke()
    }
    if (!points.length) {
      drawn.value = true
      return
    }
    const line = () => {
      points.forEach((point, index) => {
        if (!index) {
          ctx.moveTo(point.x, point.y)
          return
        }
        const previous = points[index - 1]
        const before = points[index - 2] ?? previous
        const next = points[index + 1] ?? point
        const smoothing = 0.18
        ctx.bezierCurveTo(
          previous.x + (point.x - before.x) * smoothing,
          previous.y + (point.y - before.y) * smoothing,
          point.x - (next.x - previous.x) * smoothing,
          point.y - (next.y - previous.y) * smoothing,
          point.x,
          point.y,
        )
      })
    }
    ctx.beginPath()
    line()
    ctx.lineTo(width - 12, 104)
    ctx.lineTo(12, 104)
    ctx.closePath()
    ctx.fillStyle = mix(props.color, currentMixBase(), isDarkMix() ? 0.72 : 0.82)
    ctx.fill()
    ctx.beginPath()
    line()
    ctx.strokeStyle = props.color
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    points.forEach((point) => {
      if (point.value <= 0) return
      ctx.beginPath()
      ctx.arc(point.x, point.y, 3.2, 0, Math.PI * 2)
      ctx.fillStyle = currentMixBase()
      ctx.fill()
      ctx.strokeStyle = props.color
      ctx.lineWidth = 2.4
      ctx.stroke()
    })
    const step = Math.max(1, Math.ceil(points.length / 6))
    ctx.fillStyle = isDarkMix() ? '#9aa3b8' : '#8b93a5'
    ctx.font = '8px sans-serif'
    ctx.textAlign = 'center'
    points.forEach((point, index) => {
      if (index % step !== 0 && index !== points.length - 1) return
      ctx.fillText(point.label, point.x, 121)
    })
    drawn.value = true
  })
}

/** 任何一次录入都会产生新的 points 数组；曲线数值没变就不重画画布。 */
const signature = computed(() => `${mode.value}|${props.color}|${props.points.map((item) => `${item.label}:${item.value}`).join(',')}`)

onMounted(() => nextTick(draw))
watch(signature, () => nextTick(draw))
watch(() => props.visible, (visible) => {
  if (visible && (stale || !drawn.value)) nextTick(draw)
})
</script>

<template>
  <view class="trend-card">
    <view class="head">
      <view>
        <text class="title">{{ title }}</text>
        <text class="caption">{{ caption }}</text>
      </view>
      <text class="total" :style="{ color }">{{ valueFormatter(total) }}</text>
    </view>
    <view class="plot-wrap">
      <canvas :id="canvasId" type="2d" class="plot" />
      <view v-if="!drawn" class="plot-sk">
        <view class="sk plot-sk-wave" />
        <view class="sk sk-line plot-sk-axis" />
      </view>
    </view>
  </view>
</template>

<style scoped>
.trend-card {
  margin-bottom: 12px;
  padding: 17px;
  border-radius: 24px;
  background: var(--paper);
  box-shadow: var(--elev-md), var(--glow-top);
}
.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.title { display: block; color: var(--ink); font-size: 16px; font-weight: 800; }
.caption { display: block; margin-top: 4px; color: var(--muted); font-size: 10px; }
.total { font-size: 17px; font-weight: 800; letter-spacing: -0.03em; }
.plot-wrap { position: relative; margin-top: 6px; }
.plot { display: block; width: 100%; height: 128px; }
.plot-sk {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 24px 12px 2px;
  background: var(--paper);
}
.plot-sk-wave { flex: 1; border-radius: 14px; }
.plot-sk-axis { height: 8px; margin-top: 12px; }
</style>
