<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { DayOccurrence } from '@server-domain/types'
import { tileBackground } from '@/utils/color'
import AppIcon from './AppIcon.vue'
import { showCloudError } from '@/cloud/call'
import { useFamilyStore } from '@/stores/family'
import { occurrenceExpense, temporaryNoteValue, temporaryRemark } from '@/utils/view'
import { TEXT_LIMIT } from '@/domain/limits'
import { expectedUsageCharge } from '@server-domain/charges'
import { amountError, amountInputValue, cleanText, formTip } from '@/utils/form'
import TimeField from './TimeField.vue'

const props = defineProps<{
  item: DayOccurrence | null
  readonly?: boolean
}>()

const emit = defineEmits<{
  close: []
  cancelled: [item: DayOccurrence]
}>()

const store = useFamilyStore()
const startTime = ref('18:00')
const endTime = ref('19:00')
const amount = ref('')
const paid = ref(false)
const note = ref('')
const saving = ref(false)

const expense = computed(() =>
  props.item ? occurrenceExpense(store.overviewExpenses, props.item.course, props.item.date) : undefined,
)
const locked = computed(() => expense.value?.status === 'paid')
const temporary = computed(() => props.item?.course.source === 'temporary')
const icon = computed(() => {
  const course = props.item?.course
  if (!course) return 'generic'
  return store.snapshot.courses.find((item) => item.id === course.id)?.icon || course.icon || 'generic'
})
const infoRows = computed(() => {
  const item = props.item
  if (!item || temporary.value) return []
  return [
    { icon: 'family', label: '老师', value: item.course.teacher || '待定' },
    { icon: 'school', label: '地点', value: item.course.location || '待定' },
  ]
})
const free = computed(() => {
  const course = props.item?.course
  return course?.billingPolicy?.pricingMode === 'free' || course?.billingMode === 'free'
})

watch(() => props.item, (item) => {
  if (!item) return
  startTime.value = item.exception?.startTime ?? item.course.recurrence.startTime
  endTime.value = item.exception?.endTime ?? item.course.recurrence.endTime
  const bill = occurrenceExpense(store.overviewExpenses, item.course, item.date)
  amount.value = amountInputValue(bill?.amount ?? item.course.amount)
  paid.value = bill?.status === 'paid'
  note.value = temporaryNoteValue(item.course)
}, { immediate: true })

watch([startTime, endTime], () => {
  const item = props.item
  if (!item || locked.value || free.value) return
  if (item.course.billingPolicy?.pricingMode !== 'per_hour') return
  const scheduledStart = item.exception?.startTime ?? item.course.recurrence.startTime
  const scheduledEnd = item.exception?.endTime ?? item.course.recurrence.endTime
  if (startTime.value === scheduledStart && endTime.value === scheduledEnd) return
  amount.value = amountInputValue(expectedUsageCharge(item.course, startTime.value, endTime.value).amount)
})

async function save() {
  const item = props.item
  if (!item || saving.value) return
  if (endTime.value <= startTime.value) {
    formTip('结束时间要晚于开始时间')
    return
  }
  const amountProblem = free.value || locked.value ? '' : amountError(amount.value, '金额')
  if (amountProblem) {
    formTip(amountProblem)
    return
  }
  saving.value = true
  try {
    const scheduledStart = item.exception?.startTime ?? item.course.recurrence.startTime
    const scheduledEnd = item.exception?.endTime ?? item.course.recurrence.endTime
    const timeChanged = startTime.value !== scheduledStart || endTime.value !== scheduledEnd
    if (timeChanged) {
      await store.upsertException({
        courseId: item.course.id,
        date: item.date,
        status: item.exception?.status === 'added' ? 'added' : 'rescheduled',
        startTime: startTime.value,
        endTime: endTime.value,
        title: item.course.title,
        location: item.course.location,
      })
    }
    if (!free.value && !locked.value) {
      await store.saveOccurrenceExpense(item.course.id, item.date, Number(amount.value) || 0, paid.value)
    }
    if (temporary.value) {
      const nextNote = cleanText(note.value, TEXT_LIMIT.note)
      if (nextNote !== temporaryNoteValue(item.course)) {
        await store.updateCourseNote(item.course.id, nextNote)
      }
    }
    emit('close')
  } catch (error) {
    showCloudError(error)
  } finally {
    saving.value = false
  }
}

function cancelOnce() {
  const item = props.item
  if (!item) return
  uni.showModal({
    title: '取消这次课',
    content: '取消后可以从提示里撤销。',
    success: async (res) => {
      if (!res.confirm) return
      const snapshot = JSON.parse(JSON.stringify(item)) as DayOccurrence
      try {
        if (item.exception?.status === 'added') await store.dropOccurrence(item.course.id, item.date)
        else {
          await store.upsertException({
            courseId: item.course.id,
            date: item.date,
            status: 'cancelled',
          })
        }
        emit('cancelled', snapshot)
        emit('close')
      } catch (error) {
        showCloudError(error)
      }
    },
  })
}
</script>

