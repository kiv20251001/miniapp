<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { onLoad, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { appShare, momentsShare } from '@/utils/share'
import dayjs from 'dayjs'
import {
  COURSE_COLORS,
  COURSE_ICON_COLORS,
  COURSE_ICON_OPTIONS,
  COURSE_TYPE_OPTIONS,
  WEEKDAY_SHORT,
  randomCourseColor,
  unusedCourseColor,
} from '@server-domain/constants'
import type { BillingMode, CourseDateSlot, CourseIcon, CoursePricingMode, CourseType } from '@server-domain/types'
import { busyIntervalsForDates, findBusyConflict, findScheduleConflicts, type BusyInterval } from '@server-domain/schedule'
import { showCloudError } from '@/cloud/call'
import { needFamily } from '@/utils/login-gate'
import { promptLogin } from '@/utils/login-prompt'
import { TEXT_LIMIT } from '@/domain/limits'
import { amountError, amountInputValue, cleanText, formTip } from '@/utils/form'
import { denyViewerWrite } from '@/subpages/shared/useFamilyRole'
import { useFamilyPage } from '@/composables/useFamilyPage'
import { usePageBackground, useThemePage } from '@/utils/wx-theme'
import TimeField from '@/components/TimeField.vue'
import AppIcon from '@/components/AppIcon.vue'
import SelectField from '@/components/SelectField.vue'
import PageHeader from '@/components/PageHeader.vue'
import ChildAvatar from '@/components/ChildAvatar.vue'
import DateDragGrid from '@/components/DateDragGrid.vue'

const store = useFamilyPage()
const themeClass = useThemePage()
onShareAppMessage(appShare)
onShareTimeline(momentsShare)
const pageBg = usePageBackground()
const courseId = ref('')
const saving = ref(false)
const slots = ref<CourseDateSlot[]>([])
const batchStart = ref('09:00')
const batchEnd = ref('10:00')
/** 用户手动改过批量时间后，不再按冲突自动改默认值。 */
const batchTouched = ref(false)
const editingSlot = ref<CourseDateSlot | null>(null)
const slotsOpen = ref(false)

const form = reactive({
  childIds: [] as string[],
  title: '',
  type: 'interest' as CourseType,
  teacher: '',
  location: '',
  icon: 'generic' as CourseIcon,
  color: COURSE_COLORS[0],
  pricingMode: 'prepaid' as CoursePricingMode,
  amount: '',
  paymentStatus: 'unpaid' as 'paid' | 'unpaid',
  note: '',
})

const pricingPlans = [
  { value: 'prepaid', label: '一次性支付', caption: '报名或购买课包时支付总金额' },
  { value: 'usage', label: '按需计费', caption: '按实际次数或小时累计' },
  { value: 'free', label: '无需缴费', caption: '只记录课程计划' },
]
const usageUnits = [
  { value: 'per_session', label: '按次', caption: '每完成一节按单次价格计费' },
  { value: 'per_hour', label: '按小时', caption: '按课程实际时长计算' },
]

const existing = computed(() => store.snapshot.courses.find((course) => course.id === courseId.value))
const sortedSlots = computed(() => [...slots.value].sort((a, b) => a.date.localeCompare(b.date)))
const selectedDates = computed(() => sortedSlots.value.map((slot) => slot.date))
const paymentPlan = computed(() => (
  form.pricingMode === 'per_session' || form.pricingMode === 'per_hour' ? 'usage' : form.pricingMode
))
const amountLabel = computed(() => {
  if (form.pricingMode === 'prepaid') return '课程总金额'
  if (form.pricingMode === 'per_hour') return '每小时费用'
  return '单次费用'
})
const billingSummary = computed(() => {
  const amount = `¥${Math.max(0, Number(form.amount) || 0).toLocaleString('zh-CN')}`
  if (form.pricingMode === 'free') return '该课程无需缴费，只记录课程计划。'
  if (form.pricingMode === 'prepaid') {
    return `课程总费用 ${amount}，当前${form.paymentStatus === 'paid' ? '已支付' : '待支付'}。`
  }
  const unit = form.pricingMode === 'per_hour' ? '每小时' : '每完成 1 次'
  return `${unit}计费 ${amount}；取消未上的课次不计费。`
})
const batchConflict = computed(() => {
  if (!slots.value.length) return ''
  const hit = findBusyConflict(
    busyIntervalsForDates(
      store.overviewCourses,
      slots.value.map((slot) => slot.date),
      store.overviewScheduleExceptions,
      courseId.value || undefined,
      form.childIds,
    ),
    batchStart.value,
    batchEnd.value,
  )
  return hit ? `${hit.title} 已占用 ${hit.start}–${hit.end}` : ''
})
const batchHint = computed(() => {
  if (batchEnd.value <= batchStart.value) return '结束时间要晚于开始时间'
  if (batchConflict.value) return batchConflict.value
  return ''
})

onLoad((query) => {
  if (denyViewerWrite()) return
  courseId.value = typeof query?.id === 'string' ? query.id : ''
  const course = store.snapshot.courses.find((item) => item.id === courseId.value)
  form.childIds = course?.childIds?.length
    ? [...course.childIds]
    : [course?.childId || store.childId].filter(Boolean)
  form.title = course?.title ?? ''
  form.type = course?.type ?? 'interest'
  form.teacher = course?.teacher ?? ''
  form.location = course?.location ?? ''
  form.icon = course?.icon ?? 'generic'
  form.color = course?.color ?? unusedCourseColor(store.snapshot.courses)
  form.pricingMode = course?.billingPolicy?.pricingMode === 'fixed_period'
    ? 'per_session'
    : course?.billingPolicy?.pricingMode
      ?? (course?.billingMode === 'free' ? 'free' : course?.billingMode === 'session' ? 'per_session' : 'prepaid')
  form.amount = amountInputValue(course?.amount)
  form.note = course?.note ?? ''
  slots.value = [...(course?.recurrence.dates ?? [])]
  batchStart.value = course?.recurrence.startTime ?? '09:00'
  batchEnd.value = course?.recurrence.endTime ?? '10:00'
  const upfront = store.snapshot.expenses.find((item) =>
    item.courseId === courseId.value && (item.source === 'course_upfront' || item.billingMode === 'term'),
  )
  form.paymentStatus = upfront?.status === 'paid' ? 'paid' : 'unpaid'
})

/** 先填表、提交时才创建家庭；创建完回到这里，自动选上刚建好的孩子。 */
watch(() => store.snapshot.children.length, (count, previous) => {
  if (previous || !count || form.childIds.length) return
  form.childIds = [store.childId || store.snapshot.children[0].id]
  alignDefaultTime()
})

function toggleChild(id: string) {
  form.childIds = form.childIds.includes(id)
    ? form.childIds.filter((item) => item !== id)
    : [...form.childIds, id]
  alignDefaultTime()
}

function minutesOf(time: string) {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

function timeOf(minutes: number) {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/** 新课默认 9:00–10:00。和已选日期上的课重叠时，改到那段课结束时刻再排 1 小时。整天排满则保持当前时间。 */
function suggestDefaultTime(intervals: BusyInterval[]) {
  let start = 9 * 60
  for (let guard = 0; guard < 48; guard += 1) {
    const end = start + 60
    if (end > 23 * 60) return null
    const startTime = timeOf(start)
    const endTime = timeOf(end)
    const hit = findBusyConflict(intervals, startTime, endTime)
    if (!hit) return { start: startTime, end: endTime }
    const next = minutesOf(hit.end)
    if (next <= start) return null
    start = next
  }
  return null
}

function busyForSelection() {
  return busyIntervalsForDates(
    store.overviewCourses,
    slots.value.map((slot) => slot.date),
    store.overviewScheduleExceptions,
    courseId.value || undefined,
    form.childIds,
  )
}

function applyBatchToSlots() {
  if (!slots.value.length) return
  if (batchEnd.value <= batchStart.value || batchConflict.value) return
  if (slots.value.every((slot) => slot.startTime === batchStart.value && slot.endTime === batchEnd.value)) return
  slots.value = slots.value.map((slot) => ({
    ...slot,
    startTime: batchStart.value,
    endTime: batchEnd.value,
  }))
}

function alignDefaultTime() {
  if (courseId.value || batchTouched.value) return
  if (slots.value.some((slot) => slot.startTime !== batchStart.value || slot.endTime !== batchEnd.value)) return
  const next = suggestDefaultTime(busyForSelection())
  if (!next || (next.start === batchStart.value && next.end === batchEnd.value)) return
  batchStart.value = next.start
  batchEnd.value = next.end
  applyBatchToSlots()
}

function onBatchStart(value: string) {
  batchTouched.value = true
  batchStart.value = value
  applyBatchToSlots()
}

function onBatchEnd(value: string) {
  batchTouched.value = true
  batchEnd.value = value
  applyBatchToSlots()
}

function choosePlan(value: string) {
  if (value === 'usage') {
    if (form.pricingMode !== 'per_session' && form.pricingMode !== 'per_hour') form.pricingMode = 'per_session'
    return
  }
  form.pricingMode = value as CoursePricingMode
}

function setUsageUnit(value: string) {
  form.pricingMode = value as CoursePricingMode
}

function onSelectedDates(dates: string[]) {
  const current = new Map(slots.value.map((slot) => [slot.date, slot]))
  slots.value = dates.map((date) => current.get(date) ?? {
    date,
    startTime: batchStart.value,
    endTime: batchEnd.value,
  }).sort((left, right) => left.date.localeCompare(right.date))
  alignDefaultTime()
}

function openSlot(slot: CourseDateSlot) {
  editingSlot.value = { ...slot }
}

function saveSlotTime() {
  const slot = editingSlot.value
  if (!slot) return
  if (slot.endTime <= slot.startTime) {
    formTip('结束时间要晚于开始时间')
    return
  }
  slots.value = slots.value.map((item) => item.date === slot.date ? { ...slot } : item)
  editingSlot.value = null
}

function billingMode(): BillingMode {
  if (form.pricingMode === 'free') return 'free'
  if (form.pricingMode === 'prepaid') return 'term'
  return 'session'
}

async function save() {
  if (saving.value || needFamily()) return
  const title = cleanText(form.title, TEXT_LIMIT.courseTitle)
  if (!title) {
    formTip('请填写课程名称')
    return
  }
  if (!form.childIds.length) {
    formTip('请至少选择一个孩子')
    return
  }
  if (!slots.value.length) {
    formTip('请至少选择一个上课日期')
    return
  }
  if (slots.value.some((slot) => slot.endTime <= slot.startTime)) {
    formTip('结束时间要晚于开始时间')
    return
  }
  const amountProblem = form.pricingMode === 'free' ? '' : amountError(form.amount, amountLabel.value, { required: true })
  if (amountProblem) {
    formTip(amountProblem)
    return
  }
  const dates = [...slots.value].sort((a, b) => a.date.localeCompare(b.date))
  const [conflict] = findScheduleConflicts(
    dates,
    store.overviewCourses,
    store.overviewScheduleExceptions,
    courseId.value || undefined,
    form.childIds,
  )
  if (conflict) {
    formTip(`${conflict.date} 与「${conflict.title}」时间重叠`)
    return
  }
  saving.value = true
  try {
    await store.saveCourse({
      id: courseId.value || undefined,
      childIds: [...form.childIds],
      title,
      type: form.type,
      teacher: cleanText(form.teacher, TEXT_LIMIT.teacher),
      location: cleanText(form.location, TEXT_LIMIT.location),
      icon: form.icon,
      color: form.color,
      needsBillingReview: false,
      billingPolicy: {
        pricingMode: form.pricingMode,
        settlementCycle: form.pricingMode === 'prepaid' ? 'upfront' : 'manual',
      },
      billingMode: billingMode(),
      amount: form.pricingMode === 'free' ? 0 : Number(form.amount) || 0,
      recurrence: {
        freq: 'dates',
        byWeekday: [],
        startDate: dates[0].date,
        endDate: dates[dates.length - 1].date,
        startTime: batchStart.value,
        endTime: batchEnd.value,
        dates,
      },
      note: cleanText(form.note, TEXT_LIMIT.note),
    }, form.paymentStatus)
    uni.navigateBack()
  } catch (error) {
    showCloudError(error)
  } finally {
    saving.value = false
  }
}

async function archive() {
  if (!courseId.value || saving.value) return
  saving.value = true
  try {
    if (existing.value?.archived) await store.restoreCourse(courseId.value)
    else await store.archiveCourse(courseId.value)
    uni.navigateBack()
  } catch (error) {
    showCloudError(error)
  } finally {
    saving.value = false
  }
}

function pickIcon(icon: CourseIcon) {
  form.icon = icon
  // 通用图标沿用随机且避开已用颜色；其它图标各有固定默认色，选完仍可再改颜色。
  form.color = icon === 'generic'
    ? randomCourseColor(store.snapshot.courses, { exceptId: courseId.value || undefined })
    : COURSE_ICON_COLORS[icon]
}
</script>

<template>
  <page-meta :page-style="pageBg.style" :background-color="pageBg.bg" :background-color-top="pageBg.bg" :background-color-bottom="pageBg.bg" :root-background-color="pageBg.bg" :background-text-style="pageBg.text" />
  <view class="theme-root" :class="themeClass">
  <view class="page edit sub">
    <PageHeader safe show-back :title="courseId ? '课程编辑' : '新增课程'">
      <template #actions>
        <text class="lesson-count">{{ slots.length }} 次课</text>
      </template>
    </PageHeader>

    <view class="participants">
      <text class="participants-title">选择参与这门课程的孩子<text class="req">*</text></text>
      <view class="child-row">
        <view
          v-for="child in store.snapshot.children"
          :key="child.id"
          class="child-pick press"
          :class="{ on: form.childIds.includes(child.id) }"
          hover-class="press-on"
          hover-stay-time="80"
          @click="toggleChild(child.id)"
        >
          <ChildAvatar :avatar-key="child.avatarKey" :size="52" />
          <text>{{ child.name }}</text>
        </view>
        <view
          v-if="!store.snapshot.children.length"
          class="child-create press"
          hover-class="press-on"
          hover-stay-time="80"
          @click="promptLogin()"
        >
          <text>前往创建</text>
        </view>
      </view>
    </view>

    <view class="editor-card">
      <view class="section-heading">
        <text>01</text>
        <view>
          <text class="h2">课程信息</text>
        </view>
      </view>
      <view class="field">
        <text class="field-label">课程名称<text class="req">*</text></text>
        <input v-model="form.title" :maxlength="TEXT_LIMIT.courseTitle" placeholder="例如 钢琴课 / 外教口语" placeholder-class="ph" />
      </view>
      <view class="row">
        <view class="field" style="flex: 1">
          <text class="field-label">类型</text>
          <SelectField v-model="form.type" :options="COURSE_TYPE_OPTIONS" />
        </view>
        <view class="field" style="flex: 1">
          <text class="field-label">老师</text>
          <input v-model="form.teacher" :maxlength="TEXT_LIMIT.teacher" placeholder="老师姓名" placeholder-class="ph" />
        </view>
      </view>
      <view class="field">
        <text class="field-label">上课地点</text>
        <input v-model="form.location" :maxlength="TEXT_LIMIT.location" placeholder="线下地点或在线平台" placeholder-class="ph" />
      </view>

      <view class="billing">
        <text class="bill-title">课程费用</text>
        <view class="plan-list">
          <view
            v-for="option in pricingPlans"
            :key="option.value"
            class="plan press"
            :class="{ on: paymentPlan === option.value }"
            hover-class="press-on"
            hover-stay-time="80"
            @click="choosePlan(option.value)"
          >
            <text class="plan-name">{{ option.label }}</text>
            <text class="hint">{{ option.caption }}</text>
          </view>
        </view>
        <view v-if="paymentPlan === 'usage'" class="unit-row">
          <text
            v-for="option in usageUnits"
            :key="option.value"
            class="unit press"
            :class="{ on: form.pricingMode === option.value }"
            hover-class="press-on"
            hover-stay-time="80"
            @click="setUsageUnit(option.value)"
          >{{ option.label }}</text>
        </view>
        <view v-if="form.pricingMode !== 'free'" class="field">
          <text class="field-label">{{ amountLabel }}<text class="req">*</text></text>
          <view class="money">
            <text>¥</text>
            <input v-model="form.amount" type="digit" :maxlength="TEXT_LIMIT.amount" placeholder="0" placeholder-class="ph" />
          </view>
        </view>
        <view v-if="form.pricingMode === 'prepaid'" class="row pay-row">
          <text>是否已支付</text>
          <switch :checked="form.paymentStatus === 'paid'" color="#ff7a45" @change="form.paymentStatus = $event.detail.value ? 'paid' : 'unpaid'" />
        </view>
        <text class="summary">{{ billingSummary }}</text>
      </view>
    </view>

    <view class="editor-card">
      <view class="section-heading">
        <text>02</text>
        <view>
          <text class="h2">选择上课日期<text class="req">*</text></text>
          <text class="hint">点选或按住滑动，可连续多选、取消</text>
        </view>
      </view>
      <DateDragGrid :selected="selectedDates" @update:selected="onSelectedDates" />
      <text class="hint">已选 {{ slots.length }} 个日期</text>
    </view>

    <view class="editor-card">
      <view class="section-heading">
        <text>03</text>
        <view>
          <text class="h2">批量设置时间</text>
          <text class="hint">改这里会立刻更新全部已选日期</text>
        </view>
      </view>
      <view class="row">
        <view class="field" style="flex: 1">
          <text class="field-label">开始</text>
          <TimeField :model-value="batchStart" @update:model-value="onBatchStart" />
        </view>
        <view class="field" style="flex: 1">
          <text class="field-label">结束</text>
          <TimeField :model-value="batchEnd" @update:model-value="onBatchEnd" />
        </view>
      </view>
      <text v-if="batchHint" class="hint" :class="{ warn: batchEnd <= batchStart || batchConflict }">{{ batchHint }}</text>
    </view>

    <view v-if="sortedSlots.length" class="editor-card">
      <view class="section-heading slot-toggle press" hover-class="press-on" hover-stay-time="80" @click="slotsOpen = !slotsOpen">
        <text>04</text>
        <view class="slot-toggle-copy">
          <text class="h2">逐日调整</text>
          <text class="hint">{{ slotsOpen ? '点击某个日期，单独修改当天时间' : `已选 ${sortedSlots.length} 个日期，展开后可单独调整` }}</text>
        </view>
        <view class="slot-caret" :class="{ open: slotsOpen }">
          <AppIcon name="chevron-right" tone="muted" :size="16" />
        </view>
      </view>
      <view v-if="slotsOpen" class="slot-panel">
        <view
          v-for="slot in sortedSlots"
          :key="slot.date"
          class="slot press"
          hover-class="press-on"
          hover-stay-time="80"
          @click="openSlot(slot)"
        >
          <view>
            <text class="slot-date">{{ dayjs(slot.date).format('M月D日') }}</text>
            <text class="hint">周{{ WEEKDAY_SHORT[dayjs(slot.date).day()] }}</text>
          </view>
          <text class="slot-time">{{ slot.startTime }}–{{ slot.endTime }}</text>
          <text class="slot-more">›</text>
        </view>
      </view>
    </view>

    <view class="editor-card">
      <view class="field">
        <text class="field-label">课程图标</text>
        <view class="icon-options">
          <view
            v-for="option in COURSE_ICON_OPTIONS"
            :key="option.value"
            class="icon-option press"
            :class="{ on: form.icon === option.value }"
            hover-class="press-on"
            hover-stay-time="80"
            @click="pickIcon(option.value)"
          >
            <AppIcon :name="option.value" :tone="form.icon === option.value ? 'violet' : 'ink'" :size="21" />
            <text>{{ option.label }}</text>
          </view>
        </view>
      </view>
      <view class="field">
        <text class="field-label">课程颜色</text>
        <view class="chip-row color-row">
          <view
            v-for="color in COURSE_COLORS"
            :key="color"
            class="swatch press"
            :class="{ on: form.color.toUpperCase() === color.toUpperCase() }"
            :style="{ background: color }"
            hover-class="press-on"
            hover-stay-time="80"
            @click="form.color = color"
          />
        </view>
      </view>
      <view class="field">
        <text class="field-label">备注</text>
        <textarea v-model="form.note" :maxlength="TEXT_LIMIT.note" placeholder="课程说明或注意事项" placeholder-class="ph" />
      </view>
    </view>

  </view>

  <view class="save-dock">
    <button hover-class="press-on" hover-stay-time="80" class="btn block" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存当前课程' }}</button>
    <button hover-class="press-on" hover-stay-time="80" v-if="courseId" class="btn ghost block" style="margin-top: 8px" @click="archive">
      {{ existing?.archived ? '恢复课程' : '标记已结课' }}
    </button>
  </view>

  <view v-if="editingSlot" class="mask" @click="editingSlot = null">
    <view class="sheet" @click.stop>
      <view class="sheet-head">
        <view>
          <text class="eyebrow">单独调整</text>
          <text class="sheet-title">{{ dayjs(editingSlot.date).format('M月D日') }}</text>
        </view>
        <text class="close press" hover-class="press-on" hover-stay-time="80" @click="editingSlot = null">×</text>
      </view>
      <view class="row">
        <view class="field" style="flex: 1">
          <text class="field-label">开始</text>
          <TimeField v-model="editingSlot.startTime" />
        </view>
        <view class="field" style="flex: 1">
          <text class="field-label">结束</text>
          <TimeField v-model="editingSlot.endTime" />
        </view>
      </view>
      <view class="sheet-foot">
        <button hover-class="press-on" hover-stay-time="80" class="btn block" @click="saveSlotTime">保存当天时间</button>
        <text class="hint">只修改这一天，不影响其他已选日期。</text>
      </view>
    </view>
  </view>
  </view>
</template>

<style scoped>
.edit.sub { padding-bottom: 148px; }
.lesson-count { color: var(--muted); font-size: 12px; font-weight: 700; }
.participants {
  margin-bottom: 14px;
  padding: 15px 14px 12px;
  border-radius: 22px;
  background: linear-gradient(150deg, var(--accent-soft) 0%, var(--paper) 68%);
  box-shadow: var(--elev-sm);
}
.participants-title { display: block; margin-bottom: 12px; color: var(--muted); text-align: center; font-size: 12px; font-weight: 650; }
.child-row { display: flex; flex-wrap: nowrap; justify-content: center; gap: 4px; }
.child-pick { display: flex; flex: 1; max-width: 80px; min-width: 0; flex-direction: column; align-items: center; gap: 6px; color: var(--muted); font-size: 12px; }
.child-pick text { width: 100%; overflow: hidden; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
.child-pick.on { color: var(--ink); }
.child-create {
  min-width: 132px;
  height: 40px;
  margin: 4px 0 6px;
  padding: 0 22px;
  border-radius: 14px;
  background: linear-gradient(135deg, #ffb45c 0%, #ff7a45 48%, #f15a36 100%);
  box-shadow: 0 10px 20px -10px rgba(255, 122, 69, 0.55);
}
.child-create text {
  display: block;
  height: 40px;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  line-height: 40px;
  text-align: center;
}
.child-pick.on :deep(.child-face) { box-shadow: 0 0 0 2px var(--halo), 0 0 0 4px #ff7a45; }
.editor-card {
  margin-bottom: 12px;
  padding: 16px 14px;
  border-radius: 22px;
  background: var(--paper);
  box-shadow: var(--elev-sm);
}
.section-heading { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.slot-toggle { margin-bottom: 0; }
.slot-toggle-copy { flex: 1; min-width: 0; }
.slot-caret {
  display: flex;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  transform: rotate(90deg);
  transition: transform 0.22s ease;
}
.slot-caret.open { transform: rotate(-90deg); }
.slot-panel { margin-top: 8px; }
.section-heading > text {
  color: var(--accent-text);
  font-size: 12px;
  font-weight: 800;
}
.h2 { display: block; color: var(--ink); font-size: 16px; font-weight: 800; }
.hint { display: block; color: var(--muted); font-size: 12px; }
.hint.warn { color: var(--unpaid); }
.billing { margin-top: 4px; }
.bill-title { display: block; font-weight: 800; }
.plan-list { display: flex; flex-direction: column; gap: 8px; margin: 10px 0; }
.plan { padding: 12px; border-radius: 16px; background: var(--surface-2); }
.plan.on { background: var(--accent-soft); box-shadow: inset 0 0 0 1.5px #ff7a45; }
.plan-name { display: block; font-weight: 700; }
.unit-row { display: flex; gap: 8px; margin-bottom: 12px; }
.unit { display: flex; flex: 1; align-items: center; justify-content: center; min-height: 40px; padding: 10px 0; border-radius: 12px; background: var(--surface-2); font-weight: 700; line-height: 1; }
.unit.on { background: var(--accent-soft); box-shadow: inset 0 0 0 1.5px #ff7a45; }
.pay-row { align-items: center; margin-bottom: 8px; }
.summary { margin-top: 4px; color: var(--muted); font-size: 12px; }
.slot { display: flex; align-items: center; gap: 10px; padding: 12px 0; border-top: 1px solid var(--line); }
.slot-date { display: block; font-weight: 700; }
.slot-time { margin-left: auto; font-weight: 700; }
.slot-more { color: var(--muted); font-size: 18px; }
.icon-options { display: flex; flex-wrap: wrap; gap: 8px; }
.icon-option {
  display: flex;
  width: calc(20% - 7px);
  box-sizing: border-box;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 9px 2px 7px;
  border: 1px solid var(--icon-line);
  border-radius: 14px;
  background: var(--icon-bg);
  color: var(--icon-fg);
  font-size: 10px;
}
.icon-option.on { color: var(--icon-on-fg); border-color: var(--icon-on-line); background: var(--icon-on-bg); }
.color-row { flex-wrap: nowrap; justify-content: space-between; gap: 0; padding: 0 3px; }
.swatch { width: 28px; height: 28px; flex: 0 0 auto; border-radius: 50%; }
.swatch.on { box-shadow: 0 0 0 3px var(--halo), 0 0 0 5px #ff7a45; }
.save-dock {
  position: fixed;
  z-index: 40;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 12px 18px calc(12px + env(safe-area-inset-bottom));
  background: var(--dock-bg);
}
.eyebrow { display: block; color: var(--accent-text); font-size: 11px; font-weight: 700; }
.close {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--bg);
  color: var(--muted);
  text-align: center;
  line-height: 34px;
  font-size: 22px;
}
</style>
