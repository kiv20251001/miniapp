import dayjs from 'dayjs'
import type { Expense, ExpenseCategory, ExpenseStatus, Payment } from './types'

export function signedPaymentAmount(payment: Payment) {
  return payment.kind === 'refund' ? -payment.amount : payment.amount
}

/** 已支付账单按支付/退款净额；未支付仍用账单金额。 */
export function billNetAmount(expense: Expense, payments: Payment[] = []) {
  if (expense.status === 'void') return 0
  const related = payments.filter((item) => item.expenseId === expense.id)
  if (!related.length) return expense.amount
  return Math.round(related.reduce((sum, item) => sum + signedPaymentAmount(item), 0) * 100) / 100
}

export function refundedAmountOf(expenseId: string, payments: Payment[] = []) {
  return Math.round(
    payments
      .filter((item) => item.expenseId === expenseId && item.kind === 'refund')
      .reduce((sum, item) => sum + item.amount, 0) * 100,
  ) / 100
}

export function money(n: number) {
  const amount = Math.round((Number(n) || 0) * 100) / 100
  const digits = Number.isInteger(amount) ? 0 : 2
  return `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: 2 })}`
}

export function filterByPeriod(expenses: Expense[], period: string) {
  return expenses.filter((item) => item.period === period)
}

export function filterByYear(expenses: Expense[], year: number) {
  return expenses.filter((item) => item.period.startsWith(`${year}-`))
}

export function sumByStatus(expenses: Expense[], status: ExpenseStatus) {
  return expenses.filter((item) => item.status === status).reduce((s, i) => s + i.amount, 0)
}

export function billsInDueRange(expenses: Expense[], start: string, end: string) {
  return expenses.filter((item) => item.status !== 'void' && item.dueDate >= start && item.dueDate <= end)
}

export function summarizeBills(expenses: Expense[], payments: Payment[] = []) {
  const total = expenses.reduce((sum, item) => sum + billNetAmount(item, payments), 0)
  const paid = expenses.filter((item) => item.status === 'paid').reduce((sum, item) => sum + billNetAmount(item, payments), 0)
  return {
    total: Math.round(total * 100) / 100,
    paid: Math.round(paid * 100) / 100,
    unpaid: Math.round((total - paid) * 100) / 100,
  }
}

export function groupByCategory(expenses: Expense[], payments: Payment[] = []) {
  const map = new Map<ExpenseCategory, number>()
  for (const item of expenses) {
    map.set(item.category, (map.get(item.category) ?? 0) + billNetAmount(item, payments))
  }
  return [...map.entries()].map(([category, amount]) => ({ category, amount }))
}

export function groupByMonth(expenses: Expense[], year: number) {
  const buckets = Array.from({ length: 12 }, (_, i) => ({
    month: `${year}-${String(i + 1).padStart(2, '0')}`,
    amount: 0,
    paid: 0,
    open: 0,
  }))
  for (const item of expenses) {
    if (!item.period.startsWith(`${year}-`)) continue
    const idx = Number(item.period.slice(5, 7)) - 1
    if (idx < 0 || idx > 11) continue
    buckets[idx].amount += item.amount
    if (item.status === 'paid') buckets[idx].paid += item.amount
    else buckets[idx].open += item.amount
  }
  return buckets
}

export function currentPeriod() {
  return dayjs().format('YYYY-MM')
}
