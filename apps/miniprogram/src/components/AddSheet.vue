<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'
import {
  busyIntervalsForDates,
  courseParticipantIds,
  findBusyConflict,
  minutesBetween,
  nextAvailableEndTime,
  occurrencesOnDate,
  startTimeOptions,
} from '@server-domain/schedule'
import { showCloudError } from '@/cloud/call'
import { needFamily } from '@/utils/login-gate'
import { TEXT_LIMIT } from '@/domain/limits'
import { amountError, cleanText, formTip } from '@/utils/form'
import { useFamilyStore } from '@/stores/family'
import type { Homework } from '@server-domain/types'
import AppIcon from './AppIcon.vue'
import DateDragGrid from './DateDragGrid.vue'
import TimeField from './TimeField.vue'

const props = defineProps<{
  open: boolean
  date: string
  /** 传入时直接打开作业表单并带上原内容。 */
  homework?: Homework | null
}>()

const emit = defineEmits<{
  close: []
}>()

const SUBJECT_PICKS = ['语文', '数学', '英语', '科学', '阅读']
const MODE_INDEX = { preset: 0, temporary: 1, homework: 2 } as const

const store = useFamilyStore()
const mode = ref<'preset' | 'temporary' | 'homework'>('preset')
const subject = ref('')
const content = ref('')
const homeworkNote = ref('')
const editingHomework = computed(() => props.homework ?? null)
const dates = ref<string[]>([])
const courseId = ref('')
const title = ref('')
const note = ref('')
const startTime = ref('09:00')
const endTime = ref('10:00')
const amount = ref('')
const paid = ref(false)
const saving = ref(false)
const pickerOpen = ref(false)

const sortedDates = computed(() => [...dates.value].filter(Boolean).sort())
const courses = computed(() => store.overviewCourses.filter((course) => course.source !== 'temporary'))
const selectedCourse = computed(() => courses.value.find((item) => item.id === courseId.value))
const busyChildIds = computed(() => {
  if (selectedCourse.value) return courseParticipantIds(selectedCourse.value)
  return store.child ? [store.child.id] : []
})
const busyIntervals = computed(() =>
  busyIntervalsForDates(
    store.overviewCourses,
    sortedDates.value.length ? sortedDates.value : [props.date],
    store.overviewScheduleExceptions,
    undefined,
    busyChildIds.value,
  ),
)
const conflict = computed(() => findBusyConflict(busyIntervals.value, startTime.value, endTime.value))
const dateLabel = computed(() => {
  const dates = sortedDates.value
  if (!dates.length) return '选择上课日期'
  const first = dayjs(dates[0])
  const last = dayjs(dates[dates.length - 1])
  if (dates.length === 1) return first.format('YYYY年M月D日')
  if (first.isSame(last, 'year')) return `${first.format('YYYY年M月D日')}–${last.format('M月D日')}`
  return `${first.format('YYYY年M月D日')}–${last.format('YYYY年M月D日')}`
})

function courseScheduledOnAllDates(id: string) {
  if (!sortedDates.value.length) return false
  return sortedDates.value.every((day) =>
    occurrencesOnDate(store.overviewCourses, day, store.overviewScheduleExceptions)
      .some((item) => item.course.id === id),
  )
}

function pickDefaultTimes(date: string) {
  const intervals = busyIntervalsForDates(
    store.overviewCourses,
    [date],
    store.overviewScheduleExceptions,
    undefined,
    busyChildIds.value,
  )
  const free = startTimeOptions(intervals).filter((item) => !item.disabled)
  const start = free.find((item) => item.value >= '09:00')?.value ?? free[0]?.value ?? '09:00'
  startTime.value = start
  endTime.value = nextAvailableEndTime(intervals, start, 60)
}

function resetForm() {
  const existing = editingHomework.value
  mode.value = existing ? 'homework' : 'preset'
  dates.value = [existing?.date || props.date || dayjs().format('YYYY-MM-DD')]
  courseId.value = ''
  title.value = ''
  note.value = ''
  amount.value = ''
  paid.value = false
  subject.value = existing?.subject ?? ''
  content.value = existing?.content ?? ''
  homeworkNote.value = existing?.note ?? ''
  pickerOpen.value = false
  pickDefaultTimes(dates.value[0])
}

