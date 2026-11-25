<script setup lang="ts">
import { computed } from 'vue'
import { t } from '@/i18n'

/** 加减按钮。给 values 时按这一组数依次加减，否则按 min / max / step。 */
const props = withDefaults(defineProps<{ modelValue: number; min?: number; max?: number; step?: number; values?: number[]; unit?: string }>(), { min: 1, max: 99, step: 1 })
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const at = computed(() => (props.values ? Math.max(0, props.values.indexOf(props.modelValue)) : 0))
const canDown = computed(() => (props.values ? at.value > 0 : props.modelValue - props.step >= props.min))
const canUp = computed(() => (props.values ? at.value < props.values.length - 1 : props.modelValue + props.step <= props.max))

function move(direction: -1 | 1) {
  if (direction < 0 ? !canDown.value : !canUp.value) return
  emit('update:modelValue', props.values ? props.values[at.value + direction] : props.modelValue + direction * props.step)
  uni.vibrateShort({ type: 'light' })
}
</script>

<template>
  <view class="stepper">
    <text class="step press" :class="{ off: !canDown }" hover-class="press-on" hover-stay-time="80" @click="move(-1)">−</text>
    <text :key="modelValue" class="step-value bump">{{ unit ? t(unit, { n: modelValue }) : modelValue }}</text>
    <text class="step press" :class="{ off: !canUp }" hover-class="press-on" hover-stay-time="80" @click="move(1)">＋</text>
  </view>
</template>

<style scoped>
.stepper { display: flex; align-items: center; gap: 8px; }
.step { width: 32px; height: 32px; border-radius: 10px; background: var(--surface-2); color: var(--ink); font-size: 18px; line-height: 32px; text-align: center; transition: opacity 0.2s ease; }
.step.off { opacity: 0.35; }
.step-value { min-width: 44px; color: var(--ink); font-size: 15px; font-weight: 750; text-align: center; }
.bump { animation: bump 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes bump {
  0% { transform: scale(0.8); opacity: 0.5; }
  100% { transform: scale(1); opacity: 1; }
}
</style>
