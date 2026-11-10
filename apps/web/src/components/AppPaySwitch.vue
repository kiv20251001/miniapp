<script setup lang="ts">
defineProps<{
  modelValue: boolean
  disabled?: boolean
  ariaLabel?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

function toggle(current: boolean, disabled?: boolean) {
  if (disabled) return
  emit('update:modelValue', !current)
}
</script>

<template>
  <button
    class="pay-switch"
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :disabled="disabled"
    :aria-label="ariaLabel ?? (modelValue ? '已支付' : '未支付')"
    @click="toggle(modelValue, disabled)"
  >
    <i />
  </button>
</template>

<style scoped>
.pay-switch {
  position: relative;
  width: 48px;
  height: 30px;
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: var(--track);
  transition: background-color .2s ease;
}
.pay-switch[aria-checked="true"] { background: #2f9d70; }
.pay-switch i {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 6px rgba(28, 22, 48, .2);
  transition: transform .2s ease;
}
.pay-switch[aria-checked="true"] i { transform: translateX(18px); }
.pay-switch:disabled { opacity: .55; }
</style>
