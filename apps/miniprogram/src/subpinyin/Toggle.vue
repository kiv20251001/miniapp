<script setup lang="ts">
defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <view class="switch press" :class="{ on: modelValue }" @click="emit('update:modelValue', !modelValue)">
    <view class="knob" />
  </view>
</template>

<style scoped>
.switch { position: relative; width: 48px; height: 28px; flex: none; border-radius: 14px; background: var(--track); transition: background 0.25s ease; }
.switch.on { background: linear-gradient(135deg, #ffb45c, #ff7a45); }
.knob { position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2); transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.switch.on .knob { transform: translateX(20px); }
</style>
