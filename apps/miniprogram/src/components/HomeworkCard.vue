<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import type { Homework } from '@server-domain/types'
import { HOMEWORK_COLOR, HOMEWORK_DONE_COLOR } from '@/domain/homework'
import { useThemeStore } from '@/utils/wx-theme'
import { cardBackground, deepTone, mix, tileBackground } from '@/utils/color'
import AppIcon from '@/components/AppIcon.vue'

const ACTION_WIDTH = 144

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
const dragOffset = ref(0)
let startX = 0
let startY = 0
let base = 0
let direction: '' | 'x' | 'y' = ''

/** 右侧盖上来的宽度。0 是收起，ACTION_WIDTH 是完全盖住。 */
const reveal = computed(() => (dragging.value ? dragOffset.value : props.opened ? ACTION_WIDTH : 0))
const long = computed(() => props.homework.content.length > 60 || props.homework.content.split('\n').length > 3)
let moved = false

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
    clip: {
      width: `${reveal.value}px`,
      transition: dragging.value ? 'none' : 'width .32s cubic-bezier(.32,.72,0,1)',
    },
    drawer: {
      background: dark
        ? `linear-gradient(135deg, ${mix(tint, '#1c2230', 0.28)} 0%, ${deepTone(tint)} 100%)`
        : `linear-gradient(135deg, ${mix(tint, '#ffffff', 0.12)} 0%, ${deepTone(tint)} 100%)`,
      boxShadow: dark
        ? '-8px 0 20px rgba(0, 0, 0, 0.55)'
        : `-8px 0 20px ${mix(tint, '#191f3a', 0.45)}`,
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

function touchStart(event: TouchEvent) {
  if (props.readonly) return
  const point = event.touches[0]
  startX = point.clientX
  startY = point.clientY
  base = props.opened ? ACTION_WIDTH : 0
  direction = ''
  moved = false
}

function touchMove(event: TouchEvent) {
  if (props.readonly) return
  const point = event.touches[0]
  const dx = point.clientX - startX
  const dy = point.clientY - startY
  if (!direction) {
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
    direction = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
  }
  if (direction !== 'x') return
  moved = true
  dragging.value = true
  dragOffset.value = Math.min(ACTION_WIDTH, Math.max(0, base - dx))
}

function touchEnd() {
  if (!dragging.value) return
  const open = dragOffset.value > ACTION_WIDTH / 2
  dragging.value = false
  direction = ''
  if (open) emit('open')
  else emit('close')
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
          <view class="hw-seal-inner"><text>{{ seal.text }}</text></view>
        </view>
      </view>
      <view class="hw-tile" :style="look.tile">
        <AppIcon name="homework" tone="white" :size="24" />
      </view>
      <view class="hw-copy">
        <view class="hw-top">
          <text class="hw-subject">{{ homework.subject }}</text>
          <text v-if="!seal" class="hw-status" :class="status.cls">{{ status.text }}</text>
        </view>
        <view class="hw-content" :class="{ clamp: long && !expanded }">{{ homework.content }}</view>
        <text v-if="long" class="hw-more">{{ expanded ? '收起' : '展开全部' }}</text>
        <view v-if="homework.note" class="hw-note">
          <text class="hw-note-label">备注</text>
          <text class="hw-note-text">{{ homework.note }}</text>
        </view>
      </view>
      <view v-if="!readonly && !opened" class="hw-cue">
        <AppIcon name="chevron-left" tone="muted" :size="12" />
        <text>左滑</text>
      </view>
    </view>
    <view v-if="!readonly && reveal > 0" class="hw-clip" :style="look.clip">
      <view class="hw-drawer" :style="look.drawer">
        <view hover-class="press-on" hover-stay-time="80" class="hw-action edit" @click.stop="emit('edit')">
          <AppIcon name="edit" tone="white" :size="16" />
          <text>编辑</text>
        </view>
        <view hover-class="press-on" hover-stay-time="80" class="hw-action toggle" :class="{ undo2: homework.done }" @click.stop="emit('toggle')">
          <AppIcon :name="homework.done ? 'undo' : 'check'" tone="white" :size="16" />
          <text>{{ homework.done ? '未完成' : '完成' }}</text>
        </view>
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
.hw-clip {
  position: absolute;
  z-index: 2;
  top: 0;
  right: 0;
  height: 100%;
  overflow: hidden;
  border-radius: 0 22px 22px 0;
}
.hw-drawer {
  display: flex;
  width: 144px;
  height: 100%;
  box-sizing: border-box;
  align-items: stretch;
  gap: 8px;
  padding: 8px 8px 8px 10px;
  border-radius: 0 22px 22px 0;
}
.hw-action {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin: 0;
  padding: 0;
  border-radius: 18px;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}
.hw-action.edit {
  background: rgba(255, 255, 255, 0.22);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
.hw-action.toggle {
  background: #2fb57c;
  box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
.hw-action.toggle.undo2 {
  background: #f0a43a;
  box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
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
