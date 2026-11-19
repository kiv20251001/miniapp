<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, ref, watch } from 'vue'
import { onLoad, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { TOOL_SHARE_TITLES, toolMoments, toolShare, useSearchTitle } from '@/utils/share'
import { useFamilyPage } from '@/composables/useFamilyPage'
import { usePageBackground, useThemePage } from '@/utils/wx-theme'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import { t } from '@/i18n'
import { formTip } from '@/utils/form'
import { saveSheetImages, saveSheetPdf } from '../print/save'
import { scrollToFirstSheet } from '../print/scroll'
import { isMathKind, joinProblems, kindInfo, parseProblems, randomProblems, type MathKind } from './problems'
import { BLANK_POSITIONS, chainValue, joinChains, MIXED_OPS, parseChains, placeBlanks, randomChains, type BlankPos, type Chain, type MixedOp } from './mixed'
import { MAX_PAGES, perPage } from './render'
import { mixedPerPage } from './render-mixed'
import { renderMathFiles, renderMixedFiles } from './preview'

useFamilyPage()
const themeClass = useThemePage()
const pageBg = usePageBackground()
const instance = getCurrentInstance()

const kind = ref<MathKind>('break10')
onShareAppMessage(() => toolShare(kind.value, `/subpages/maths/sheet?kind=${kind.value}`))
onShareTimeline(() => toolMoments(kind.value, `kind=${kind.value}`))
useSearchTitle(() => t(TOOL_SHARE_TITLES[kind.value]))
const text = ref('')
const hint = ref(true)
const images = ref<string[]>([])
const rendering = ref(false)
const saving = ref(false)

const mixedOp = ref<MixedOp>('random')
const blankPos = ref<BlankPos>('random')
let lastRandom = ''

const info = computed(() => kindInfo(kind.value))
const parsed = computed(() => {
  const value = kind.value
  return value === 'mixed' ? parseChains(text.value) : parseProblems(value, text.value)
})
const sheetSize = computed(() => (kind.value === 'mixed' ? mixedPerPage() : perPage()))
const maxCount = computed(() => sheetSize.value * MAX_PAGES)

onLoad((query) => {
  if (isMathKind(query?.kind)) kind.value = query.kind
})

watch([text, hint, blankPos], () => {
  images.value = []
})

function fillRandom() {
  const value = kind.value
  text.value = value === 'mixed' ? joinChains(randomChains(mixedOp.value, sheetSize.value)) : joinProblems(randomProblems(value, sheetSize.value))
  lastRandom = text.value
}

const SAMPLE_CHAINS: Record<MixedOp, Chain[]> = {
  add: [{ nums: [8, 5, 6], ops: ['+', '+'] }, { nums: [12, 3, 4], ops: ['+', '+'] }, { nums: [6, 9, 2], ops: ['+', '+'] }],
  sub: [{ nums: [18, 6, 3], ops: ['-', '-'] }, { nums: [15, 4, 7], ops: ['-', '-'] }, { nums: [19, 9, 5], ops: ['-', '-'] }],
  random: [{ nums: [15, 7, 4], ops: ['-', '+'] }, { nums: [6, 8, 3], ops: ['+', '-'] }, { nums: [17, 5, 6], ops: ['-', '-'] }],
}
const SAMPLE_BLANKS: Record<BlankPos, number[]> = {
  left: [0, 0, 0],
  middle: [1, 2, 1],
  right: [3, 3, 3],
  random: [0, 2, 3],
}

/** 设置区的示例：三道题，空格用 null 表示。 */
const mixedSamples = computed(() =>
  SAMPLE_CHAINS[mixedOp.value].map((chain, index) => {
    const blank = SAMPLE_BLANKS[blankPos.value][index]
    const tokens: Array<string | null> = []
    chain.nums.forEach((num, at) => {
      if (at > 0) tokens.push(chain.ops[at - 1] === '+' ? '+' : '−')
      tokens.push(at === blank ? null : String(num))
    })
    tokens.push('=', blank === chain.nums.length ? null : String(chainValue(chain)))
    return tokens
  }),
)

function setMixedOp(value: MixedOp) {
  if (mixedOp.value === value) return
  mixedOp.value = value
  if (text.value && text.value === lastRandom) fillRandom()
}

function clearText() {
  text.value = ''
}

function skippedList(list: string[]) {
  return list.slice(0, 5).join('、') + (list.length > 5 ? '…' : '')
}

async function generate() {
  if (rendering.value) return
  const { problems, skipped } = parsed.value
  if (!problems.length) {
    formTip(skipped.length ? t('这些算式不适合{name}：{list}', { name: t(info.value.name), list: skippedList(skipped) }) : '请先输入算式，或点随机生成')
    return
  }
  if (problems.length > maxCount.value) {
    formTip(t('一次最多 {n} 道题，请减少算式', { n: maxCount.value }))
    return
  }
  rendering.value = true
  uni.showLoading({ title: '正在排版…', mask: true })
  try {
    const value = kind.value
    images.value =
      value === 'mixed'
        ? await renderMixedFiles({ items: placeBlanks(parseChains(text.value).problems, blankPos.value) })
        : await renderMathFiles({ kind: value, problems: parseProblems(value, text.value).problems, hint: hint.value })
    uni.hideLoading()
    await nextTick()
    scrollToFirstSheet(instance?.proxy)
    if (skipped.length) {
      setTimeout(() => {
        formTip(t('已跳过 {n} 道不适合{name}的算式：{list}', { n: skipped.length, name: t(info.value.name), list: skippedList(skipped) }))
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
    await saveSheetPdf(images.value, `uday-${kind.value}`)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <page-meta :page-style="pageBg.style" :background-color="pageBg.bg" :background-color-top="pageBg.bg" :background-color-bottom="pageBg.bg" :root-background-color="pageBg.bg" :background-text-style="pageBg.text" />
  <view class="theme-root page sub math-sheet" :class="[themeClass, { 'has-pages': images.length }]">
    <PageHeader safe show-back :title="t(info.title)" :caption="t('按 A4 排版，可保存图片或 PDF')" />

    <view class="card">
      <view class="field">
        <view class="field-head">
          <text class="field-label">{{ t('输入算式') }}</text>
          <text class="field-count">{{ t('已识别 {n} 道题', { n: parsed.problems.length }) }}</text>
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
        <textarea v-model="text" maxlength="2000" :placeholder="t(info.placeholder)" placeholder-class="ph" />
        <view class="rules">
          <text class="rules-title">{{ t('出题说明') }}</text>
          <text v-for="rule in info.rules" :key="rule" class="rule">· {{ t(rule) }}</text>
        </view>
      </view>

      <template v-if="kind === 'mixed'">
        <view class="option-group">
          <text class="option-label">{{ t('运算符') }}</text>
          <view class="option-row">
            <text
              v-for="item in MIXED_OPS"
              :key="item.value"
              class="chip press"
              :class="{ active: mixedOp === item.value }"
              hover-class="press-on"
              hover-stay-time="80"
              @click="setMixedOp(item.value)"
            >{{ t(item.label) }}</text>
          </view>
        </view>
        <view class="option-group">
          <text class="option-label">{{ t('填空位置') }}</text>
          <view class="option-row">
            <text
              v-for="item in BLANK_POSITIONS"
              :key="item.value"
              class="chip press"
              :class="{ active: blankPos === item.value }"
              hover-class="press-on"
              hover-stay-time="80"
              @click="blankPos = item.value"
            >{{ t(item.label) }}</text>
          </view>
        </view>
        <view class="mixed-preview">
          <view v-for="(sample, index) in mixedSamples" :key="index" class="sample">
            <template v-for="(token, at) in sample" :key="at">
              <view v-if="token === null" class="sample-box" />
              <text v-else class="sample-text">{{ token }}</text>
            </template>
          </view>
        </view>
      </template>
      <template v-else>
        <view class="setting">
          <text>{{ t('显示 10 的提示') }}</text>
          <switch :checked="hint" color="#ff7a45" @change="hint = Boolean($event.detail.value)" />
        </view>
        <text class="setting-note">{{ kind === 'make10' ? t('用半透明红色写出要凑成的 10') : t('用半透明红色写出要拆出的 10') }}</text>
      </template>
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
.math-sheet.has-pages { padding-bottom: calc(96px + var(--safe-bottom)); }
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
.setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 42px;
  color: var(--ink);
  font-size: 14px;
  font-weight: 650;
}
.option-group { padding-top: 14px; }
.option-label { display: block; color: var(--ink); font-size: 14px; font-weight: 650; }
.option-row { display: flex; flex-wrap: wrap; gap: 10px 10px; margin-top: 10px; }
.option-row .chip { justify-content: center; min-width: 52px; }
.mixed-preview {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 16px;
  padding: 14px 12px;
  border: 1px solid #e3e6ee;
  border-radius: 12px;
  background: #fff;
}
.sample { display: flex; flex: 1; align-items: center; justify-content: center; gap: 2px; min-width: 0; }
.sample-text { color: #2b3340; font-size: 14px; font-weight: 500; white-space: nowrap; }
.sample-box { flex: none; width: 22px; height: 17px; border: 1px solid #5b6474; box-sizing: border-box; }
.setting-note { display: block; margin-top: -4px; color: var(--muted); font-size: 11px; }
.create { margin-top: 14px; }
.preview { margin-top: 4px; }
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
