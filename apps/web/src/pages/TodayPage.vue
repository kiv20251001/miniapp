<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { useAppStore } from '@/stores/app'
import CourseScheduleList from '@/components/CourseScheduleList.vue'
import AddOccurrenceSheet from '@/components/AddOccurrenceSheet.vue'
import OccurrenceEditSheet from '@/components/OccurrenceEditSheet.vue'
import { money } from '@/services/billing'
import type { DayOccurrence } from '@/domain/types'
import { occurrencesOnDate } from '@/services/schedule'
import { useHomeDate } from '@/composables/useHomeDate'
import { useQuickAdd } from '@/composables/useQuickAdd'
import { useViewRefresh } from '@/composables/useViewRefresh'
import { courseScheduleProgress } from '@/services/courseSchedule'
import {
  sumUnbilledCharges,
} from '@/services/charges'

const store = useAppStore()
const { view } = useHomeDate()
const { pendingPreset, consumePresetRequest } = useQuickAdd()
const today = dayjs()
const editing = ref<DayOccurrence | null>(null)
const cancelling = ref<DayOccurrence | null>(null)
const recentlyCancelled = ref<DayOccurrence | null>(null)
const addSheetOpen = ref(false)
let toastTimer: ReturnType<typeof setTimeout> | undefined

const weekDays = computed(() => {
  const anchor = today.add(view.weekOffset, 'week')
  const monday = anchor.subtract((anchor.day() + 6) % 7, 'day')
  return Array.from({ length: 7 }, (_, index) => monday.add(index, 'day'))
})
const weekRange = computed(() => {
  const days = weekDays.value
  const start = days[0]
  const end = days[6]
  return start.month() === end.month()
    ? `${start.format('M月D日')}–${end.format('D日')}`
    : `${start.format('M月D日')}–${end.format('M月D日')}`
})

useViewRefresh(() => ({
  from: weekDays.value[0].format('YYYY-MM-DD'),
  to: weekDays.value[6].format('YYYY-MM-DD'),
}))

function dateCourseColors(date: string) {
  const colors = occurrencesOnDate(store.overviewCourses, date, store.overviewScheduleExceptions)
    .map((item) => item.course.color)
  return [...new Set(colors)].slice(0, 3)
}

const selectedDay = computed(() => dayjs(view.selectedDate))
const selectedItems = computed(() =>
  [...occurrencesOnDate(store.overviewCourses, view.selectedDate, store.overviewScheduleExceptions)].sort((a, b) => {
    const time = a.course.recurrence.startTime.localeCompare(b.course.recurrence.startTime)
    if (time !== 0) return time
    return a.course.recurrence.endTime.localeCompare(b.course.recurrence.endTime)
  }),
)

function courseProgress(item: DayOccurrence) {
  return courseScheduleProgress(item.course, view.selectedDate, store.overviewScheduleExceptions)
}

const weekBills = computed(() => {
  const start = weekDays.value[0].format('YYYY-MM-DD')
  const end = weekDays.value[6].format('YYYY-MM-DD')
  return store.overviewExpenses.filter(
    (item) => item.status !== 'void' && item.dueDate >= start && item.dueDate <= end,
  )
})

const weekOpenAmount = computed(() =>
  weekBills.value.filter((item) => item.status !== 'paid').reduce((sum, item) => sum + item.amount, 0),
)

const weekSettledPercent = computed(() => {
  const total = weekBills.value.reduce((sum, item) => sum + item.amount, 0)
  if (!total) return 0
  const paid = weekBills.value
    .filter((item) => item.status === 'paid')
    .reduce((sum, item) => sum + item.amount, 0)
  return Math.round((paid / total) * 100)
})

const dayDonePercent = computed(() => {
  const total = selectedItems.value.length
  if (!total) return 0
  if (selectedDay.value.isBefore(today, 'day')) return 100
  if (selectedDay.value.isAfter(today, 'day')) return 0
  const now = dayjs().format('HH:mm')
  const done = selectedItems.value.filter(
    (item) => (item.exception?.endTime ?? item.course.recurrence.endTime) <= now,
  ).length
  return Math.round((done / total) * 100)
})

