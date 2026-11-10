import dayjs from 'dayjs'
import type { Course, Expense, OccurrenceRecord, ScheduleException } from '@/domain/types'
import {
  expectedUsageCharge,
  mondayOf,
  resolveOccurrenceAttendance,
  roundMoney,
} from '@/services/charges'
import { occurrencesInRange } from '@/services/schedule'

function courseActiveInRange(course: Course, start: string, end: string) {
  if (course.recurrence.startDate > end) return false
  if (course.recurrence.endDate && course.recurrence.endDate < start) return false
  return true
}

function hasFixedPeriodBill(course: Course, expenses: Expense[], cycle: 'weekly' | 'monthly', value: string) {
  const statementKey = `${course.id}:fixed:${cycle}:${value}`
  return expenses.some((expense) => {
    if (expense.statementKey === statementKey) return true
    if (cycle !== 'monthly') return false
    return expense.courseId === course.id
      && expense.period === value
      && expense.source !== 'course_usage'
      && expense.billingMode !== 'session'
      && expense.status !== 'void'
  })
}

function forecastFixedPeriod(
  course: Course,
  expenses: Expense[],
  start: string,
  end: string,
  today: string,
) {
  if (course.needsBillingReview || course.billingPolicy?.pricingMode !== 'fixed_period') return 0
  const amount = Number(course.amount) || 0
  if (amount <= 0) return 0
  const cycle = course.billingPolicy.settlementCycle
  if (cycle !== 'weekly' && cycle !== 'monthly') return 0

  if (cycle === 'monthly') {
    let cursor = dayjs(today).add(1, 'month').startOf('month')
    const rangeStart = dayjs(start).startOf('month')
    const rangeEnd = dayjs(end).endOf('month')
    if (cursor.isBefore(rangeStart, 'month')) cursor = rangeStart
    let sum = 0
    while (!cursor.isAfter(rangeEnd, 'month')) {
      const period = cursor.format('YYYY-MM')
      const monthStart = cursor.format('YYYY-MM-DD')
      const monthEnd = cursor.endOf('month').format('YYYY-MM-DD')
      if (courseActiveInRange(course, monthStart, monthEnd) && !hasFixedPeriodBill(course, expenses, 'monthly', period)) {
        sum += amount
      }
      cursor = cursor.add(1, 'month')
    }
    return roundMoney(sum)
  }

  const thisMonday = mondayOf(today)
  let cursor = dayjs(thisMonday).add(7, 'day')
  const rangeStart = dayjs(start)
  const rangeEnd = dayjs(end)
  while (cursor.add(6, 'day').isBefore(rangeStart, 'day')) cursor = cursor.add(7, 'day')
  let sum = 0
  while (!cursor.isAfter(rangeEnd, 'day')) {
    const weekStart = cursor.format('YYYY-MM-DD')
    const weekEnd = cursor.add(6, 'day').format('YYYY-MM-DD')
    if (courseActiveInRange(course, weekStart, weekEnd) && !hasFixedPeriodBill(course, expenses, 'weekly', weekStart)) {
      sum += amount
    }
    cursor = cursor.add(7, 'day')
  }
  return roundMoney(sum)
}

/** 未来安排按当前计价规则推算，不计入实际支出或待支付。 */
export function forecastAmountInRange(
  courses: Course[],
  exceptions: ScheduleException[],
  records: OccurrenceRecord[],
  expenses: Expense[],
  start: string,
  end: string,
  today = dayjs().format('YYYY-MM-DD'),
) {
  const from = start > today ? start : dayjs(today).add(1, 'day').format('YYYY-MM-DD')
  if (from > end) {
    return courses.reduce(
      (sum, course) => sum + forecastFixedPeriod(course, expenses, start, end, today),
      0,
    )
  }

  let total = 0
  for (const item of occurrencesInRange(courses, from, end, exceptions)) {
    if (item.course.source === 'temporary' || item.course.needsBillingReview) continue
    const attendance = resolveOccurrenceAttendance(item, records)
    if (attendance !== 'scheduled') continue
    const mode = item.course.billingPolicy?.pricingMode
    if (mode !== 'per_session' && mode !== 'per_hour') continue
    total += expectedUsageCharge(
      item.course,
      item.course.recurrence.startTime,
      item.course.recurrence.endTime,
    ).amount
  }

  for (const course of courses) {
    if (course.source === 'temporary' || course.archived) continue
    total += forecastFixedPeriod(course, expenses, start, end, today)
  }

  return roundMoney(total)
}