function switchMode(next: 'preset' | 'temporary' | 'homework') {
  mode.value = next
  if (next === 'homework' && dates.value.length > 1) dates.value = [sortedDates.value[0]]
}

/** 作业只记在一天上：多选时保留刚点的那一天。 */
function pickDates(next: string[]) {
  if (mode.value !== 'homework') {
    dates.value = next
    return
  }
  const added = next.filter((day) => !dates.value.includes(day))
  dates.value = added.length ? [added[added.length - 1]] : next.slice(-1)
}

function onContentInput(event: { detail?: { value?: string } }) {
  content.value = String(event.detail?.value ?? '')
}

function pasteContent() {
  uni.getClipboardData({
    success: (res) => {
      const text = String(res.data || '').trim()
      if (!text) {
        formTip('剪贴板里没有文字')
        return
      }
      content.value = Array.from(text).slice(0, TEXT_LIMIT.homeworkContent).join('')
    },
  })
}

function removeHomework() {
  const existing = editingHomework.value
  if (!existing || saving.value) return
  uni.showModal({
    title: '删除作业',
    content: `删除「${existing.subject}」这条作业？`,
    confirmText: '删除',
    confirmColor: '#e5484d',
    success: async (res) => {
      if (!res.confirm) return
      saving.value = true
      try {
        await store.removeHomework(existing.id)
        emit('close')
      } catch (error) {
        showCloudError(error)
      } finally {
        saving.value = false
      }
    },
  })
}

async function submitHomework() {
  // 微信里点底部按钮时，多行输入框可能还没把最后一次输入交出来。
  await new Promise((resolve) => setTimeout(resolve, 40))
  const cleanSubject = cleanText(subject.value, TEXT_LIMIT.homeworkSubject)
  const cleanContent = content.value.replace(/\r\n?/g, '\n').trim().slice(0, TEXT_LIMIT.homeworkContent)
  if (!sortedDates.value.length) {
    formTip('请选择作业日期')
    return
  }
  if (!cleanSubject) {
    formTip('请填写作业科目')
    return
  }
  if (!cleanContent) {
    formTip('请填写作业内容')
    return
  }
  saving.value = true
  try {
    const existingId = editingHomework.value?.id
    await store.saveHomework({
      ...(existingId ? { id: existingId } : {}),
      date: sortedDates.value[0],
      subject: cleanSubject,
      content: cleanContent,
      note: cleanText(homeworkNote.value, TEXT_LIMIT.note),
    })
    emit('close')
  } catch (error) {
    showCloudError(error)
  } finally {
    saving.value = false
  }
}

watch(() => props.open, (open) => {
  if (open) resetForm()
}, { immediate: true })

function selectCourse(id: string) {
  if (courseScheduledOnAllDates(id)) return
  courseId.value = id
}

function setStart(value: string) {
  const duration = minutesBetween(startTime.value, endTime.value)
  startTime.value = value
  endTime.value = nextAvailableEndTime(busyIntervals.value, value, duration > 0 ? duration : 60)
}

function goCreateCourse() {
  emit('close')
  uni.navigateTo({ url: '/subpages/course-edit/index' })
}

