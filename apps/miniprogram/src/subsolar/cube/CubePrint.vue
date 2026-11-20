<script setup lang="ts">
import { getCurrentInstance, nextTick, ref, watch } from 'vue'
import { t } from '@/i18n'
import { formTip } from '@/utils/form'
import { renderPages } from '@/print/export'
import { saveSheetImages, saveSheetPdf } from '@/print/save'
import { scrollToFirstSheet } from '@/print/scroll'
import { CUBE_NETS } from './geometry'
import { drawCubePage, layoutPages, PER_PAGE } from './render'
import { buildSheet, SHEET_KINDS, type SheetKind } from './worksheet'
import type { Level } from './quiz'
import NetThumb from './NetThumb.vue'

const instance = getCurrentInstance()

const kinds = ref<SheetKind[]>(['net', 'opposite', 'count', 'views', 'calc', 'paint'])
const level = ref<Level>('easy')
const pages = ref(1)
const answers = ref(true)
const images = ref<string[]>([])
const rendering = ref(false)
const saving = ref(false)

const LEVELS: Array<{ value: Level; label: string }> = [
  { value: 'easy', label: '简单' },
  { value: 'medium', label: '中等' },
  { value: 'hard', label: '困难' },
]
const PAGES = [1, 2, 3]
const SAMPLE = CUBE_NETS[1].cells

watch([kinds, level, pages, answers], () => {
  images.value = []
}, { deep: true })

function onAnswers(event: Event) {
  answers.value = (event as unknown as { detail: { value: boolean } }).detail.value
}

function toggleKind(value: SheetKind) {
  const has = kinds.value.includes(value)
  if (has && kinds.value.length === 1) {
    formTip('至少选一种题型')
    return
  }
  kinds.value = has ? kinds.value.filter((item) => item !== value) : [...kinds.value, value]
}

async function generate() {
  if (rendering.value) return
  rendering.value = true
  uni.showLoading({ title: '正在排版…', mask: true })
  try {
    const items = buildSheet(kinds.value, level.value, pages.value * PER_PAGE)
    const list = layoutPages(items, answers.value)
    images.value = await renderPages(list.length, (pen, index) => drawCubePage(pen, list[index], index, list.length))
    uni.hideLoading()
    await nextTick()
    scrollToFirstSheet(instance?.proxy)
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
    await saveSheetPdf(images.value, 'uday-cube')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <view class="cube-print" :class="{ 'has-pages': images.length }">
    <view class="card">
      <view class="intro">
        <NetThumb :cells="SAMPLE" :unit="13" pairs />
        <view class="intro-copy">
          <text class="intro-title">{{ t('正方体和长方体常考题型') }}</text>
          <text class="intro-text">{{ t('展开图、相对面、数方块、三视图、表面积体积、涂色问题，每页 6 道，可附答案。') }}</text>
        </view>
      </view>
      <view class="option-group">
        <text class="option-label">{{ t('题型（可多选）') }}</text>
        <view class="option-row">
          <text
            v-for="item in SHEET_KINDS"
            :key="item.value"
            class="chip press"
            :class="{ active: kinds.includes(item.value) }"
            hover-class="press-on"
            hover-stay-time="80"
            @click="toggleKind(item.value)"
          >{{ t(item.label) }}</text>
        </view>
      </view>
      <view class="option-group">
        <text class="option-label">{{ t('难度') }}</text>
        <view class="option-row">
          <text
            v-for="item in LEVELS"
            :key="item.value"
            class="chip press"
            :class="{ active: level === item.value }"
            hover-class="press-on"
            hover-stay-time="80"
            @click="level = item.value"
          >{{ t(item.label) }}</text>
        </view>
      </view>
      <view class="option-group">
        <text class="option-label">{{ t('页数') }}</text>
        <view class="option-row">
          <text
            v-for="item in PAGES"
            :key="item"
            class="chip press"
            :class="{ active: pages === item }"
            hover-class="press-on"
            hover-stay-time="80"
            @click="pages = item"
          >{{ t('{n} 页 · {q} 道', { n: item, q: item * PER_PAGE }) }}</text>
        </view>
      </view>
      <view class="switch-row">
        <text class="option-label flat">{{ t('最后附参考答案') }}</text>
        <switch :checked="answers" color="#ff7a45" @change="onAnswers" />
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
.cube-print.has-pages { padding-bottom: 96px; }
.intro { display: flex; align-items: center; gap: 14px; padding: 12px; border-radius: 16px; background: var(--surface-2); }
.intro-copy { display: flex; flex: 1; flex-direction: column; gap: 4px; min-width: 0; }
.intro-title { color: var(--ink); font-size: 14px; font-weight: 750; }
.intro-text { color: var(--muted); font-size: 12px; line-height: 1.55; }
.option-group { margin-top: 14px; }
.option-label { display: block; margin-bottom: 8px; color: var(--ink); font-size: 14px; font-weight: 650; }
.option-label.flat { margin-bottom: 0; }
.option-row { display: flex; flex-wrap: wrap; gap: 8px; }
.switch-row { display: flex; align-items: center; justify-content: space-between; margin-top: 14px; }
.create { margin-top: 18px; }
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
