<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { occurrencesOnDate } from '@server-domain/schedule'
import type { DayOccurrence, Homework } from '@server-domain/types'
import { showCloudError } from '@/cloud/call'
import { homeworkStatusMap } from '@/domain/homework'
import { useFamilyStore } from '@/stores/family'
import { useUiStore } from '@/stores/ui'
import { monthMatrix, occurrenceDots } from '@/utils/view'
import PageHeader from '@/components/PageHeader.vue'
import DayCourseList from '@/components/DayCourseList.vue'
import AddSheet from '@/components/AddSheet.vue'
import HomeworkBadge from '@/components/HomeworkBadge.vue'
import OccurrenceSheet from '@/components/OccurrenceSheet.vue'

defineProps<{ active: boolean }>()
const emit = defineEmits<{ cover: [covered: boolean] }>()
const store = useFamilyStore()
const ui = useUiStore()
const cursor = ref(dayjs().format('YYYY-MM'))
const addOpen = ref(false)
const editingHomework = ref<Homework | null>(null)
const editing = ref<DayOccurrence | null>(null)
const cancelled = ref<DayOccurrence | null>(null)

watch([addOpen, editing], () => {
  emit('cover', addOpen.value || Boolean(editing.value))
}, { immediate: true })

function openAdd() {
  if (!store.canWrite) return
  editingHomework.value = null
  addOpen.value = true
}

function openEdit(item: DayOccurrence) {
  editing.value = item
}

function openHomework(item: Homework) {
  if (!store.canWrite) return
  editingHomework.value = item
  addOpen.value = true
}

function closeAdd() {
  addOpen.value = false
  editingHomework.value = null
}

const cells = computed(() => monthMatrix(cursor.value))
const items = computed(() =>
  occurrencesOnDate(store.overviewCourses, ui.selectedDate, store.overviewScheduleExceptions),
)
/** 只随月份和课程数据变化；点选日期不会触发重算。 */
const cellColors = computed(() => cells.value.map((date) => date
  ? occurrenceDots(store.overviewCourses, date, store.overviewScheduleExceptions)
  : []))
const cellHomework = computed(() => homeworkStatusMap(store.homework, cells.value, ui.today))
const cellViews = computed(() => cells.value.map((date, index) => ({
  homework: date ? cellHomework.value[date] ?? 'none' : 'none',
  date,
  label: date ? Number(date.slice(8, 10)) : '',
  muted: Boolean(date) && date!.slice(0, 7) !== cursor.value,
  today: date === ui.today,
  on: date === ui.selectedDate,
  colors: cellColors.value[index],
})))
const monthTitle = computed(() => dayjs(`${cursor.value}-01`).format('YYYY年M月'))
const listTitle = computed(() => `${dayjs(ui.selectedDate).format('M月D日')}计划`)

function shiftMonth(delta: number) {
  cursor.value = dayjs(`${cursor.value}-01`).add(delta, 'month').format('YYYY-MM')
}

function pick(date: string) {
  ui.selectedDate = date
  cursor.value = date.slice(0, 7)
}

function jump(date: string) {
  if (!date) return
  pick(date)
}

async function undoCancel() {
  const item = cancelled.value
  if (!item) return
  try {
    if (item.exception?.status === 'added') {
      await store.upsertException({
        courseId: item.course.id,
        date: item.date,
        status: 'added',
        startTime: item.exception.startTime,
        endTime: item.exception.endTime,
        title: item.exception.title,
        location: item.exception.location,
      })
    } else {
      await store.restoreOccurrence({
        courseId: item.course.id,
        date: item.date,
        startTime: item.exception?.startTime ?? item.course.recurrence.startTime,
        endTime: item.exception?.endTime ?? item.course.recurrence.endTime,
      })
    }
    cancelled.value = null
  } catch (error) {
    showCloudError(error)
  }
}
</script>

<template>
    <view class="page">
      <PageHeader eyebrow="课程日历" :title="monthTitle">
        <template #actions>
          <view class="nav">
            <button hover-class="press-on" hover-stay-time="80" @click="shiftMonth(-1)">‹</button>
            <button hover-class="press-on" hover-stay-time="80" class="today" @click="pick(ui.today)">今</button>
            <button hover-class="press-on" hover-stay-time="80" @click="shiftMonth(1)">›</button>
          </view>
        </template>
      </PageHeader>
      <view class="card cal">
        <view class="week">
          <text v-for="label in ['一', '二', '三', '四', '五', '六', '日']" :key="label">{{ label }}</text>
        </view>
        <view class="days">
          <button hover-class="press-on" hover-stay-time="80"
            v-for="(cell, index) in cellViews"
            :key="index"
            class="day"
            :class="{ muted: cell.muted, today: cell.today, on: cell.on }"
            @click="cell.date && pick(cell.date)"
          >
            <HomeworkBadge v-if="cell.date" :status="cell.homework" :size="10" />
            <text>{{ cell.label }}</text>
            <view class="dots">
              <view v-for="dot in cell.colors" :key="dot.id" :style="{ background: dot.color }" />
            </view>
          </button>
        </view>
      </view>
      <DayCourseList
        :title="listTitle"
        :date="ui.selectedDate"
        :items="items"
        :readonly="!store.canWrite"
        :hide-fee="!store.canViewBills"
        @add="openAdd"
        @edit="openEdit"
        @edit-homework="openHomework"
      />
      <view v-if="cancelled" class="undo">
        <text>已取消“{{ cancelled.course.title }}”</text>
        <button hover-class="press-on" hover-stay-time="80" @click="undoCancel">撤销</button>
      </view>
      <AddSheet v-if="store.canWrite && addOpen" :open="addOpen" :date="ui.selectedDate" :homework="editingHomework" @close="closeAdd" />
      <OccurrenceSheet v-if="editing" :item="editing" :readonly="!store.canWrite" @close="editing = null" @cancelled="cancelled = $event" />
    </view>
</template>

<style scoped>
.nav {
  display: flex;
  align-items: center;
  padding: 3px;
  border-radius: 14px;
  background: var(--paper);
  box-shadow: var(--elev-sm);
}
.nav button {
  display: flex;
  width: 32px;
  height: 30px;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  border-radius: 11px;
  font-size: 16px;
  font-weight: 700;
  line-height: 30px;
}
.nav .today {
  width: 38px;
  color: var(--accent-text);
  background: var(--accent-soft);
  font-size: 12px;
}
.cal { margin-bottom: 18px; }
.week, .days { display: flex; flex-wrap: wrap; text-align: center; }
.week text, .day { width: 14.28%; }
.week { color: var(--muted); font-size: 12px; margin-bottom: 8px; }
.day {
  position: relative;
  height: 46px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  font-size: 14px;
}
.day.muted { color: var(--faint); }
.day.today { font-weight: 700; }
.day.on { background: var(--accent-soft); color: var(--accent-text); font-weight: 700; }
.dots { display: flex; justify-content: center; gap: 2px; min-height: 5px; margin-top: 2px; }
.dots view { width: 4px; height: 4px; border-radius: 50%; }
</style>
