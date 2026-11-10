<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import dayjs from 'dayjs'
import { useAppStore } from '@/stores/app'
import AppDatePicker from '@/components/AppDatePicker.vue'
import AppTimeSelect from '@/components/AppTimeSelect.vue'
import AppPaySwitch from '@/components/AppPaySwitch.vue'
import {
  busyIntervalsForDates,
  courseParticipantIds,
  endTimeOptions,
  findBusyConflict,
  minutesBetween,
  nextAvailableEndTime,
  occurrencesOnDate,
  scheduleConflictMessage,
  startTimeOptions,
} from '@/services/schedule'

const props = defineProps<{
  open: boolean
  date: string
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  added: [date: string]
}>()

const store = useAppStore()
const route = useRoute()
const selectedCourseId = ref('')
const addMode = ref<'preset' | 'temporary'>('preset')
const selectedDates = ref<string[]>([])
const quickForm = reactive({
  title: '',
  startTime: '09:00',
  endTime: '10:00',
  amount: 0,
  paid: false,
})

const returnTo = computed(() => (route.path.startsWith('/') ? route.path : '/'))
const presetCourses = computed(() => store.overviewCourses.filter((course) => course.source !== 'temporary'))
const sortedDates = computed(() => [...selectedDates.value].filter(Boolean).sort())
const firstDate = computed(() => sortedDates.value[0] ?? '')
const busyChildIds = computed(() => {
  const selected = store.overviewCourses.find((item) => item.id === selectedCourseId.value)
  if (selected) return courseParticipantIds(selected)
  return store.child ? [store.child.id] : []
})
function courseScheduledOnAllDates(courseId: string) {
  if (!sortedDates.value.length) return false
  return sortedDates.value.every((day) =>
    occurrencesOnDate(store.overviewCourses, day, store.overviewScheduleExceptions)
      .some((item) => item.course.id === courseId),
  )
}

const busyIntervals = computed(() =>
  busyIntervalsForDates(
    store.overviewCourses,
    sortedDates.value.length ? sortedDates.value : [props.date],
    store.overviewScheduleExceptions,
    undefined,
    busyChildIds.value,
  ),
)
const startOptions = computed(() => startTimeOptions(busyIntervals.value))
const endOptions = computed(() => endTimeOptions(busyIntervals.value, quickForm.startTime))
const conflict = computed(() =>
  findBusyConflict(busyIntervals.value, quickForm.startTime, quickForm.endTime),
)

const attemptedSubmit = ref(false)
const presetError = ref('')
const formError = computed(() => {
  if (!quickForm.title.trim()) return '请填写课程名称'
  if (!sortedDates.value.length) return '请选择安排日期'
  if (!quickForm.startTime || !quickForm.endTime) return '请选择开始和结束时间'
  if (quickForm.endTime <= quickForm.startTime) return '结束时间要晚于开始时间'
  if (conflict.value) return `所选日期中 ${conflict.value.title} 已占用该时间段`
  return ''
})

const PREFERRED_START = '09:00'

function pickDefaultTimes(date: string) {
  const intervals = busyIntervalsForDates(
    store.overviewCourses,
    [date],
    store.overviewScheduleExceptions,
    undefined,
    busyChildIds.value,
  )
  const free = startTimeOptions(intervals).filter((item) => !item.disabled)
  const start = free.find((item) => item.value >= PREFERRED_START)?.value
    ?? free[0]?.value
    ?? PREFERRED_START
  quickForm.startTime = start
  quickForm.endTime = nextAvailableEndTime(intervals, start, 60)
}

function setStartTime(start: string) {
  const duration = minutesBetween(quickForm.startTime, quickForm.endTime)
  quickForm.startTime = start
  quickForm.endTime = nextAvailableEndTime(
    busyIntervals.value,
    start,
    duration > 0 ? duration : 60,
  )
}

function resetForm() {
  selectedCourseId.value = ''
  addMode.value = 'preset'
  attemptedSubmit.value = false
  presetError.value = ''
  selectedDates.value = props.date ? [props.date] : [dayjs().format('YYYY-MM-DD')]
  quickForm.title = ''
  quickForm.amount = 0
  quickForm.paid = false
  pickDefaultTimes(selectedDates.value[0])
}

watch(() => props.open, (open) => {
  if (open) resetForm()
})

watch(firstDate, (date) => {
  if (!props.open || !date) return
  if (conflict.value || !quickForm.endTime) pickDefaultTimes(date)
})

function close() {
  emit('update:open', false)
}

async function submitPreset() {
  if (!selectedCourseId.value || !sortedDates.value.length) return
  presetError.value = ''
  const result = await store.addPresetOccurrence(selectedCourseId.value, sortedDates.value)
  if (!result.ok) {
    if (result.reason === 'conflict') {
      presetError.value = result.conflict ? scheduleConflictMessage(result.conflict) : '该孩子此时已有其他课程'
    }
    else if (result.reason === 'duplicate') presetError.value = '所选日期都已有这门课'
    else if (result.reason === 'temporary') presetError.value = '临时计划不能加入已有课程'
    return
  }
  emit('added', firstDate.value)
  close()
}

