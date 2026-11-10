<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import type { Homework } from '@server-domain/types'
import { HOMEWORK_COLOR, HOMEWORK_DONE_COLOR } from '@/domain/homework'
import { useThemeStore } from '@/utils/wx-theme'
import { cardBackground, mix, tileBackground } from '@/utils/color'
import AppIcon from '@/components/AppIcon.vue'
import { t, tc } from '@/i18n'

const ACTION_WIDTH = 176

const props = withDefaults(defineProps<{
  homework: Homework
  /** 日期已过且没完成。 */
  missed?: boolean
  readonly?: boolean
  /** 同一时间只让一张卡片保持左滑展开。 */
  opened?: boolean
}>(), {
  missed: false,
  readonly: false,
  opened: false,
})

const emit = defineEmits<{
  open: []
  close: []
  edit: []
  toggle: []
}>()

const { isDark } = storeToRefs(useThemeStore())
const expanded = ref(false)
const dragging = ref(false)
/** 右侧操作区已经盖住的宽度。卡片本身不位移。 */
const reveal = ref(props.opened ? ACTION_WIDTH : 0)
let startX = 0
let startY = 0
let base = 0
let lastX = 0
let lastTime = 0
let velocity = 0
let direction: '' | 'x' | 'y' = ''
let moved = false
let settling = false
let gesture = 0

const long = computed(() => props.homework.content.length > 60 || props.homework.content.split('\n').length > 3)

watch(() => props.opened, (opened) => {
  if (dragging.value || settling) return
  reveal.value = opened ? ACTION_WIDTH : 0
})

const look = computed(() => {
  const tint = props.homework.done ? HOMEWORK_DONE_COLOR : HOMEWORK_COLOR
  const dark = isDark.value
  return {
    card: {
      background: cardBackground(tint),
      boxShadow: dark
        ? `0 2px 6px rgba(0,0,0,.28), 0 18px 34px -18px rgba(0,0,0,.6), inset 0 1px 0 ${mix(tint, '#1c2230', 0.78)}`
        : `0 2px 5px rgba(25,31,58,.04), 0 18px 34px -16px ${mix(tint, '#191f3a', 0.58)}, inset 0 1px 0 rgba(255,255,255,.9)`,
    },
    actions: {
      transform: `translate3d(${ACTION_WIDTH - reveal.value}px, 0, 0)`,
    },
    cue: {
      opacity: Math.max(0, 1 - reveal.value / 40),
    },
    tile: {
      background: tileBackground(tint),
      boxShadow: dark
        ? '0 10px 20px -12px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.14)'
        : `0 10px 20px -10px ${mix(tint, '#191f3a', 0.3)}, inset 0 1px 0 rgba(255,255,255,.4)`,
    },
  }
})

const status = computed(() => {
  if (props.homework.done) return { text: '已完成', cls: 'done' }
  if (props.missed) return { text: '未完成', cls: 'missed' }
  return { text: '待完成', cls: 'pending' }
})
const seal = computed(() => {
  if (props.homework.done) return { text: '已完成', cls: 'done' }
  if (props.missed) return { text: '未完成', cls: 'missed' }
  return null
})

function touchPoint(touch: Touch) {
  const point = touch as Touch & { pageX?: number; pageY?: number; x?: number; y?: number }
  return {
    x: point.clientX ?? point.pageX ?? point.x ?? 0,
    y: point.clientY ?? point.pageY ?? point.y ?? 0,
  }
}

function touchStart(event: TouchEvent) {
  if (props.readonly) return
  gesture += 1
  settling = false
  const point = touchPoint(event.touches[0])
  startX = point.x
  startY = point.y
  lastX = point.x
  lastTime = Date.now()
  velocity = 0
  base = reveal.value
  direction = ''
  moved = false
}

function touchMove(event: TouchEvent) {
  if (props.readonly) return
  const point = touchPoint(event.touches[0])
  const dx = point.x - startX
  const dy = point.y - startY
  const now = Date.now()
  const dt = Math.max(now - lastTime, 1)
  velocity = (point.x - lastX) / dt
  lastX = point.x
  lastTime = now
  if (!direction) {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
    direction = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
  }
  if (direction !== 'x') return
  moved = true
  dragging.value = true
  const next = base - dx
  if (next <= 0) reveal.value = 0
  else if (next > ACTION_WIDTH) reveal.value = ACTION_WIDTH + (next - ACTION_WIDTH) * 0.2
  else reveal.value = next
}

function touchEnd() {
  if (!dragging.value) return
  const flickOpen = velocity < -0.35
  const flickClose = velocity > 0.35
  let open = reveal.value > ACTION_WIDTH * 0.4
  if (flickOpen) open = true
  if (flickClose) open = false
  const target = open ? ACTION_WIDTH : 0
  const id = gesture
  settling = true
  dragging.value = false
  direction = ''
  velocity = 0
  if (open) emit('open')
  else emit('close')
  nextTick(() => {
    if (id !== gesture) return
    reveal.value = target
    settling = false
  })
}

function tapCard() {
  if (moved) return
  if (props.opened) {
    emit('close')
    return
  }
  if (long.value) expanded.value = !expanded.value
}
</script>

