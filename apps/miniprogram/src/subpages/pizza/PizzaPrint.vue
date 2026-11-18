<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import { t } from '@/i18n'
import { formTip } from '@/utils/form'
import { saveSheetImages, saveSheetPdf } from '../print/save'
import { scrollToFirstSheet } from '../print/scroll'
import { MAX_PAGES, pizzaPerPage } from './render'
import { renderPizzaFiles } from './preview'
import { assignModes, joinFractions, parseFractions, randomFractions, SHEET_KINDS, type PizzaSheetKind } from './worksheet'
import type { Level } from './fraction'
import PizzaView from './PizzaView.vue'

const instance = getCurrentInstance()

const text = ref('')
const kind = ref<PizzaSheetKind>('mixed')
const level = ref<Level>('easy')
const count = ref(pizzaPerPage())
const images = ref<string[]>([])
const rendering = ref(false)
const saving = ref(false)
let lastRandom = ''

const LEVELS: Array<{ value: Level; label: string }> = [
  { value: 'easy', label: '简单' },
  { value: 'medium', label: '中等' },
  { value: 'hard', label: '困难' },
]

const counts = computed(() => {
  const base = pizzaPerPage()
  return [1, 2, 3].map((times) => base * times).filter((value) => value <= base * MAX_PAGES)
})
const parsed = computed(() => parseFractions(text.value))
const maxCount = computed(() => pizzaPerPage() * MAX_PAGES)

watch([text, kind], () => {
  images.value = []
})

function fillRandom() {
  text.value = joinFractions(randomFractions(level.value, count.value))
  lastRandom = text.value
}

function refillIfRandom() {
  if (text.value && text.value === lastRandom) fillRandom()
}

function setCount(value: number) {
  if (count.value === value) return
  count.value = value
  refillIfRandom()
}

function setLevel(value: Level) {
  if (level.value === value) return
  level.value = value
  refillIfRandom()
}

const SAMPLE_MODES: Record<PizzaSheetKind, Array<'line' | 'read'>> = {
  line: ['line', 'line', 'line'],
  read: ['read', 'read', 'read'],
  mixed: ['line', 'read', 'line'],
}
const SAMPLES = [
  { den: 4, num: 1 },
  { den: 8, num: 3 },
  { den: 6, num: 2 },
]
const samples = computed(() =>
  SAMPLES.map((sample, index) => ({
    ...sample,
    mode: SAMPLE_MODES[kind.value][index],
    filled: Array.from({ length: sample.den }, (_, at) => at < sample.num),
  })),
)

function skippedList(list: string[]) {
  return list.slice(0, 5).join('、') + (list.length > 5 ? '…' : '')
}

