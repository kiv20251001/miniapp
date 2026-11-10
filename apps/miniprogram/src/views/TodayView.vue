<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { WEEKDAY_SHORT } from '@server-domain/constants'
import { occurrencesOnDate } from '@server-domain/schedule'
import { billNetAmount, billsInDueRange, money } from '@server-domain/billing'
import { sumUnbilledCharges } from '@server-domain/charges'
import type { DayOccurrence, Homework } from '@server-domain/types'
import { showCloudError } from '@/cloud/call'
import { homeworkStatusMap } from '@/domain/homework'
import { onViewShow } from '@/composables/useTabView'
import { useFamilyStore } from '@/stores/family'
import { useUiStore } from '@/stores/ui'
import { openTab } from '@/utils/nav'
import { occurrenceDots, weekDates, weekLabel } from '@/utils/view'
import AppIcon from '@/components/AppIcon.vue'
import DayCourseList from '@/components/DayCourseList.vue'
import AddSheet from '@/components/AddSheet.vue'
import HomeworkBadge from '@/components/HomeworkBadge.vue'
import OccurrenceSheet from '@/components/OccurrenceSheet.vue'

const props = defineProps<{ active: boolean }>()
const emit = defineEmits<{ cover: [covered: boolean] }>()
const store = useFamilyStore()
const ui = useUiStore()
const addOpen = ref(false)
const editingHomework = ref<Homework | null>(null)
const editing = ref<DayOccurrence | null>(null)
const cancelled = ref<DayOccurrence | null>(null)
let undoTimer: ReturnType<typeof setTimeout> | undefined
/** 页面常驻，进度环按“回到页面的时刻”计算，而不是首次打开的时刻。 */
const clock = ref(dayjs().format('HH:mm'))

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

function openBills() {
  uni.navigateTo({ url: '/subpages/bills/index?from=today' })
}

watch([addOpen, editing], () => {
  emit('cover', addOpen.value || Boolean(editing.value))
}, { immediate: true })

function takePendingAdd() {
  if (!props.active || !ui.pendingAdd) return
  ui.pendingAdd = false
  openAdd()
}

onViewShow(() => props.active, () => {
  clock.value = dayjs().format('HH:mm')
  takePendingAdd()
})
/** 底栏“快速新增”在今日视图上点下时，视图没有切换，只能靠监听标记。 */
watch(() => ui.pendingAdd, takePendingAdd)

const days = computed(() => weekDates(ui.selectedDate))
const items = computed(() =>
  occurrencesOnDate(store.overviewCourses, ui.selectedDate, store.overviewScheduleExceptions)
    .slice()
    .sort((a, b) => a.course.recurrence.startTime.localeCompare(b.course.recurrence.startTime)),
)
const weekBills = computed(() => billsInDueRange(store.overviewExpenses, days.value[0], days.value[6]))
const weekOpen = computed(() =>
  weekBills.value.filter((item) => item.status !== 'paid').reduce((sum, item) => sum + billNetAmount(item, store.overviewPayments), 0),
)
const weekSettledPercent = computed(() => {
  const total = weekBills.value.reduce((sum, item) => sum + billNetAmount(item, store.overviewPayments), 0)
  if (!total) return 0
  const paid = weekBills.value.filter((item) => item.status === 'paid').reduce((sum, item) => sum + billNetAmount(item, store.overviewPayments), 0)
  return Math.round((paid / total) * 100)
})
const isThisWeek = computed(() => days.value[0] === weekDates(ui.today)[0])
const recordDates = computed(() => new Map((store.snapshot.occurrenceRecords ?? []).map((item) => [item.id, item.date])))
const weekUnbilled = computed(() => {
  const start = days.value[0]
  const end = days.value[6]
  return sumUnbilledCharges(store.overviewCharges, (charge) => {
    const recordDate = recordDates.value.get(charge.occurrenceId)
    const date = recordDate ?? charge.occurrenceId.slice(charge.occurrenceId.lastIndexOf('_') + 1)
    return date >= start && date <= end
  })
})
const dayDonePercent = computed(() => {
  const total = items.value.length
  if (!total) return 0
  const today = ui.today
  if (ui.selectedDate < today) return 100
  if (ui.selectedDate > today) return 0
  const now = clock.value
  const done = items.value.filter((item) => (item.exception?.endTime ?? item.course.recurrence.endTime) <= now).length
  return Math.round((done / total) * 100)
})

