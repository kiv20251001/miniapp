<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import { CATEGORY_LABEL, EXPENSE_STATUS_LABEL } from '@/domain/constants'
import type { Expense } from '@/domain/types'
import { billNetAmount, money, refundedAmountOf } from '@/services/billing'
import { useAppStore } from '@/stores/app'
import CourseIcon from '@/components/CourseIcon.vue'

const props = defineProps<{
  expense: Expense
}>()

const store = useAppStore()
const course = computed(() =>
  props.expense.courseId
    ? store.snapshot.courses.find((item) => item.id === props.expense.courseId)
    : undefined,
)
const netAmount = computed(() => billNetAmount(props.expense, store.overviewPayments))
const refunded = computed(() => refundedAmountOf(props.expense.id, store.overviewPayments))
</script>

<template>
  <article class="card item">
    <span
      class="expense-icon"
      :class="{ fallback: !course }"
      :style="course ? { '--course-color': course.color } : undefined"
    >
      <CourseIcon v-if="course" :name="course.icon ?? 'generic'" />
      <template v-else>¥</template>
    </span>
    <div class="expense-copy">
        <p class="muted">{{ CATEGORY_LABEL[expense.category] }} · {{ dayjs(`${expense.period}-01`).format('YYYY年M月') }}</p>
        <h3>{{ expense.title }}</h3>
        <p class="muted due-date">
          {{ expense.paidAt ? `支付 ${dayjs(expense.paidAt).format('M月D日')}` : '未支付' }}
        </p>
        <p v-if="refunded" class="refund-note">已退 {{ money(refunded) }}</p>
    </div>
    <div class="right">
        <strong>{{ money(netAmount) }}</strong>
        <span
          class="status-btn"
          :class="`status-${expense.status}`"
        >
          {{ EXPENSE_STATUS_LABEL[expense.status] }}
        </span>
    </div>
    <span class="arrow">›</span>
  </article>
</template>

<style scoped>
.item {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto 12px;
  gap: 11px;
  align-items: center;
  padding: 14px;
}
.expense-icon {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  color: #fff;
  border-radius: 13px;
  background: var(--course-color);
  box-shadow: 0 10px 18px -10px color-mix(in srgb, var(--course-color) 80%, transparent), inset 0 1px 0 rgba(255,255,255,.35);
  font-size: 21px;
  font-weight: 800;
}
.expense-icon :deep(svg) {
  width: 22px;
  height: 22px;
}
.expense-icon.fallback {
  --course-color: #ff6b8a;
  font-size: 15px;
}
.expense-copy { min-width: 0; }
.expense-copy > p { font-size: 9px; }
.refund-note { color: var(--unpaid); }
.item h3 {
  margin: 3px 0 5px;
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.right {
  text-align: right;
  display: grid;
  gap: 6px;
  justify-items: end;
}
.right > strong { font-size: 14px; font-variant-numeric: tabular-nums; }
.status-btn {
  padding: 3px 7px;
  border: 0;
  border-radius: 999px;
  background: color-mix(in srgb, currentColor 12%, transparent);
  font-size: 9px;
  font-weight: 700;
}
.arrow { color: var(--muted); font-size: 18px; }
</style>
