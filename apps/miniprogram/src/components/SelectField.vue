<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: string
  options: Array<{ value: string; label: string }>
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const labels = computed(() => props.options.map((item) => item.label))
const index = computed(() => Math.max(0, props.options.findIndex((item) => item.value === props.modelValue)))
const current = computed(() => props.options.find((item) => item.value === props.modelValue)?.label)

function onChange(event: { detail: { value: number | string } }) {
  const next = props.options[Number(event.detail.value)]
  if (next) emit('update:modelValue', next.value)
}
</script>

<template>
  <picker mode="selector" :range="labels" :value="index" @change="onChange">
    <view class="control press" hover-class="press-on" hover-stay-time="80">{{ current || placeholder || '请选择' }}</view>
  </picker>
</template>
