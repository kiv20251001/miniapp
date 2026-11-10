<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import {
  COURSE_COLORS,
  COURSE_ICON_COLORS,
  COURSE_ICON_OPTIONS,
  COURSE_TYPE_OPTIONS,
  WEEKDAY_SHORT,
  unusedCourseColor,
} from '@/domain/constants'
import type {
  BillingMode,
  CourseDateSlot,
  CourseIcon as CourseIconName,
  CoursePricingMode,
  CourseType,
  PackageUnit,
} from '@/domain/types'
import { effectiveCourseSlots } from '@/services/courseSchedule'
import {
  busyIntervalsForDates,
  endTimeOptions,
  ensureTimeOption,
  minutesBetween,
  nextAvailableEndTime,
  scheduleConflictMessage,
  startTimeOptions,
} from '@/services/schedule'
import CourseIcon from '@/components/CourseIcon.vue'
import ChildProfilePicker from '@/components/ChildProfilePicker.vue'
import AppSelect from '@/components/AppSelect.vue'
import AppTimeSelect from '@/components/AppTimeSelect.vue'
import AppPaySwitch from '@/components/AppPaySwitch.vue'
import PageHeader from '@/components/PageHeader.vue'
import dayjs from 'dayjs'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const id = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const returnTo = computed(() => {
  const target = typeof route.query.returnTo === 'string' ? route.query.returnTo : '/'
  return target.startsWith('/') ? target : '/'
})
const existing = computed(() => store.snapshot.courses.find((course) => course.id === id.value))
const calendarMonth = ref(dayjs().startOf('month'))
const batchStartTime = ref(existing.value?.recurrence.startTime ?? '18:00')
const batchEndTime = ref(existing.value?.recurrence.endTime ?? '19:00')
const editingSlot = ref<CourseDateSlot | null>(null)
const formError = ref('')
const slotTimeError = ref('')
const dragging = ref(false)
let dragMode: 'add' | 'remove' = 'add'
const dragVisited = new Set<string>()
let dragStartDate = ''
let dragStartX = 0
let dragStartY = 0
let didDrag = false
const courseTypeOptions = COURSE_TYPE_OPTIONS
const pricingPlanOptions = [
  { value: 'prepaid', label: '一次性支付', caption: '报名或购买课包时支付总金额' },
  { value: 'usage', label: '按需计费', caption: '按实际次数或小时累计' },
  { value: 'free', label: '无需缴费', caption: '只记录课程安排' },
]
const usageUnitOptions = [
  { value: 'per_session', label: '按次', caption: '每完成一节按单次价格计费' },
  { value: 'per_hour', label: '按小时', caption: '按课程实际时长计算' },
]

function setCourseType(value: string) {
  form.type = value as CourseType
}

function initialPricingMode(): CoursePricingMode {
  if (!existing.value) return 'prepaid'
  if (existing.value.billingPolicy?.pricingMode === 'fixed_period') return 'per_session'
  if (existing.value.billingPolicy) return existing.value.billingPolicy.pricingMode
  if (existing.value.billingMode === 'free') return 'free'
  if (existing.value.billingMode === 'session') return 'per_session'
  if (existing.value.billingMode === 'term') return 'prepaid'
  return 'per_session'
}

function initialSettlementCycle(): SettlementCycle {
  if (!existing.value) return 'upfront'
  if (existing.value?.billingPolicy) return existing.value.billingPolicy.settlementCycle
  if (existing.value?.billingMode === 'monthly') return 'monthly'
  if (existing.value?.billingMode === 'term') return 'upfront'
  return 'manual'
}

function upfrontExpenseStatus() {
  const expense = store.snapshot.expenses.find(
    (item) => item.courseId === id.value
      && (item.source === 'course_upfront' || item.billingMode === 'term'),
  )
  return expense?.status === 'paid' ? 'paid' as const : 'unpaid' as const
}

function initialChildIds() {
  if (existing.value?.childIds?.length) return [...existing.value.childIds]
  if (existing.value?.childId) return [existing.value.childId]
  return [store.snapshot.children[0]?.id].filter(Boolean) as string[]
}

const form = reactive({
  childIds: initialChildIds(),
  title: existing.value?.title ?? '',
  type: (existing.value?.type ?? 'interest') as CourseType,
  teacher: existing.value?.teacher ?? '',
  location: existing.value?.location ?? '',
  icon: (existing.value?.icon ?? 'generic') as CourseIconName,
  color: existing.value?.color ?? unusedCourseColor(store.snapshot.courses),
  pricingMode: initialPricingMode(),
  settlementCycle: initialSettlementCycle(),
  paymentStatus: upfrontExpenseStatus(),
  amount: existing.value?.amount ?? 0,
  packageEnabled: Number(existing.value?.billingPolicy?.packageUnits) > 0,
  packageUnit: (existing.value?.billingPolicy?.packageUnit ?? 'session') as PackageUnit,
  packageUnits: existing.value?.billingPolicy?.packageUnits ?? 20,
  note: existing.value?.note ?? '',
})

const paymentPlan = computed(() => {
  if (form.pricingMode === 'per_session' || form.pricingMode === 'per_hour') return 'usage'
  return form.pricingMode
})

const billingAmountLabel = computed(() => {
  if (form.pricingMode === 'prepaid') return '课程总金额'
  if (form.pricingMode === 'per_hour') return '每小时费用'
  return '单次费用'
})

const billingSummary = computed(() => {
  const amount = `¥${Math.max(0, Number(form.amount) || 0).toLocaleString('zh-CN')}`
  if (form.pricingMode === 'free') return '该课程无需缴费，只记录课程安排。'
  if (form.pricingMode === 'prepaid') {
    return `课程总费用 ${amount}，当前${form.paymentStatus === 'paid' ? '已支付' : '待支付'}。`
  }
  const unit = form.pricingMode === 'per_hour' ? '每小时' : '每完成 1 次'
  return `${unit}计费 ${amount}；取消未上的课次不计费。`
})

