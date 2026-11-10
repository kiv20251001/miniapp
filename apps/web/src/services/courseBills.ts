import dayjs from 'dayjs'
import type { Charge, Course, Expense, Payment, ScheduleException } from '@/domain/types'
import { billNetAmount } from '@/services/billing'
import { WEEKDAY_SHORT } from '@/domain/constants'
import { effectiveCourseSlots } from '@/services/courseSchedule'
import { expectedUsageCharge, isUsagePriced, occurrenceIdFor, roundMoney } from '@/services/charges'

export type CourseBillRowKind = 'session' | 'prepaid' | 'period' | 'free'
export type CourseBillPayState = 'paid' | 'unpaid' | 'free'

export interface CourseBillDayRow {
  key: string
  date: string
  weekdayLabel: string
  startTime?: string
  endTime?: string
  amount: number
  amountLabel: string
  payState: CourseBillPayState
  payLabel: string
  expenseId?: string
  kind: CourseBillRowKind
}

export interface CourseBillLedger {
  total: number
  paid: number
  unpaid: number
  days: CourseBillDayRow[]
}

function payFromExpense(status: Expense['status']): { payState: CourseBillPayState; payLabel: string } {
  if (status === 'paid') return { payState: 'paid', payLabel: '已支付' }
  return { payState: 'unpaid', payLabel: '未支付' }
}

function moneyLabel(amount: number) {
  return `¥${roundMoney(amount).toLocaleString('zh-CN')}`
}

function weekdayLabel(date: string) {
  return `周${WEEKDAY_SHORT[dayjs(date).day()]}`
}

function courseExpenses(courseId: string, expenses: Expense[]) {
  return expenses.filter((item) => item.courseId === courseId && item.status !== 'void')
}

function findUpfront(course: Course, expenses: Expense[]) {
  return expenses.find(
    (item) => item.courseId === course.id
      && item.status !== 'void'
      && (item.source === 'course_upfront' || item.billingMode === 'term'),
  )
}

/** 一门课按上课日展开的费用明细。页面只区分已支付 / 未支付。 */
export function buildCourseBillLedger(
  course: Course,
  expenses: Expense[],
  exceptions: ScheduleException[],
  charges: Charge[] = [],
  payments: Payment[] = [],
): CourseBillLedger {
  const bills = courseExpenses(course.id, expenses)

  const isPrepaid = course.billingPolicy?.pricingMode === 'prepaid' || course.billingMode === 'term'
  const isFree = course.billingPolicy?.pricingMode === 'free' || course.billingMode === 'free'
  const upfront = isPrepaid ? findUpfront(course, expenses) : undefined
  const usedExpenseIds = new Set<string>()
  if (upfront) usedExpenseIds.add(upfront.id)

  const days: CourseBillDayRow[] = []

  for (const slot of effectiveCourseSlots(course, exceptions)) {
    const base = {
      key: `slot-${slot.date}`,
      date: slot.date,
      weekdayLabel: weekdayLabel(slot.date),
      startTime: slot.startTime,
      endTime: slot.endTime,
    }

    if (isFree) {
      days.push({
        ...base,
        amount: 0,
        amountLabel: '无需缴费',
        payState: 'free',
        payLabel: '无需缴费',
        kind: 'free',
      })
      continue
    }

    if (isPrepaid) {
      days.push({
        ...base,
        amount: upfront ? billNetAmount(upfront, payments) : course.amount,
        amountLabel: '已含总价',
        ...payFromExpense(upfront?.status ?? 'unpaid'),
        expenseId: upfront?.id,
        kind: 'prepaid',
      })
      continue
    }

    const expense = bills.find((item) => item.dueDate === slot.date)
    if (expense) usedExpenseIds.add(expense.id)
    if (expense) {
      days.push({
        ...base,
        amount: billNetAmount(expense, payments),
        amountLabel: moneyLabel(billNetAmount(expense, payments)),
        ...payFromExpense(expense.status),
        expenseId: expense.id,
        kind: 'session',
      })
      continue
    }

    const charge = (charges ?? []).find(
      (item) => item.occurrenceId === occurrenceIdFor(course.id, slot.date)
        && item.status !== 'reversed'
        && item.status !== 'waived',
    )
    const expected = charge
      ? charge.amount
      : isUsagePriced(course)
        ? expectedUsageCharge(course, slot.startTime, slot.endTime).amount
        : roundMoney(course.amount)
    days.push({
      ...base,
      amount: expected,
      amountLabel: expected ? moneyLabel(expected) : '—',
      payState: 'unpaid',
      payLabel: '未支付',
      expenseId: charge?.billedExpenseId,
      kind: 'session',
    })
  }

  for (const bill of bills) {
    if (usedExpenseIds.has(bill.id)) continue
    days.push({
      key: `bill-${bill.id}`,
      date: bill.dueDate,
      weekdayLabel: weekdayLabel(bill.dueDate),
      amount: billNetAmount(bill, payments),
      amountLabel: moneyLabel(billNetAmount(bill, payments)),
      ...payFromExpense(bill.status),
      expenseId: bill.id,
      kind: bill.source === 'course_upfront' || bill.billingMode === 'term' ? 'prepaid' : 'period',
    })
  }

  days.sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key))

  let total = 0
  let paid = 0
  let unpaid = 0
  if (isPrepaid) {
    total = roundMoney(upfront ? billNetAmount(upfront, payments) : course.amount)
    paid = upfront?.status === 'paid' ? total : 0
    unpaid = roundMoney(total - paid)
  } else {
    for (const row of days) {
      if (row.payState === 'free') continue
      total = roundMoney(total + row.amount)
      if (row.payState === 'paid') paid = roundMoney(paid + row.amount)
      else unpaid = roundMoney(unpaid + row.amount)
    }
  }

  return { total, paid, unpaid, days }
}