const weekUnbilled = computed(() => {
  const start = weekDays.value[0].format('YYYY-MM-DD')
  const end = weekDays.value[6].format('YYYY-MM-DD')
  return sumUnbilledCharges(store.overviewCharges, (charge) => {
    const record = store.snapshot.occurrenceRecords?.find((item) => item.id === charge.occurrenceId)
    const date = record?.date ?? charge.occurrenceId.slice(charge.occurrenceId.lastIndexOf('_') + 1)
    return date >= start && date <= end
  })
})

function openEdit(item: DayOccurrence) {
  editing.value = item
}

function requestCancelFromEdit(item: DayOccurrence) {
  cancelling.value = item
  editing.value = null
}

async function confirmCancel() {
  if (!cancelling.value) return
  const item = cancelling.value
  if (item.exception?.status === 'added') {
    await store.dropOccurrenceSlot(item.course.id, item.date)
  } else {
    await store.upsertScheduleException({
      courseId: item.course.id,
      date: item.date,
      status: 'cancelled',
    })
  }
  recentlyCancelled.value = item
  cancelling.value = null
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    recentlyCancelled.value = null
  }, 4500)
}

async function undoCancel() {
  const item = recentlyCancelled.value
  if (!item) return
  const slot = {
    date: item.date,
    startTime: item.exception?.startTime ?? item.course.recurrence.startTime,
    endTime: item.exception?.endTime ?? item.course.recurrence.endTime,
  }
  if (item.exception?.status === 'added') {
    await store.upsertScheduleException({
      courseId: item.course.id,
      date: item.date,
      status: 'added',
      title: item.exception.title,
      startTime: slot.startTime,
      endTime: slot.endTime,
      location: item.exception.location,
      note: item.exception.note,
    })
  } else {
    await store.restoreOccurrenceSlot(item.course.id, slot)
  }
  recentlyCancelled.value = null
  window.clearTimeout(toastTimer)
}

function openDayAdd() {
  addSheetOpen.value = true
}

function openPresetPicker() {
  addSheetOpen.value = true
}

// 底部菜单的「新增日期安排」：请求可能早于本页挂载，挂载时与变化时都尝试消费
function handlePresetRequest() {
  if (consumePresetRequest()) openPresetPicker()
}

onMounted(handlePresetRequest)
watch(pendingPreset, (value) => {
  if (value) handlePresetRequest()
})

function changeWeek(step: number) {
  view.weekOffset += step
  view.selectedDate = dayjs(view.selectedDate).add(step, 'week').format('YYYY-MM-DD')
}

function selectDate(date: string) {
  view.selectedDate = date
}

function mondayOf(value: dayjs.Dayjs) {
  return value.subtract((value.day() + 6) % 7, 'day').startOf('day')
}

// 新增到其他日期后把首页切到那一天，否则用户会以为没添加成功
function focusDate(date: string) {
  view.weekOffset = mondayOf(dayjs(date)).diff(mondayOf(today), 'week')
  view.selectedDate = date
}
</script>

