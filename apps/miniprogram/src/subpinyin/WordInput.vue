<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import { t } from '@/i18n'
import { MAX_RANDOM, randomWords, WORD_CHOICES } from './wordpool'
import Stepper from './Stepper.vue'

/** 听写和打印题共用：按年级（和字帖同样的下拉）随机出词，也可以自己输入。 */
const props = defineProps<{ modelValue: string; placeholder: string; found: number; foundLabel: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const SAVE = 'uday-pinyin-words-v1'
const saved = (uni.getStorageSync(SAVE) || {}) as { grade?: number; count?: number }
const gradeIndex = ref(Math.min(saved.grade ?? 0, WORD_CHOICES.length - 1))
const gradeChosen = ref(saved.grade !== undefined)
const count = ref(saved.count ?? 10)
const labels = computed(() => WORD_CHOICES.map((item) => t(item.label)))
const text = computed({ get: () => props.modelValue, set: (value: string) => emit('update:modelValue', value) })
const spin = ref(0)

function save() {
  uni.setStorageSync(SAVE, { grade: gradeIndex.value, count: count.value })
}

function fill() {
  text.value = randomWords(WORD_CHOICES[gradeIndex.value].id, count.value).split(' ').join('\n')
  spin.value += 1
}

function onGrade(event: { detail: { value: string | number } }) {
  gradeIndex.value = Number(event.detail.value)
  gradeChosen.value = true
  save()
  fill()
}

function onRandom() {
  gradeChosen.value = true
  fill()
}

function setCount(value: number) {
  count.value = value
  save()
  if (gradeChosen.value) fill()
}
</script>

<template>
  <view class="word-input">
    <view class="head">
      <text class="label">{{ foundLabel }}</text>
      <text class="found" :class="{ zero: !found }">{{ t('已识别 {n} 个', { n: found }) }}</text>
    </view>
    <view class="grade-actions">
      <picker class="grade-picker" mode="selector" :range="labels" :value="gradeIndex" @change="onGrade">
        <view class="tool-btn ghost press" hover-class="press-on" hover-stay-time="80">
          <AppIcon name="book" tone="accent" :size="15" />
          <text class="grade-name">{{ labels[gradeIndex] }}</text>
          <text class="caret">▾</text>
        </view>
      </picker>
      <view class="tool-btn solid press" hover-class="press-on" hover-stay-time="80" @click="onRandom">
        <view :key="spin" class="dice"><AppIcon name="shuffle" tone="white" :size="15" /></view>
        <text>{{ t('随机生成') }}</text>
      </view>
      <view class="tool-btn clear press" hover-class="press-on" hover-stay-time="80" @click="text = ''">
        <AppIcon name="eraser" tone="ink" :size="14" />
        <text>{{ t('清空') }}</text>
      </view>
    </view>
    <textarea v-model="text" maxlength="1000" :placeholder="placeholder" placeholder-class="ph" />
    <view class="count-row">
      <text class="count-label">{{ t('随机个数') }}</text>
      <Stepper :model-value="count" :min="1" :max="MAX_RANDOM" @update:model-value="setCount" />
    </view>
    <text class="note">{{ t('可以直接修改上面的词语，用空格、逗号或换行隔开') }}</text>
    <slot name="extra" />
  </view>
</template>

<style scoped>
.head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px; }
.label { color: var(--ink); font-size: 14px; font-weight: 650; }
.found { color: var(--accent-text); font-size: 12px; font-weight: 700; }
.found.zero { color: var(--muted); font-weight: 500; }
.grade-actions { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.grade-picker { flex: 1; min-width: 0; }
.tool-btn { display: flex; align-items: center; justify-content: center; gap: 4px; height: 34px; box-sizing: border-box; padding: 0 10px; border-radius: 12px; font-size: 12px; font-weight: 700; line-height: 34px; white-space: nowrap; }
.tool-btn.ghost { width: 100%; min-width: 0; justify-content: flex-start; background: var(--surface-2); color: var(--ink); }
.tool-btn.solid { flex: none; background: linear-gradient(135deg, #ffb45c 0%, #ff7a45 48%, #f15a36 100%); color: #fff; }
.tool-btn.clear { flex: none; background: var(--surface-2); color: var(--ink); }
.grade-name { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.caret { margin-left: 2px; color: var(--muted); font-size: 11px; }
.dice { display: flex; animation: roll 0.45s cubic-bezier(0.34, 1.3, 0.64, 1); }
textarea { width: 100%; height: 120px; box-sizing: border-box; padding: 10px 12px; border-radius: 12px; background: var(--surface-2); color: var(--ink); font-size: 15px; line-height: 1.6; }
.count-row { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; color: var(--ink); font-size: 14px; font-weight: 650; }
.note { display: block; margin-top: 6px; color: var(--muted); font-size: 11px; line-height: 1.45; }
@keyframes roll {
  0% { transform: rotate(-200deg) scale(0.6); }
  100% { transform: rotate(0) scale(1); }
}
</style>
