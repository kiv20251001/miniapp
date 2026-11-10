<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'

const props = withDefaults(defineProps<{
  modelValue: string | string[]
  mode?: 'date' | 'month'
  multiple?: boolean
  ariaLabel?: string
}>(), {
  mode: 'date',
  multiple: false,
  ariaLabel: '选择日期',
})

const emit = defineEmits<{ 'update:modelValue': [value: string | string[]] }>()
const open = ref(false)
const cursor = ref(dayjs(anchorDate(props.modelValue) || undefined))

function asDates(value: string | string[]) {
  if (Array.isArray(value)) return [...value].filter(Boolean).sort()
  return value ? [value] : []
}

function anchorDate(value: string | string[]) {
  const dates = asDates(value)
  return dates[dates.length - 1] ?? ''
}

watch(() => props.modelValue, (value) => {
  const key = props.mode === 'month' && typeof value === 'string'
    ? `${value}-01`
    : anchorDate(value)
  if (key) cursor.value = dayjs(key)
})

const displayValue = computed(() => {
  if (props.mode === 'month' && typeof props.modelValue === 'string') {
    if (!props.modelValue) return '选择账期'
    return dayjs(`${props.modelValue}-01`).format('YYYY年M月')
  }
  const dates = asDates(props.modelValue)
  if (!dates.length) return '选择日期'
  const first = dayjs(dates[0])
  const last = dayjs(dates[dates.length - 1])
  if (dates.length === 1) return first.format('YYYY年M月D日')
  if (first.isSame(last, 'year')) return `${first.format('YYYY年M月D日')}–${last.format('M月D日')}`
  return `${first.format('YYYY年M月D日')}–${last.format('YYYY年M月D日')}`
})

const selectedSet = computed(() => new Set(asDates(props.modelValue)))

const calendarDays = computed(() => {
  const start = cursor.value.startOf('month').startOf('week')
  return Array.from({ length: 42 }, (_, index) => start.add(index, 'day'))
})

function show() {
  const key = props.mode === 'month' && typeof props.modelValue === 'string'
    ? `${props.modelValue || dayjs().format('YYYY-MM')}-01`
    : anchorDate(props.modelValue)
  cursor.value = dayjs(key || undefined)
  open.value = true
}

function chooseDate(value: dayjs.Dayjs) {
  const key = value.format('YYYY-MM-DD')
  if (!props.multiple) {
    emit('update:modelValue', key)
    open.value = false
    return
  }
  const next = asDates(props.modelValue)
  const index = next.indexOf(key)
  if (index >= 0) next.splice(index, 1)
  else next.push(key)
  emit('update:modelValue', next.sort())
}

function chooseMonth(month: number) {
  const value = cursor.value.month(month)
  emit('update:modelValue', value.format('YYYY-MM'))
  open.value = false
}

function isSelected(day: dayjs.Dayjs) {
  if (props.mode === 'month') return false
  if (props.multiple) return selectedSet.value.has(day.format('YYYY-MM-DD'))
  return day.format('YYYY-MM-DD') === props.modelValue
}
</script>

