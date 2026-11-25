<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, ref, watch } from 'vue'
import { t } from '@/i18n'
import { formTip } from '@/utils/form'
import { saveSheetImages, saveSheetPdf } from '@/print/save'
import { scrollToFirstSheet } from '@/print/scroll'
import { NASAL_SAMPLE, SHEET_SAMPLE } from './labels'
import Toggle from './Toggle.vue'
import WordInput from './WordInput.vue'
import { countPages, MAX_PAGES, renderPinyinFiles } from './render'
import { nasalItems, parseWords, SHEET_KINDS, type PinyinSheetKind } from './worksheet'

const instance = getCurrentInstance()

const text = ref('')
const kind = ref<PinyinSheetKind>('mixed')
const answers = ref(true)
const images = ref<string[]>([])
const rendering = ref(false)
const saving = ref(false)

const words = computed(() => parseWords(text.value))
const nasal = computed(() => nasalItems(words.value))
const itemCount = computed(() => (kind.value === 'nasal' ? nasal.value.length : words.value.length))

watch([text, kind, answers], () => {
  images.value = []
})

function useDictation() {
  const saved = uni.getStorageSync('uday-pinyin-dictation-v1') as { text?: string } | ''
  if (!saved || !saved.text?.trim()) {
    formTip('听写里还没有题目')
    return
  }
  text.value = saved.text
}

const SAMPLE = SHEET_SAMPLE
const sampleKinds = computed(() => (kind.value === 'mixed' ? (['write', 'note', 'tone'] as const) : ([kind.value] as const)))
/** 随机时三种各给一个字，其余给整个词。 */
const sampleChars = computed(() => (kind.value === 'mixed' ? SAMPLE.chars.slice(0, 1) : SAMPLE.chars))