function choosePaymentPlan(value: string) {
  if (value === 'usage') {
    if (form.pricingMode !== 'per_session' && form.pricingMode !== 'per_hour') {
      form.pricingMode = 'per_session'
    }
    form.settlementCycle = 'manual'
    return
  }
  form.pricingMode = value as CoursePricingMode
  form.settlementCycle = value === 'prepaid' ? 'upfront' : 'manual'
}

function setUsageUnit(value: string) {
  form.pricingMode = value as Extract<CoursePricingMode, 'per_session' | 'per_hour'>
}

function compatibilityBillingMode(): BillingMode {
  if (form.pricingMode === 'free') return 'free'
  if (form.pricingMode === 'prepaid') return 'term'
  if (form.pricingMode === 'fixed_period') return 'monthly'
  return 'session'
}

function selectCourseIcon(icon: CourseIconName) {
  const systemColors = new Set([
    ...COURSE_COLORS.map((color) => color.toUpperCase()),
    ...Object.values(COURSE_ICON_COLORS).map((color) => color.toUpperCase()),
  ])
  form.icon = icon
  if (!id.value || systemColors.has(form.color.toUpperCase())) {
    form.color = unusedCourseColor(store.snapshot.courses, {
      preferred: COURSE_ICON_COLORS[icon],
      exceptId: id.value || undefined,
    })
  }
}

function initialSlots(): CourseDateSlot[] {
  const course = existing.value
  if (!course) return []
  const exceptions = store.snapshot.scheduleExceptions.filter((item) => item.courseId === course.id)
  return effectiveCourseSlots(course, exceptions)
}

const slots = ref<CourseDateSlot[]>(initialSlots())
const isLegacySchedule = computed(
  () => Boolean(existing.value && existing.value.recurrence.freq !== 'dates'),
)

const batchBusyIntervals = computed(() =>
  busyIntervalsForDates(
    store.overviewCourses,
    slots.value.map((slot) => slot.date),
    store.overviewScheduleExceptions,
    id.value || undefined,
    form.childIds,
  ),
)

const slotBusyIntervals = computed(() =>
  busyIntervalsForDates(
    store.overviewCourses,
    editingSlot.value?.date ? [editingSlot.value.date] : [],
    store.overviewScheduleExceptions,
    id.value || undefined,
    form.childIds,
  ),
)

const batchStartTimeOptions = computed(() =>
  ensureTimeOption(startTimeOptions(batchBusyIntervals.value), batchStartTime.value),
)
const slotStartTimeOptions = computed(() =>
  ensureTimeOption(startTimeOptions(slotBusyIntervals.value), editingSlot.value?.startTime ?? ''),
)
const batchEndTimeOptions = computed(() =>
  ensureTimeOption(endTimeOptions(batchBusyIntervals.value, batchStartTime.value), batchEndTime.value),
)
const slotEndTimeOptions = computed(() =>
  ensureTimeOption(
    endTimeOptions(slotBusyIntervals.value, editingSlot.value?.startTime ?? ''),
    editingSlot.value?.endTime ?? '',
  ),
)

const batchTimeHint = computed(() => {
  if (!slots.value.length) return '先选择上课日期，再对照已有课程避开冲突时间。'
  const start = batchStartTimeOptions.value.find((option) => option.value === batchStartTime.value)
  if (start?.disabled) return start.caption || '开始时间已被占用'
  const end = batchEndTimeOptions.value.find((option) => option.value === batchEndTime.value)
  if (end?.disabled) return end.caption || '结束时间与已有课程冲突'
  return '灰色时间已被所选孩子的其他课程占用。'
})

const batchTimeConflict = computed(() => {
  const start = batchStartTimeOptions.value.find((option) => option.value === batchStartTime.value)
  const end = batchEndTimeOptions.value.find((option) => option.value === batchEndTime.value)
  return Boolean(start?.disabled || end?.disabled)
})

function setBatchStartTime(start: string) {
  const duration = minutesBetween(batchStartTime.value, batchEndTime.value)
  batchStartTime.value = start
  batchEndTime.value = nextAvailableEndTime(
    batchBusyIntervals.value,
    start,
    duration > 0 ? duration : 60,
  ) || batchEndTime.value
}

function setSlotStartTime(start: string) {
  if (!editingSlot.value) return
  const duration = minutesBetween(editingSlot.value.startTime, editingSlot.value.endTime)
  editingSlot.value.startTime = start
  editingSlot.value.endTime = nextAvailableEndTime(
    slotBusyIntervals.value,
    start,
    duration > 0 ? duration : 60,
  ) || editingSlot.value.endTime
}

watch(id, () => {
  slots.value = initialSlots()
  const course = existing.value
  batchStartTime.value = course?.recurrence.startTime ?? '18:00'
  batchEndTime.value = course?.recurrence.endTime ?? '19:00'
  Object.assign(form, {
    childIds: initialChildIds(),
    title: course?.title ?? '',
    type: (course?.type ?? 'interest') as CourseType,
    teacher: course?.teacher ?? '',
    location: course?.location ?? '',
    icon: (course?.icon ?? 'generic') as CourseIconName,
    color: course?.color ?? unusedCourseColor(store.snapshot.courses),
    pricingMode: initialPricingMode(),
    settlementCycle: initialSettlementCycle(),
    paymentStatus: upfrontExpenseStatus(),
    amount: course?.amount ?? 0,
    packageEnabled: Number(course?.billingPolicy?.packageUnits) > 0,
    packageUnit: (course?.billingPolicy?.packageUnit ?? 'session') as PackageUnit,
    packageUnits: course?.billingPolicy?.packageUnits ?? 20,
    note: course?.note ?? '',
  })
})
const sortedSlots = computed(() => [...slots.value].sort((a, b) => a.date.localeCompare(b.date)))
const monthSlots = computed(() =>
  sortedSlots.value.filter((slot) => dayjs(slot.date).isSame(calendarMonth.value, 'month')),
)
const calendarDays = computed(() => {
  const start = calendarMonth.value.startOf('month').startOf('week')
  return Array.from({ length: 42 }, (_, index) => start.add(index, 'day'))
})