async function submit() {
  if (saving.value || needFamily()) return
  if (mode.value === 'homework') {
    await submitHomework()
    return
  }
  const cleanTitle = cleanText(title.value, TEXT_LIMIT.courseTitle)
  if (!sortedDates.value.length) {
    formTip('请选择上课日期')
    return
  }
  if (mode.value === 'preset') {
    if (!courseId.value) {
      formTip('请选择一门课程')
      return
    }
    if (courseScheduledOnAllDates(courseId.value)) {
      formTip('所选日期都已有这门课')
      return
    }
  } else {
    if (!cleanTitle) {
      formTip('请填写计划名称')
      return
    }
    if (!startTime.value || !endTime.value || endTime.value <= startTime.value) {
      formTip('结束时间要晚于开始时间')
      return
    }
    if (conflict.value) {
      formTip(`所选日期中「${conflict.value.title}」已占用该时间段`)
      return
    }
    const amountProblem = amountError(amount.value, '费用')
    if (amountProblem) {
      formTip(amountProblem)
      return
    }
  }
  saving.value = true
  try {
    if (mode.value === 'preset') {
      await store.addOccurrences(courseId.value, sortedDates.value)
    } else {
      await store.quickArrangement({
        dates: sortedDates.value,
        title: cleanTitle,
        note: cleanText(note.value, TEXT_LIMIT.note),
        startTime: startTime.value,
        endTime: endTime.value,
        amount: Number(amount.value) || 0,
        expenseStatus: paid.value ? 'paid' : 'unpaid',
      })
    }
    emit('close')
  } catch (error) {
    showCloudError(error)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <view v-if="open" class="mask" @click="emit('close')">
    <view class="sheet" @click.stop>
      <view class="handle" />
      <view class="add-head">
        <view class="add-icon" :class="{ homework: mode === 'homework' }">
          <AppIcon :name="mode === 'homework' ? 'homework' : 'plus'" tone="white" :size="22" />
        </view>
        <view class="add-copy">
          <text class="add-title">{{ editingHomework ? '编辑作业' : '新增计划' }}</text>
          <text class="add-caption">{{ mode === 'homework' ? '把老师在群里布置的作业贴进来' : '选一门已有课程，或临时加一项安排' }}</text>
        </view>
        <text class="close press" hover-class="press-on" hover-stay-time="80" @click="emit('close')">×</text>
      </view>

      <scroll-view scroll-y class="sheet-scroll" :show-scrollbar="false">
        <view class="field">
          <text class="field-label">{{ mode === 'homework' ? '作业日期' : '上课日期' }}<text class="req">*</text></text>
          <view class="date-trigger press" hover-class="press-on" hover-stay-time="80" @click="pickerOpen = true">
            <text class="date-text">{{ dateLabel }}</text>
            <text class="date-count">{{ sortedDates.length && mode !== 'homework' ? `${sortedDates.length} 天` : '' }}</text>
          </view>
        </view>

        <view v-if="!editingHomework" class="mode-tabs">
          <view class="mode-thumb" :style="{ transform: `translateX(${MODE_INDEX[mode] * 100}%)` }" />
          <text class="mode-tab press" :class="{ on: mode === 'preset' }" hover-class="press-on" hover-stay-time="80" @click="switchMode('preset')">选择已有课程</text>
          <text class="mode-tab press" :class="{ on: mode === 'temporary' }" hover-class="press-on" hover-stay-time="80" @click="switchMode('temporary')">新增临时计划</text>
          <text class="mode-tab press" :class="{ on: mode === 'homework' }" hover-class="press-on" hover-stay-time="80" @click="switchMode('homework')">课堂作业</text>
        </view>

        <template v-if="mode === 'homework'">
          <view class="field">
            <text class="field-label">作业科目<text class="req">*</text></text>
            <input v-model="subject" :maxlength="TEXT_LIMIT.homeworkSubject" placeholder="请输入相应的作业类型" placeholder-class="ph" />
            <view class="subject-picks">
              <text
                v-for="item in SUBJECT_PICKS"
                :key="item"
                class="subject-pick press"
                :class="{ on: subject === item }"
                hover-class="press-on"
                hover-stay-time="80"
                @click="subject = item"
              >{{ item }}</text>
            </view>
          </view>
          <view class="field">
            <view class="field-label-row">
              <text class="field-label">作业内容<text class="req">*</text></text>
              <text class="paste press" hover-class="press-on" hover-stay-time="80" @click="pasteContent">粘贴群消息</text>
            </view>
            <view class="homework-box">
              <textarea
                :value="content"
                class="homework-content"
                :maxlength="TEXT_LIMIT.homeworkContent"
                placeholder="输入或粘贴作业具体内容"
                placeholder-class="ph"
                :show-confirm-bar="false"
                :disable-default-padding="true"
                @input="onContentInput"
                @blur="onContentInput"
              />
            </view>
          </view>
          <view class="field">
            <text class="field-label">备注</text>
            <input v-model="homeworkNote" :maxlength="TEXT_LIMIT.note" placeholder="例如 周五前交、需要家长签字" placeholder-class="ph" />
          </view>
        </template>

        <template v-else-if="mode === 'preset'">
          <view v-if="courses.length" class="preset-list">
            <view
              v-for="course in courses"
              :key="course.id"
              class="preset press"
              :class="{ on: courseId === course.id, off: courseScheduledOnAllDates(course.id) }"
              hover-class="press-on"
              hover-stay-time="80"
              @click="selectCourse(course.id)"
            >
              <view class="dot" :style="{ background: course.color }" />
              <view class="preset-copy">
                <text class="preset-name">{{ course.title }}</text>
                <text class="preset-meta">{{ course.recurrence.startTime }}–{{ course.recurrence.endTime }} · {{ course.teacher || '老师待定' }}</text>
              </view>
              <text class="preset-mark">{{ courseScheduledOnAllDates(course.id) ? '已计划' : (courseId === course.id ? '✓' : '') }}</text>
            </view>
          </view>
          <view v-else class="empty-course">
            <button hover-class="press-on" hover-stay-time="80" class="btn outline" @click="goCreateCourse">新增课程</button>
          </view>
        </template>

        <template v-else-if="mode === 'temporary'">
          <view class="field">
            <text class="field-label">计划名称<text class="req">*</text></text>
            <input v-model="title" :maxlength="TEXT_LIMIT.courseTitle" placeholder="请输入计划名称" placeholder-class="ph" />
          </view>
          <view class="field">
            <text class="field-label">备注</text>
            <input v-model="note" :maxlength="TEXT_LIMIT.note" placeholder="请输入备注信息" placeholder-class="ph" />
          </view>
          <view class="row">
            <view class="field" style="flex: 1">
              <text class="field-label">开始时间</text>
              <TimeField :model-value="startTime" @update:model-value="setStart" />
            </view>
            <view class="field" style="flex: 1">
              <text class="field-label">结束时间</text>
              <TimeField v-model="endTime" />
            </view>
          </view>
          <view v-if="busyIntervals.length" class="busy">
            <text v-for="busy in busyIntervals" :key="`${busy.start}-${busy.title}`">{{ busy.start }}–{{ busy.end }} {{ busy.title }}</text>
          </view>
          <view class="field">
            <text class="field-label">费用</text>
            <view class="money">
              <text>¥</text>
              <input v-model="amount" type="digit" :maxlength="TEXT_LIMIT.amount" placeholder="0" placeholder-class="ph" />
            </view>
          </view>
          <view class="row pay-row">
            <text>是否已支付</text>
            <switch :checked="paid" color="#ff7a45" @change="paid = Boolean($event.detail.value)" />
          </view>
        </template>
      </scroll-view>

      <view class="sheet-foot" :class="{ 'with-delete': editingHomework && mode === 'homework' }">
        <button
          v-if="editingHomework && mode === 'homework'"
          hover-class="press-on"
          hover-stay-time="80"
          class="btn ghost block delete-btn"
          :disabled="saving"
          @click="removeHomework"
        >删除这条作业</button>
        <button hover-class="press-on" hover-stay-time="80" class="btn block" :disabled="saving" @click="submit">{{ saving ? '保存中…' : '确认' }}</button>
      </view>
    </view>
  </view>
  <view v-if="pickerOpen" class="mask picker-mask" @click="pickerOpen = false">
    <view class="sheet picker-sheet" @click.stop>
      <view class="sheet-head">
        <text class="sheet-title">{{ mode === 'homework' ? '选择作业日期' : '选择上课日期' }}</text>
        <text class="close press" hover-class="press-on" hover-stay-time="80" @click="pickerOpen = false">×</text>
      </view>
      <text class="tip">{{ mode === 'homework' ? '作业记在一天上，点选哪天就是哪天。' : '点选或按住滑动，可连续多选、取消。' }}</text>
      <DateDragGrid :selected="dates" @update:selected="pickDates" />
      <view class="sheet-foot">
        <button hover-class="press-on" hover-stay-time="80" class="btn block" @click="pickerOpen = false">{{ mode === 'homework' ? '完成' : `完成 · ${dates.length} 天` }}</button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.handle {
  width: 38px;
  height: 4px;
  margin: 2px auto 12px;
  border-radius: 99px;
  background: var(--line);
}
.add-head { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.add-icon {
  display: flex;
  width: 46px;
  height: 46px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: linear-gradient(135deg, #ffb45c 0%, #ff7a45 48%, #f15a36 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 10px 20px -10px rgba(255, 122, 69, 0.7);
}
.add-copy { flex: 1; min-width: 0; }
.add-title { display: block; color: var(--ink); font-size: 20px; font-weight: 800; letter-spacing: -0.03em; }
.add-caption { display: block; margin-top: 4px; color: var(--muted); font-size: 12px; }
.sheet-title { font-size: 22px; }
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
.mode-tabs {
  position: relative;
  display: flex;
  margin-bottom: 14px;
  padding: 4px;
  border-radius: 16px;
  background: var(--surface-2);
}
.mode-thumb {
  position: absolute;
  top: 4px;
  left: 4px;
  width: calc((100% - 8px) / 3);
  height: 39px;
  border-radius: 12px;
  background: var(--accent-soft);
  transition: transform 0.42s cubic-bezier(0.32, 0.72, 0, 1);
}
.add-icon.homework {
  background: linear-gradient(135deg, #9b8cff 0%, #6c63ff 55%, #5146e0 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 10px 20px -10px rgba(108, 99, 255, 0.7);
}
.subject-picks { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.subject-pick {
  padding: 5px 11px;
  border-radius: 999px;
  color: var(--muted);
  background: var(--surface-2);
  font-size: 12px;
  font-weight: 650;
}
.subject-pick.on { color: #fff; background: #6c63ff; }
.field-label-row { display: flex; align-items: center; justify-content: space-between; }
.paste { color: var(--accent-text); font-size: 12px; font-weight: 700; }
.homework-box {
  box-sizing: border-box;
  width: 100%;
  padding: 10px 12px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--field-bg);
}
.homework-content {
  box-sizing: border-box;
  display: block;
  width: 100%;
  height: 112px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  color: var(--ink);
  background: transparent;
  box-shadow: none;
  font-size: 14px;
  line-height: 1.55;
}
.with-delete {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.delete-btn {
  color: #e5484d;
  background: var(--danger-soft);
  box-shadow: none;
}
.mode-tab {
  position: relative;
  z-index: 1;
  display: flex;
  flex: 1;
  height: 39px;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  transition: color 0.3s ease;
}
.mode-tab.on { color: var(--accent-text); }
.mode-tab.press-on {
  transition: transform 0.12s cubic-bezier(0.2, 0, 0.2, 1);
  transform: scale(0.94);
}
.preset-meta, .busy text {
  display: block;
  color: var(--muted);
  font-size: 12px;
}
.preset {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  padding: 12px;
  border-radius: 16px;
  background: var(--surface-2);
}
.preset.on { box-shadow: inset 0 0 0 1.5px #ff7a45; background: var(--accent-soft); }
.preset.off { opacity: 0.45; }
.dot { width: 10px; height: 10px; border-radius: 50%; }
.preset-copy { flex: 1; min-width: 0; }
.preset-name { display: block; font-weight: 700; }
.preset-mark { color: var(--accent-text); font-size: 12px; font-weight: 700; }
.empty-course { padding: 4px 0 16px; }
.btn.outline {
  width: 100%;
  height: 44px;
  color: var(--accent-text);
  background: transparent;
  box-shadow: inset 0 0 0 1.5px #ff7a45;
  font-weight: 700;
}
.money {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  border-radius: 14px;
  background: var(--field-bg);
  box-shadow: inset 0 0 0 1px var(--line);
}
.money input { flex: 1; height: 44px; }
.busy { margin-bottom: 12px; }
.pay-row { align-items: center; margin-bottom: 8px; }
.date-trigger {
  display: flex;
  min-height: 46px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 13px;
  border-radius: 14px;
  color: var(--ink);
  background: var(--field-bg);
  box-shadow: inset 0 0 0 1px var(--line);
}
.date-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.date-count { color: var(--accent-text); font-size: 12px; font-weight: 700; }
.picker-mask { z-index: 12000; }
.picker-sheet { padding-bottom: calc(16px + var(--safe-bottom)); }
</style>
