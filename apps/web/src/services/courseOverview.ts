import dayjs from 'dayjs'
import type { Charge, Course, Expense, OccurrenceRecord, Payment, ScheduleException } from '@/domain/types'
import { effectiveCourseSlots } from '@/services/courseSchedule'
import { getPackageBalance, packageCaption, packageUnitLabel } from '@/services/packages'
import { billNetAmount } from '@/services/billing'
import { buildCourseBillLedger } from '@/services/courseBills'

export type CourseLifecycle = 'active' | 'upcoming' | 'unscheduled' | 'ended' | 'completed'

export interface CourseLifecycleState {
  key: CourseLifecycle
  label: string
  inactive: boolean
}

export function getCourseLifecycle(
  course: Course,
  exceptions: ScheduleException[],
  today = dayjs().format('YYYY-MM-DD'),
): CourseLifecycleState {
  if (course.archived) return { key: 'completed', label: '已结课', inactive: true }

  const slots = effectiveCourseSlots(course, exceptions)
  if (!slots.length) return { key: 'unscheduled', label: '待排课', inactive: false }
  if (slots[0].date > today) return { key: 'upcoming', label: '待开课', inactive: false }
  if (slots[slots.length - 1].date < today) return { key: 'ended', label: '已结束', inactive: true }
  return { key: 'active', label: '进行中', inactive: false }
}

export type CourseBillingState = 'free' | 'unbilled' | 'pending' | 'open' | 'settled'

export interface CourseBillingSummary {
  key: CourseBillingState
  label: string
  openAmount: number
  paidAmount: number
  unitLabel: string
}

export function getCoursePricingLabel(course: Course) {
  if (course.needsBillingReview) {
    if (course.billingMode === 'term') return '旧版按期（待确认）'
    if (course.billingMode === 'monthly') return '旧版按月（待确认）'
  }
  const mode = course.billingPolicy?.pricingMode
  if (mode === 'prepaid') return '一次性支付'
  if (mode === 'per_session') return '按次计费'
  if (mode === 'per_hour') return '按小时计费'
  if (mode === 'fixed_period') {
    return course.billingPolicy?.settlementCycle === 'weekly' ? '每周固定费' : '每月固定费'
  }
  if (mode === 'free' || course.billingMode === 'free') return '无需缴费'
  if (course.billingMode === 'term') return '一次性支付'
  if (course.billingMode === 'session') return '按次计费'
  return '每月固定费'
}

export function getCourseAmountLabel(course: Course) {
  if (course.needsBillingReview) return `参考 ¥${course.amount.toLocaleString('zh-CN')}`
  if (course.billingPolicy?.pricingMode === 'per_session') return `¥${course.amount.toLocaleString('zh-CN')}/次`
  if (course.billingPolicy?.pricingMode === 'per_hour') return `¥${course.amount.toLocaleString('zh-CN')}/小时`
  if (course.billingPolicy?.pricingMode === 'fixed_period') {
    const unit = course.billingPolicy.settlementCycle === 'weekly' ? '周' : '月'
    return `¥${course.amount.toLocaleString('zh-CN')}/${unit}`
  }
  if (course.billingMode === 'free') return '免费'
  const units = course.billingPolicy?.packageUnits
  if (course.billingPolicy?.pricingMode === 'prepaid' && units) {
    return `总价 ¥${course.amount.toLocaleString('zh-CN')} · ${units}${packageUnitLabel(course.billingPolicy.packageUnit ?? 'session')}`
  }
  return `总价 ¥${course.amount.toLocaleString('zh-CN')}`
}

export function getCourseBillingSummary(
  course: Course,
  expenses: Expense[],
  _period: string,
  charges: Charge[] = [],
  records: OccurrenceRecord[] = [],
  exceptions: ScheduleException[] = [],
  payments: Payment[] = [],
): CourseBillingSummary {
  const unitLabel = getCourseAmountLabel(course)
  if (course.billingPolicy?.pricingMode === 'free' || course.billingMode === 'free') {
    return { key: 'free', label: '无需缴费', openAmount: 0, paidAmount: 0, unitLabel: '免费' }
  }

  if (!course.needsBillingReview && course.billingPolicy?.pricingMode === 'prepaid') {
    const upfront = expenses.find(
      (item) => item.courseId === course.id
        && (item.source === 'course_upfront' || item.billingMode === 'term'),
    )
    const balance = getPackageBalance(course, records)
    const amount = upfront ? billNetAmount(upfront, payments) : course.amount
    const paidAmount = upfront?.status === 'paid' ? amount : 0
    const openAmount = upfront?.status === 'paid' ? 0 : amount
    if (!upfront) {
      return { key: 'unbilled', label: `已付 ¥0 · 未付 ¥${amount.toLocaleString('zh-CN')}`, openAmount: amount, paidAmount: 0, unitLabel }
    }
    return {
      key: openAmount > 0 ? 'open' : 'settled',
      label: balance
        ? `${packageCaption(balance, upfront.status === 'paid')} · 已付 ¥${paidAmount.toLocaleString('zh-CN')} · 未付 ¥${openAmount.toLocaleString('zh-CN')}`
        : `已付 ¥${paidAmount.toLocaleString('zh-CN')} · 未付 ¥${openAmount.toLocaleString('zh-CN')}`,
      openAmount,
      paidAmount,
      unitLabel,
    }
  }

  const ledger = buildCourseBillLedger(course, expenses, exceptions, charges, payments)
  return {
    key: ledger.unpaid > 0 ? 'open' : ledger.paid > 0 ? 'settled' : 'unbilled',
    label: `已付 ¥${ledger.paid.toLocaleString('zh-CN')} · 未付 ¥${ledger.unpaid.toLocaleString('zh-CN')}`,
    openAmount: ledger.unpaid,
    paidAmount: ledger.paid,
    unitLabel,
  }
}
