import dayjs from 'dayjs'
import type { Charge, Course, Expense, OccurrenceRecord, Payment, ScheduleException } from '@/domain/types'
import { billsInDueRange, summarizeBills } from '@/services/billing'
import { durationMinutes, occurrenceIdFor, sumUnbilledCharges } from '@/services/charges'
import { forecastAmountInRange } from '@/services/forecast'
import { getPackageBalance, packageCaption } from '@/services/packages'
import { occurrencesInRange } from '@/services/schedule'

export type StatisticsGranularity = 'year' | 'month'

export interface CourseStatistic {
  course: Course
  scheduledCount: number
  completedCount: number
  scheduledMinutes: number
  completedMinutes: number
  completion: number
  expense: number
  totalFee: number
  paidFee: number
  unpaidFee: number
  forecast: number
  packageLabel?: string
  consumedValue?: number
}

export interface TrendPoint {
  key: string
  label: string
  courseHours: number
  expense: number
}

export interface LearningStatistics {
  totalExpense: number
  paidExpense: number
  openExpense: number
  pendingExpense: number
  unpaidExpense: number
  accruedExpense: number
  forecastExpense: number
  scheduledCount: number
  completedCount: number
  scheduledMinutes: number
  courseStats: CourseStatistic[]
  trend: TrendPoint[]
  temporaryExpense: number
  unassignedExpense: number
  periodTotal: number
  periodPaid: number
  periodUnpaid: number
}

function expensesInRange(expenses: Expense[], startDate: string, endDate: string) {
  const startPeriod = startDate.slice(0, 7)
  const endPeriod = endDate.slice(0, 7)
  return expenses.filter((item) => item.period >= startPeriod && item.period <= endPeriod)
}

function createTrend(anchor: dayjs.Dayjs, granularity: StatisticsGranularity): TrendPoint[] {
  if (granularity === 'year') {
    return Array.from({ length: 12 }, (_, index) => ({
      key: `${anchor.year()}-${String(index + 1).padStart(2, '0')}`,
      label: `${index + 1}月`,
      courseHours: 0,
      expense: 0,
    }))
  }

  return Array.from({ length: anchor.daysInMonth() }, (_, index) => ({
    key: anchor.date(index + 1).format('YYYY-MM-DD'),
    label: String(index + 1),
    courseHours: 0,
    expense: 0,
  }))
}

