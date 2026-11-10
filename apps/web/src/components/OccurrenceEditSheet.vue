<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { DayOccurrence } from '@/domain/types'
import { useAppStore } from '@/stores/app'
import AppTimeSelect from '@/components/AppTimeSelect.vue'
import AppPaySwitch from '@/components/AppPaySwitch.vue'
import {
  durationMinutes,
  expectedUsageCharge,
  occurrenceIdFor,
  resolveOccurrenceAttendance,
} from '@/services/charges'
import { hasCoursePackage, packageUnitOf } from '@/services/packages'
import {
  busyIntervalsForDates,
  courseParticipantIds,
  endTimeOptions,
  ensureTimeOption,
  minutesBetween,
  nextAvailableEndTime,
  scheduleConflictMessage,
  startTimeOptions,
} from '@/services/schedule'

const props = defineProps<{
  item: DayOccurrence | null
}>()

const emit = defineEmits<{
  close: []
  cancel: [item: DayOccurrence]
}>()

const store = useAppStore()
const minutesTouched = ref(false)
const timeError = ref('')
const form = reactive({
  startTime: '',
  endTime: '',
  actualMinutes: 60,
  amount: 0,
  paid: false,
})

function scheduledMinutes() {
  return durationMinutes(form.startTime, form.endTime)
}

function currentRecord() {
  if (!props.item) return undefined
  return store.snapshot.occurrenceRecords?.find(
    (item) => item.id === occurrenceIdFor(props.item!.course.id, props.item!.date),
  )
}

const paidLocked = computed(() => {
  if (!props.item) return false
  return store.findOccurrenceExpense(props.item.course.id, props.item.date)?.status === 'paid'
})

watch(
  () => props.item,
  (item) => {
    if (!item) return
    minutesTouched.value = false
    const startTime = item.exception?.startTime ?? item.course.recurrence.startTime
    const endTime = item.exception?.endTime ?? item.course.recurrence.endTime
    const record = store.snapshot.occurrenceRecords?.find(
      (entry) => entry.id === occurrenceIdFor(item.course.id, item.date),
    )
    const expense = store.findOccurrenceExpense(item.course.id, item.date)
    const expected = expectedUsageCharge(item.course, startTime, endTime, record?.actualMinutes).amount
    timeError.value = ''
    Object.assign(form, {
      startTime,
      endTime,
      actualMinutes: record?.actualMinutes && record.actualMinutes > 0
        ? record.actualMinutes
        : durationMinutes(startTime, endTime),
      amount: expense?.amount ?? (expected || item.course.amount || 0),
      paid: expense?.status === 'paid',
    })
  },
  { immediate: true },
)

watch(
  () => [form.startTime, form.endTime],
  () => {
    if (!minutesTouched.value) form.actualMinutes = scheduledMinutes()
  },
)

function attendance() {
  if (!props.item) return 'scheduled'
  return resolveOccurrenceAttendance(props.item, store.snapshot.occurrenceRecords ?? [])
}

const showMinutesField = computed(() => {
  if (!props.item) return false
  return props.item.course.billingPolicy?.pricingMode === 'per_hour'
    || (hasCoursePackage(props.item.course) && packageUnitOf(props.item.course) === 'minute')
})

const busyIntervals = computed(() => {
  if (!props.item) return []
  return busyIntervalsForDates(
    store.overviewCourses,
    [props.item.date],
    store.overviewScheduleExceptions,
    props.item.course.id,
    courseParticipantIds(props.item.course),
  )
})

const startOptions = computed(() =>
  ensureTimeOption(startTimeOptions(busyIntervals.value), form.startTime),
)
const endOptions = computed(() =>
  ensureTimeOption(endTimeOptions(busyIntervals.value, form.startTime), form.endTime),
)

function setStartTime(start: string) {
  const duration = minutesBetween(form.startTime, form.endTime)
  form.startTime = start
  form.endTime = nextAvailableEndTime(
    busyIntervals.value,
    start,
    duration > 0 ? duration : 60,
  ) || form.endTime
  timeError.value = ''
}

async function applySessionEdits() {
  if (!props.item) return
  const item = props.item
  const location = item.exception?.location ?? item.course.location
  const note = item.exception?.note ?? ''
  const title = item.exception?.title ?? item.course.title
  const unchanged = form.startTime === (item.exception?.startTime ?? item.course.recurrence.startTime)
    && form.endTime === (item.exception?.endTime ?? item.course.recurrence.endTime)
  if (unchanged && !item.exception) return
  await store.upsertScheduleException({
    courseId: item.course.id,
    date: item.date,
    status: item.exception?.status === 'added' ? 'added' : 'rescheduled',
    title,
    startTime: form.startTime,
    endTime: form.endTime,
    location,
    note,
  })
}

