import dayjs from 'dayjs'
import type { Charge, Course, Expense, OccurrenceRecord, ScheduleException } from './types'
import { effectiveCourseSlots } from './courseSchedule'
import { sumUnbilledCharges } from './charges'
import { getPackageBalance, packageCaption, packageUnitLabel } from './packages'

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
  period: string,
  charges: Charge[] = [],
  records: OccurrenceRecord[] = [],
): CourseBillingSummary {
  if (course.billingPolicy?.pricingMode === 'free' || course.billingMode === 'free') {
    return { key: 'free', label: '无需缴费', openAmount: 0 }
  }

  const unbilledAmount = sumUnbilledCharges(charges, (item) => item.courseId === course.id)

  if (!course.needsBillingReview && course.billingPolicy?.pricingMode === 'prepaid') {
    const upfront = expenses.find(
      (item) => item.courseId === course.id
        && (item.source === 'course_upfront' || item.billingMode === 'term'),
    )
    const balance = getPackageBalance(course, records)
    if (!upfront) return { key: 'unbilled', label: '待记录支付状态', openAmount: 0 }
    if (upfront.status === 'paid') {
      return {
        key: 'settled',
        label: balance ? packageCaption(balance, true) : '课程费已支付',
        openAmount: 0,
      }
    }
    if (upfront.status === 'pending') return { key: 'pending', label: '待出账', openAmount: 0 }
    return {
      key: 'open',
      label: balance
        ? packageCaption(balance, false)
        : `待支付 ¥${upfront.amount.toLocaleString('zh-CN')}`,
      openAmount: upfront.amount,
    }
  }

  const bills = expenses.filter((item) => item.courseId === course.id && item.period === period)
  const openAmount = bills
    .filter((item) => item.status === 'unpaid')
    .reduce((total, item) => total + item.amount, 0)

  if (bills.some((item) => item.status === 'unpaid')) {
    const accrued = unbilledAmount > 0
      ? ` · 另待结算 ¥${unbilledAmount.toLocaleString('zh-CN')}`
      : unbilledAmount < 0
        ? ` · 待冲减 ¥${Math.abs(unbilledAmount).toLocaleString('zh-CN')}`
        : ''
    return {
      key: 'open',
      label: `${openAmount ? `待支付 ¥${openAmount.toLocaleString('zh-CN')}` : '待支付'}${accrued}`,
      openAmount,
    }
  }
  if (bills.some((item) => item.status === 'pending')) {
    return { key: 'pending', label: '待出账', openAmount: 0 }
  }
  if (unbilledAmount > 0) {
    return { key: 'unbilled', label: `待结算 ¥${unbilledAmount.toLocaleString('zh-CN')}`, openAmount: unbilledAmount }
  }
  if (unbilledAmount < 0) {
    return { key: 'unbilled', label: `待冲减 ¥${Math.abs(unbilledAmount).toLocaleString('zh-CN')}`, openAmount: unbilledAmount }
  }
  if (!bills.length) {
    const cycle = course.needsBillingReview ? undefined : course.billingPolicy?.settlementCycle
    const label = cycle === 'weekly'
      ? '本周待结算'
      : cycle === 'monthly'
        ? '本月待结算'
        : cycle === 'manual'
          ? '待手动结算'
          : '本期待出账'
    return { key: 'unbilled', label, openAmount: 0 }
  }
  if (bills.every((item) => item.status === 'void')) {
    return { key: 'settled', label: '本期无应付', openAmount: 0 }
  }
  return { key: 'settled', label: '本期已结清', openAmount: 0 }
}
