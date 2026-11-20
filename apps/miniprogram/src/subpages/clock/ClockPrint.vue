<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import { t } from '@/i18n'
import { formTip } from '@/utils/form'
import { saveSheetImages, saveSheetPdf } from '@/print/save'
import { scrollToFirstSheet } from '@/print/scroll'
import { clockPerPage, MAX_PAGES } from './render'
import { renderClockFiles } from './preview'
import type { Level } from './time'
import {
  assignModes,
  formatSheetTime,
  joinTimes,
  parseTimes,
  PER_ROW_OPTIONS,
  randomTimes,
  SHEET_KINDS,
  SHEET_LEVELS,
  type ClockMode,
  type ClockSheetKind,
  type PerRow,
  type SheetTime,
} from './worksheet'

const instance = getCurrentInstance()

const text = ref('')
const kind = ref<ClockSheetKind>('mixed')
const perRow = ref<PerRow>(3)
const level = ref<Level>('medium')
const seconds = ref(false)
const images = ref<string[]>([])
const rendering = ref(false)
const saving = ref(false)
let lastRandom = ''

const parsed = computed(() => parseTimes(text.value))
const maxCount = computed(() => clockPerPage(perRow.value) * MAX_PAGES)

watch([text, kind, perRow, seconds], () => {
  images.value = []
})

function fillRandom() {
  text.value = joinTimes(randomTimes(level.value, clockPerPage(perRow.value), seconds.value), seconds.value)
  lastRandom = text.value
}

function onSecondsChange(event: Event) {
  seconds.value = Boolean((event as unknown as { detail: { value: boolean } }).detail.value)
  refillIfRandom()
}

function refillIfRandom() {
  if (text.value && text.value === lastRandom) fillRandom()
}

function setPerRow(value: PerRow) {
  if (perRow.value === value) return
  perRow.value = value
  refillIfRandom()
}

function setLevel(value: Level) {
  if (level.value === value) return
  level.value = value
  refillIfRandom()
}

function clearText() {
  text.value = ''
}

const SAMPLE_TIMES: SheetTime[] = [{ h: 3, m: 0, s: 20 }, { h: 8, m: 30, s: 45 }, { h: 10, m: 10, s: 5 }]
const SAMPLE_MODES: Record<ClockSheetKind, ClockMode[]> = {
  draw: ['draw', 'draw', 'draw'],
  read: ['read', 'read', 'read'],
  mixed: ['draw', 'read', 'draw'],
}

/** 设置区的示例：三个小钟，跟着题型变。 */
const samples = computed(() =>
  SAMPLE_TIMES.map((sample, index) => {
    const time = seconds.value ? sample : { ...sample, s: 0 }
    return {
      mode: SAMPLE_MODES[kind.value][index],
      label: formatSheetTime(time, seconds.value),
      hour: { transform: `rotate(${(time.h % 12) * 30 + time.m * 0.5}deg)` },
      minute: { transform: `rotate(${time.m * 6 + time.s * 0.1}deg)` },
      second: { transform: `rotate(${time.s * 6}deg)` },
    }
  }),
)
const TICKS = Array.from({ length: 12 }, (_, index) => ({ transform: `rotate(${index * 30}deg)` }))

function skippedList(list: string[]) {
  return list.slice(0, 5).join('、') + (list.length > 5 ? '…' : '')
}

async function generate() {
  if (rendering.value) return
  const { times, skipped } = parsed.value
  if (!times.length) {
    formTip(skipped.length ? t('这些时间无法识别：{list}', { list: skippedList(skipped) }) : '请先输入时间，或点随机生成')
    return
  }
  if (times.length > maxCount.value) {
    formTip(t('一次最多 {n} 道题，请减少时间', { n: maxCount.value }))
    return
  }
  rendering.value = true
  uni.showLoading({ title: '正在排版…', mask: true })
  try {
    images.value = await renderClockFiles({
      items: assignModes(times, kind.value, seconds.value),
      perRow: perRow.value,
      seconds: seconds.value,
    })
    uni.hideLoading()
    await nextTick()
    scrollToFirstSheet(instance?.proxy)
    if (skipped.length) {
      setTimeout(() => {
        formTip(t('已跳过 {n} 个无法识别的时间：{list}', { n: skipped.length, list: skippedList(skipped) }))
      }, 400)
    }
  } catch (error) {
    formTip(error instanceof Error ? error.message : '生成图片失败')
  } finally {
    uni.hideLoading()
    rendering.value = false
  }
}

async function saveImages() {
  if (!images.value.length || saving.value) return
  saving.value = true
  try {
    await saveSheetImages(images.value)
  } finally {
    saving.value = false
  }
}