<template>
  <div class="date-picker">
    <button class="date-trigger" type="button" :aria-label="ariaLabel" @click="show">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="5.5" width="16" height="14" rx="3" />
        <path d="M8 3.5v4M16 3.5v4M4 10h16" />
      </svg>
      <span>{{ displayValue }}</span>
      <b>⌄</b>
    </button>

    <Teleport to="body">
      <Transition name="picker">
        <div v-if="open" class="picker-backdrop" @click.self="open = false">
          <section class="picker-sheet" role="dialog" aria-modal="true" :aria-label="ariaLabel">
            <header>
              <button type="button" aria-label="上一周期" @click="cursor = cursor.subtract(1, mode === 'month' ? 'year' : 'month')">‹</button>
              <strong>{{ mode === 'month' ? cursor.format('YYYY年') : cursor.format('YYYY年M月') }}</strong>
              <button type="button" aria-label="下一周期" @click="cursor = cursor.add(1, mode === 'month' ? 'year' : 'month')">›</button>
            </header>

            <div v-if="mode === 'month'" class="month-grid">
              <button
                v-for="month in 12"
                :key="month"
                type="button"
                :class="{ selected: `${cursor.year()}-${String(month).padStart(2, '0')}` === modelValue }"
                @click="chooseMonth(month - 1)"
              >{{ month }}月</button>
            </div>

            <template v-else>
              <div class="week-row">
                <span v-for="label in ['日', '一', '二', '三', '四', '五', '六']" :key="label">{{ label }}</span>
              </div>
              <div class="day-grid">
                <button
                  v-for="day in calendarDays"
                  :key="day.format('YYYY-MM-DD')"
                  type="button"
                  :class="{
                    muted: !day.isSame(cursor, 'month'),
                    today: day.isSame(dayjs(), 'day'),
                    selected: isSelected(day),
                  }"
                  @click="chooseDate(day)"
                >{{ day.date() }}</button>
              </div>
            </template>

            <div class="picker-actions">
              <button class="picker-cancel" type="button" @click="open = false">取消</button>
              <button v-if="multiple" class="picker-done" type="button" @click="open = false">完成</button>
            </div>
          </section>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.date-trigger {
  display: grid;
  width: 100%;
  min-height: 46px;
  grid-template-columns: 20px minmax(0, 1fr) auto;
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

.date-trigger svg {
  width: 19px;
  fill: none;
  stroke: var(--accent-text);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.date-trigger span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.date-trigger b { color: var(--muted); font-size: 13px; }

.picker-backdrop {
  position: fixed;
  z-index: 1300;
  inset: 0;
  display: grid;
  padding: 18px;
  align-items: end;
  background: rgba(29, 33, 43, .35);
  backdrop-filter: blur(5px);
}

.picker-sheet {
  width: min(100%, 444px);
  margin: 0 auto;
  padding: 18px;
  color: var(--ink);
  border: 0;
  border-radius: 26px;
  background: var(--paper);
  box-shadow: var(--elev-lg), var(--glow-top);
}

.picker-sheet header {
  display: grid;
  grid-template-columns: 40px 1fr 40px;
  align-items: center;
  margin-bottom: 14px;
  text-align: center;
}

.picker-sheet header button {
  width: 40px;
  height: 40px;
  color: var(--ink);
  border: 0;
  border-radius: 13px;
  background: var(--paper);
  box-shadow: var(--elev-sm), var(--glow-top);
  font-size: 22px;
}

.month-grid,
.day-grid,
.week-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 5px;
}

.month-grid { grid-template-columns: repeat(3, 1fr); gap: 9px; }
.week-row { margin-bottom: 5px; color: var(--muted); text-align: center; font-size: 10px; }

.month-grid button,
.day-grid button {
  min-height: 42px;
  color: var(--ink);
  border: 0;
  border-radius: 12px;
  background: transparent;
}

.month-grid button { min-height: 50px; background: var(--bg); }
.day-grid button.muted { color: var(--muted); opacity: .45; }
.day-grid button.today { box-shadow: inset 0 0 0 1px var(--accent); }
.month-grid button.selected,
.day-grid button.selected { color: #fff; background: var(--accent-gradient); box-shadow: 0 12px 20px -8px rgba(255,122,69,.7); }

.picker-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin-top: 14px;
}
.picker-actions:has(.picker-done) { grid-template-columns: 1fr 1fr; }

.picker-cancel,
.picker-done {
  width: 100%;
  padding: 11px;
  border: 0;
  border-radius: 13px;
  font-weight: 700;
}
.picker-cancel {
  color: var(--muted);
  background: var(--bg);
}
.picker-done {
  color: #fff;
  background: var(--accent-gradient);
}

.picker-enter-active,
.picker-leave-active { transition: opacity .22s ease; }
.picker-enter-active .picker-sheet,
.picker-leave-active .picker-sheet { transition: transform .22s ease; }
.picker-enter-from,
.picker-leave-to { opacity: 0; }
.picker-enter-from .picker-sheet,
.picker-leave-to .picker-sheet { transform: translateY(28px); }
</style>