function findSlot(date: string) {
  return slots.value.find((slot) => slot.date === date)
}

function applyDateSelection(date: string) {
  if (dragVisited.has(date)) return
  dragVisited.add(date)
  const index = slots.value.findIndex((slot) => slot.date === date)
  if (dragMode === 'remove') {
    if (index >= 0) slots.value.splice(index, 1)
    return
  }
  if (index < 0) {
    slots.value.push({
      date,
      startTime: batchStartTime.value,
      endTime: batchEndTime.value,
    })
  }
}

function onPointerMove(event: PointerEvent) {
  if (!dragging.value) return
  event.preventDefault()
  if (!didDrag && Math.hypot(event.clientX - dragStartX, event.clientY - dragStartY) > 6) {
    didDrag = true
    if (dragMode === 'remove') applyDateSelection(dragStartDate)
  }
  if (!didDrag) return
  const target = document.elementFromPoint(event.clientX, event.clientY)
  const button = target?.closest<HTMLElement>('[data-course-date]')
  const date = button?.dataset.courseDate
  if (date && dayjs(date).isSame(calendarMonth.value, 'month')) applyDateSelection(date)
}

function stopDragging() {
  if (dragging.value && dragMode === 'remove' && !didDrag) {
    const slot = findSlot(dragStartDate)
    if (slot) openSlot(slot)
  }
  dragging.value = false
  document.removeEventListener('pointermove', onPointerMove)
  document.removeEventListener('pointerup', stopDragging)
  document.removeEventListener('pointercancel', stopDragging)
}

function startSelecting(date: string, event: PointerEvent) {
  if (!dayjs(date).isSame(calendarMonth.value, 'month')) return
  event.preventDefault()
  dragVisited.clear()
  dragMode = findSlot(date) ? 'remove' : 'add'
  dragStartDate = date
  dragStartX = event.clientX
  dragStartY = event.clientY
  didDrag = false
  dragging.value = true
  if (dragMode === 'add') applyDateSelection(date)
  document.addEventListener('pointermove', onPointerMove, { passive: false })
  document.addEventListener('pointerup', stopDragging, { once: true })
  document.addEventListener('pointercancel', stopDragging, { once: true })
}

function applyBatchTime() {
  if (!batchStartTime.value || !batchEndTime.value || batchEndTime.value <= batchStartTime.value) {
    formError.value = '结束时间要晚于开始时间'
    return
  }
  if (batchTimeConflict.value) {
    formError.value = batchTimeHint.value
    return
  }
  formError.value = ''
  for (const slot of slots.value) {
    slot.startTime = batchStartTime.value
    slot.endTime = batchEndTime.value
  }
}

function saveSlotTime() {
  if (!editingSlot.value) return
  if (!editingSlot.value.startTime || !editingSlot.value.endTime
    || editingSlot.value.endTime <= editingSlot.value.startTime) {
    slotTimeError.value = '结束时间要晚于开始时间'
    return
  }
  const start = slotStartTimeOptions.value.find((option) => option.value === editingSlot.value?.startTime)
  const end = slotEndTimeOptions.value.find((option) => option.value === editingSlot.value?.endTime)
  if (start?.disabled || end?.disabled) {
    slotTimeError.value = start?.disabled
      ? (start.caption || '开始时间已被占用')
      : (end?.caption || '结束时间与已有课程冲突')
    return
  }
  slotTimeError.value = ''
  const target = findSlot(editingSlot.value.date)
  if (target) {
    target.startTime = editingSlot.value.startTime
    target.endTime = editingSlot.value.endTime
  }
  editingSlot.value = null
}

function openSlot(slot: CourseDateSlot) {
  slotTimeError.value = ''
  editingSlot.value = { ...slot }
}

async function save() {
  formError.value = ''
  if (!form.title.trim()) {
    formError.value = '请填写课程名称'
    return
  }
  if (!slots.value.length) {
    formError.value = '请至少在日历中选择一个上课日期'
    return
  }
  if (!form.childIds.length) {
    formError.value = '请至少选择一个孩子'
    return
  }
  if (form.pricingMode !== 'free' && (!Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0)) {
    formError.value = `请填写${billingAmountLabel.value}`
    return
  }
  if (
    form.pricingMode === 'prepaid'
    && form.packageEnabled
    && (!Number.isInteger(Number(form.packageUnits)) || Number(form.packageUnits) <= 0)
  ) {
    formError.value = '请填写大于 0 的课包总量'
    return
  }
  if (slots.value.some((slot) => !slot.startTime || !slot.endTime || slot.endTime <= slot.startTime)) {
    formError.value = '课程中存在无效时间，请确认结束时间晚于开始时间'
    return
  }
  const dates = sortedSlots.value
  const [conflict] = store.findCourseScheduleConflicts(dates, id.value || undefined, form.childIds)
  if (conflict) {
    formError.value = scheduleConflictMessage(conflict)
    return
  }
  let savedId = ''
  try {
    savedId = await store.upsertCourse({
    id: id.value || undefined,
    childIds: [...form.childIds],
    title: form.title.trim(),
    type: form.type,
    teacher: form.teacher.trim(),
    location: form.location.trim(),
    icon: form.icon,
    color: form.color,
    needsBillingReview: false,
    billingPolicy: {
      pricingMode: form.pricingMode,
      settlementCycle: form.pricingMode === 'prepaid' ? 'upfront' : 'manual',
      packageUnits: form.pricingMode === 'prepaid' && form.packageEnabled
        ? Number(form.packageUnits)
        : undefined,
      packageUnit: form.pricingMode === 'prepaid' && form.packageEnabled
        ? form.packageUnit
        : undefined,
    },
    billingMode: compatibilityBillingMode(),
    amount: form.pricingMode === 'free' ? 0 : Number(form.amount) || 0,
    recurrence: {
      freq: 'dates',
      byWeekday: [],
      startDate: dates[0].date,
      endDate: dates[dates.length - 1].date,
      startTime: batchStartTime.value,
      endTime: batchEndTime.value,
      dates,
    },
    note: form.note,
  })
    await store.syncCourseUpfrontExpense(savedId, form.paymentStatus)
    await store.clearScheduleExceptionsForCourse(savedId)
  } catch (error) {
    formError.value = error instanceof Error ? error.message : '保存失败'
    return
  }
  router.push(returnTo.value)
}

