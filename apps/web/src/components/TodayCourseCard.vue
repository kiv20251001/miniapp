<script setup lang="ts">
import { computed } from 'vue'
import { COURSE_TYPE_LABEL } from '@/domain/constants'
import type { DayOccurrence } from '@/domain/types'
import CourseIcon from '@/components/CourseIcon.vue'
import { useAppStore } from '@/stores/app'
import { courseCardFee } from '@/services/charges'
import { buildCourseBillLedger } from '@/services/courseBills'
import { money } from '@/services/billing'

const props = defineProps<{
  item: DayOccurrence
  index: number
  progress: { completed: number; total: number; percent: number }
}>()
defineEmits<{ edit: [item: DayOccurrence] }>()

const store = useAppStore()

const cardStyle = computed(() => ({
  '--card-tint': props.item.course.color,
  '--delay': `${props.index * 70}ms`,
}))

function minutesOf(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

const startTime = computed(() => props.item.exception?.startTime ?? props.item.course.recurrence.startTime)
const endTime = computed(() => props.item.exception?.endTime ?? props.item.course.recurrence.endTime)

const durationLabel = computed(() => {
  let minutes = minutesOf(endTime.value) - minutesOf(startTime.value)
  if (minutes < 0) minutes += 24 * 60
  if (minutes < 60) return `${minutes}min`
  const hours = minutes / 60
  return Number.isInteger(hours) ? `${hours}h` : `${Number(hours.toFixed(1))}h`
})

const timeRange = computed(
  () => `${startTime.value}–${endTime.value}`,
)

const feeExpense = computed(() => {
  const course = props.item.course
  if (course.billingPolicy?.pricingMode === 'prepaid' || course.billingMode === 'term') {
    return store.snapshot.expenses.find((item) =>
      item.courseId === course.id
      && item.status !== 'void'
      && (item.source === 'course_upfront' || item.billingMode === 'term'),
    )
  }
  return store.findOccurrenceExpense(course.id, props.item.date)
})

const fee = computed(() => courseCardFee(props.item.course, feeExpense.value))

const courseTotals = computed(() => {
  const course = props.item.course
  if (course.billingPolicy?.pricingMode === 'free' || course.billingMode === 'free') return null
  const ledger = buildCourseBillLedger(
    course,
    store.snapshot.expenses,
    store.snapshot.scheduleExceptions,
    store.snapshot.charges ?? [],
    store.snapshot.payments ?? [],
  )
  return ledger
})
</script>

<template>
  <article
    class="lesson-card"
    :style="cardStyle"
  >
    <div class="lesson-time">
      <i><CourseIcon :name="item.course.icon ?? 'generic'" /></i>
    </div>
    <div class="lesson-main">
      <div class="lesson-copy">
        <span class="lesson-type">{{ COURSE_TYPE_LABEL[item.course.type] }}</span>
        <h3>{{ item.course.title }}</h3>
        <p>
          <span>{{ item.course.teacher || '老师待定' }}</span>
          <i />
          <span>{{ item.course.location || '地点待定' }}</span>
        </p>
        <div class="lesson-period">
          <strong>{{ durationLabel }}</strong>
          <span>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="8" />
              <path d="M12 8v4l3 2" />
            </svg>
            {{ timeRange }}
          </span>
        </div>
        <small v-if="item.exception">{{ item.exception.status === 'added' ? '本次临时添加' : '本次安排已调整' }}</small>
      </div>
      <div class="fee-row">
        <strong>{{ fee.label }}</strong>
        <span v-if="fee.paid !== undefined" class="pay-pill" :class="fee.paid ? 'paid' : 'unpaid'">
          {{ fee.paid ? '本次已付' : '本次未付' }}
        </span>
        <small v-if="courseTotals" class="fee-totals">
          已付 {{ money(courseTotals.paid) }} · 未付 {{ money(courseTotals.unpaid) }}
        </small>
      </div>
    </div>
    <div class="lesson-actions">
      <button class="edit" type="button" aria-label="编辑本次课程" @click="$emit('edit', item)">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="5" r="1.35" />
          <circle cx="12" cy="12" r="1.35" />
          <circle cx="12" cy="19" r="1.35" />
        </svg>
      </button>
    </div>
    <div class="course-progress">
      <div class="progress-copy">
        <span>课程进度</span>
        <b>{{ progress.completed }}/{{ progress.total }} 课时</b>
      </div>
      <div class="progress-track"><i :style="{ width: `${progress.percent}%` }" /></div>
    </div>
  </article>
</template>

<style scoped>
.lesson-card {
  --card-tint: #7b61ff;
  --lesson-color: var(--card-tint);
  --lesson-deep: color-mix(in srgb, var(--card-tint) 76%, #2a2350);
  --card-ink: var(--ink);
  position: relative;
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr) 32px;
  column-gap: 13px;
  row-gap: 12px;
  align-items: start;
  min-height: 150px;
  padding: 14px;
  overflow: hidden;
  background:
    linear-gradient(150deg, color-mix(in srgb, var(--card-tint) 12%, var(--mix-base)) 0%, var(--mix-base) 55%),
    var(--paper);
  border: 0;
  border-radius: 22px;
  box-shadow:
    0 2px 5px rgba(25,31,58,.04),
    0 18px 34px -16px color-mix(in srgb, var(--card-tint) 40%, rgba(25,31,58,.5)),
    inset 0 1px 0 rgba(255,255,255,.9);
  animation: lesson-in 0.55s cubic-bezier(.2, .85, .25, 1) both;
  animation-delay: var(--delay);
}

.lesson-time {
  display: grid;
  grid-row: 1;
  align-self: stretch;
  min-height: 102px;
  place-items: center;
  border-radius: 16px;
  background: linear-gradient(150deg, color-mix(in srgb, var(--card-tint) 88%, #fff) 0%, var(--lesson-deep) 100%);
  box-shadow:
    0 10px 20px -10px color-mix(in srgb, var(--card-tint) 70%, transparent),
    inset 0 1px 0 rgba(255,255,255,.4);
}

.lesson-time i {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  color: #fff;
  font-size: 24px;
  font-style: normal;
  font-weight: 800;
}

.lesson-time svg {
  width: 25px;
  height: 25px;
}

.lesson-main {
  display: grid;
  grid-row: 1;
  grid-column: 2;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: 10px;
  align-items: center;
  min-width: 0;
  align-self: start;
  padding-top: 2px;
}

.lesson-copy {
  min-width: 0;
}

.lesson-type {
  display: inline-block;
  padding: 3px 8px;
  color: var(--lesson-deep);
  border-radius: 7px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--card-tint) 22%, var(--mix-base)) 0%, color-mix(in srgb, var(--card-tint) 12%, var(--mix-base)) 100%);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .02em;
}