<template>
  <main class="page today-page">
    <section class="week-picker" aria-label="周日期选择">
      <div class="week-toolbar">
        <button type="button" aria-label="上一周" @click="changeWeek(-1)">
          <svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <span>{{ view.weekOffset === 0 ? '本周' : weekRange }}</span>
        <button type="button" aria-label="下一周" @click="changeWeek(1)">
          <svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </div>
      <div class="date-strip">
        <button
          v-for="date in weekDays"
          :key="date.format('YYYY-MM-DD')"
          type="button"
          :aria-label="`查看${date.format('M月D日')}安排`"
          :class="{
            active: date.format('YYYY-MM-DD') === view.selectedDate,
            today: date.isSame(today, 'day'),
          }"
          @click="selectDate(date.format('YYYY-MM-DD'))"
        >
          <span>{{ date.format('dd') }}</span>
          <strong>{{ date.date() }}</strong>
          <span class="course-dots" aria-hidden="true">
            <i
              v-for="color in dateCourseColors(date.format('YYYY-MM-DD'))"
              :key="color"
              :style="{ background: color }"
            />
          </span>
        </button>
      </div>
    </section>

    <section class="overview">
      <router-link class="overview-card" to="/calendar">
        <header>
          <i aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Zm2-2v4m10-4v4M4 10h16" />
            </svg>
          </i>
          <span>{{ selectedDay.isSame(today, 'day') ? '今日课程' : `${selectedDay.format('M月D日')}课程` }}</span>
          <b>›</b>
        </header>
        <div class="overview-body">
          <p>
            <strong>{{ selectedItems.length }}</strong>
            <small>节安排</small>
          </p>
          <span class="overview-ring" :style="{ '--ring': `${dayDonePercent}%` }">
            <i>{{ dayDonePercent }}%</i>
          </span>
        </div>
      </router-link>
      <router-link class="overview-card is-bill" :to="{ path: '/bills', query: { from: 'today' } }">
        <header>
          <i aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M7 4h10v16l-5-3-5 3V4Zm3 4h4m-4 4h4" />
            </svg>
          </i>
          <span>本周课程账单</span>
          <b>›</b>
        </header>
        <div class="overview-body">
          <p>
            <strong>{{ money(weekOpenAmount) }}</strong>
            <small>{{ weekBills.length }} 笔账单<template v-if="weekUnbilled"> · 待结算 {{ money(weekUnbilled) }}</template></small>
          </p>
          <span class="overview-ring" :style="{ '--ring': `${weekSettledPercent}%` }">
            <i>{{ weekSettledPercent }}%</i>
          </span>
        </div>
      </router-link>
    </section>

    <CourseScheduleList
      :title="selectedDay.isSame(today, 'day') ? '今日安排' : `${selectedDay.format('M月D日')}安排`"
      :items="selectedItems"
      :progress-for="courseProgress"
      action-label="新增"
      @add="openDayAdd"
      @edit="openEdit"
    />

    <AddOccurrenceSheet
      v-model:open="addSheetOpen"
      :date="view.selectedDate"
      @added="focusDate"
    />

    <OccurrenceEditSheet
      :item="editing"
      @close="editing = null"
      @cancel="requestCancelFromEdit"
    />

    <Transition name="fade">
      <div v-if="cancelling" class="overlay dialog-overlay" @click.self="cancelling = null">
        <section class="confirm-dialog">
          <div class="confirm-icon">!</div>
          <h2>取消这一次课程？</h2>
          <div>
            <button type="button" @click="cancelling = null">暂不取消</button>
            <button class="danger" type="button" @click="confirmCancel">确认取消</button>
          </div>
        </section>
      </div>
    </Transition>

    <Transition name="toast">
      <div v-if="recentlyCancelled" class="toast">
        <span>已取消“{{ recentlyCancelled.course.title }}”</span>
        <button type="button" @click="undoCancel">撤销</button>
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.today-page {
  padding-top: 24px;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 22px;
  animation: page-in .45s ease both;
}

.app-header p {
  margin: 0 0 2px;
  color: var(--muted);
  font-size: 13px;
}

.app-header h1 {
  display: flex;
  margin: 0;
  align-items: center;
  gap: 10px;
  color: var(--ink);
  font-size: 29px;
  font-weight: 800;
  letter-spacing: -.045em;
}

