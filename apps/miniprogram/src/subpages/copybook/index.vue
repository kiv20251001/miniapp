<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, ref, watch } from 'vue'
import { onReady, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { TOOL_SHARE_TITLES, toolMoments, toolShare, useSearchTitle } from '@/utils/share'
import { useFamilyPage } from '@/composables/useFamilyPage'
import { usePageBackground, useThemePage } from '@/utils/wx-theme'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import { t } from '@/i18n'
import { formTip } from '@/utils/form'
import { GRADE_CHOICES, randomGradeText } from './grades'
import { englishWords, isEnglishText, layoutSheet, MAX_PAGES, type GridStyle } from './render'
import { renderSheetFiles } from './export'
import { bindKaiCanvas, kaiFontIssue, loadKaiFont } from './font'
import { saveSheetImages, saveSheetPdf } from '@/print/save'
import { scrollToFirstSheet } from '@/print/scroll'

useFamilyPage()
const themeClass = useThemePage()
onShareAppMessage(() => toolShare('copybook', '/subpages/copybook/index'))
onShareTimeline(() => toolMoments('copybook'))
useSearchTitle(() => t(TOOL_SHARE_TITLES.copybook))
const pageBg = usePageBackground()
const instance = getCurrentInstance()
const MAX_SLOTS = 12
bindKaiCanvas(() => new Promise((resolve) => {
  const ask = (left: number) => {
    uni.createSelectorQuery().in(instance?.proxy).select('#kai-sheet').fields({ node: true, size: true }, () => {}).exec((res) => {
      const node = (res?.[0] as { node?: { width: number; height: number; getContext: (kind: '2d') => unknown } } | undefined)?.node ?? null
      if (node || left <= 0) resolve(node as never)
      else setTimeout(() => ask(left - 1), 80)
    })
  }
  ask(8)
}))
onReady(() => { loadKaiFont() })

const STYLES: Array<{ value: GridStyle; label: string }> = [
  { value: 'tian', label: '田字格' },
  { value: 'mi', label: '米字格' },
  { value: 'line', label: '四线格' },
]

const text = ref('')
const gradeIndex = ref(0)
const gradeLabels = computed(() => GRADE_CHOICES.map((item) => t(item.label)))
const style = ref<GridStyle>('tian')
const traceCount = ref(2)
const practiceCount = ref(3)
const columns = ref<1 | 2>(2)
const withPinyin = ref(true)
const depth = ref(30)
const images = ref<string[]>([])
const rendering = ref(false)
const saving = ref(false)

const previewGroups = computed(() => {
  const samples = columns.value === 2
    ? [
        { char: '\u591a', reading: 'du\u014d' },
        { char: '\u7c73', reading: 'm\u01d0' },
      ]
    : [{ char: '\u591a', reading: 'du\u014d' }]
  const perRow = columns.value === 2 ? 6 : 12
  const cells = [
    ...Array.from({ length: traceCount.value }, (_, index) => ({ index, trace: true })),
    ...Array.from({ length: practiceCount.value }, (_, index) => ({ index: traceCount.value + index, trace: false })),
  ].slice(0, perRow)
  return samples.map((sample) => ({ ...sample, cells }))
})
const traceColor = computed(() => `rgba(23, 130, 74, ${depth.value / 100})`)
function previewCellWidth() {
  const perRow = columns.value === 2 ? 6 : 12
  const shown = Math.min(perRow, Math.max(1, traceCount.value + practiceCount.value))
  const gutter = columns.value === 2 ? 18 : 0
  const group = (320 - gutter) / columns.value
  return (group - (shown - 1) * 3) / shown
}
const previewFont = computed(() => {
  const scale = style.value === 'line' ? 0.42 : 0.62
  return `${Math.max(11, Math.round(previewCellWidth() * scale))}px`
})
const previewPy = computed(() => `${Math.max(8, Math.round(previewCellWidth() * 0.29))}px`)

const english = computed(() => isEnglishText(text.value))
/** 英文预览：取输入的前一两个单词，范字一遍、临摹几遍，书写留空位。 */
const previewWords = computed(() => {
  const words = englishWords(text.value)
  const picked = columns.value === 2 ? [words[0] ?? 'good', words[1] ?? 'day'] : [words[0] ?? 'good']
  const count = 1 + traceCount.value + practiceCount.value
  return picked.map((word, group) => ({
    key: `${group}-${word}`,
    slots: Array.from({ length: count }, (_, index) => ({
      index,
      text: word,
      kind: index === 0 ? 'model' : index <= traceCount.value ? 'trace' : 'blank',
    })),
  }))
})

const options = computed(() => ({
  text: text.value,
  style: style.value,
  traceCount: traceCount.value,
  practiceCount: practiceCount.value,
  columns: columns.value,
  pinyin: !english.value && style.value !== 'line' && withPinyin.value,
  alpha: depth.value / 100,
}))

watch(options, () => {
  images.value = []
})

function step(target: 'trace' | 'practice', delta: number) {
  const nextTrace = traceCount.value + (target === 'trace' ? delta : 0)
  const nextPractice = practiceCount.value + (target === 'practice' ? delta : 0)
  if (nextTrace < 0 || nextPractice < 0) return
  if (nextTrace + nextPractice > MAX_SLOTS || nextTrace + nextPractice < 1) return
  traceCount.value = nextTrace
  practiceCount.value = nextPractice
}

function setColumns(next: 1 | 2) {
  if (columns.value === next) return
  columns.value = next
  if (next === 1) {
    traceCount.value = 3
    practiceCount.value = 9
  } else {
    traceCount.value = 2
    practiceCount.value = 3
  }
}

function clearText() {
  text.value = ''
}

function onGrade(event: { detail: { value: string | number } }) {
  gradeIndex.value = Number(event.detail.value)
}

function fillGrade() {
  text.value = randomGradeText(GRADE_CHOICES[gradeIndex.value].id, 20)
}

async function generate() {
  if (rendering.value) return
  const sheet = options.value
  const glyphs = Array.from(sheet.text).filter((char) => !/\s/u.test(char))
  if (!glyphs.length) {
    const confirmed = await new Promise<boolean>((resolve) => {
      uni.showModal({
        content: t('还没有输入要生成的内容，确定生成空白的格子本吗？'),
        success: (result) => resolve(Boolean(result.confirm)),
        fail: () => resolve(false),
      })
    })
    if (!confirmed) return
  }
  if (glyphs.length > 200) {
    formTip('文字太长，请缩短后再生成')
    return
  }
  const pages = layoutSheet(sheet)
  if (pages.length > MAX_PAGES) {
    formTip(t('内容大约 {n} 页，一次最多 {max} 页，请缩短文字', { n: pages.length, max: MAX_PAGES }))
    return
  }
  rendering.value = true
  uni.showLoading({ title: '正在加载楷体…', mask: true })
  try {
    if (!english.value && !(await loadKaiFont())) {
      uni.hideLoading()
      console.warn('[copybook] kai font', kaiFontIssue)
      const goOn = await new Promise<boolean>((resolve) => {
        uni.showModal({
          title: t('这次没能用上楷体'),
          content: t('手机上没能把楷体画进字帖，打出来会是系统字体，不适合描红。想用楷体，请用电脑版微信打开这个小程序再生成。'),
          confirmText: t('继续生成'),
          cancelText: t('先不生成'),
          success: (result) => resolve(Boolean(result.confirm)),
          fail: () => resolve(false),
        })
      })
      if (!goOn) return
    }
    uni.showLoading({ title: '正在排版…', mask: true })
    images.value = await renderSheetFiles(sheet)
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
    await saveSheetPdf(images.value)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <page-meta :page-style="pageBg.style" :background-color="pageBg.bg" :background-color-top="pageBg.bg" :background-color-bottom="pageBg.bg" :root-background-color="pageBg.bg" :background-text-style="pageBg.text" />
  <view class="theme-root page sub copybook" :class="[themeClass, { 'has-pages': images.length }]">
    <PageHeader safe show-back :title="t('字帖生成')" :caption="t('按 A4 排版，可保存图片或 PDF')" />
    <canvas id="kai-sheet" type="2d" class="kai-sheet" />

    <view class="card">
      <view class="field">
        <text class="field-label">{{ t('要练习的文字') }}</text>
        <view class="grade-actions">
          <picker class="grade-picker" mode="selector" :range="gradeLabels" :value="gradeIndex" @change="onGrade">
            <view class="tool-btn ghost press" hover-class="press-on" hover-stay-time="80">
              <AppIcon name="book" tone="accent" :size="15" />
              <text class="grade-name">{{ gradeLabels[gradeIndex] }}</text>
              <text class="caret">▾</text>
            </view>
          </picker>
          <view class="tool-btn solid press" hover-class="press-on" hover-stay-time="80" @click="fillGrade">
            <AppIcon name="shuffle" tone="white" :size="15" />
            <text>{{ t('随机生成') }}</text>
          </view>
          <view class="tool-btn clear press" hover-class="press-on" hover-stay-time="80" @click="clearText">
            <AppIcon name="eraser" tone="ink" :size="14" />
            <text>{{ t('清空') }}</text>
          </view>
        </view>
        <textarea v-model="text" maxlength="200" :placeholder="t('请输入要练习的生字：例如天地人上中下多米要开心……')" placeholder-class="ph" />
        <text class="grade-note">{{ t('支持手动输入或修改需要生成的内容，也可以输入英文，按空格分成单词') }}</text>
      </view>

      <view class="setting">
        <text>{{ t('临摹') }}</text>
        <view class="stepper">
          <text class="step press" hover-class="press-on" hover-stay-time="80" @click="step('trace', -1)">−</text>
          <text class="step-value">{{ traceCount }}</text>
          <text class="step press" hover-class="press-on" hover-stay-time="80" @click="step('trace', 1)">＋</text>
        </view>
      </view>
      <view class="setting">
        <text>{{ t('书写') }}</text>
        <view class="stepper">
          <text class="step press" hover-class="press-on" hover-stay-time="80" @click="step('practice', -1)">−</text>
          <text class="step-value">{{ practiceCount }}</text>
          <text class="step press" hover-class="press-on" hover-stay-time="80" @click="step('practice', 1)">＋</text>
        </view>
      </view>
      <view class="setting">
        <text>{{ t('排版') }}</text>
        <view class="chip-row tight">
          <text class="chip press" :class="{ active: columns === 1 }" @click="setColumns(1)">{{ t('单列') }}</text>
          <text class="chip press" :class="{ active: columns === 2 }" @click="setColumns(2)">{{ t('双列') }}</text>
        </view>
      </view>
      <view v-if="!english && style !== 'line'" class="setting">
        <text>{{ t('拼音') }}</text>
        <switch :checked="withPinyin" color="#ff7a45" @change="withPinyin = Boolean($event.detail.value)" />
      </view>
      <view class="setting depth">
        <text>{{ t('透明度') }} {{ depth }}%</text>
        <slider :value="depth" min="10" max="80" activeColor="#ff7a45" backgroundColor="#e6e8f0" block-size="18" @change="depth = Number($event.detail.value)" />
      </view>
      <view v-if="english" class="setting">
        <text>{{ t('格子') }}</text>
        <text class="english-note">{{ t('英文单词使用四线格') }}</text>
      </view>
      <view v-else class="setting">
        <text>{{ t('格子') }}</text>
        <view class="chip-row tight">
          <text
            v-for="item in STYLES"
            :key="item.value"
            class="chip press"
            :class="{ active: style === item.value }"
            hover-class="press-on"
            hover-stay-time="80"
            @click="style = item.value"
          >{{ t(item.label) }}</text>
        </view>
      </view>
      <view v-if="english" class="row-preview words" :class="{ split: columns === 2 }">
        <view v-for="group in previewWords" :key="group.key" class="word-staff">
          <view class="word-line solid top" />
          <view class="word-line dash mid" />
          <view class="word-line dash base" />
          <view class="word-line solid bottom" />
          <view class="word-row">
            <text
              v-for="slot in group.slots"
              :key="slot.index"
              class="word-text"
              :class="slot.kind"
              :style="slot.kind === 'trace' ? { color: traceColor } : undefined"
            >{{ slot.text }}</text>
          </view>
        </view>
      </view>
      <view v-else class="row-preview" :class="{ lines: style === 'line', split: columns === 2 }">
        <view v-for="group in previewGroups" :key="group.char" class="preview-group">
          <view class="preview-cells">
            <view v-for="cell in group.cells" :key="cell.index" class="preview-slot">
              <view v-if="style !== 'line' && withPinyin" class="mini-band">
                <view class="band-line upper" />
                <view class="band-line base" />
                <text v-if="cell.trace" class="mini-py" :style="{ color: traceColor, fontSize: previewPy }">{{ group.reading }}</text>
              </view>
              <view class="mini-face" :class="style">
                <view v-if="style !== 'line'" class="guide cross" />
                <view v-if="style === 'mi'" class="guide diag" />
                <view v-if="style === 'line'" class="staff-lines">
                  <view class="staff solid" />
                  <view class="staff dash" />
                  <view class="staff dash" />
                  <view class="staff solid" />
                </view>
                <text v-if="cell.trace" class="mini-char" :style="{ color: traceColor, fontSize: previewFont }">{{ group.char }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
      <button hover-class="press-on" hover-stay-time="80" class="btn block create" :disabled="rendering" @click="generate">{{ t('生成字帖') }}</button>
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
.copybook.has-pages { padding-bottom: calc(96px + var(--safe-bottom)); }
.row-preview { display: flex; margin: 10px 0 14px; }
.row-preview.split { gap: 16px; }
.preview-group { flex: 1; min-width: 0; }
.preview-cells { display: flex; gap: 3px; }
.preview-slot { flex: 1; min-width: 0; }
.mini-band {
  position: relative;
  height: 0;
  padding-bottom: 46%;
  margin-bottom: 1px;
  border: 1px solid #7d8798;
  overflow: hidden;
}
.band-line {
  position: absolute;
  left: 2px;
  right: 2px;
  border-top: 1px dashed #b7c0ce;
}
.band-line.upper { top: 33.3%; }
.band-line.base { top: 66.7%; }
.mini-py {
  position: absolute;
  left: 0;
  right: 0;
  top: 66.7%;
  transform: translateY(-78%);
  text-align: center;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
}
.mini-face {
  position: relative;
  height: 0;
  padding-bottom: 100%;
  border: 1px solid #7d8798;
  border-radius: 2px;
  overflow: hidden;
}
.row-preview.lines .mini-face { padding-bottom: 64%; border-color: transparent; }
.mini-char {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  text-align: center;
  font-family: UdayKai, STKaiti, "Kaiti SC", KaiTi, "\6977\4f53", "\6977\4f53_GB2312", serif;
  line-height: 1;
}
.guide { position: absolute; inset: 2px; pointer-events: none; }
.guide.cross {
  background:
    linear-gradient(#c5ccd6, #c5ccd6) center / 1px 100% no-repeat,
    linear-gradient(#c5ccd6, #c5ccd6) center / 100% 1px no-repeat;
}
.guide.diag {
  background:
    linear-gradient(to top right, transparent calc(50% - 0.6px), #c5ccd6, transparent calc(50% + 0.6px)),
    linear-gradient(to top left, transparent calc(50% - 0.6px), #c5ccd6, transparent calc(50% + 0.6px));
}
.staff-lines { position: absolute; inset: 2px 0; display: flex; flex-direction: column; justify-content: space-between; }
.staff { height: 0; border-top: 1px solid #7d8798; }
.staff.dash { border-top-style: dashed; border-top-color: #c5ccd6; }
.word-staff { position: relative; flex: 1; min-width: 0; height: 40px; overflow: hidden; }
.word-line { position: absolute; left: 0; right: 0; height: 0; border-top: 1px solid #7d8798; }
.word-line.dash { border-top-style: dashed; border-top-color: #c5ccd6; }
.word-line.top { top: 2px; }
.word-line.mid { top: 14px; }
.word-line.base { top: 26px; }
.word-line.bottom { top: 38px; }
.word-row { position: absolute; top: 8px; left: 4px; display: flex; white-space: nowrap; }
.word-text {
  flex: none;
  margin-right: 18px;
  color: #1c2430;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 23px;
  line-height: 23px;
}
.word-text.blank { visibility: hidden; }
.english-note { color: var(--muted); font-size: 12px; font-weight: 500; }
.grade-actions { display: flex; align-items: center; gap: 8px; }
.grade-picker { flex: 1; min-width: 0; }
.tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 34px;
  border-radius: 12px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 700;
  line-height: 34px;
  white-space: nowrap;
  box-sizing: border-box;
}
.tool-btn.ghost {
  width: 100%;
  min-width: 0;
  justify-content: flex-start;
  background: var(--surface-2);
  color: var(--ink);
}
.tool-btn.solid {
  flex: none;
  background: linear-gradient(135deg, #ffb45c 0%, #ff7a45 48%, #f15a36 100%);
  color: #fff;
}
.tool-btn.clear {
  flex: none;
  padding: 0 10px;
  background: var(--surface-2);
  color: var(--ink);
}
.grade-name { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.caret { margin-left: 2px; color: var(--muted); font-size: 11px; }
.grade-note { color: var(--muted); font-size: 11px; line-height: 1.45; }
.create { margin-top: 8px; }
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
.setting.depth { align-items: center; }
.setting slider { flex: 1; margin: 0; }
.chip-row.tight { flex-wrap: nowrap; gap: 6px; }
.stepper { display: flex; align-items: center; gap: 8px; }
.step {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: var(--surface-2);
  color: var(--ink);
  font-size: 18px;
  line-height: 32px;
  text-align: center;
}
.step-value { min-width: 18px; text-align: center; }
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
.kai-sheet { position: fixed; left: 0; top: -8px; width: 1px; height: 1px; pointer-events: none; }
</style>
