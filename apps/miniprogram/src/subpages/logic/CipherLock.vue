<script setup lang="ts">
import { onUnmounted, ref } from 'vue'

type Clue = { a: number; b: number; op: 'eq' | 'gt' | 'sum'; n: number }

const props = defineProps<{
  dials: number[]
  clues: Clue[]
  seen?: boolean[]
  disabled?: boolean
}>()

const emit = defineEmits<{ turn: [index: number, to: number] }>()

const CELL = 40
/** 三圈 0–9，中间那圈对准窗口，上下滑出一圈也不露白 */
const STRIP = Array.from({ length: 30 }, (_, index) => index % 10)
const LETTERS = ['A', 'B', 'C', 'D', 'E']

const drag = ref(-1)
const offset = ref(0)
const glide = ref<(number | null)[]>([null, null, null, null, null])
const freeze = ref(-1)
let startY = 0
let startValue = 0
const tokens = [0, 0, 0, 0, 0]
const timers: ReturnType<typeof setTimeout>[] = []

function canonical(value: number) {
  const digit = ((value % 10) + 10) % 10
  return -(9 + digit) * CELL
}

function stripY(index: number) {
  if (drag.value === index) return canonical(startValue) + offset.value
  const held = glide.value[index]
  if (held != null) return held
  return canonical(props.dials[index] ?? 0)
}

function stripStyle(index: number) {
  return `transform: translateY(${stripY(index)}px);`
}

function pointY(event: { touches?: Array<{ clientY?: number; pageY?: number }>; changedTouches?: Array<{ clientY?: number; pageY?: number }> }) {
  const touch = event.touches?.[0] || event.changedTouches?.[0]
  return touch?.clientY ?? touch?.pageY ?? 0
}

function onStart(index: number, event: { touches?: Array<{ clientY?: number; pageY?: number }> }) {
  if (props.disabled) return
  tokens[index] += 1
  const next = [...glide.value]
  next[index] = null
  glide.value = next
  drag.value = index
  offset.value = 0
  startY = pointY(event)
  startValue = props.dials[index] ?? 0
}

function onMove(event: { touches?: Array<{ clientY?: number; pageY?: number }> }) {
  if (drag.value < 0) return
  const dy = pointY(event) - startY
  const limit = 8 * CELL
  offset.value = Math.max(-limit, Math.min(limit, dy))
}

function onEnd() {
  if (drag.value < 0) return
  const index = drag.value
  const steps = Math.max(-8, Math.min(8, Math.round(-offset.value / CELL)))
  const to = (startValue + steps + 10) % 10
  const next = [...glide.value]
  next[index] = -(9 + startValue + steps) * CELL
  glide.value = next
  drag.value = -1
  offset.value = 0
  if (to !== (props.dials[index] ?? 0)) emit('turn', index, to)
  tokens[index] += 1
  const token = tokens[index]
  const timer = setTimeout(() => {
    if (tokens[index] !== token) return
    const cleared = [...glide.value]
    cleared[index] = null
    freeze.value = index
    glide.value = cleared
    setTimeout(() => {
      if (freeze.value === index) freeze.value = -1
    }, 30)
  }, 430)
  timers.push(timer)
}

function face(index: number) {
  return props.seen?.[index] ? String(props.dials[index] ?? 0) : '?'
}

function clueOk(clue: Clue) {
  if (!props.seen?.[clue.a] || !props.seen?.[clue.b]) return false
  const a = props.dials[clue.a] ?? 0
  const b = props.dials[clue.b] ?? 0
  if (clue.op === 'eq') return a === b
  if (clue.op === 'gt') return a === b + clue.n
  return a + b === clue.n
}

onUnmounted(() => timers.forEach((timer) => clearTimeout(timer)))
</script>

