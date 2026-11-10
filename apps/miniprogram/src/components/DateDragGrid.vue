<script setup lang="ts">
import { computed, getCurrentInstance, ref } from 'vue'
import dayjs from 'dayjs'
import { WEEKDAY_SHORT } from '@server-domain/constants'

const props = defineProps<{
  selected: string[]
}>()

const emit = defineEmits<{
  'update:selected': [dates: string[]]
}>()

const month = ref(dayjs().startOf('month'))
const instance = getCurrentInstance()
const days = computed(() => {
  const start = month.value.startOf('month').startOf('week')
  return Array.from({ length: 42 }, (_, index) => {
    const day = start.add(index, 'day')
    const date = day.format('YYYY-MM-DD')
    return {
      date,
      label: day.date(),
      inMonth: day.isSame(month.value, 'month'),
      today: day.isSame(dayjs(), 'day'),
      on: props.selected.includes(date),
    }
  })
})

type Box = { left: number; right: number; top: number; bottom: number; date: string; inMonth: boolean }
let boxes: Box[] = []
let dragMode: 'add' | 'remove' = 'add'
let dragging = false
const visited = new Set<string>()

function shift(delta: number) {
  month.value = month.value.add(delta, 'month')
}

function measure() {
  return new Promise<void>((resolve) => {
    const query = uni.createSelectorQuery().in((instance?.proxy || instance) as never)
    query.selectAll('.drag-day').boundingClientRect()
    query.exec((res) => {
      const rects = (res?.[0] || []) as Array<{ left: number; right: number; top: number; bottom: number }>
      boxes = rects.map((box, index) => ({
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        date: days.value[index]?.date || '',
        inMonth: Boolean(days.value[index]?.inMonth),
      }))
      resolve()
    })
  })
}

function hit(x: number, y: number) {
  return boxes.find((item) => item.inMonth && x >= item.left && x <= item.right && y >= item.top && y <= item.bottom)?.date || ''
}

function touchPoint(event: { touches?: Array<Record<string, number>>; changedTouches?: Array<Record<string, number>> }) {
  const touch = event.touches?.[0] || event.changedTouches?.[0]
  if (!touch) return null
  const x = touch.clientX ?? touch.pageX ?? touch.x
  const y = touch.clientY ?? touch.pageY ?? touch.y
  if (x == null || y == null) return null
  return { x, y }
}

function applyDate(date: string) {
  if (!date || visited.has(date)) return
  visited.add(date)
  const next = new Set(props.selected)
  if (dragMode === 'add') next.add(date)
  else next.delete(date)
  emit('update:selected', [...next].sort())
}

async function onStart(event: { touches?: Array<Record<string, number>>; changedTouches?: Array<Record<string, number>> }) {
  const touch = touchPoint(event)
  if (!touch) return
  dragging = true
  visited.clear()
  await measure()
  const date = hit(touch.x, touch.y)
  if (!date) return
  dragMode = props.selected.includes(date) ? 'remove' : 'add'
  applyDate(date)
}

function onMove(event: { touches?: Array<Record<string, number>>; changedTouches?: Array<Record<string, number>> }) {
  if (!dragging) return
  const touch = touchPoint(event)
  if (!touch) return
  applyDate(hit(touch.x, touch.y))
}

function onEnd() {
  dragging = false
  visited.clear()
}

defineExpose({ shift })
</script>

<template>
  <view class="drag-cal">
    <view class="month-nav">
      <text class="press" hover-class="press-on" hover-stay-time="80" @click="shift(-1)">‹</text>
      <text class="month-label">{{ month.format('YYYY年 M月') }}</text>
      <text class="press" hover-class="press-on" hover-stay-time="80" @click="shift(1)">›</text>
    </view>
    <view class="week-row">
      <text v-for="day in WEEKDAY_SHORT" :key="day">{{ day }}</text>
    </view>
    <view
      class="date-grid"
      @touchstart="onStart"
      @touchmove.stop.prevent="onMove"
      @touchend="onEnd"
      @touchcancel="onEnd"
    >
      <view
        v-for="day in days"
        :key="day.date"
        class="drag-day"
        :class="{ out: !day.inMonth, on: day.on, today: day.today }"
      >
        <text>{{ day.label }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.month-nav, .week-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.month-nav text {
  display: flex;
  min-width: 36px;
  height: 32px;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  line-height: 1;
}
.month-label { flex: 1; font-size: 15px; font-weight: 800; }
.week-row { margin: 8px 0 4px; color: var(--muted); font-size: 12px; }
.week-row text, .drag-day { width: 14.28%; text-align: center; }
.date-grid { display: flex; flex-wrap: wrap; }
.drag-day {
  display: flex;
  height: 40px;
  align-items: center;
  justify-content: center;
  color: var(--ink);
}
.drag-day text {
  display: flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  line-height: 1;
}
.drag-day.out { color: var(--faint); }
.drag-day.on text { background: #ff7a45; color: #fff; }
.drag-day.today:not(.on) text { box-shadow: inset 0 0 0 1px #ffb45c; }
</style>