async function archive() {
  if (!id.value) return
  if (existing.value?.archived) await store.restoreCourse(id.value)
  else await store.archiveCourse(id.value)
  router.push(returnTo.value)
}

onBeforeUnmount(stopDragging)
</script>

<template>
  <main class="page course-editor">
    <PageHeader show-back :title="id ? '课程编辑' : '新增课程'">
      <template #actions>
        <span class="lesson-count">{{ slots.length }} 次课</span>
      </template>
    </PageHeader>

    <form @submit.prevent="save">
      <div class="course-participants">
        <p>选择参与这门课程的孩子</p>
        <ChildProfilePicker v-model="form.childIds" mode="multiple" centered />
      </div>

      <section class="editor-card basic-card">
        <div class="section-heading">
          <span>01</span>
          <div><h2>课程信息</h2><p>这些信息会作为快速排课的预设</p></div>
        </div>
        <div class="field">
          <label>课程名称</label>
          <input v-model="form.title" placeholder="例如 钢琴课 / 外教口语" />
        </div>
        <div class="two-fields">
          <div class="field">
            <label>类型</label>
            <AppSelect
              :model-value="form.type"
              :options="courseTypeOptions"
              aria-label="选择课程类型"
              @update:model-value="setCourseType"
            />
          </div>
          <div class="field">
            <label>老师</label>
            <input v-model="form.teacher" placeholder="老师姓名" />
          </div>
        </div>
        <div class="field">
          <label>上课地点</label>
          <input v-model="form.location" placeholder="线下地点或在线平台" />
        </div>
        <div class="billing-settings">
          <div class="billing-heading">
            <div><strong>课程费用</strong><small>先选择收费方式，系统会提示需要填写的金额</small></div>
          </div>
          <div v-if="existing?.needsBillingReview" class="billing-review-tip">
            旧版“按月/按期”无法判断是固定费用、一次性支付还是按课后付，请确认下面的收费方式后再保存。
          </div>
          <div class="pricing-plan-grid">
            <button
              v-for="option in pricingPlanOptions"
              :key="option.value"
              type="button"
              :class="{ active: paymentPlan === option.value }"
              @click="choosePaymentPlan(option.value)"
            >
              <i>
                <svg v-if="option.value === 'prepaid'" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14v11H5zM8 7V5h8v2M8 11h8m-8 3h5" /></svg>
                <svg v-else-if="option.value === 'usage'" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 8v8m3-6.2c-.8-.7-1.7-1-3-1-1.5 0-2.5.7-2.5 1.7 0 2.5 5.2 1 5.2 3.6 0 1.1-1.1 1.9-2.7 1.9-1.3 0-2.4-.4-3.1-1.1" /></svg>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="m7 12 3 3 7-7" /></svg>
              </i>
              <span><b>{{ option.label }}</b><small>{{ option.caption }}</small></span>
            </button>
          </div>

          <div v-if="paymentPlan === 'usage'" class="billing-detail">
            <div class="field">
              <label>计价单位</label>
              <div class="option-pair">
                <button
                  v-for="option in usageUnitOptions"
                  :key="option.value"
                  type="button"
                  :class="{ active: form.pricingMode === option.value }"
                  @click="setUsageUnit(option.value)"
                >
                  <b>{{ option.label }}</b>
                  <small>{{ option.caption }}</small>
                </button>
              </div>
            </div>
            <div class="field">
              <label>{{ billingAmountLabel }}</label>
              <div class="billing-money"><span>¥</span><input v-model.number="form.amount" type="number" min="0" step="0.01" /></div>
            </div>
          </div>

          <div v-else-if="form.pricingMode === 'prepaid'" class="billing-detail">
            <div class="field">
              <label>{{ billingAmountLabel }}</label>
              <div class="billing-money"><span>¥</span><input v-model.number="form.amount" type="number" min="0" step="0.01" /></div>
            </div>
            <div class="switch-row">
              <span>是否已支付</span>
              <AppPaySwitch
                :model-value="form.paymentStatus === 'paid'"
                @update:model-value="form.paymentStatus = $event ? 'paid' : 'unpaid'"
              />
            </div>
          </div>

          <p class="billing-summary">{{ billingSummary }}</p>
        </div>
      </section>

      <section class="editor-card calendar-card">
        <div class="section-heading">
          <span>02</span>
          <div><h2>选择上课日期</h2><p>按住并拖动，可连续多选或取消</p></div>
        </div>
        <div class="legacy-tip">
          {{ isLegacySchedule
            ? '原来的每周规则会在今日调整或保存后展开为具体日期。'
            : '今日取消、改时间或补课会同步到这门课，次数和日历会一起更新。' }}
        </div>
        <div class="calendar-nav">
          <button type="button" aria-label="上个月" @click="calendarMonth = calendarMonth.subtract(1, 'month')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
          </button>
          <strong>{{ calendarMonth.format('YYYY年 M月') }}</strong>
          <button type="button" aria-label="下个月" @click="calendarMonth = calendarMonth.add(1, 'month')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6" /></svg>
          </button>
        </div>
        <div class="calendar-week">
          <span v-for="day in WEEKDAY_SHORT" :key="day">{{ day }}</span>
        </div>
        <div class="date-grid" :class="{ dragging }">
          <button
            v-for="day in calendarDays"
            :key="day.format('YYYY-MM-DD')"
            type="button"
            :data-course-date="day.format('YYYY-MM-DD')"
            :disabled="!day.isSame(calendarMonth, 'month')"
            :class="{
              selected: Boolean(findSlot(day.format('YYYY-MM-DD'))),
              today: day.isSame(dayjs(), 'day'),
            }"
            @pointerdown="startSelecting(day.format('YYYY-MM-DD'), $event)"
            @click.prevent
          >
            <span>{{ day.date() }}</span>
            <i v-if="findSlot(day.format('YYYY-MM-DD'))" />
          </button>
        </div>
        <div class="calendar-summary">
          <span>本月已选 <b>{{ monthSlots.length }}</b> 天</span>
          <span>全部共 <b>{{ slots.length }}</b> 次课</span>
        </div>
      </section>

      <section class="editor-card time-card">
        <div class="section-heading">
          <span>03</span>
          <div><h2>批量设置时间</h2><p>应用到当前已选的全部日期</p></div>
        </div>
        <div class="time-range">
          <div class="time-field">
            <span>开始</span>
            <AppTimeSelect
              :model-value="batchStartTime"
              :options="batchStartTimeOptions"
              aria-label="选择批量开始时间"
              @update:model-value="setBatchStartTime"
            />
          </div>
          <i>→</i>
          <div class="time-field">
            <span>结束</span>
            <AppTimeSelect
              v-model="batchEndTime"
              :options="batchEndTimeOptions"
              aria-label="选择批量结束时间"
            />
          </div>
        </div>
        <p class="time-hint" :class="{ conflict: batchTimeConflict }">{{ batchTimeHint }}</p>
        <button class="apply-time" type="button" :disabled="!slots.length || batchTimeConflict" @click="applyBatchTime">
          应用到已选 {{ slots.length }} 个日期
        </button>
      </section>

      <section v-if="slots.length" class="editor-card selected-card">
        <div class="section-heading">
          <span>04</span>
          <div><h2>逐日调整</h2><p>点击某个日期，单独修改当天时间</p></div>
        </div>
        <div class="slot-list">
          <button v-for="slot in sortedSlots" :key="slot.date" type="button" @click="openSlot(slot)">
            <span>
              <b>{{ dayjs(slot.date).format('M月D日') }}</b>
              <small>{{ dayjs(slot.date).format('dddd') }}</small>
            </span>
            <strong>{{ slot.startTime }}–{{ slot.endTime }}</strong>
            <i>›</i>
          </button>
        </div>
      </section>

      <section class="editor-card extra-card">
        <div class="field">
          <label>课程图标</label>
          <div class="icon-options" role="radiogroup" aria-label="课程图标">
            <button
              v-for="option in COURSE_ICON_OPTIONS"
              :key="option.value"
              type="button"
              :class="{ active: form.icon === option.value }"
              :aria-label="`选择${option.label}图标`"
              :aria-pressed="form.icon === option.value"
              @click="selectCourseIcon(option.value)"
            >
              <CourseIcon :name="option.value" />
              <span>{{ option.label }}</span>
            </button>
          </div>
        </div>
        <div class="field">
          <label>课程颜色</label>
          <div class="colors" role="radiogroup" aria-label="课程颜色">
            <button
              v-for="color in COURSE_COLORS"
              :key="color"
              type="button"
              :style="{ '--swatch': color }"
              :class="{ active: form.color === color }"
              :aria-label="`选择颜色${color}`"
              :aria-pressed="form.color === color"
              @click="form.color = color"
            />
            <label class="custom-color" aria-label="自定义课程颜色">
              <input v-model="form.color" type="color" />
              <span>＋</span>
            </label>
          </div>
          <small class="color-tip">选择 8 种系统配色，或使用“＋”自定义颜色</small>
        </div>
        <div class="field">
          <label>备注</label>
          <textarea v-model="form.note" rows="3" placeholder="课程说明或注意事项" />
        </div>
      </section>

      <p v-if="formError" class="form-error">{{ formError }}</p>
      <div class="save-bar">
        <button class="save-button" type="submit">保存当前课程</button>
        <button v-if="id" class="archive-button" type="button" @click="archive">
          {{ existing?.archived ? '恢复课程' : '标记已结课' }}
        </button>
      </div>
    </form>

    <Transition name="fade">
      <div v-if="editingSlot" class="slot-overlay" @click.self="editingSlot = null">
        <section class="slot-sheet">
          <i class="sheet-handle" />
          <div class="slot-title">
            <div>
              <p>单独调整</p>
              <h2>{{ dayjs(editingSlot.date).format('M月D日 dddd') }}</h2>
            </div>
            <button type="button" @click="editingSlot = null">×</button>
          </div>
          <div class="time-range single">
            <div class="time-field">
              <span>开始</span>
              <AppTimeSelect
                :model-value="editingSlot.startTime"
                :options="slotStartTimeOptions"
                aria-label="选择当天开始时间"
                @update:model-value="setSlotStartTime"
              />
            </div>
            <i>→</i>
            <div class="time-field">
              <span>结束</span>
              <AppTimeSelect
                v-model="editingSlot.endTime"
                :options="slotEndTimeOptions"
                aria-label="选择当天结束时间"
              />
            </div>
          </div>
          <p v-if="slotTimeError" class="slot-time-error">{{ slotTimeError }}</p>
          <button class="save-button" type="button" @click="saveSlotTime">保存当天时间</button>
          <p class="slot-tip">只修改这一天，不影响当前课程的其他已选日期。</p>
        </section>
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.course-editor {
  padding-top: 10px;
}