async function submitTemporary() {
  attemptedSubmit.value = true
  if (formError.value) return
  const result = await store.createQuickArrangement({
    dates: sortedDates.value,
    title: quickForm.title,
    startTime: quickForm.startTime,
    endTime: quickForm.endTime,
    amount: quickForm.amount,
    expenseStatus: quickForm.paid ? 'paid' : 'unpaid',
  })
  if (!result.ok) return
  emit('added', firstDate.value)
  close()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="overlay" @click.self="close">
        <section class="sheet preset-sheet">
          <i class="sheet-handle" />
          <div class="sheet-title">
            <div>
              <p>新增安排</p>
              <h2>安排课程</h2>
            </div>
            <button type="button" aria-label="关闭" @click="close">×</button>
          </div>

          <div class="quick-date-field">
            <label>安排日期</label>
            <AppDatePicker v-model="selectedDates" multiple aria-label="选择安排日期" />
          </div>

          <div class="add-mode-tabs" aria-label="新增方式">
            <button type="button" :class="{ active: addMode === 'preset' }" @click="addMode = 'preset'">选择已有课程</button>
            <button type="button" :class="{ active: addMode === 'temporary' }" @click="addMode = 'temporary'">临时新增安排</button>
          </div>

          <template v-if="addMode === 'preset'">
            <p class="preset-tip">老师、时间和地点将自动带入，添加后仍可单独调整这一次安排。</p>
            <div v-if="presetCourses.length" class="preset-list">
              <button
                v-for="course in presetCourses"
                :key="course.id"
                type="button"
                :disabled="courseScheduledOnAllDates(course.id)"
                :class="{ selected: selectedCourseId === course.id }"
                @click="selectedCourseId = course.id"
              >
                <i :style="{ background: course.color }" />
                <div>
                  <strong>{{ course.title }}</strong>
                  <small>{{ course.recurrence.startTime }}–{{ course.recurrence.endTime }} · {{ course.teacher || '老师待定' }}</small>
                </div>
                <span v-if="courseScheduledOnAllDates(course.id)">已安排</span>
                <b v-else>{{ selectedCourseId === course.id ? '✓' : '' }}</b>
              </button>
            </div>
            <div v-else class="preset-empty">
              <p>还没有课程预设，请先新增课程。</p>
              <router-link :to="{ path: '/courses/edit', query: { returnTo } }">新增课程</router-link>
            </div>
            <p v-if="presetError" class="quick-form-error">{{ presetError }}</p>
            <button
              v-if="presetCourses.length"
              class="sheet-submit"
              type="button"
              :disabled="!selectedCourseId || !sortedDates.length"
              @click="submitPreset"
            >
              确认
            </button>
          </template>

          <form v-else class="temporary-form" @submit.prevent="submitTemporary">
            <div class="field">
              <label>课程名称</label>
              <input v-model="quickForm.title" placeholder="例如 临时钢琴课" />
            </div>
            <div class="time-fields">
              <div class="field">
                <label>开始时间</label>
                <AppTimeSelect
                  :model-value="quickForm.startTime"
                  :options="startOptions"
                  aria-label="选择开始时间"
                  @update:model-value="setStartTime"
                />
              </div>
              <div class="field">
                <label>结束时间</label>
                <AppTimeSelect v-model="quickForm.endTime" :options="endOptions" aria-label="选择结束时间" />
              </div>
            </div>
            <ul v-if="busyIntervals.length" class="busy-hint">
              <li v-for="busy in busyIntervals" :key="`${busy.start}-${busy.title}`">
                <b>{{ busy.start }}–{{ busy.end }}</b><span>{{ busy.title }}</span>
              </li>
            </ul>
            <div class="field">
              <label>费用</label>
              <div class="quick-money-input"><span>¥</span><input v-model.number="quickForm.amount" type="number" min="0" step="0.01" /></div>
            </div>
            <div class="switch-row">
              <span>是否已支付</span>
              <AppPaySwitch v-model="quickForm.paid" />
            </div>
            <p v-if="attemptedSubmit && formError" class="quick-form-error">{{ formError }}</p>
            <button class="sheet-submit" type="submit">确认</button>
          </form>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  z-index: 1100;
  inset: 0;
  display: grid;
  padding: 18px;
  align-items: end;
  background: rgba(29, 33, 43, .36);
  backdrop-filter: blur(5px);
}

.sheet {
  width: min(100%, 444px);
  margin: 0 auto;
  padding: 18px 18px 22px;
  overflow: auto;
  color: var(--ink);
  border: 0;
  border-radius: 26px;
  background: var(--paper);
  box-shadow: var(--elev-lg), var(--glow-top);
}

.preset-sheet {
  max-height: min(88vh, 720px);
}

.sheet-handle {
  display: block;
  width: 38px;
  height: 4px;
  margin: -6px auto 14px;
  border-radius: 99px;
  background: var(--line);
}

.sheet-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}

.sheet-title p {
  margin: 0 0 3px;
  color: var(--accent-text);
  font-size: 11px;
  font-weight: 700;
}

.sheet-title h2 { font-size: 22px; }