async function save() {
  if (!props.item) return
  if (!form.startTime || !form.endTime || form.endTime <= form.startTime) {
    timeError.value = '结束时间要晚于开始时间'
    return
  }
  const [conflict] = store.findCourseScheduleConflicts(
    [{ date: props.item.date, startTime: form.startTime, endTime: form.endTime }],
    props.item.course.id,
    courseParticipantIds(props.item.course),
  )
  if (conflict) {
    timeError.value = scheduleConflictMessage(conflict)
    return
  }
  timeError.value = ''
  await applySessionEdits()
  if (attendance() === 'completed') {
    await store.setOccurrenceAttendance(props.item.course.id, props.item.date, 'completed', {
      billable: currentRecord()?.billable ?? true,
      actualMinutes: Number(form.actualMinutes) > 0 ? Number(form.actualMinutes) : scheduledMinutes(),
    })
  }
  if (!paidLocked.value) {
    await store.upsertOccurrenceExpense(props.item.course.id, props.item.date, {
      amount: Number(form.amount) || 0,
      paid: form.paid,
    })
  }
  emit('close')
}

function requestCancel() {
  if (!props.item) return
  emit('cancel', props.item)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="item" class="overlay" @click.self="$emit('close')">
        <section class="sheet">
          <i class="sheet-handle" />
          <div class="sheet-title">
            <h2>{{ item.course.title }}</h2>
            <button type="button" aria-label="关闭" @click="$emit('close')">×</button>
          </div>
          <div class="sheet-body">
            <div class="time-fields">
              <div class="field">
                <label>开始时间</label>
                <AppTimeSelect
                  :model-value="form.startTime"
                  :options="startOptions"
                  aria-label="选择开始时间"
                  @update:model-value="setStartTime"
                />
              </div>
              <div class="field">
                <label>结束时间</label>
                <AppTimeSelect
                  v-model="form.endTime"
                  :options="endOptions"
                  aria-label="选择结束时间"
                />
              </div>
            </div>
            <p v-if="timeError" class="time-error">{{ timeError }}</p>
            <div v-if="showMinutesField" class="field">
              <label>实际时长（分钟）</label>
              <input
                v-model.number="form.actualMinutes"
                type="number"
                min="1"
                step="1"
                @input="minutesTouched = true"
              />
            </div>
            <div class="field">
              <label>金额</label>
              <div class="money-input">
                <span>¥</span>
                <input v-model.number="form.amount" type="number" min="0" step="0.01" :disabled="paidLocked" />
              </div>
            </div>
            <div class="switch-row">
              <span>是否已支付</span>
              <AppPaySwitch v-model="form.paid" :disabled="paidLocked" />
            </div>
          </div>
          <div class="sheet-footer">
            <div class="action-row">
              <button class="btn danger" type="button" @click="requestCancel">取消课程</button>
              <button class="btn primary" type="button" @click="save">确认修改</button>
            </div>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(28, 22, 48, .42);
}
.sheet {
  display: flex;
  width: min(100%, 480px);
  max-height: min(92vh, 760px);
  flex-direction: column;
  padding: 8px 0 0;
  overflow: hidden;
  border-radius: 22px 22px 0 0;
  background: #fff;
}
.sheet-handle {
  display: block;
  width: 36px;
  height: 4px;
  margin: 6px auto 10px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: #e6e1ee;
}
.sheet-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 18px 12px;
}
.sheet-title h2 {
  margin: 0;
  min-width: 0;
  overflow: hidden;
  font-size: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sheet-title button {
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  border: 0;
  border-radius: 50%;
  background: #f3f0f7;
}
.sheet-body {
  min-height: 0;
  padding: 0 18px 8px;
  overflow: auto;
}
.field { display: grid; gap: 6px; margin-bottom: 12px; }
.field label { color: var(--muted); font-size: 12px; }
.field input {
  width: 100%;
  padding: 11px 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fbfafd;
}
.field input:disabled { color: var(--muted); }
.money-input {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  border-radius: 14px;
  background: #fbfafd;
  box-shadow: inset 0 0 0 1px var(--line);
}
.money-input span { padding-left: 13px; color: var(--accent-text); font-weight: 800; }
.money-input input { border: 0; background: transparent; box-shadow: none; }
.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  min-height: 42px;
}
.switch-row > span { color: var(--muted); font-size: 12px; }
.time-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.time-error {
  margin: -4px 0 12px;
  color: #c2483c;
  font-size: 12px;
}
.sheet-footer {
  display: grid;
  gap: 10px;
  padding: 12px 18px calc(12px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--line);
  background: #fff;
}
.action-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.btn {
  min-height: 48px;
  padding: 0 12px;
  border: 0;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 700;
}
.btn.primary {
  color: #fff;
  background: var(--accent);
}
.btn.danger {
  color: #ed5d6e;
  background: #fff1f3;
}

.drawer-enter-active,
.drawer-leave-active {
  transition: background-color .28s ease;
}
.drawer-enter-active .sheet,
.drawer-leave-active .sheet {
  transition: transform .4s cubic-bezier(.32, .72, 0, 1);
}
.drawer-enter-from,
.drawer-leave-to {
  background-color: transparent;
}
.drawer-enter-from .sheet,
.drawer-leave-to .sheet {
  transform: translate3d(0, 100%, 0);
}

@media (prefers-reduced-motion: reduce) {
  .drawer-enter-active,
  .drawer-leave-active,
  .drawer-enter-active .sheet,
  .drawer-leave-active .sheet {
    transition: none;
  }
}
</style>