.course-participants {
  margin: 0 0 14px;
  padding: 15px 14px 12px;
  border: 0;
  border-radius: 22px;
  background: linear-gradient(150deg, color-mix(in srgb, var(--accent) 10%, var(--mix-base)) 0%, var(--paper) 68%);
  box-shadow: var(--elev-sm), var(--glow-top);
}

.course-participants > p {
  margin: 0 0 12px;
  color: var(--muted);
  text-align: center;
  font-size: 10px;
  font-weight: 650;
}

.course-child-context {
  position: absolute;
  z-index: 12;
  top: 12px;
  right: max(18px, calc((100vw - 480px) / 2 + 18px));
  display: flex;
  width: min(300px, calc(100vw - 92px));
  gap: 7px;
  justify-content: flex-end;
  overflow-x: auto;
  scrollbar-width: none;
}

.course-child-context::-webkit-scrollbar {
  display: none;
}

.context-child {
  display: flex;
  min-width: 0;
  flex: 0 1 auto;
  gap: 7px;
  align-items: center;
  padding: 4px 10px 4px 4px;
  color: var(--ink);
  border: 0;
  border-radius: 999px;
  background: var(--paper);
  box-shadow: var(--elev-sm), var(--glow-top);
}

.context-child i,
.extra-children i,
.child-name-preview > i {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  color: #fff;
  border-radius: 50%;
  background: var(--avatar-color, #7b61ff);
  font-size: 10px;
  font-style: normal;
  font-weight: 800;
}

.context-child span {
  max-width: 76px;
  overflow: hidden;
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.context-add {
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  padding: 0;
  color: var(--accent-text);
  border: 1px dashed color-mix(in srgb, var(--accent) 34%, var(--line));
  border-radius: 50%;
  background: var(--accent-soft);
  font-size: 22px;
  line-height: 1;
}

.lesson-count {
  padding: 7px 11px;
  color: var(--accent-text);
  border-radius: 12px;
  background: var(--accent-soft);
  font-size: 12px;
  font-weight: 700;
}

.editor-card {
  margin-bottom: 13px;
  padding: 17px;
  border: 1px solid rgba(108, 78, 171, .08);
  border-radius: 25px;
  background: rgba(255,255,255,.9);
  box-shadow: 0 15px 38px rgba(65, 48, 109, .08);
}

.extra-children {
  display: grid;
  gap: 8px;
  margin-bottom: 16px;
}

.extra-children p,
.new-child-field span {
  color: #8e8799;
  font-size: 11px;
}

.extra-child-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.extra-child-row .choose-existing {
  display: flex;
  min-width: 0;
  flex: 1;
  gap: 10px;
  align-items: center;
  padding: 8px 10px;
  color: var(--ink);
  text-align: left;
  border: 0;
  border-radius: 16px;
  background: var(--surface-2);
}

.extra-child-row .choose-existing span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.extra-child-row .delete-child {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  padding: 0;
  place-items: center;
  color: #b4485a;
  border: 1px solid #f1dde1;
  border-radius: 14px;
  background: #fdf3f4;
  transition: transform .2s ease, background .2s ease;
}

.extra-child-row .delete-child:active {
  background: #f9e5e8;
  transform: scale(.92);
}

.extra-child-row .delete-child svg {
  width: 17px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.new-child-field {
  display: grid;
  gap: 6px;
  margin-bottom: 14px;
}

.new-child-field input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid #e7e2ef;
  border-radius: 14px;
  background: var(--surface-2);
}

.child-name-sheet {
  max-width: 420px;
}

.child-name-preview {
  display: flex;
  gap: 12px;
  align-items: center;
  margin: 20px 0 16px;
  padding: 12px;
  border: 0;
  border-radius: 18px;
  background: linear-gradient(150deg, color-mix(in srgb, var(--accent) 8%, var(--mix-base)) 0%, var(--paper) 72%);
  box-shadow: var(--elev-sm), var(--glow-top);
}

.child-name-preview > i {
  width: 46px;
  height: 46px;
  font-size: 12px;
}

.child-name-preview label {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 5px;
}

.child-name-preview label span {
  color: var(--muted);
  font-size: 10px;
}

.child-name-preview input {
  width: 100%;
  padding: 4px 0;
  color: var(--ink);
  border: 0;
  outline: 0;
  background: transparent;
  font-size: 17px;
  font-weight: 700;
}

.remove-from-course {
  width: 100%;
  margin-top: 8px;
  padding: 12px;
  color: #8b8494;
  border: 0;
  background: transparent;
  font-size: 12px;
}

.section-heading {
  display: flex;
  gap: 11px;
  align-items: center;
  margin-bottom: 17px;
}

.section-heading > span {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  color: var(--accent);
  border-radius: 11px;
  background: var(--accent-soft);
  font-size: 11px;
  font-weight: 750;
}

.section-heading h2 {
  font-size: 17px;
}

.section-heading p {
  margin: 3px 0 0;
  color: #9c96a6;
  font-size: 11px;
}

.two-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.billing-settings {
  margin-top: 18px;
  padding-top: 17px;
  border-top: 1px solid var(--line);
}

.billing-heading {
  display: flex;
  margin-bottom: 12px;
  align-items: center;
  justify-content: space-between;
}

.billing-heading strong,
.billing-heading small {
  display: block;
}

.billing-heading strong {
  color: var(--ink);
  font-size: 14px;
}

.billing-heading small {
  margin-top: 3px;
  color: var(--muted);
  font-size: 10px;
}

.billing-review-tip {
  margin: 0 0 12px;
  padding: 10px 12px;
  color: #7657ba;
  border-radius: 13px;
  background: #f2edff;
  font-size: 10px;
  line-height: 1.5;
}

.pricing-plan-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.pricing-plan-grid > button {
  display: grid;
  min-height: 68px;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 9px;
  align-items: center;
  padding: 9px;
  color: var(--muted);
  text-align: left;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: color-mix(in srgb, var(--paper) 92%, var(--bg));
  transition: border-color .2s ease, background .2s ease, transform .2s ease;
}

.pricing-plan-grid > button:active {
  transform: scale(.98);
}

.pricing-plan-grid > button.active {
  color: var(--accent-text);
  border-color: color-mix(in srgb, var(--accent) 42%, var(--line));
  background: var(--accent-soft);
}

.pricing-plan-grid i {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  color: var(--accent-text);
  border-radius: 11px;
  background: var(--paper);
  font-style: normal;
}

.pricing-plan-grid svg {
  width: 19px;
  height: 19px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.pricing-plan-grid b,
.pricing-plan-grid small {
  display: block;
}

.pricing-plan-grid b {
  color: var(--ink);
  font-size: 12px;
}

.pricing-plan-grid small {
  margin-top: 3px;
  font-size: 9px;
  line-height: 1.35;
}

.billing-detail {
  display: grid;
  gap: 13px;
  margin-top: 12px;
  padding: 13px;
  border-radius: 18px;
  background: color-mix(in srgb, var(--accent-soft) 42%, var(--paper));
}

.billing-fields {
  align-items: end;
}

.option-pair,
.payment-status {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.option-pair button,
.payment-status button {
  min-height: 56px;
  padding: 9px 10px;
  color: var(--muted);
  text-align: left;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--paper);
}

.option-pair button.active,
.payment-status button.active {
  color: var(--accent-text);
  border-color: color-mix(in srgb, var(--accent) 48%, var(--line));
  background: color-mix(in srgb, var(--accent-soft) 78%, var(--paper));
}

.option-pair b,
.option-pair small,
.payment-status span,
.payment-status small {
  display: block;
}

.option-pair b,
.payment-status span {
  color: var(--ink);
  font-size: 12px;
  font-weight: 750;
}

.option-pair small,
.payment-status small {
  margin-top: 3px;
  font-size: 9px;
  line-height: 1.35;
}

.billing-money {
  display: grid;
  min-height: 47px;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  color: var(--accent-text);
  border-radius: 14px;
  background: var(--paper);
  box-shadow: inset 0 0 0 1px var(--line), var(--elev-sm);
}

.billing-money span {
  padding-left: 13px;
  font-weight: 800;
}

.billing-money input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 42px;
}
.switch-row > span { color: var(--muted); font-size: 12px; }

.billing-summary {
  margin: 12px 1px 0;
  padding: 10px 12px;
  color: var(--accent-text);
  border-left: 3px solid var(--accent);
  border-radius: 0 12px 12px 0;
  background: color-mix(in srgb, var(--accent-soft) 58%, transparent);
  font-size: 10px;
  line-height: 1.55;
}

.legacy-tip {
  margin: -4px 0 14px;
  padding: 10px 12px;
  color: #7657ba;
  border-radius: 13px;
  background: #f2edff;
  font-size: 11px;
  line-height: 1.5;
}

.calendar-nav {
  display: grid;
  grid-template-columns: 36px 1fr 36px;
  align-items: center;
  margin-bottom: 15px;
  text-align: center;
}

.calendar-nav button {
  display: grid;
  width: 36px;
  height: 36px;
  padding: 0;
  place-items: center;
  color: var(--ink);
  border: 0;
  border-radius: 12px;
  background: var(--surface-2);
}

.calendar-nav button svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.calendar-nav strong {
  font-size: 15px;
}

.calendar-week,
.date-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 5px;
}

.calendar-week {
  margin-bottom: 6px;
  color: var(--muted);
  text-align: center;
  font-size: 10px;
}

.date-grid {
  touch-action: none;
  user-select: none;
}

.date-grid button {
  position: relative;
  display: grid;
  aspect-ratio: 1;
  padding: 0;
  place-items: center;
  color: var(--ink);
  border: 0;
  border-radius: 13px;
  background: var(--surface-2);
  transition: color .16s ease, background .16s ease, transform .16s ease;
}

.date-grid button:disabled {
  visibility: hidden;
}

.date-grid button.selected {
  color: #fff;
  background: var(--accent);
  box-shadow: 0 10px 18px -8px rgba(255,122,69,.75);
  transform: scale(.96);
}

.date-grid button.today:not(.selected) {
  color: var(--accent);
  outline: 1px solid color-mix(in srgb, var(--accent) 45%, #fff);
}

.date-grid button span {
  font-size: 12px;
  font-weight: 650;
}

.date-grid button i {
  position: absolute;
  bottom: 5px;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #fff;
}

.calendar-summary {
  display: flex;
  justify-content: space-between;
  margin-top: 14px;
  padding-top: 12px;
  color: #96909f;
  border-top: 1px solid #eeeaf4;
  font-size: 11px;
}

.calendar-summary b {
  color: #7047e8;
}

.time-range {
  display: grid;
  grid-template-columns: 1fr 22px 1fr;
  gap: 7px;
  align-items: end;
}

.time-field {
  display: grid;
  gap: 6px;
}

.time-field > span {
  color: #8e8799;
  font-size: 11px;
}

.time-range > i {
  padding-bottom: 12px;
  color: #aaa3b4;
  text-align: center;
  font-style: normal;
}

.time-hint {
  margin: 10px 2px 0;
  color: var(--muted, #8e8799);
  font-size: 11px;
  line-height: 1.45;
}

.time-hint.conflict {
  color: #c2483c;
}

.apply-time {
  width: 100%;
  margin-top: 12px;
  padding: 11px;
  color: #7048df;
  border: 0;
  border-radius: 14px;
  background: var(--accent-soft);
  font-size: 12px;
  font-weight: 700;
}

.apply-time:disabled {
  opacity: .45;
}

.slot-list {
  display: grid;
  max-height: 280px;
  gap: 7px;
  overflow: auto;
}

.slot-list button {
  display: grid;
  grid-template-columns: 1fr auto 16px;
  gap: 10px;
  align-items: center;
  padding: 11px 12px;
  color: var(--ink);
  text-align: left;
  border: 0;
  border-radius: 15px;
  background: var(--surface-2);
}

.slot-list span b,
.slot-list span small {
  display: block;
}

.slot-list span b {
  font-size: 12px;
}

.slot-list span small {
  margin-top: 3px;
  color: #9a94a3;
  font-size: 10px;
}

.slot-list > button > strong {
  color: #7048df;
  font-size: 12px;
}

.slot-list > button > i {
  color: #aaa3b3;
  font-size: 20px;
  font-style: normal;
}

.icon-options {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.icon-options button {
  display: grid;
  min-width: 0;
  gap: 5px;
  padding: 9px 4px 7px;
  place-items: center;
  color: #81798d;
  border: 1px solid #e9e4f0;
  border-radius: 14px;
  background: var(--surface-2);
  transition: color .2s ease, border .2s ease, background .2s ease, transform .2s ease;
}

.icon-options button:active {
  transform: scale(.92);
}

.icon-options button.active {
  color: #7048df;
  border-color: #8b64ee;
  background: #f0eaff;
}

.icon-options svg {
  width: 21px;
  height: 21px;
}

.icon-options span {
  font-size: 9px;
}

.colors {
  display: flex;
  flex-wrap: wrap;
  gap: 11px;
}

.colors button {
  width: 30px;
  height: 30px;
  border: 3px solid #fff;
  border-radius: 50%;
  background: linear-gradient(140deg, color-mix(in srgb, var(--swatch) 88%, #fff) 0%, color-mix(in srgb, var(--swatch) 74%, #2a2350) 100%);
  box-shadow: 0 8px 16px -8px color-mix(in srgb, var(--swatch) 80%, transparent);
  transition: transform .2s ease, box-shadow .2s ease;
}

.colors button.active {
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--swatch) 70%, #2a2350),
    0 10px 18px -8px color-mix(in srgb, var(--swatch) 85%, transparent);
  transform: scale(1.1);
}

.custom-color {
  position: relative;
  display: grid;
  width: 30px;
  height: 30px;
  overflow: hidden;
  place-items: center;
  color: #706879;
  border: 1px dashed #aaa2b5;
  border-radius: 50%;
  background: #f7f5fa;
  cursor: pointer;
}

.custom-color input {
  position: absolute;
  width: 50px;
  height: 50px;
  padding: 0;
  opacity: 0;
  cursor: pointer;
}

.custom-color span {
  font-size: 19px;
  line-height: 1;
}

.color-tip {
  color: #9a93a4;
  font-size: 10px;
}

.form-error {
  margin: 10px 4px;
  color: #e55365;
  font-size: 12px;
}

.save-bar {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 9px;
  margin-top: 16px;
}

.save-button,
.archive-button {
  min-height: 48px;
  padding: 0 18px;
  color: #fff;
  border: 0;
  border-radius: 16px;
  background: var(--accent);
  box-shadow: 0 14px 26px -10px rgba(255,122,69,.75), inset 0 1px 0 rgba(255,255,255,.28);
  font-weight: 750;
}

.archive-button {
  color: #b4485a;
  background: #fdf1f3;
  box-shadow: none;
}

.slot-overlay {
  position: fixed;
  z-index: 60;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 18px;
  background: rgba(31,25,45,.36);
  backdrop-filter: blur(7px);
}

.slot-sheet {
  width: min(100%, 480px);
  padding: 10px 20px calc(22px + env(safe-area-inset-bottom, 0px));
  border-radius: 29px;
  background: var(--paper);
  box-shadow: 0 25px 70px rgba(37,25,69,.3);
  animation: sheet-up .35s cubic-bezier(.2,.8,.2,1) both;
}

.sheet-handle {
  display: block;
  width: 38px;
  height: 5px;
  margin: 0 auto 18px;
  border-radius: 99px;
  background: #d9d4e3;
}

.slot-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.slot-title p {
  margin: 0 0 3px;
  color: var(--accent-text);
  font-size: 11px;
  font-weight: 700;
}

.slot-title h2 {
  font-size: 21px;
}

.slot-title button {
  width: 34px;
  height: 34px;
  color: #716a7d;
  border: 0;
  border-radius: 50%;
  background: #f0edf5;
  font-size: 21px;
}

.time-range.single {
  margin-bottom: 16px;
}

.slot-time-error {
  margin: -7px 0 12px;
  color: #b4485a;
  text-align: center;
  font-size: 10px;
}

.slot-sheet .save-button {
  width: 100%;
}

.slot-tip {
  margin: 11px 0 0;
  color: #9891a3;
  text-align: center;
  font-size: 11px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity .22s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes sheet-up {
  from { opacity: 0; transform: translateY(50px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 380px) {
  .two-fields {
    grid-template-columns: 1fr;
  }
}
</style>