.app-header h1 i {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  color: #fff;
  border: 0;
  border-radius: 12px;
  background: var(--avatar-color, #7b61ff);
  font-size: 11px;
  font-style: normal;
  font-weight: 800;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.child-switcher {
  display: flex;
  flex-direction: row-reverse;
  justify-content: flex-end;
}

.child-switcher button {
  display: grid;
  width: 32px;
  height: 32px;
  margin-left: -8px;
  padding: 0;
  place-items: center;
  color: #fff;
  border: 3px solid var(--bg);
  border-radius: 50%;
  color: color-mix(in srgb, var(--avatar-color, #7b61ff) 72%, #2b3040);
  background: color-mix(in srgb, var(--avatar-color, #7b61ff) 20%, #fff);
  font-size: 8px;
  font-weight: 800;
  transition: transform .2s ease, box-shadow .2s ease;
}

.child-switcher button.active {
  z-index: 2;
  color: #fff;
  background: var(--avatar-color, #7b61ff);
  transform: scale(1.06);
}

.header-actions {
  display: flex;
  gap: 9px;
}

.header-actions button,
.header-actions a {
  position: relative;
  display: grid;
  width: 42px;
  height: 42px;
  padding: 0;
  place-items: center;
  color: var(--ink);
  border: 0;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 9px 22px rgba(62, 45, 104, .1);
  transition: transform .2s ease;
}

.header-actions button:active,
.header-actions a:active {
  transform: scale(.9);
}

.header-actions svg {
  width: 19px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 1.8;
}

.header-actions i {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 7px;
  height: 7px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: #ff5e67;
}

.week-picker {
  margin-bottom: 20px;
  padding: 12px 10px 10px;
  border: 0;
  border-radius: 24px;
  background: linear-gradient(170deg, var(--paper) 0%, color-mix(in srgb, var(--accent) 8%, var(--paper)) 100%);
  box-shadow: var(--elev-md), var(--glow-top);
  animation: page-in .5s .05s ease both;
}

.week-toolbar {
  display: grid;
  grid-template-columns: 32px 1fr 32px;
  align-items: center;
  margin-bottom: 5px;
  text-align: center;
}

.week-toolbar button {
  display: grid;
  width: 32px;
  height: 32px;
  padding: 0;
  place-items: center;
  color: var(--muted);
  border: 0;
  border-radius: 11px;
  background: transparent;
  transition: transform .2s ease, background .2s ease;
}

.week-toolbar button:active {
  transform: scale(.88);
  background: var(--accent-soft);
}

.week-toolbar button:last-child {
  justify-self: end;
}

.week-toolbar svg {
  width: 18px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

.week-toolbar span {
  color: var(--muted);
  font-size: 11px;
  font-weight: 650;
}

.date-strip {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.date-strip button {
  display: grid;
  height: 62px;
  padding: 0;
  place-items: center;
  align-content: center;
  color: var(--muted);
  border: 0;
  border-radius: 16px;
  background: transparent;
  transition: transform .25s ease, background .25s ease;
}

.date-strip span {
  font-size: 11px;
}

.date-strip strong {
  margin-top: 4px;
  color: var(--ink);
  font-size: 15px;
}

.date-strip button.active {
  color: #fff;
  background: var(--accent-gradient);
  box-shadow: 0 14px 26px -10px rgba(255,122,69,.75), inset 0 1px 0 rgba(255,255,255,.3);
}

.date-strip button.active strong {
  color: #fff;
}

.date-strip .course-dots {
  display: flex;
  min-height: 6px;
  gap: 3px;
  align-items: center;
  margin-top: 5px;
  font-size: 0;
}

.date-strip .course-dots i {
  width: 6px;
  height: 6px;
  border: 0;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(42,48,71,.15);
}

.date-strip button.active .course-dots i {
  box-shadow: 0 0 0 1px rgba(255,255,255,.7);
}

.overview {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 11px;
  margin-bottom: 28px;
  animation: page-in .55s .1s ease both;
}

.overview-card {
  --ring-color: var(--accent);
  --ring-deep: #e95331;
  display: flex;
  min-height: 118px;
  flex-direction: column;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 15px;
  color: var(--ink);
  border: 0;
  border-radius: 24px;
  background:
    linear-gradient(150deg, color-mix(in srgb, var(--ring-color) 16%, var(--mix-base)) 0%, var(--mix-base) 62%),
    var(--paper);
  box-shadow:
    0 2px 5px rgba(25,31,58,.04),
    0 18px 34px -16px color-mix(in srgb, var(--ring-color) 42%, rgba(25,31,58,.5)),
    inset 0 1px 0 rgba(255,255,255,.9);
  transition: transform .2s ease, box-shadow .2s ease;
}

.overview-card.is-bill {
  --ring-color: #ff5f79;
  --ring-deep: #d93d59;
}

.overview-card:active {
  transform: scale(.98);
  box-shadow:
    0 2px 4px rgba(25,31,58,.04),
    0 10px 20px -14px color-mix(in srgb, var(--ring-color) 42%, rgba(25,31,58,.5));
}

.overview-card header {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
}

.overview-card header i {
  display: grid;
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  place-items: center;
  color: #fff;
  border-radius: 9px;
  background: linear-gradient(140deg, color-mix(in srgb, var(--ring-color) 88%, #fff) 0%, var(--ring-deep) 100%);
  box-shadow:
    0 6px 14px -6px color-mix(in srgb, var(--ring-color) 75%, transparent),
    inset 0 1px 0 rgba(255,255,255,.45);
}

.overview-card header i svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.overview-card header span {
  overflow: hidden;
  flex: 1 1 auto;
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.overview-card header b {
  flex: 0 0 auto;
  color: var(--muted);
  font-size: 15px;
  font-weight: 600;
  line-height: 1;
}

.overview-body {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
}

.overview-body p {
  min-width: 0;
  margin: 0;
}

.overview-body strong {
  display: block;
  overflow: hidden;
  font-size: 25px;
  font-weight: 780;
  letter-spacing: -.045em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.overview-body small {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 10px;
}

.overview-ring {
  position: relative;
  display: grid;
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  background: conic-gradient(
    from 210deg,
    var(--ring-deep) 0deg,
    var(--ring-color) var(--ring),
    color-mix(in srgb, var(--ring-color) 16%, var(--track)) var(--ring)
  );
  box-shadow: 0 8px 16px -8px color-mix(in srgb, var(--ring-color) 70%, transparent);
}

.overview-ring::after {
  position: absolute;
  width: 33px;
  height: 33px;
  border-radius: 50%;
  background: var(--mix-base);
  box-shadow: inset 0 1px 3px color-mix(in srgb, var(--ink) 8%, transparent);
  content: "";
}

.overview-ring i {
  position: relative;
  z-index: 1;
  color: var(--ring-deep);
  font-size: 9px;
  font-style: normal;
  font-weight: 800;
}

.bubble {
  display: none;
}

.content-block {
  margin-bottom: 28px;
}

.section-title {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 13px;
}

.section-title h2 {
  color: var(--ink);
  font-size: 19px;
  letter-spacing: -.025em;
}

.section-title p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 12px;
}

.section-title a {
  color: var(--accent-text);
  font-size: 12px;
  font-weight: 650;
}

.section-actions {
  display: flex;
  gap: 7px;
}

.section-actions button,
.section-actions a {
  display: flex;
  min-height: 32px;
  gap: 4px;
  align-items: center;
  padding: 6px 9px;
  color: #7048df;
  border: 0;
  border-radius: 11px;
  background: var(--accent-soft);
  font-size: 10px;
  font-weight: 700;
  transition: transform .2s ease, background .2s ease;
}

.section-actions button:active,
.section-actions a:active {
  transform: scale(.92);
}

.section-actions svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.lesson-list {
  position: relative;
  display: grid;
  gap: 12px;
}

.timeline-entry {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: 10px;
  align-items: stretch;
}

.timeline-marker {
  position: relative;
  min-height: 100%;
  padding-top: 16px;
  color: var(--muted);
  text-align: left;
}

.timeline-marker::after {
  position: absolute;
  top: 34px;
  right: 3px;
  bottom: -18px;
  width: 1px;
  background: var(--line);
  content: "";
}

.timeline-marker.last::after {
  bottom: 20px;
}

.timeline-marker time {
  display: block;
  padding-right: 10px;
  font-size: 10px;
  font-weight: 650;
  letter-spacing: -.02em;
}

.timeline-marker i {
  position: absolute;
  z-index: 1;
  top: 30px;
  right: 0;
  width: 7px;
  height: 7px;
  border: 2px solid var(--bg);
  border-radius: 50%;
  background: color-mix(in srgb, var(--timeline-color) 65%, #687087);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--timeline-color) 35%, transparent);
}

.lesson-list-leave-active {
  position: absolute;
  width: 100%;
}

.lesson-list-leave-to {
  opacity: 0;
  transform: translateX(-28px) scale(.96);
}

.lesson-list-move,
.lesson-list-leave-active {
  transition: all .35s cubic-bezier(.2,.8,.2,1);
}

.empty-state {
  padding: 32px 20px;
  text-align: center;
  border: 0;
  border-radius: 24px;
  background: var(--paper);
  box-shadow: var(--elev-md), var(--glow-top);
}

.empty-state div {
  display: grid;
  width: 48px;
  height: 48px;
  margin: 0 auto 12px;
  place-items: center;
  color: #fff;
  border-radius: 16px;
  background: var(--accent-gradient);
}

.empty-state h3 { font-size: 17px; }
.empty-state p { margin: 8px 0 16px; color: var(--muted); font-size: 12px; }
.empty-state a,
.empty-state button { display: inline-block; padding: 9px 16px; color: #fff; border: 0; border-radius: 13px; background: var(--accent-gradient); box-shadow: 0 12px 22px -10px rgba(255,122,69,.75); font-size: 13px; }

.preset-sheet {
  max-height: min(88vh, 720px);
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

.temporary-form {
  display: grid;
  gap: 14px;
}

.temporary-form .field {
  margin-bottom: 0;
}

.temporary-form .field > small {
  color: var(--muted);
  font-size: 10px;
}

.quick-money-input {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  border-radius: 14px;
  background: var(--paper);
  box-shadow: inset 0 0 0 1px var(--line);
}

.quick-money-input span {
  padding-left: 13px;
  color: var(--accent-text);
  font-weight: 800;
}

.quick-money-input input {
  border: 0;
  background: transparent;
  box-shadow: none;
}

.settlement-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.settlement-options button {
  min-height: 42px;
  color: var(--muted);
  border: 0;
  border-radius: 13px;
  background: color-mix(in srgb, var(--ink) 5%, var(--paper));
  font-weight: 700;
}

.settlement-options button.active {
  color: var(--accent-text);
  background: var(--accent-soft);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 28%, transparent);
}

.busy-hint {
  display: grid;
  gap: 5px;
  margin: -4px 0 0;
  padding: 11px 12px;
  list-style: none;
  border-radius: 14px;
  background: color-mix(in srgb, var(--ink) 4%, var(--paper));
}

.busy-hint li {
  display: flex;
  gap: 8px;
  align-items: baseline;
  color: var(--muted);
  font-size: 10px;
}

.busy-hint b {
  color: var(--ink);
  font-size: 10px;
  font-weight: 750;
}

.quick-form-error {
  margin: 0;
  padding: 10px 12px;
  color: #b8453a;
  border-radius: 13px;
  background: color-mix(in srgb, #d9503f 9%, var(--paper));
  font-size: 11px;
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
  grid-template-columns: 5px minmax(0,1fr) auto;
  gap: 12px;
  align-items: center;
  min-height: 68px;
  padding: 11px 13px 11px 0;
  overflow: hidden;
  color: var(--ink);
  text-align: left;
  border: 0;
  border-radius: 18px;
  background: #fff;
  box-shadow: var(--elev-sm), var(--glow-top);
  transition: box-shadow .2s ease, background .2s ease, transform .2s ease;
}

.preset-list > button:not(:disabled):active {
  transform: scale(.98);
}

.preset-list > button.selected {
  background: linear-gradient(150deg, #f4f0ff 0%, #fff 70%);
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

.preset-list div {
  min-width: 0;
}

.preset-list strong {
  display: block;
  font-size: 14px;
}

.preset-list small {
  display: block;
  margin-top: 5px;
  overflow: hidden;
  color: var(--muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preset-list span {
  color: var(--muted);
  font-size: 11px;
}

.preset-list b {
  display: grid;
  width: 25px;
  height: 25px;
  place-items: center;
  color: #fff;
  border: 0;
  border-radius: 50%;
  background: #fff;
  box-shadow: inset 0 0 0 1px #e3e5ee;
}

.preset-list button.selected b {
  background: var(--accent-gradient);
  box-shadow: 0 8px 16px -8px rgba(255,122,69,.8);
}

.preset-empty {
  padding: 24px;
  text-align: center;
  border-radius: 18px;
  background: #f5f2fb;
}

.preset-empty p { margin: 0 0 12px; color: #8f889a; font-size: 13px; }
.preset-empty a { display: inline-block; padding: 9px 15px; color: #fff; border-radius: 12px; background: var(--accent-gradient); box-shadow: 0 10px 20px -10px rgba(255,122,69,.8); font-size: 12px; }
.sheet-submit:disabled { cursor: default; opacity: .45; box-shadow: none; }

.overlay {
  position: fixed;
  z-index: 1100;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 18px;
  background: rgba(30, 24, 45, .34);
  backdrop-filter: blur(7px);
}

.sheet {
  width: min(100%, 480px);
  max-height: 90vh;
  padding: 10px 20px calc(22px + env(safe-area-inset-bottom, 0px));
  overflow: auto;
  border-radius: 31px;
  background: #fbfaff;
  box-shadow: 0 25px 70px rgba(37,25,69,.3);
  animation: sheet-up .42s cubic-bezier(.18,.86,.22,1) both;
}

.sheet-handle {
  display: block;
  width: 38px;
  height: 5px;
  margin: 0 auto 18px;
  border-radius: 99px;
  background: #d9d4e3;
}

.sheet-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.sheet-title p { margin: 0 0 3px; color: var(--accent-text); font-size: 11px; font-weight: 700; }
.sheet-title h2 { font-size: 22px; }
.sheet-title button { width: 34px; height: 34px; color: #6f687a; border: 0; border-radius: 50%; background: #eeebf5; font-size: 22px; }

.time-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.sheet-submit {
  width: 100%;
  padding: 14px;
  color: #fff;
  border: 0;
  border-radius: 16px;
  background: var(--accent-gradient);
  box-shadow: 0 14px 26px -10px rgba(255,122,69,.7), inset 0 1px 0 rgba(255,255,255,.28);
  font-weight: 700;
}

.sheet-submit:active { transform: scale(.98); }

.sheet-delete {
  width: 100%;
  margin-top: 8px;
  padding: 12px;
  color: #b4485a;
  border: 0;
  border-radius: 16px;
  background: #fdf1f3;
  font-weight: 650;
}

.sheet-delete:active { transform: scale(.98); }

.sheet-tip { margin: 12px 0 0; color: var(--muted); text-align: center; font-size: 11px; }

.dialog-overlay { align-items: center; }
.confirm-dialog { width: min(100%, 330px); padding: 25px 20px 18px; text-align: center; border-radius: 27px; background: #fff; box-shadow: 0 25px 70px rgba(37,25,69,.3); animation: dialog-in .3s cubic-bezier(.2,.85,.25,1) both; }
.confirm-icon { display: grid; width: 50px; height: 50px; margin: 0 auto 14px; place-items: center; color: #f05b6d; border-radius: 17px; background: #fff0f2; font-size: 23px; font-weight: 800; }
.confirm-dialog h2 { margin-bottom: 20px; font-size: 20px; }
.confirm-dialog > div:last-child { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
.confirm-dialog button { padding: 12px 8px; color: #5e576a; border: 0; border-radius: 14px; background: #f2eff7; font-weight: 650; }
.confirm-dialog button.danger { color: #fff; background: #ed5d6e; }

.toast {
  position: fixed;
  z-index: 1100;
  left: 50%;
  bottom: calc(94px + env(safe-area-inset-bottom, 0px));
  display: flex;
  width: min(calc(100% - 36px), 410px);
  align-items: center;
  justify-content: space-between;
  padding: 13px 15px;
  color: #fff;
  border-radius: 17px;
  background: rgba(37,32,49,.94);
  box-shadow: 0 12px 30px rgba(31,24,47,.25);
  transform: translateX(-50%);
  font-size: 13px;
}

.toast button { color: #b99fff; border: 0; background: transparent; font-weight: 750; }
.fade-enter-active, .fade-leave-active { transition: opacity .25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.toast-enter-active, .toast-leave-active { transition: all .32s cubic-bezier(.2,.8,.2,1); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 18px); }

@keyframes page-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes sheet-up {
  from { opacity: 0; transform: translateY(70px) scale(.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes dialog-in {
  from { opacity: 0; transform: scale(.88); }
  to { opacity: 1; transform: scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    transition-duration: .01ms !important;
  }
}
</style>
