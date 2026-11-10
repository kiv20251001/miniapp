<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { useAppStore } from '@/stores/app'
import { occurrencesInRange } from '@/services/schedule'
import { WEEKDAY_SHORT } from '@/domain/constants'
import type { DayOccurrence } from '@/domain/types'
import { courseScheduleProgress } from '@/services/courseSchedule'
import PageHeader from '@/components/PageHeader.vue'
import CourseScheduleList from '@/components/CourseScheduleList.vue'
import AddOccurrenceSheet from '@/components/AddOccurrenceSheet.vue'
import OccurrenceEditSheet from '@/components/OccurrenceEditSheet.vue'
import { useViewRefresh } from '@/composables/useViewRefresh'

const store = useAppStore()
const cursor = ref(dayjs())
const selected = ref(dayjs().format('YYYY-MM-DD'))
const addSheetOpen = ref(false)
const editing = ref<DayOccurrence | null>(null)
const cancelling = ref<DayOccurrence | null>(null)

const monthStart = computed(() => cursor.value.startOf('month'))

useViewRefresh(() => ({
  from: monthStart.value.format('YYYY-MM-DD'),
  to: monthStart.value.endOf('month').format('YYYY-MM-DD'),
}))
const grid = computed(() => {
  const start = monthStart.value.startOf('week')
  return Array.from({ length: 42 }, (_, i) => start.add(i, 'day'))
})

const monthOcc = computed(() =>
  occurrencesInRange(
    store.overviewCourses,
    monthStart.value.format('YYYY-MM-DD'),
    monthStart.value.endOf('month').format('YYYY-MM-DD'),
    store.overviewScheduleExceptions,
  ),
)

const colorsByDate = computed(() => {
  const map = new Map<string, string[]>()
  for (const item of monthOcc.value) {
    const colors = map.get(item.date)
    if (colors) {
      if (!colors.includes(item.course.color) && colors.length < 3) colors.push(item.course.color)
    } else {
      map.set(item.date, [item.course.color])
    }
  }
  return map
})

function dots(date: string) {
  return colorsByDate.value.get(date) ?? []
}

const dayItems = computed(() =>
  monthOcc.value
    .filter((item) => item.date === selected.value)
    .sort((a, b) => a.course.recurrence.startTime.localeCompare(b.course.recurrence.startTime)),
)

function courseProgress(item: DayOccurrence) {
  return courseScheduleProgress(item.course, selected.value, store.overviewScheduleExceptions)
}

function addToSelectedDay() {
  addSheetOpen.value = true
}

function onOccurrenceAdded(date: string) {
  selected.value = date
  const added = dayjs(date)
  if (!added.isSame(cursor.value, 'month')) cursor.value = added
}

function editCourse(item: DayOccurrence) {
  editing.value = item
}

function requestCancel(item: DayOccurrence) {
  cancelling.value = item
  editing.value = null
}

async function confirmCancel() {
  if (!cancelling.value) return
  const item = cancelling.value
  if (item.exception?.status === 'added') await store.dropOccurrenceSlot(item.course.id, item.date)
  else {
    await store.upsertScheduleException({
      courseId: item.course.id,
      date: item.date,
      status: 'cancelled',
    })
  }
  cancelling.value = null
}

function pick(date: dayjs.Dayjs) {
  selected.value = date.format('YYYY-MM-DD')
  if (!date.isSame(cursor.value, 'month')) cursor.value = date
}
</script>

<template>
  <main class="page calendar-page">
    <PageHeader eyebrow="课程日历" :title="cursor.format('YYYY年M月')">
      <template #actions>
      <div class="nav">
        <button type="button" aria-label="上月" @click="cursor = cursor.subtract(1, 'month')">‹</button>
        <button type="button" @click="cursor = dayjs(); selected = dayjs().format('YYYY-MM-DD')">今</button>
        <button type="button" aria-label="下月" @click="cursor = cursor.add(1, 'month')">›</button>
      </div>
      </template>
    </PageHeader>

    <section class="card cal">
      <div class="week">
        <span v-for="d in WEEKDAY_SHORT" :key="d">{{ d }}</span>
      </div>
      <div class="days">
        <button
          v-for="day in grid"
          :key="day.format('YYYY-MM-DD')"
          type="button"
          class="day"
          :class="{
            muted: !day.isSame(cursor, 'month'),
            today: day.isSame(dayjs(), 'day'),
            on: day.format('YYYY-MM-DD') === selected,
          }"
          @click="pick(day)"
        >
          {{ day.date() }}
          <i class="dots">
            <b v-for="color in dots(day.format('YYYY-MM-DD'))" :key="color" :style="{ background: color }" />
          </i>
        </button>
      </div>
    </section>

    <CourseScheduleList
      :title="`${dayjs(selected).format('M月D日')}安排`"
      :items="dayItems"
      :progress-for="courseProgress"
      action-label="新增"
      @add="addToSelectedDay"
      @edit="editCourse"
    />

    <AddOccurrenceSheet
      v-model:open="addSheetOpen"
      :date="selected"
      @added="onOccurrenceAdded"
    />

    <OccurrenceEditSheet
      :item="editing"
      @close="editing = null"
      @cancel="requestCancel"
    />

    <div v-if="cancelling" class="overlay" @click.self="cancelling = null">
      <section class="confirm-dialog">
        <h2>取消这一次课程？</h2>
        <div class="confirm-actions">
          <button type="button" @click="cancelling = null">暂不取消</button>
          <button class="danger" type="button" @click="confirmCancel">确认取消</button>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.nav {
  display: flex;
  overflow: hidden;
  align-items: center;
  padding: 3px;
  border: 0;
  border-radius: 14px;
  background: var(--paper);
  box-shadow: var(--elev-sm), var(--glow-top);
}
.nav button {
  display: grid;
  width: 32px;
  height: 30px;
  padding: 0;
  place-items: center;
  color: var(--muted);
  border: 0;
  border-radius: 11px;
  background: transparent;
  font-size: 15px;
  font-weight: 700;
  transition: color .2s ease, background .2s ease;
}
.nav button:nth-child(2) {
  width: 38px;
  color: var(--accent-text);
  background: var(--accent-soft);
  font-size: 12px;
}
.nav button:hover {
  color: var(--ink);
}
.cal {
  margin-bottom: 18px;
}
.week,
.days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
}
.week {
  color: var(--muted);
  font-size: 12px;
  margin-bottom: 8px;
}
.day {
  position: relative;
  height: 46px;
  border: 0;
  background: transparent;
  border-radius: 12px;
}
.day.muted {
  color: color-mix(in srgb, var(--muted) 60%, transparent);
}
.day.today {
  font-weight: 700;
}
.day.on {
  color: #fff;
  background: var(--accent-gradient);
  box-shadow: 0 12px 22px -10px rgba(255,122,69,.75), inset 0 1px 0 rgba(255,255,255,.28);
}
.day.on .dots i {
  box-shadow: 0 0 0 1px rgba(255,255,255,.7);
}
.dots {
  display: flex;
  justify-content: center;
  gap: 3px;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 6px;
}
.dots b {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  background: rgba(28, 22, 48, .38);
}
.confirm-dialog {
  width: min(100%, 330px);
  padding: 24px 20px 18px;
  text-align: center;
  border-radius: 24px;
  background: var(--paper);
}
.confirm-dialog h2 { margin-bottom: 20px; font-size: 20px; }
.confirm-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
.confirm-actions button {
  padding: 12px 8px;
  border: 0;
  border-radius: 14px;
  background: var(--surface-2);
  font-weight: 650;
}
.confirm-actions .danger { color: #fff; background: #ed5d6e; }
</style>