async function savePdf() {
  if (!images.value.length || saving.value) return
  saving.value = true
  try {
    await saveSheetPdf(images.value, 'uday-clock')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <view class="clock-print" :class="{ 'has-pages': images.length }">
    <view class="card">
      <view class="field">
        <view class="field-head">
          <text class="field-label">{{ t('输入时间') }}</text>
          <text class="field-count">{{ t('已识别 {n} 道题', { n: parsed.times.length }) }}</text>
        </view>
        <view class="tool-row">
          <view class="tool-btn solid press" hover-class="press-on" hover-stay-time="80" @click="fillRandom">
            <AppIcon name="shuffle" tone="white" :size="15" />
            <text>{{ t('随机生成') }}</text>
          </view>
          <view class="tool-btn clear press" hover-class="press-on" hover-stay-time="80" @click="clearText">
            <AppIcon name="eraser" tone="ink" :size="14" />
            <text>{{ t('清空') }}</text>
          </view>
        </view>
        <textarea v-model="text" maxlength="2000" :placeholder="t('例如：3:00  8:30  10:15，也可以写 3点半')" placeholder-class="ph" />
        <view class="rules">
          <text class="rules-title">{{ t('出题说明') }}</text>
          <text class="rule">· {{ t('时间写成 3:30 或 3点半，用空格、逗号或换行隔开') }}</text>
          <text class="rule">· {{ t('打开秒针后可以写 3:30:15，没写秒数按 0 秒') }}</text>
          <text class="rule">· {{ t('写 15:20 这样的 24 小时制也可以，纸上按钟面显示') }}</text>
        </view>
      </view>

      <view class="option-group">
        <text class="option-label">{{ t('随机难度') }}</text>
        <view class="option-row">
          <text
            v-for="item in SHEET_LEVELS"
            :key="item.value"
            class="chip press"
            :class="{ active: level === item.value }"
            hover-class="press-on"
            hover-stay-time="80"
            @click="setLevel(item.value)"
          >{{ t(item.label) }}</text>
        </view>
      </view>
      <view class="option-group">
        <text class="option-label">{{ t('题型') }}</text>
        <view class="option-row">
          <text
            v-for="item in SHEET_KINDS"
            :key="item.value"
            class="chip press"
            :class="{ active: kind === item.value }"
            hover-class="press-on"
            hover-stay-time="80"
            @click="kind = item.value"
          >{{ t(item.label) }}</text>
        </view>
      </view>
      <view class="option-group">
        <text class="option-label">{{ t('每行钟表') }}</text>
        <view class="option-row">
          <text
            v-for="item in PER_ROW_OPTIONS"
            :key="item"
            class="chip press"
            :class="{ active: perRow === item }"
            hover-class="press-on"
            hover-stay-time="80"
            @click="setPerRow(item)"
          >{{ t('{n} 个', { n: item }) }}</text>
        </view>
      </view>
      <view class="setting">
        <text>{{ t('包含秒针') }}</text>
        <switch :checked="seconds" color="#ff7a45" @change="onSecondsChange" />
      </view>

      <view class="sample-strip">
        <view v-for="(sample, index) in samples" :key="index" class="sample">
          <view class="mini-clock">
            <view v-for="(tick, at) in TICKS" :key="at" class="mini-tick-wrap" :style="tick">
              <view class="mini-tick" :class="{ major: at % 3 === 0 }" />
            </view>
            <image class="mini-brand" src="/static/brand/yimu-logo.svg" mode="widthFix" />
            <template v-if="sample.mode === 'read'">
              <view class="mini-hand hour" :style="sample.hour" />
              <view class="mini-hand minute" :style="sample.minute" />
              <view v-if="seconds" class="mini-hand second" :style="sample.second" />
            </template>
            <view class="mini-cap" />
          </view>
          <text v-if="sample.mode === 'draw'" class="sample-time">{{ sample.label }}</text>
          <view v-else class="sample-blank">
            <view class="sample-box" />
            <text class="sample-colon">:</text>
            <view class="sample-box" />
            <template v-if="seconds">
              <text class="sample-colon">:</text>
              <view class="sample-box" />
            </template>
          </view>
        </view>
      </view>

      <button hover-class="press-on" hover-stay-time="80" class="btn block create" :disabled="rendering" @click="generate">{{ t('生成题目') }}</button>
    </view>

    <view v-if="images.length" class="preview">
      <text class="preview-title">{{ t('预览') }} · {{ t('{n} 页', { n: images.length }) }}</text>
      <text class="preview-tip">{{ t('打印时选择 A4，缩放选实际大小。') }}</text>
      <image v-for="(src, index) in images" :id="index === 0 ? 'sheet-0' : undefined" :key="src + index" class="sheet" :src="src" mode="widthFix" />
    </view>

    <view v-if="images.length" class="save-dock">
      <button hover-class="press-on" hover-stay-time="80" class="btn ghost" :disabled="saving" @click="saveImages">{{ t('保存图片') }}</button>
      <button hover-class="press-on" hover-stay-time="80" class="btn" :disabled="saving" @click="savePdf">{{ t('保存 PDF') }}</button>
    </view>
  </view>
</template>

<style scoped>
.clock-print.has-pages { padding-bottom: 96px; }
.field-head { display: flex; align-items: baseline; justify-content: space-between; }
.field-count { color: var(--muted); font-size: 12px; }
.tool-row { display: flex; align-items: center; gap: 8px; }
.tool-btn {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 34px;
  border-radius: 12px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 700;
  line-height: 34px;
  white-space: nowrap;
  box-sizing: border-box;
}
.tool-btn.solid {
  background: linear-gradient(135deg, #ffb45c 0%, #ff7a45 48%, #f15a36 100%);
  color: #fff;
}
.tool-btn.clear {
  background: var(--surface-2);
  color: var(--ink);
}
.rules {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--surface-2);
}
.rules-title { color: var(--ink); font-size: 12px; font-weight: 700; }
.rule { color: var(--muted); font-size: 12px; line-height: 1.5; }
.option-group { padding-top: 14px; }
.option-label { display: block; color: var(--ink); font-size: 14px; font-weight: 650; }
.option-row { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
.option-row .chip { justify-content: center; min-width: 52px; }

.sample-strip {
  display: flex;
  justify-content: space-around;
  gap: 8px;
  margin-top: 16px;
  padding: 14px 12px 12px;
  border: 1px solid #e3e6ee;
  border-radius: 12px;
  background: #fff;
}
.sample { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.mini-clock {
  position: relative;
  width: 64px;
  height: 64px;
  border: 4px solid #eceef4;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 0 1px #e1e5ec;
  box-sizing: border-box;
}
.mini-tick-wrap { position: absolute; top: 0; left: 0; right: 0; bottom: 0; }
.mini-tick { position: absolute; top: 2px; left: 50%; width: 1px; height: 3px; margin-left: -0.5px; background: #9aa1b2; }
.mini-tick.major { width: 2px; height: 5px; margin-left: -1px; background: #2b3340; }
.mini-hand {
  position: absolute;
  left: 50%;
  bottom: 50%;
  border-radius: 2px;
  background: #2b3340;
  transform-origin: 50% 100%;
}
.mini-hand.hour { width: 3px; height: 14px; margin-left: -1.5px; }
.mini-hand.minute { width: 2px; height: 21px; margin-left: -1px; }
.mini-hand.second { width: 1px; height: 23px; margin-left: -0.5px; background: #f15a36; }
.mini-brand {
  position: absolute;
  top: 27%;
  left: 50%;
  width: 22%;
  opacity: 0.78;
  transform: translate(-50%, -50%);
}
.setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 42px;
  margin-top: 8px;
  color: var(--ink);
  font-size: 14px;
  font-weight: 650;
}
.mini-cap {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 6px;
  height: 6px;
  margin: -3px 0 0 -3px;
  border: 1.5px solid #2b3340;
  border-radius: 50%;
  background: #f15a36;
  box-sizing: border-box;
}
.sample-time { height: 18px; color: #1c2430; font-size: 15px; font-weight: 800; line-height: 18px; font-variant-numeric: tabular-nums; }
.sample-blank { display: flex; align-items: center; gap: 3px; height: 18px; }
.sample-box { width: 20px; height: 16px; border: 1px solid #5b6474; box-sizing: border-box; }
.sample-colon { color: #2b3340; font-size: 13px; font-weight: 800; line-height: 16px; }

.create { margin-top: 14px; }
.preview { margin-top: 14px; }
.preview-title { display: block; color: var(--ink); font-size: 16px; font-weight: 800; }
.preview-tip { display: block; margin: 6px 0 12px; color: var(--muted); font-size: 12px; }
.sheet {
  display: block;
  width: 100%;
  margin-bottom: 12px;
  border-radius: 12px;
  box-shadow: var(--elev-md);
}
.save-dock {
  position: fixed;
  z-index: 40;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: 10px;
  padding: 12px 18px calc(12px + env(safe-area-inset-bottom));
  background: var(--dock-bg);
}
.save-dock .btn { flex: 1; }
</style>
