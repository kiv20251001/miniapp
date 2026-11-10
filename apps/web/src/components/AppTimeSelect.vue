<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { TimeSlotOption } from '@/services/schedule'

const props = defineProps<{
  modelValue: string
  options: TimeSlotOption[]
  ariaLabel?: string
  placement?: 'top' | 'bottom'
  showLegend?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const open = ref(false)
const draft = ref(props.modelValue)
const hourListEl = ref<HTMLElement | null>(null)
const minuteListEl = ref<HTMLElement | null>(null)

const current = computed(() => props.options.find((item) => item.value === props.modelValue))
const invalid = computed(() => Boolean(props.modelValue) && Boolean(current.value?.disabled))
const draftOption = computed(() => props.options.find((item) => item.value === draft.value))
const draftDisabled = computed(() => Boolean(draftOption.value?.disabled))

const hourGroups = computed(() => {
  const map = new Map<string, TimeSlotOption[]>()
  for (const option of props.options) {
    const hour = option.value.slice(0, 2)
    const list = map.get(hour) ?? []
    list.push(option)
    map.set(hour, list)
  }
  return [...map.entries()].map(([hour, slots]) => ({
    hour,
    slots,
    disabled: slots.every((slot) => slot.disabled),
  }))
})

const selectedHour = computed(() => draft.value.slice(0, 2))
const selectedMinute = computed(() => draft.value.slice(3, 5))
const minuteSlots = computed(() =>
  hourGroups.value.find((group) => group.hour === selectedHour.value)?.slots ?? [],
)

function firstEnabled() {
  return props.options.find((item) => !item.disabled)?.value ?? props.modelValue
}

function show() {
  draft.value = props.modelValue || firstEnabled()
  open.value = true
}

function hide() {
  open.value = false
}

function chooseHour(hour: string) {
  const slots = hourGroups.value.find((group) => group.hour === hour)?.slots ?? []
  const sameMinute = slots.find((slot) => slot.value.endsWith(`:${selectedMinute.value}`) && !slot.disabled)
  const firstFree = slots.find((slot) => !slot.disabled)
  draft.value = sameMinute?.value ?? firstFree?.value ?? `${hour}:${selectedMinute.value || '00'}`
}

function chooseMinute(option: TimeSlotOption) {
  if (option.disabled) return
  draft.value = option.value
}

function confirm() {
  if (!draft.value || draftDisabled.value) return
  emit('update:modelValue', draft.value)
  hide()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) hide()
}