<template>
  <view class="safe">
    <view class="rivet left" />
    <view class="rivet right" />
    <view class="clues">
      <view v-for="(clue, index) in clues" :key="index" class="eq" :class="{ ok: clueOk(clue) }">
        <template v-if="clue.op === 'sum'">
          <view class="term" :class="{ hot: drag === clue.a }">
            <text class="name">{{ LETTERS[clue.a] }}</text>
            <text class="paren">({{ face(clue.a) }})</text>
          </view>
          <text class="op">+</text>
          <view class="term" :class="{ hot: drag === clue.b }">
            <text class="name">{{ LETTERS[clue.b] }}</text>
            <text class="paren">({{ face(clue.b) }})</text>
          </view>
          <text class="op">=</text>
          <text class="goal">{{ clue.n }}</text>
        </template>
        <template v-else-if="clue.op === 'gt'">
          <view class="term" :class="{ hot: drag === clue.a }">
            <text class="name">{{ LETTERS[clue.a] }}</text>
            <text class="paren">({{ face(clue.a) }})</text>
          </view>
          <text class="op">=</text>
          <view class="term" :class="{ hot: drag === clue.b }">
            <text class="name">{{ LETTERS[clue.b] }}</text>
            <text class="paren">({{ face(clue.b) }})</text>
          </view>
          <text class="op">+</text>
          <text class="goal">{{ clue.n }}</text>
        </template>
        <template v-else>
          <view class="term" :class="{ hot: drag === clue.a }">
            <text class="name">{{ LETTERS[clue.a] }}</text>
            <text class="paren">({{ face(clue.a) }})</text>
          </view>
          <text class="op">=</text>
          <view class="term" :class="{ hot: drag === clue.b }">
            <text class="name">{{ LETTERS[clue.b] }}</text>
            <text class="paren">({{ face(clue.b) }})</text>
          </view>
        </template>
      </view>
    </view>

    <view class="wheels">
      <view v-for="(value, index) in dials" :key="index" class="wheel">
        <view
          class="window"
          @touchstart="onStart(index, $event)"
          @touchmove.stop.prevent="onMove"
          @touchend="onEnd"
          @touchcancel="onEnd"
        >
          <view class="strip" :class="{ live: drag === index || freeze === index }" :style="stripStyle(index)">
            <text v-for="(digit, at) in STRIP" :key="at" class="digit">{{ digit }}</text>
          </view>
          <view class="shade" />
          <view class="mark" />
        </view>
        <text class="letter">{{ LETTERS[index] }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.safe {
  position: relative;
  margin-top: 8px;
  padding: 16px 12px 14px;
  border-radius: 22px;
  background: linear-gradient(180deg, #3d465c 0%, #2a3142 42%, #1e2431 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 12px 24px -18px rgba(0, 0, 0, 0.7);
}
.rivet {
  position: absolute;
  top: 12px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #d5dbe8, #6f7a90 60%, #3a4254);
}
.rivet.left { left: 12px; }
.rivet.right { right: 12px; }
.clues { display: flex; flex-direction: column; gap: 2px; padding: 4px 8px 10px; }
.eq { display: flex; align-items: center; justify-content: center; gap: 6px; height: 34px; border-radius: 10px; }
.eq.ok { background: rgba(52, 199, 123, 0.16); }
.term {
  display: flex;
  align-items: baseline;
  transition: transform 0.25s cubic-bezier(0.34, 1.4, 0.64, 1);
}
.term.hot { transform: scale(1.12); }
.name, .paren, .goal, .op { font-weight: 800; line-height: 1; }
.name { color: #f2d48a; font-size: 18px; }
.paren { color: #ffffff; font-size: 16px; }
.eq.ok .name, .eq.ok .paren, .eq.ok .goal, .eq.ok .op { color: #7be0a8; }
.op { color: #9aa3b5; font-size: 16px; }
.goal { min-width: 22px; color: #f2d48a; font-size: 18px; text-align: center; }
.wheels { display: flex; gap: 6px; }
.wheel { flex: 1; min-width: 0; }
.window {
  position: relative;
  height: 120px;
  overflow: hidden;
  border-radius: 12px;
  background: #12151c;
  box-shadow: inset 0 0 0 2px #0b0d12, inset 0 10px 14px rgba(0, 0, 0, 0.45);
}
.strip { transition: transform 0.42s cubic-bezier(0.34, 1.3, 0.64, 1); }
.strip.live { transition: none; }
.digit {
  display: block;
  height: 40px;
  color: #f2d48a;
  font-size: 22px;
  font-weight: 800;
  line-height: 40px;
  text-align: center;
}
.shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(18, 21, 28, 0.92) 0%, rgba(18, 21, 28, 0.15) 32%, rgba(18, 21, 28, 0.15) 68%, rgba(18, 21, 28, 0.92) 100%);
  pointer-events: none;
}
.mark {
  position: absolute;
  top: 40px;
  right: 5px;
  left: 5px;
  height: 40px;
  border-top: 1px solid rgba(242, 212, 138, 0.75);
  border-bottom: 1px solid rgba(242, 212, 138, 0.75);
  pointer-events: none;
}
.letter {
  display: block;
  margin-top: 6px;
  color: #c8b89a;
  font-size: 12px;
  font-weight: 800;
  text-align: center;
}
</style>