<template>
  <view
    class="hw"
    :class="{ readonly }"
    @touchstart="touchStart"
    @touchmove="touchMove"
    @touchend="touchEnd"
    @touchcancel="touchEnd"
    @click="tapCard"
  >
    <view
      class="hw-card"
      :class="{ done: homework.done, cue: !readonly }"
      :style="look.card"
    >
      <view v-if="seal" class="hw-seal" :class="seal.cls">
        <view class="hw-seal-ring">
          <view class="hw-seal-inner"><text>{{ t(seal.text) }}</text></view>
        </view>
      </view>
      <view class="hw-tile" :style="look.tile">
        <AppIcon name="homework" tone="white" :size="24" />
      </view>
      <view class="hw-copy">
        <view class="hw-top">
          <text class="hw-subject">{{ t(homework.subject) }}</text>
          <text v-if="!seal" class="hw-status" :class="status.cls">{{ t(status.text) }}</text>
        </view>
        <view class="hw-content" :class="{ clamp: long && !expanded }">{{ homework.content }}</view>
        <text v-if="long" class="hw-more">{{ t(expanded ? '收起' : '展开全部') }}</text>
        <view v-if="homework.note" class="hw-note">
          <text class="hw-note-label">{{ t('备注') }}</text>
          <text class="hw-note-text">{{ homework.note }}</text>
        </view>
      </view>
      <view v-if="!readonly && !opened" class="hw-cue" :style="look.cue">
        <AppIcon name="chevron-left" tone="muted" :size="12" />
        <text>{{ t('左滑') }}</text>
      </view>
    </view>
    <view
      v-if="!readonly"
      class="hw-actions"
      :class="{ dragging, shut: !dragging && reveal === 0 }"
      :style="look.actions"
    >
      <view hover-class="hw-action-on" hover-stay-time="80" class="hw-action hw-edit" @click.stop="emit('edit')">
        <AppIcon name="edit" tone="white" :size="15" />
        <text>{{ t('编辑') }}</text>
      </view>
      <view
        hover-class="hw-action-on"
        hover-stay-time="80"
        class="hw-action hw-state"
        :class="{ 'hw-revert': homework.done }"
        @click.stop="emit('toggle')"
      >
        <AppIcon :name="homework.done ? 'undo' : 'check'" tone="white" :size="15" />
        <text>{{ homework.done ? tc('action', '未完成') : t('完成') }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.hw {
  position: relative;
  margin-bottom: 12px;
  overflow: hidden;
  border-radius: 22px;
}
.hw-actions {
  position: absolute;
  z-index: 4;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-wrap: nowrap;
  width: 176px;
  overflow: hidden;
  background: #6c63ff;
  transform: translate3d(176px, 0, 0);
  transition: transform .32s cubic-bezier(.22, .82, .28, 1);
}
.hw-actions.dragging { transition: none; }
.hw-actions.shut { pointer-events: none; }
.hw-action {
  display: flex;
  flex: 1 0 0;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  height: 100%;
  padding: 0 8px;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.28);
}
.hw-action text {
  flex: 0 0 auto;
  white-space: nowrap;
  line-height: 1;
}
.hw-action.hw-edit { background: #6c63ff; }
.hw-action.hw-state { background: #2fb57c; }
.hw-action.hw-state.hw-revert { background: #ff7a45; }
.hw-card {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  border-radius: 22px;
}
.hw-tile {
  position: relative;
  z-index: 1;
  display: flex;
  width: 48px;
  height: 48px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
}
.hw-card.cue { padding-right: 52px; }
.hw-cue {
  position: absolute;
  z-index: 2;
  top: 16px;
  right: 10px;
  display: flex;
  align-items: center;
  gap: 1px;
  color: var(--faint);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  pointer-events: none;
}
.hw-seal {
  position: absolute;
  z-index: 0;
  right: -18px;
  bottom: 8px;
  display: flex;
  width: 84px;
  height: 84px;
  align-items: center;
  justify-content: center;
  opacity: 0.32;
  transform: rotate(-16deg);
  pointer-events: none;
}
.hw-seal.done { color: var(--paid); }
.hw-seal.missed { color: #e5484d; }
.hw-seal-ring {
  display: flex;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 4px;
  border: 2px solid currentColor;
  border-radius: 50%;
}
.hw-seal-inner {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  border: 1px solid currentColor;
  border-radius: 50%;
}
.hw-seal-inner text {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  line-height: 1;
  transform: translate(-6px, -4px);
}
.hw-copy { position: relative; z-index: 1; min-width: 0; flex: 1; }
.hw-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.hw-subject {
  min-width: 0;
  overflow: hidden;
  color: var(--ink);
  font-size: 17px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hw-status { flex: 0 0 auto; padding: 3px 8px; border-radius: 999px; font-size: 10px; font-weight: 750; }
.hw-status.pending { color: #6c63ff; background: rgba(108, 99, 255, 0.12); }
.hw-status.done { color: var(--paid); background: var(--paid-soft); }
.hw-status.missed { color: var(--unpaid); background: var(--unpaid-soft); }
.hw-content {
  display: block;
  margin-top: 7px;
  color: var(--ink);
  font-size: 13px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-all;
}
.hw-content.clamp {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}
.hw-card.done .hw-content { color: var(--muted); }
.hw-more { display: block; margin-top: 4px; color: #6c63ff; font-size: 11px; font-weight: 700; }
.hw-note { display: flex; gap: 6px; margin-top: 9px; padding-top: 8px; border-top: 1px solid var(--line); font-size: 11px; }
.hw-note-label { flex: 0 0 auto; color: var(--faint); font-weight: 700; }
.hw-note-text { min-width: 0; color: var(--muted); line-height: 1.4; }
</style>

<style>
.hw-action-on { opacity: 0.86; }
</style>