.lesson-main h3 {
  margin: 7px 0 5px;
  overflow: hidden;
  color: var(--card-ink);
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -.025em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lesson-main p {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  overflow: hidden;
  color: var(--muted);
  font-size: 11px;
  white-space: nowrap;
}

.lesson-main p span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.lesson-main p i {
  width: 3px;
  height: 3px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: color-mix(in srgb, var(--muted) 60%, transparent);
}

.lesson-main small {
  display: block;
  margin-top: 6px;
  color: var(--lesson-color);
  font-size: 10px;
  font-weight: 650;
}

.fee-row {
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  align-items: flex-end;
  align-self: center;
  gap: 6px;
  text-align: right;
}

.fee-row strong {
  color: var(--card-ink);
  font-size: 15px;
  font-weight: 750;
  letter-spacing: -.03em;
  white-space: nowrap;
}

.pay-pill {
  display: inline-flex;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 750;
}

.pay-pill.paid {
  color: var(--paid);
  background: var(--paid-soft);
}

.pay-pill.unpaid {
  color: var(--unpaid);
  background: var(--unpaid-soft);
}

.fee-totals {
  max-width: 118px;
  color: var(--muted);
  font-size: 9px;
  font-weight: 650;
  line-height: 1.35;
  white-space: normal;
  text-align: right;
}

.lesson-period {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 9px;
  align-items: center;
  margin-top: 11px;
}

.lesson-period strong {
  color: var(--card-ink);
  font-size: 15px;
  font-weight: 750;
  letter-spacing: -.03em;
}

.lesson-period span {
  display: flex;
  gap: 4px;
  align-items: center;
  color: var(--muted);
  font-size: 9px;
  white-space: nowrap;
}

.lesson-period svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.course-progress {
  grid-row: 2;
  grid-column: 1 / -1;
  padding-top: 11px;
  border-top: 1px solid var(--line);
}

.progress-copy {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  color: var(--muted);
  font-size: 10px;
}

.progress-copy b {
  color: color-mix(in srgb, var(--card-ink) 78%, transparent);
  font-weight: 700;
}

.progress-track {
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--card-tint) 14%, var(--track));
  box-shadow: inset 0 1px 2px rgba(25,31,58,.06);
}

.progress-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, color-mix(in srgb, var(--card-tint) 72%, #fff) 0%, var(--lesson-deep) 100%);
  box-shadow: 0 0 10px -2px color-mix(in srgb, var(--card-tint) 72%, transparent);
}

.lesson-actions {
  position: relative;
  z-index: 2;
  grid-row: 1;
  grid-column: 3;
  align-self: start;
}

.lesson-actions button {
  display: grid;
  width: 32px;
  height: 32px;
  padding: 0;
  place-items: center;
  color: color-mix(in srgb, var(--lesson-color) 55%, var(--muted));
  border: 0;
  border-radius: 50%;
  background: transparent;
  transition: transform .2s ease, color .2s ease, background .2s ease;
  -webkit-tap-highlight-color: transparent;
}

.lesson-actions button:hover {
  color: var(--lesson-color);
  background: color-mix(in srgb, var(--card-tint) 14%, var(--mix-base));
}

.lesson-actions button:active {
  transform: scale(.9);
}

.lesson-actions svg {
  width: 18px;
  fill: currentColor;
}

@keyframes lesson-in {
  from { opacity: 0; transform: translateY(16px) scale(.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