async function generate() {
  if (rendering.value) return
  const { fractions, skipped } = parsed.value
  if (!fractions.length) {
    formTip(skipped.length ? t('这些分数无法识别：{list}', { list: skippedList(skipped) }) : '请先输入分数，或点随机生成')
    return
  }
  if (fractions.length > maxCount.value) {
    formTip(t('一次最多 {n} 道题，请减少分数', { n: maxCount.value }))
    return
  }
  rendering.value = true
  uni.showLoading({ title: '正在排版…', mask: true })
  try {
    images.value = await renderPizzaFiles({ items: assignModes(fractions, kind.value) })
    uni.hideLoading()
    await nextTick()
    scrollToFirstSheet(instance?.proxy)
    if (skipped.length) {
      setTimeout(() => formTip(t('已跳过 {n} 个无法识别的分数：{list}', { n: skipped.length, list: skippedList(skipped) })), 400)
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
    await saveSheetPdf(images.value, 'uday-pizza')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <view class="pizza-print" :class="{ 'has-pages': images.length }">
    <view class="card">
      <view class="field">
        <view class="field-head">
          <text class="field-label">{{ t('输入分数') }}</text>
          <text class="field-count">{{ t('已识别 {n} 道题', { n: parsed.fractions.length }) }}</text>
        </view>
        <view class="tool-row">
          <view class="tool-btn solid press" hover-class="press-on" hover-stay-time="80" @click="fillRandom">
            <AppIcon name="shuffle" tone="white" :size="15" />
            <text>{{ t('随机生成') }}</text>
          </view>
          <view class="tool-btn clear press" hover-class="press-on" hover-stay-time="80" @click="text = ''">
            <AppIcon name="eraser" tone="ink" :size="14" />
            <text>{{ t('清空') }}</text>
          </view>
        </view>
        <textarea v-model="text" maxlength="2000" :placeholder="t('例如：1/4  3/8  2/6，也可以写 4分之1')" placeholder-class="ph" />
        <view class="rules">
          <text class="rules-title">{{ t('出题说明') }}</text>
          <text class="rule">· {{ t('写成 3/4，斜线前面是分子、后面是分母') }}</text>
          <text class="rule">· {{ t('写成 4分之3 也行，和说出来的顺序一样') }}</text>
          <text class="rule">· {{ t('分母最大 12，分子不能比分母大，用空格或逗号隔开') }}</text>
        </view>
      </view>
      <view class="option-group">
        <text class="option-label">{{ t('随机难度') }}</text>
        <view class="option-row">
          <text
            v-for="item in LEVELS"
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
        <text class="option-label">{{ t('题目数量') }}</text>
        <view class="option-row">
          <text
            v-for="item in counts"
            :key="item"
            class="chip press"
            :class="{ active: count === item }"
            hover-class="press-on"
            hover-stay-time="80"
            @click="setCount(item)"
          >{{ t('{n} 道', { n: item }) }}</text>
        </view>
      </view>

      <view class="sample-strip">
        <view v-for="(sample, index) in samples" :key="index" class="sample">
          <view v-if="sample.mode === 'line'" class="mini-track">
            <view class="mini-bar" />
            <view class="mini-ends"><text>0</text><text>1</text></view>
          </view>
          <PizzaView v-else :parts="sample.den" :filled="sample.filled" size="78px" />
          <view class="mini-frac">
            <text class="mini-tag">{{ t('分子') }}</text>
            <text v-if="sample.mode === 'line'" class="mini-num">{{ sample.num }}</text>
            <view v-else class="mini-box" />
            <view class="mini-line" />
            <text v-if="sample.mode === 'line'" class="mini-num">{{ sample.den }}</text>
            <view v-else class="mini-box" />
            <text class="mini-tag">{{ t('分母') }}</text>
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
.pizza-print.has-pages { padding-bottom: 96px; }
.field-head { display: flex; align-items: baseline; justify-content: space-between; }
.field-label { color: var(--ink); font-size: 14px; font-weight: 650; }
.field-count { color: var(--muted); font-size: 12px; }
.tool-row { display: flex; gap: 8px; margin: 8px 0; }
.tool-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 34px;
  padding: 0 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
  line-height: 34px;
}
.tool-btn.solid { background: linear-gradient(135deg, #ffb45c 0%, #ff7a45 48%, #f15a36 100%); color: #fff; }
.tool-btn.clear { background: var(--surface-2); color: var(--ink); }
textarea {
  width: 100%;
  height: 76px;
  box-sizing: border-box;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--surface-2);
  color: var(--ink);
  font-size: 14px;
  line-height: 1.5;
}
.rules { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; padding: 10px 12px; border-radius: 12px; background: var(--surface-2); }
.rules-title { color: var(--ink); font-size: 12px; font-weight: 700; }
.rule { color: var(--muted); font-size: 12px; line-height: 1.5; }
.option-group { margin-top: 14px; }
.option-label { display: block; margin-bottom: 8px; color: var(--ink); font-size: 14px; font-weight: 650; }
.option-row { display: flex; flex-wrap: wrap; gap: 8px; }
.sample-strip { display: flex; justify-content: space-around; margin: 18px 0 4px; }
.sample { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.mini-frac { display: flex; flex-direction: column; align-items: center; }
.mini-tag { color: var(--muted); font-size: 10px; font-weight: 650; }
.mini-num { color: var(--ink); font-size: 13px; font-weight: 750; line-height: 1.1; }
.mini-line { width: 18px; height: 1.5px; margin: 2px 0; background: var(--ink); }
.mini-box { width: 16px; height: 12px; margin: 1px 0; border: 1px solid var(--muted); border-radius: 3px; }
.mini-track { display: flex; width: 78px; height: 78px; flex-direction: column; align-items: stretch; justify-content: center; }
.mini-bar { height: 3px; border-radius: 2px; background: var(--ink); }
.mini-ends { display: flex; justify-content: space-between; margin-top: 4px; color: var(--muted); font-size: 11px; font-weight: 700; }
.preview { margin-top: 16px; }
.preview-title { display: block; color: var(--ink); font-size: 15px; font-weight: 750; }
.preview-tip { display: block; margin: 4px 0 10px; color: var(--muted); font-size: 12px; }
.sheet { width: 100%; margin-bottom: 12px; border-radius: 12px; }
.save-dock {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  gap: 10px;
  padding: 10px 18px calc(10px + var(--safe-bottom));
  background: var(--header-bg);
  box-shadow: 0 -8px 24px -16px rgba(25, 31, 58, 0.4);
}
.save-dock .btn { flex: 1; }
</style>
