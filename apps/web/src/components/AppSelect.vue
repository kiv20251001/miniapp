<script setup lang="ts">
import { computed, ref } from 'vue'

export interface SelectOption {
  value: string
  label: string
  caption?: string
}

const props = defineProps<{
  modelValue: string
  options: SelectOption[]
  ariaLabel?: string
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const open = ref(false)
const selected = computed(() => props.options.find((item) => item.value === props.modelValue))

function choose(value: string) {
  emit('update:modelValue', value)
  open.value = false
}
</script>

<template>
  <div class="app-select">
    <button class="select-trigger" type="button" :aria-label="ariaLabel" :aria-expanded="open" :disabled="disabled" @click="open = !open">
      <span>{{ selected?.label ?? '请选择' }}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
    </button>
    <Transition name="select-menu">
      <div v-if="open" class="select-popover">
        <button
          v-for="option in options"
          :key="option.value"
          type="button"
          :class="{ active: option.value === modelValue }"
          @click="choose(option.value)"
        >
          <span><b>{{ option.label }}</b><small v-if="option.caption">{{ option.caption }}</small></span>
          <svg v-if="option.value === modelValue" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12 4 4 8-9" /></svg>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.app-select { position: relative; }
.select-trigger {
  display: grid;
  width: 100%;
  min-height: 47px;
  grid-template-columns: minmax(0, 1fr) 20px;
  align-items: center;
  gap: 10px;
  padding: 0 13px;
  color: var(--ink);
  text-align: left;
  border: 0;
  border-radius: 14px;
  background: var(--paper);
  box-shadow: inset 0 0 0 1px var(--line), var(--elev-sm);
}
.select-trigger span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.select-trigger svg { width: 18px; fill: none; stroke: var(--muted); stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; transition: transform .2s ease; }
.select-trigger[aria-expanded="true"] svg { transform: rotate(180deg); }
.select-trigger:disabled { cursor: not-allowed; opacity: .62; }
.select-popover {
  position: absolute;
  z-index: 40;
  top: calc(100% + 6px);
  right: 0;
  left: 0;
  overflow: hidden;
  padding: 6px;
  border: 0;
  border-radius: 16px;
  background: var(--paper);
  box-shadow: var(--elev-lg), var(--glow-top);
}
.select-popover button {
  display: grid;
  width: 100%;
  min-height: 42px;
  grid-template-columns: minmax(0, 1fr) 18px;
  align-items: center;
  gap: 8px;
  padding: 7px 9px;
  color: var(--ink);
  text-align: left;
  border: 0;
  border-radius: 11px;
  background: transparent;
}
.select-popover button.active { color: var(--accent-text); background: var(--accent-soft); }
.select-popover button span { display: grid; gap: 2px; }
.select-popover button b { font-size: 12px; }
.select-popover button small { color: var(--muted); font-size: 9px; }
.select-popover button > svg { width: 17px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2; }
.select-menu-enter-active, .select-menu-leave-active { transition: opacity .16s ease, transform .16s ease; transform-origin: top; }
.select-menu-enter-from, .select-menu-leave-to { opacity: 0; transform: translateY(-4px) scale(.98); }
</style>