.sheet-title button {
  width: 34px;
  height: 34px;
  color: var(--muted);
  border: 0;
  border-radius: 50%;
  background: var(--bg);
  font-size: 22px;
}

.quick-date-field {
  display: grid;
  gap: 7px;
  margin: -4px 0 14px;
}

.quick-date-field > label {
  color: var(--muted);
  font-size: 12px;
}

.quick-date-field :deep(.date-trigger) {
  min-height: 46px;
  background: var(--paper);
}

.add-mode-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
  margin-bottom: 18px;
  padding: 4px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--ink) 5%, var(--paper));
}

.add-mode-tabs button {
  min-height: 39px;
  color: var(--muted);
  border: 0;
  border-radius: 12px;
  background: transparent;
  font-size: 12px;
  font-weight: 700;
}

.add-mode-tabs button.active {
  color: var(--accent-text);
  background: var(--paper);
  box-shadow: var(--elev-sm), var(--glow-top);
}

.preset-tip {
  margin: -8px 0 16px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.55;
}

.preset-list {
  display: grid;
  gap: 9px;
  margin-bottom: 18px;
}

.preset-list > button {
  display: grid;
  grid-template-columns: 5px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  min-height: 68px;
  padding: 11px 13px 11px 0;
  overflow: hidden;
  color: var(--ink);
  text-align: left;
  border: 0;
  border-radius: 18px;
  background: var(--paper);
  box-shadow: var(--elev-sm), var(--glow-top);
}

.preset-list > button:not(:disabled):active { transform: scale(.98); }

.preset-list > button.selected {
  background: linear-gradient(150deg, var(--accent-soft) 0%, var(--paper) 70%);
  box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--accent) 45%, #fff), 0 10px 22px -12px rgba(255,122,69,.6);
}

.preset-list > button:disabled {
  cursor: default;
  opacity: .48;
}

.preset-list > button > i {
  width: 5px;
  height: 46px;
  border-radius: 0 6px 6px 0;
}

.preset-list div { min-width: 0; }
.preset-list strong { display: block; font-size: 14px; }
.preset-list small {
  display: block;
  margin-top: 5px;
  overflow: hidden;
  color: var(--muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.preset-list span { color: var(--muted); font-size: 11px; }
.preset-list b {
  display: grid;
  width: 25px;
  height: 25px;
  place-items: center;
  color: #fff;
  border-radius: 50%;
  background: var(--paper);
  box-shadow: inset 0 0 0 1px var(--line);
}
.preset-list button.selected b {
  background: var(--accent-gradient);
  box-shadow: 0 8px 16px -8px rgba(255,122,69,.8);
}

.preset-empty { padding: 24px; text-align: center; }
.preset-empty p { margin: 0 0 12px; color: var(--muted); font-size: 13px; }
.preset-empty a {
  display: inline-block;
  padding: 9px 15px;
  color: #fff;
  border-radius: 12px;
  background: var(--accent-gradient);
  box-shadow: 0 10px 20px -10px rgba(255,122,69,.8);
  font-size: 12px;
}

.temporary-form { display: grid; gap: 14px; }
.temporary-form .field { margin-bottom: 0; }

.field { display: grid; gap: 7px; margin-bottom: 12px; }
.field > label { color: var(--muted); font-size: 12px; }
.field input,
.field textarea {
  width: 100%;
  min-height: 46px;
  padding: 10px 13px;
  color: var(--ink);
  border: 0;
  border-radius: 14px;
  background: var(--paper);
  box-shadow: inset 0 0 0 1px var(--line);
}

.time-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.quick-money-input {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  border-radius: 14px;
  background: var(--paper);
  box-shadow: inset 0 0 0 1px var(--line);
}
.quick-money-input span { padding-left: 13px; color: var(--accent-text); font-weight: 800; }
.quick-money-input input { border: 0; background: transparent; box-shadow: none; }

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 42px;
}
.switch-row > span { color: var(--muted); font-size: 12px; }

.busy-hint {
  display: grid;
  gap: 5px;
  margin: -4px 0 0;
  padding: 11px 12px;
  list-style: none;
  border-radius: 14px;
  background: color-mix(in srgb, var(--ink) 4%, var(--paper));
}
.busy-hint li { display: flex; gap: 8px; align-items: baseline; color: var(--muted); font-size: 10px; }
.busy-hint b { color: var(--ink); font-size: 10px; font-weight: 750; }

.quick-form-error {
  margin: 0;
  padding: 10px 12px;
  color: #b8453a;
  border-radius: 13px;
  background: color-mix(in srgb, #d9503f 9%, var(--paper));
  font-size: 11px;
}

.sheet-submit {
  width: 100%;
  min-height: 48px;
  margin-top: 4px;
  color: #fff;
  border: 0;
  border-radius: 16px;
  background: var(--accent-gradient);
  box-shadow: 0 12px 22px -10px rgba(255,122,69,.75);
  font-weight: 750;
}
.sheet-submit:disabled { cursor: default; opacity: .45; box-shadow: none; }
.sheet-submit:active { transform: scale(.98); }

.fade-enter-active, .fade-leave-active { transition: opacity .25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