export function calculateLearningStatistics(
  courses: Course[],
  expenses: Expense[],
  exceptions: ScheduleException[],
  anchor: dayjs.Dayjs,
  granularity: StatisticsGranularity,
  charges: Charge[] = [],
  occurrenceRecords: OccurrenceRecord[] = [],
  payments: Payment[] = [],
): LearningStatistics {
  const start = (granularity === 'year' ? anchor.startOf('year') : anchor.startOf('month')).format('YYYY-MM-DD')
  const end = (granularity === 'year' ? anchor.endOf('year') : anchor.endOf('month')).format('YYYY-MM-DD')
  const today = dayjs().format('YYYY-MM-DD')
  const occurrences = occurrencesInRange(courses, start, end, exceptions)
  const scopedExpenses = expensesInRange(expenses, start, end)
  const periodBills = billsInDueRange(expenses, start, end)
  const periodMoney = summarizeBills(periodBills, payments)
  const scopedPayments = payments.filter((item) => item.paidAt >= start && item.paidAt <= end)
  const openExpenses = scopedExpenses.filter((item) => item.status !== 'paid' && item.status !== 'void')
  const trend = createTrend(anchor, granularity)
  const trendMap = new Map(trend.map((item) => [item.key, item]))
  const occurrenceMap = new Map<string, { count: number; completed: number; minutes: number; completedMinutes: number }>()

  for (const item of occurrences) {
    const record = occurrenceRecords.find((entry) => entry.id === occurrenceIdFor(item.course.id, item.date))
    const minutes = record?.actualMinutes && record.actualMinutes > 0
      ? record.actualMinutes
      : durationMinutes(item.course.recurrence.startTime, item.course.recurrence.endTime)
    const current = occurrenceMap.get(item.course.id) ?? {
      count: 0,
      completed: 0,
      minutes: 0,
      completedMinutes: 0,
    }
    current.count += 1
    current.minutes += minutes
    if (item.date <= today) {
      current.completed += 1
      current.completedMinutes += minutes
    }
    occurrenceMap.set(item.course.id, current)

    const trendKey = granularity === 'year' ? item.date.slice(0, 7) : item.date
    const point = trendMap.get(trendKey)
    if (point) point.courseHours += minutes / 60
  }

  const expenseByCourse = new Map<string, number>()
  let temporaryExpense = 0
  let unassignedExpense = 0
  for (const payment of scopedPayments) {
    const expense = expenses.find((item) => item.id === payment.expenseId)
    if (!expense) continue
    const signedAmount = payment.kind === 'refund' ? -payment.amount : payment.amount
    if (expense.category === 'temporary') {
      temporaryExpense += signedAmount
    } else if (expense.courseId && courses.some((course) => course.id === expense.courseId)) {
      expenseByCourse.set(expense.courseId, (expenseByCourse.get(expense.courseId) ?? 0) + signedAmount)
    } else {
      unassignedExpense += signedAmount
    }

    const trendKey = granularity === 'year'
      ? payment.paidAt.slice(0, 7)
      : payment.paidAt
    const point = trendMap.get(trendKey)
    if (point) point.expense += signedAmount
  }

  const courseStats = courses
    .filter((course) => course.source !== 'temporary')
    .map((course) => {
    const schedule = occurrenceMap.get(course.id) ?? {
      count: 0,
      completed: 0,
      minutes: 0,
      completedMinutes: 0,
    }
    const balance = getPackageBalance(course, occurrenceRecords)
    const consumedValue = balance && course.amount
      ? Math.round((course.amount * balance.consumed / balance.total) * 100) / 100
      : 0
    const courseBills = periodBills.filter((item) => item.courseId === course.id)
    const courseMoney = summarizeBills(courseBills, payments)
    return {
      course,
      scheduledCount: schedule.count,
      completedCount: schedule.completed,
      scheduledMinutes: schedule.minutes,
      completedMinutes: schedule.completedMinutes,
      completion: schedule.count ? Math.round((schedule.completed / schedule.count) * 100) : 0,
      expense: expenseByCourse.get(course.id) ?? 0,
      totalFee: courseMoney.total,
      paidFee: courseMoney.paid,
      unpaidFee: courseMoney.unpaid,
      forecast: forecastAmountInRange([course], exceptions, occurrenceRecords, expenses, start, end, today),
      packageLabel: balance
        ? `${packageCaption(balance)} · 已消耗价值 ¥${consumedValue.toLocaleString('zh-CN')}`
        : undefined,
      consumedValue,
    }
  }).sort((a, b) => b.scheduledMinutes - a.scheduledMinutes || b.expense - a.expense)

  return {
    totalExpense: scopedPayments.reduce(
      (sum, item) => sum + (item.kind === 'refund' ? -item.amount : item.amount),
      0,
    ),
    paidExpense: scopedPayments.reduce(
      (sum, item) => sum + (item.kind === 'refund' ? -item.amount : item.amount),
      0,
    ),
    openExpense: openExpenses.reduce((sum, item) => sum + item.amount, 0),
    pendingExpense: openExpenses
      .filter((item) => item.status === 'pending')
      .reduce((sum, item) => sum + item.amount, 0),
    unpaidExpense: openExpenses
      .filter((item) => item.status === 'unpaid')
      .reduce((sum, item) => sum + item.amount, 0),
    accruedExpense: sumUnbilledCharges(charges, (item) => {
      const record = occurrenceRecords.find((entry) => entry.id === item.occurrenceId)
      const date = record?.date ?? item.occurrenceId.slice(item.occurrenceId.lastIndexOf('_') + 1)
      return date >= start && date <= end
    }),
    forecastExpense: forecastAmountInRange(courses, exceptions, occurrenceRecords, expenses, start, end, today),
    scheduledCount: occurrences.length,
    completedCount: occurrences.filter((item) => item.date <= today).length,
    scheduledMinutes: occurrences.reduce((sum, item) => {
      const record = occurrenceRecords.find((entry) => entry.id === occurrenceIdFor(item.course.id, item.date))
      return sum + (record?.actualMinutes && record.actualMinutes > 0
        ? record.actualMinutes
        : durationMinutes(item.course.recurrence.startTime, item.course.recurrence.endTime))
    }, 0),
    courseStats,
    trend: trend.map((item) => ({
      ...item,
      courseHours: Number(item.courseHours.toFixed(1)),
    })),
    temporaryExpense,
    unassignedExpense,
    periodTotal: periodMoney.total,
    periodPaid: periodMoney.paid,
    periodUnpaid: periodMoney.unpaid,
  }
}