<template>
  <view v-if="item" class="mask" @click="emit('close')">
    <view class="sheet" @click.stop>
      <view class="handle" />
      <view class="occ-head">
        <view class="occ-icon" :style="{ background: tileBackground(item.course.color) }">
          <AppIcon :name="icon" tone="white" :size="24" />
        </view>
        <view class="occ-copy">
          <text class="occ-badge">{{ temporary ? '临时计划' : '这次计划' }}</text>
          <text class="occ-title">{{ item.course.title }}</text>
        </view>
        <text class="close press" hover-class="press-on" hover-stay-time="80" @click="emit('close')">×</text>
      </view>
      <scroll-view scroll-y class="sheet-scroll" :show-scrollbar="false">
        <view v-if="infoRows.length" class="info-card">
          <view v-for="row in infoRows" :key="row.label" class="info-row">
            <view class="info-mark"><AppIcon :name="row.icon" tone="muted" :size="15" /></view>
            <text class="info-label">{{ row.label }}</text>
            <text class="info-value">{{ row.value }}</text>
          </view>
        </view>
        <view v-else-if="temporary && readonly" class="info-card">
          <view class="info-row">
            <view class="info-mark"><AppIcon name="clipboard" tone="muted" :size="15" /></view>
            <text class="info-label">备注</text>
            <text class="info-value">{{ temporaryRemark(item.course) }}</text>
          </view>
        </view>
        <template v-if="!readonly">
          <view class="row" :class="{ 'time-first': !infoRows.length }">
            <view class="field" style="flex: 1">
              <text class="field-label">开始</text>
              <TimeField v-model="startTime" />
            </view>
            <view class="field" style="flex: 1">
              <text class="field-label">结束</text>
              <TimeField v-model="endTime" />
            </view>
          </view>
          <view v-if="temporary" class="field">
            <text class="field-label">备注</text>
            <input v-model="note" :maxlength="TEXT_LIMIT.note" placeholder="地点或事项" placeholder-class="ph" />
          </view>
          <view v-if="!free" class="field">
            <text class="field-label">金额</text>
            <view class="money">
              <text>¥</text>
              <input v-model="amount" type="digit" :maxlength="TEXT_LIMIT.amount" placeholder="0" placeholder-class="ph" :disabled="locked" />
            </view>
          </view>
          <view v-if="!free" class="row pay-row">
            <text>是否已支付</text>
            <switch :checked="paid" :disabled="locked" color="#ff7a45" @change="paid = Boolean($event.detail.value)" />
          </view>
        </template>
      </scroll-view>
      <view v-if="!readonly" class="sheet-foot action-row">
        <button hover-class="press-on" hover-stay-time="80" class="btn danger" @click="cancelOnce">取消课程</button>
        <button hover-class="press-on" hover-stay-time="80" class="btn" :disabled="saving" @click="save">{{ saving ? '保存中…' : '确认修改' }}</button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.handle {
  width: 38px;
  height: 4px;
  margin: 2px auto 14px;
  border-radius: 99px;
  background: var(--line);
}
.occ-head { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.occ-icon {
  display: flex;
  width: 48px;
  height: 48px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 10px 20px -12px rgba(25, 31, 58, 0.45);
}
.occ-copy { flex: 1; min-width: 0; }
.occ-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  color: var(--accent-text);
  background: var(--accent-soft);
  font-size: 10px;
  font-weight: 750;
}
.occ-title {
  display: block;
  margin-top: 5px;
  overflow: hidden;
  color: var(--ink);
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.03em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.info-card {
  margin-bottom: 14px;
  padding: 4px 14px;
  border-radius: 18px;
  background: var(--surface-2);
}
.info-row { display: flex; align-items: center; gap: 10px; min-height: 44px; }
.info-row + .info-row { border-top: 1px solid var(--line); }
.info-mark {
  display: flex;
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  background: var(--paper);
}
.info-label { flex: 0 0 auto; width: 34px; color: var(--muted); font-size: 12px; }
.info-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--ink);
  font-size: 14px;
  font-weight: 700;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.time-first { margin-top: 2px; }
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
.pay-row { align-items: center; margin-bottom: 8px; }
.action-row { display: flex; gap: 10px; }
.action-row .btn { flex: 1; min-height: 48px; }
.action-row .btn.danger {
  color: #ed5d6e;
  background: var(--danger-soft);
  box-shadow: none;
}
</style>