function scrollSelected() {
  const hourButton = hourListEl.value?.querySelector<HTMLElement>('[data-active="true"]')
  const minuteButton = minuteListEl.value?.querySelector<HTMLElement>('[data-active="true"]')
  hourButton?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  minuteButton?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

watch(open, async (isOpen) => {
  document.body.style.overflow = isOpen ? 'hidden' : ''
  if (isOpen) {
    document.addEventListener('keydown', onKeydown)
    await nextTick()
    scrollSelected()
    return
  }
  document.removeEventListener('keydown', onKeydown)
})

watch(() => props.modelValue, (value) => {
  if (!open.value) draft.value = value
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="time-select">
    <button
      class="time-trigger"
      :class="{ invalid }"
      type="button"
      :aria-label="ariaLabel"
      :aria-expanded="open"
      @click="show"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.4" /><path d="M12 7.4V12l3.3 2" /></svg>
      <span>{{ modelValue || '选择时间' }}</span>
      <b>⌄</b>
    </button>

    <Teleport to="body">
      <Transition name="time-sheet">
        <div v-if="open" class="time-backdrop" @click.self="hide">
          <section class="time-sheet" role="dialog" aria-modal="true" :aria-label="ariaLabel || '选择时间'">
            <i class="sheet-handle" />
            <header>
              <p>{{ ariaLabel || '选择时间' }}</p>
              <strong :class="{ invalid: draftDisabled }">{{ draft || '--:--' }}</strong>
              <small v-if="draftOption?.caption">{{ draftOption.caption }}</small>
            </header>

            <div class="wheels" role="group" :aria-label="ariaLabel || '选择时间'">
              <div class="wheel">
                <span>时</span>
                <div ref="hourListEl" class="wheel-list">
                  <button
                    v-for="group in hourGroups"
                    :key="group.hour"
                    type="button"
                    :data-active="group.hour === selectedHour"
                    :class="{ active: group.hour === selectedHour }"
                    :disabled="group.disabled"
                    @click="chooseHour(group.hour)"
                  >{{ group.hour }}</button>
                </div>
              </div>
              <em>:</em>
              <div class="wheel">
                <span>分</span>
                <div ref="minuteListEl" class="wheel-list">
                  <button
                    v-for="option in minuteSlots"
                    :key="option.value"
                    type="button"
                    :data-active="option.value === draft"
                    :class="{ active: option.value === draft }"
                    :disabled="option.disabled"
                    :title="option.caption"
                    @click="chooseMinute(option)"
                  >{{ option.value.slice(3) }}</button>
                </div>
              </div>
            </div>

            <p v-if="showLegend !== false" class="time-legend">灰色时间已被占用，无法选择。</p>

            <div class="sheet-actions">
              <button class="sheet-cancel" type="button" @click="hide">取消</button>
              <button class="sheet-done" type="button" :disabled="!draft || draftDisabled" @click="confirm">确定</button>
            </div>
          </section>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.time-select {
  position: relative;
}

.time-trigger {
  display: grid;
  width: 100%;
  min-height: 47px;
  grid-template-columns: 18px minmax(0, 1fr) 14px;
  align-items: center;
  gap: 9px;
  padding: 0 13px;
  color: var(--ink);
  text-align: left;
  border: 0;
  border-radius: 14px;
  background: var(--paper);
  box-shadow: inset 0 0 0 1px var(--line), var(--elev-sm);
}

.time-trigger.invalid {
  color: #c2483c;
  box-shadow: inset 0 0 0 1.5px color-mix(in srgb, #d9503f 55%, var(--line));
}

.time-trigger svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: var(--accent-text);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.time-trigger b {
  color: var(--muted);
  font-size: 12px;
}

.time-backdrop {
  position: fixed;
  z-index: 1400;
  inset: 0;
  display: grid;
  padding: 18px;
  align-items: end;
  background: rgba(29, 33, 43, .38);
  backdrop-filter: blur(6px);
}

.time-sheet {
  width: min(100%, 444px);
  margin: 0 auto;
  padding: 8px 18px 16px;
  color: var(--ink);
  border: 0;
  border-radius: 26px;
  background: var(--paper);
  box-shadow: var(--elev-lg), var(--glow-top);
}

.sheet-handle {
  display: block;
  width: 36px;
  height: 4px;
  margin: 6px auto 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ink) 12%, transparent);
}

.time-sheet header {
  display: grid;
  gap: 4px;
  margin-bottom: 14px;
  text-align: center;
}

.time-sheet header p {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}

.time-sheet header strong {
  font-size: 32px;
  font-variant-numeric: tabular-nums;
  letter-spacing: .04em;
  line-height: 1.1;
}

.time-sheet header strong.invalid {
  color: #c2483c;
}

.time-sheet header small {
  color: #c2483c;
  font-size: 12px;
}

.wheels {
  display: grid;
  grid-template-columns: 1fr 16px 1fr;
  align-items: stretch;
  gap: 8px;
  min-height: 220px;
  padding: 8px;
  border-radius: 20px;
  background: color-mix(in srgb, var(--ink) 4%, var(--paper));
}

.wheel {
  display: grid;
  grid-template-rows: auto 1fr;
  min-width: 0;
}

.wheel > span {
  margin-bottom: 6px;
  color: var(--muted);
  text-align: center;
  font-size: 11px;
}

.wheel-list {
  display: grid;
  align-content: start;
  gap: 4px;
  max-height: 196px;
  overflow: auto;
  padding: 4px 2px;
  scroll-snap-type: y proximity;
}

.wheel-list button {
  min-height: 42px;
  color: var(--ink);
  border: 0;
  border-radius: 13px;
  background: transparent;
  font-size: 20px;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  scroll-snap-align: center;
}

.wheel-list button.active {
  color: #fff;
  background: var(--accent-gradient);
  box-shadow: 0 10px 18px -10px rgba(255, 122, 69, .75);
}

.wheel-list button:disabled {
  color: color-mix(in srgb, var(--muted) 70%, transparent);
  text-decoration: line-through;
  cursor: not-allowed;
}

.wheel-list button.active:disabled {
  color: #fff;
  background: color-mix(in srgb, #c2483c 82%, #8a2d24);
  box-shadow: none;
}

.wheels > em {
  align-self: center;
  color: var(--muted);
  font-size: 28px;
  font-style: normal;
  font-weight: 700;
  text-align: center;
}

.time-legend {
  margin: 12px 2px 0;
  color: var(--muted);
  text-align: center;
  font-size: 11px;
}

.sheet-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 14px;
}

.sheet-cancel,
.sheet-done {
  min-height: 46px;
  border: 0;
  border-radius: 14px;
  font-weight: 700;
}

.sheet-cancel {
  color: var(--muted);
  background: var(--bg);
}

.sheet-done {
  color: #fff;
  background: var(--accent-gradient);
}

.sheet-done:disabled {
  opacity: .45;
}

.time-sheet-enter-active,
.time-sheet-leave-active {
  transition: opacity .22s ease;
}

.time-sheet-enter-active .time-sheet,
.time-sheet-leave-active .time-sheet {
  transition: transform .22s ease;
}

.time-sheet-enter-from,
.time-sheet-leave-to {
  opacity: 0;
}

.time-sheet-enter-from .time-sheet,
.time-sheet-leave-to .time-sheet {
  transform: translateY(28px);
}
</style>
