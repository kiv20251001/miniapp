<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function onChange(event: { detail: { value: string } }) {
  emit('update:modelValue', event.detail.value)
}
</script>

<template>
  <picker mode="date" :value="modelValue" @change="onChange">
    <view class="control press" hover-class="press-on" hover-stay-time="80">{{ modelValue || placeholder || '选择日期' }}</view>
  </picker>
</template>