async function generate() {
  if (rendering.value) return
  if (!words.value.length) {
    formTip('请先输入词语，或选一组示例')
    return
  }
  if (kind.value === 'nasal' && !nasal.value.length) {
    formTip('这些词里没有前后鼻音的字')
    return
  }
  const options = { kind: kind.value, words: words.value, nasal: nasal.value, answers: answers.value }
  if (countPages(options) > MAX_PAGES) {
    formTip(t('题目太多，最多 {n} 页，请减少词语', { n: MAX_PAGES }))
    return
  }
  rendering.value = true
  uni.showLoading({ title: '正在排版…', mask: true })
  try {
    images.value = await renderPinyinFiles(options)
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
    await saveSheetPdf(images.value, 'uday-pinyin')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <view class="pinyin-print" :class="{ 'has-pages': images.length }">
    <view class="card">
      <WordInput v-model="text" :found="itemCount" :found-label="t('输入词语')" :placeholder="t('例如：春天 花朵 朋友，用空格或换行隔开')">
        <template #extra>
          <view class="from-dictation press" hover-class="press-on" hover-stay-time="80" @click="useDictation">
            <text>{{ t('用听写里的词语') }}</text>
            <text class="arrow">›</text>
          </view>
        </template>
      </WordInput>

      <view class="option-group">
        <text class="option-label">{{ t('题型') }}</text>
        <view class="option-row">
          <text v-for="item in SHEET_KINDS" :key="item.value" class="chip press" :class="{ active: kind === item.value }" hover-class="press-on" hover-stay-time="80" @click="kind = item.value">{{ t(item.label) }}</text>
        </view>
      </view>

      <view class="sample">
        <view v-if="kind !== 'nasal'" class="sample-group">
          <view v-for="piece in sampleKinds" :key="piece" class="sample-word">
            <view v-for="(char, index) in sampleChars" :key="index" class="sample-col">
              <view class="sample-strip">
                <text v-if="piece === 'write'" class="sample-py">{{ SAMPLE.marked[index] }}</text>
                <text v-else-if="piece === 'tone'" class="sample-py">{{ SAMPLE.bare[index] }}</text>
              </view>
              <view class="sample-box" :class="{ tian: piece === 'write' }">
                <text v-if="piece !== 'write'" class="sample-han">{{ char }}</text>
              </view>
            </view>
          </view>
        </view>
        <view v-else class="sample-nasal">
          <view class="sample-box tian"><text class="sample-han">{{ NASAL_SAMPLE.char }}</text></view>
          <view class="sample-options">
            <text class="sample-py" :class="{ ring: NASAL_SAMPLE.answer === 0 }">{{ NASAL_SAMPLE.options[0] }}</text>
            <text class="sample-slash">/</text>
            <text class="sample-py" :class="{ ring: NASAL_SAMPLE.answer === 1 }">{{ NASAL_SAMPLE.options[1] }}</text>
          </view>
        </view>
      </view>

      <view class="answer-switch">
        <view class="switch-copy">
          <text class="switch-name">{{ t('后面附答案页') }}</text>
          <text class="switch-sub">{{ t('家长对答案用，红色是答案') }}</text>
        </view>
        <Toggle v-model="answers" />
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
.pinyin-print.has-pages { padding-bottom: 96px; }
.option-group { margin-top: 14px; }
.option-label { display: block; margin-bottom: 8px; color: var(--ink); font-size: 14px; font-weight: 650; }
.option-row { display: flex; flex-wrap: wrap; gap: 8px; }

.sample { display: flex; justify-content: center; margin: 18px 0 6px; padding: 14px 0; border-radius: 14px; background: var(--surface-2); }
.sample-group { display: flex; gap: 14px; }
.sample-word { display: flex; gap: 6px; }
.sample-col { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.sample-strip { position: relative; display: flex; width: 64px; height: 30px; align-items: flex-end; justify-content: center; background: linear-gradient(#9db0cf, #9db0cf) 0 0 / 100% 1px no-repeat, linear-gradient(#9db0cf, #9db0cf) 0 10px / 100% 1px no-repeat, linear-gradient(#d98c8c, #d98c8c) 0 20px / 100% 1px no-repeat, linear-gradient(#9db0cf, #9db0cf) 0 29px / 100% 1px no-repeat; }
.sample-py { color: var(--ink); font-family: 'Avenir Next', 'Helvetica Neue', Arial, sans-serif; font-size: 15px; font-weight: 600; line-height: 1; transform: translateY(-9px); }
.sample-box { display: flex; width: 48px; height: 48px; box-sizing: border-box; align-items: center; justify-content: center; }
.sample-box.tian { border: 1.5px solid #7d8ba3; background: linear-gradient(90deg, transparent calc(50% - 0.5px), #c9d1de calc(50% - 0.5px), #c9d1de calc(50% + 0.5px), transparent calc(50% + 0.5px)), linear-gradient(transparent calc(50% - 0.5px), #c9d1de calc(50% - 0.5px), #c9d1de calc(50% + 0.5px), transparent calc(50% + 0.5px)); }
.sample-han { color: var(--ink); font-size: 30px; font-weight: 600; }
.sample-nasal { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.sample-options { display: flex; align-items: center; gap: 12px; }
.sample-options .sample-py { transform: none; padding: 4px 8px; }
.sample-py.ring { border: 2px solid #e5484d; border-radius: 50%; }
.sample-slash { color: var(--muted); }

.answer-switch { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 14px; padding: 10px 12px; border-radius: 14px; background: var(--surface-2); }
.switch-copy { display: flex; flex-direction: column; gap: 2px; }
.switch-name { color: var(--ink); font-size: 14px; font-weight: 650; }
.switch-sub { color: var(--muted); font-size: 11px; }
.from-dictation { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; padding: 10px 12px; border-radius: 12px; background: var(--accent-soft); color: var(--accent-text); font-size: 13px; font-weight: 700; }
.arrow { font-size: 18px; }
.create { margin-top: 16px; }
.preview { margin-top: 16px; }
.preview-title { display: block; color: var(--ink); font-size: 15px; font-weight: 750; }
.preview-tip { display: block; margin: 4px 0 10px; color: var(--muted); font-size: 12px; }
.sheet { width: 100%; margin-bottom: 12px; border-radius: 12px; }
.save-dock { position: fixed; right: 0; bottom: 0; left: 0; display: flex; gap: 10px; padding: 10px 18px calc(10px + var(--safe-bottom)); background: var(--header-bg); box-shadow: 0 -8px 24px -16px rgba(25, 31, 58, 0.4); }
.save-dock .btn { flex: 1; }
</style>