const weekHomework = computed(() => homeworkStatusMap(store.homework, days.value, ui.today))
const dayViews = computed(() => days.value.map((date) => ({
  date,
  weekday: WEEKDAY_SHORT[dayjs(date).day()],
  num: Number(date.slice(8, 10)),
  colors: occurrenceDots(store.overviewCourses, date, store.overviewScheduleExceptions),
  homework: weekHomework.value[date] ?? 'none',
})))
const isToday = computed(() => ui.selectedDate === ui.today)
const selectedLabel = computed(() => dayjs(ui.selectedDate).format('M月D日'))

function shiftWeek(delta: number) {
  ui.selectedDate = dayjs(ui.selectedDate).add(delta, 'week').format('YYYY-MM-DD')
}

function rememberCancel(item: DayOccurrence) {
  cancelled.value = item
  clearTimeout(undoTimer)
  undoTimer = setTimeout(() => {
    cancelled.value = null
  }, 4500)
}

async function undoCancel() {
  const item = cancelled.value
  if (!item) return
  const slot = {
    courseId: item.course.id,
    date: item.date,
    startTime: item.exception?.startTime ?? item.course.recurrence.startTime,
    endTime: item.exception?.endTime ?? item.course.recurrence.endTime,
  }
  try {
    if (item.exception?.status === 'added') {
      await store.upsertException({
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
      await store.restoreOccurrence(slot)
    }
    cancelled.value = null
  } catch (error) {
    showCloudError(error)
  }
}
</script>

<template>
  <view class="page today-page">
      <view class="week-picker">
        <view class="week-toolbar">
          <button hover-class="press-on" hover-stay-time="80" @click="shiftWeek(-1)"><AppIcon name="chevron-left" tone="muted" :size="18" /></button>
          <text>{{ isThisWeek ? '本周' : weekLabel(ui.selectedDate) }}</text>
          <button hover-class="press-on" hover-stay-time="80" @click="shiftWeek(1)"><AppIcon name="chevron-right" tone="muted" :size="18" /></button>
        </view>
        <view class="date-strip">
          <button hover-class="press-on" hover-stay-time="80"
            v-for="day in dayViews"
            :key="day.date"
            :class="{ active: day.date === ui.selectedDate, today: day.date === ui.today }"
            @click="ui.selectedDate = day.date"
          >
            <HomeworkBadge :status="day.homework" :inverse="day.date === ui.selectedDate" :size="11" />
            <text>{{ day.weekday }}</text>
            <text class="num">{{ day.num }}</text>
            <view class="course-dots">
              <view v-for="dot in day.colors" :key="dot.id" :style="{ background: dot.color }" />
            </view>
          </button>
        </view>
      </view>

      <view class="overview">
        <view class="overview-card press" hover-class="press-on" hover-stay-time="80" @click="openTab('calendar')">
          <view class="overview-head">
            <view class="mark"><AppIcon name="calendar" tone="white" :size="15" /></view>
            <text>课程日历</text>
            <text class="more">›</text>
          </view>
          <view v-if="store.booting" class="overview-body">
            <view>
              <view class="sk sk-title boot-num" />
              <view class="sk sk-line boot-sub" />
            </view>
            <view class="sk boot-ring" />
          </view>
          <view v-else class="overview-body">
            <view>
              <text class="big">{{ items.length }}</text>
              <text class="muted">节课程</text>
            </view>
            <view class="overview-ring" :style="{ '--ring': dayDonePercent + '%' }">
              <text>{{ dayDonePercent }}%</text>
            </view>
          </view>
        </view>
        <view v-if="store.canViewBills" class="overview-card is-bill press" hover-class="press-on" hover-stay-time="80" @click="openBills">
          <view class="overview-head">
            <view class="mark bill"><AppIcon name="bill" tone="white" :size="15" /></view>
            <text>本周课程账单</text>
            <text class="more">›</text>
          </view>
          <view v-if="store.booting" class="overview-body">
            <view>
              <view class="sk sk-title boot-num" />
              <view class="sk sk-line boot-sub" />
            </view>
            <view class="sk boot-ring" />
          </view>
          <view v-else class="overview-body">
            <view>
              <text class="big">{{ money(weekOpen) }}</text>
              <text class="muted">{{ weekBills.length }} 笔账单{{ weekUnbilled ? ' · 待结算 ' + money(weekUnbilled) : '' }}</text>
            </view>
            <view class="overview-ring" :style="{ '--ring': weekSettledPercent + '%' }">
              <text>{{ weekSettledPercent }}%</text>
            </view>
          </view>
        </view>
      </view>

      <DayCourseList
        :title="isToday ? '今日计划' : selectedLabel + '计划'"
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
      <OccurrenceSheet v-if="editing" :item="editing" :readonly="!store.canWrite" @close="editing = null" @cancelled="rememberCancel" />
  </view>
</template>

<style scoped>
.today-page { padding-top: 8px; }
.week-picker {
  margin-bottom: 20px;
  padding: 12px 10px 10px;
  border-radius: 24px;
  background: linear-gradient(170deg, var(--paper) 0%, var(--accent-soft) 100%);
  box-shadow: var(--elev-md), var(--glow-top);
}
.week-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 5px;
}
.week-toolbar button {
  display: flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
}
.week-toolbar text { color: var(--muted); font-size: 11px; font-weight: 650; }
.date-strip { display: flex; gap: 4px; }
.date-strip button {
  position: relative;
  flex: 1;
  height: 62px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  border-radius: 16px;
  font-size: 11px;
}
.date-strip .num { margin-top: 4px; color: var(--ink); font-size: 15px; font-weight: 700; }
.date-strip button.active {
  color: #fff;
  background: linear-gradient(135deg, #ffb45c 0%, #ff7a45 48%, #f15a36 100%);
  box-shadow: 0 14px 26px -10px rgba(255,122,69,.75);
}
.date-strip button.active .num { color: #fff; }
.course-dots { display: flex; min-height: 6px; justify-content: center; gap: 2px; margin-top: 5px; }
.course-dots view { width: 6px; height: 6px; border-radius: 50%; }
.overview { display: flex; gap: 11px; margin-bottom: 28px; }
.overview-card {
  flex: 1;
  min-height: 118px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 14px 15px;
  border-radius: 24px;
  background: linear-gradient(150deg, var(--accent-soft) 0%, var(--paper) 62%);
  box-shadow: var(--elev-md), var(--glow-top);
}
.overview-card.is-bill {
  background: linear-gradient(150deg, var(--unpaid-soft) 0%, var(--paper) 62%);
  box-shadow: var(--elev-md), var(--glow-top);
}
.overview-head { display: flex; align-items: center; gap: 6px; color: var(--muted); font-size: 11px; font-weight: 700; }
.overview-head text:nth-child(2) { flex: 1; }
.mark {
  display: flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  background: linear-gradient(140deg, #ff9a62, #e95331);
  box-shadow: 0 6px 14px -6px rgba(255, 122, 69, 0.75), inset 0 1px 0 rgba(255,255,255,.45);
}
.mark.bill { background: linear-gradient(140deg, #ff8ea3, #d93d59); box-shadow: 0 6px 14px -6px rgba(255, 95, 121, 0.75), inset 0 1px 0 rgba(255,255,255,.45); }
.more { font-size: 15px; }
.overview-body { display: flex; align-items: flex-end; justify-content: space-between; }
.boot-num { width: 48px; margin-bottom: 8px; }
.boot-sub { width: 64px; }
.boot-ring { width: 44px; height: 44px; border-radius: 50%; }
.big { display: block; color: var(--ink); font-size: 22px; font-weight: 800; letter-spacing: -0.04em; }
.overview-ring {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: conic-gradient(from 210deg, #e95331 0deg, #ff7a45 var(--ring), var(--ring-rest) var(--ring));
  box-shadow: 0 8px 16px -8px rgba(255, 122, 69, 0.7);
  font-size: 9px;
  font-weight: 800;
  color: #e95331;
}
.is-bill .overview-ring {
  background: conic-gradient(from 210deg, #d93d59 0deg, #ff5f79 var(--ring), var(--ring-rest-bill) var(--ring));
  box-shadow: 0 8px 16px -8px rgba(255, 95, 121, 0.7);
  color: #d93d59;
}
.overview-ring text {
  width: 33px;
  height: 33px;
  border-radius: 50%;
  background: var(--paper);
  text-align: center;
  line-height: 33px;
  box-shadow: inset 0 1px 3px rgba(25, 31, 58, 0.08);
}
</style>
