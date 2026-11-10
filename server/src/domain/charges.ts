import dayjs from 'dayjs'
import type {
  Charge,
  Course,
  DayOccurrence,
  Expense,
  OccurrenceAttendance,
  OccurrenceRecord,
  SettlementCycle,
} from './types'
import { getPackageBalance, packageCaption } from './packages'
import { minutesBetween } from './schedule'

export function occurrenceIdFor(courseId: string, originDate: string) {
  return `occ_${courseId}_${originDate}`
}

export function roundMoney(amount: number) {
  return Math.round((Number(amount) || 0) * 100) / 100
}

/** 今日/日历课卡上的金额与支付状态，不含解释文案。 */
export function courseCardFee(course: Course, expense?: Expense) {
  const mode = course.billingPolicy?.pricingMode
  if (mode === 'free' || course.billingMode === 'free') {
    return { label: '无需缴费', paid: undefined as boolean | undefined }
  }
  const amount = `¥${roundMoney(course.amount).toLocaleString('zh-CN')}`
  if (mode === 'prepaid' || course.billingMode === 'term') {
    return { label: amount, paid: expense?.status === 'paid' }
  }
  if (mode === 'per_hour') return { label: `${amount}/小时`, paid: expense?.status === 'paid' }
  return { label: `${amount}/次`, paid: expense?.status === 'paid' }
}

export function durationMinutes(startTime: string, endTime: string) {
  let minutes = minutesBetween(startTime, endTime)
  if (minutes < 0) minutes += 24 * 60
  return Math.max(0, minutes)
}

export function usageMinutes(startTime: string, endTime: string, actualMinutes?: number) {
  if (actualMinutes && actualMinutes > 0) return actualMinutes
  return durationMinutes(startTime, endTime)
}

export function inferOccurrenceAttendance(
  date: string,
  endTime: string,
  now = dayjs(),
): OccurrenceAttendance {
  const today = now.format('YYYY-MM-DD')
  if (date > today) return 'scheduled'
  if (date < today) return 'pending_confirmation'
  return endTime <= now.format('HH:mm') ? 'pending_confirmation' : 'scheduled'
}

export function resolveOccurrenceAttendance(
  item: Pick<DayOccurrence, 'date' | 'course' | 'exception'>,
  records: OccurrenceRecord[],
  now = dayjs(),
): OccurrenceAttendance {
  const record = records.find((entry) => entry.id === occurrenceIdFor(item.course.id, item.date))
  if (record) return record.status
  const endTime = item.exception?.endTime ?? item.course.recurrence.endTime
  return inferOccurrenceAttendance(item.date, endTime, now)
}

export function isUsagePriced(course: Course) {
  const mode = course.billingPolicy?.pricingMode
  return mode === 'per_session' || mode === 'per_hour'
}

export function computeUsageAmount(course: Course, minutes: number, estimated = false) {
  const amount = Number(course.amount) || 0
  const mode = course.billingPolicy?.pricingMode
  if (mode === 'per_session') {
    return { amount: roundMoney(amount), estimated: false, source: 'session' as const }
  }
  if (mode === 'per_hour') {
    return {
      amount: roundMoney((minutes * amount) / 60),
      estimated,
      source: 'hour' as const,
    }
  }
  return { amount: 0, estimated: false, source: 'session' as const }
}

export function expectedUsageCharge(course: Course, startTime: string, endTime: string, actualMinutes?: number) {
  const minutes = usageMinutes(startTime, endTime, actualMinutes)
  const computed = computeUsageAmount(course, minutes, actualMinutes == null)
  return {
    ...computed,
    minutes,
  }
}

export function sumUnbilledCharges(charges: Charge[], predicate?: (charge: Charge) => boolean) {
  return roundMoney(
    charges
      .filter((charge) => charge.status === 'unbilled' && (!predicate || predicate(charge)))
      .reduce((sum, charge) => sum + charge.amount, 0),
  )
}

export function occurrenceDateFromCharge(charge: Charge, records: OccurrenceRecord[]) {
  return records.find((record) => record.id === charge.occurrenceId)?.date
    ?? charge.occurrenceId.slice(charge.occurrenceId.lastIndexOf('_') + 1)
}

export function mondayOf(date: string) {
  const value = dayjs(date)
  return value.subtract((value.day() + 6) % 7, 'day').format('YYYY-MM-DD')
}

export function chargeStatementKey(
  charge: Charge,
  course: Course,
  records: OccurrenceRecord[],
): string {
  const date = occurrenceDateFromCharge(charge, records)
  const cycle = course.billingPolicy?.settlementCycle ?? 'manual'
  if (cycle === 'weekly') return `${course.id}:weekly:${mondayOf(date)}`
  if (cycle === 'monthly') return `${course.id}:monthly:${date.slice(0, 7)}`
  return `${course.id}:manual:${date.slice(0, 7)}`
}

export function statementLabel(cycle: SettlementCycle, statementKey: string) {
  const value = statementKey.slice(statementKey.lastIndexOf(':') + 1)
  if (cycle === 'weekly') {
    const start = dayjs(value)
    return `${start.format('M月D日')}–${start.add(6, 'day').format('M月D日')}`
  }
  return dayjs(`${value}-01`).format('YYYY年M月')
}

export function billingCaption(
  course: Course,
  attendance: OccurrenceAttendance,
  charge?: Charge,
  estimatedAmount?: number,
  records: OccurrenceRecord[] = [],
) {
  const mode = course.billingPolicy?.pricingMode
  if (mode === 'free' || course.billingMode === 'free') return '免费 · 只记录课次'
  if (course.needsBillingReview) return `参考 ¥${roundMoney(course.amount).toLocaleString('zh-CN')} · 待确认计费方式`
  if (mode === 'prepaid') {
    const balance = getPackageBalance(course, records)
    if (balance) return packageCaption(balance, true)
    return '课包已按总价记账 · 课次变化不改历史付款'
  }
  if (mode === 'fixed_period') {
    const unit = course.billingPolicy?.settlementCycle === 'weekly' ? '周' : '月'
    return `¥${roundMoney(course.amount).toLocaleString('zh-CN')}/${unit} · 周期固定费`
  }
  if (mode === 'per_hour') {
    if (attendance === 'completed' && charge?.status === 'unbilled') {
      const estimated = charge.estimated ? '（按时长估算）' : ''
      return `本次 ¥${roundMoney(charge.amount).toLocaleString('zh-CN')} 已计入待结算${estimated}`
    }
    if (attendance === 'completed' && charge?.status === 'billed') {
      return `本次 ¥${roundMoney(charge.amount).toLocaleString('zh-CN')} 已汇总到账单`
    }
    const amount = estimatedAmount ?? roundMoney(((Number(course.amount) || 0) * 60) / 60)
    return `¥${roundMoney(course.amount).toLocaleString('zh-CN')}/小时 · 本次预计 ¥${roundMoney(amount).toLocaleString('zh-CN')}`
  }
  if (attendance === 'completed' && charge?.status === 'unbilled') {
    return `本次 ¥${roundMoney(charge.amount).toLocaleString('zh-CN')} 已计入待结算`
  }
  if (attendance === 'completed' && charge?.status === 'billed') {
    return `本次 ¥${roundMoney(charge.amount).toLocaleString('zh-CN')} 已汇总到账单`
  }
  if (attendance === 'pending_confirmation' && isUsagePriced(course)) {
    return `¥${roundMoney(course.amount).toLocaleString('zh-CN')}/次 · 待确认后计入待结算`
  }
  return `¥${roundMoney(course.amount).toLocaleString('zh-CN')}/次 · 未上不计费`
}

export function cancelImpactCopy(course: Course, attendance: OccurrenceAttendance, unbilled?: Charge) {
  if (unbilled && unbilled.status === 'unbilled') {
    return `取消后将从待结算移除 ¥${roundMoney(unbilled.amount).toLocaleString('zh-CN')}，不会删除已支付账单。`
  }
  if (unbilled?.status === 'billed') {
    return `本次已出账 ¥${roundMoney(unbilled.amount).toLocaleString('zh-CN')}；取消会保留原账单并生成冲减，已支付时需另记退款。`
  }
  if (isUsagePriced(course) && (attendance === 'scheduled' || attendance === 'pending_confirmation')) {
    return '未确认上课，取消后不计费。'
  }
  if (course.billingPolicy?.pricingMode === 'prepaid') {
    if (course.billingPolicy.packageUnits && course.billingPolicy.packageUnit === 'minute') {
      return '取消课次不改变历史支出，只恢复剩余分钟。'
    }
    if (course.billingPolicy.packageUnits) {
      return '取消课次不改变历史支出，只恢复剩余课次。'
    }
    return '取消课次不改变历史支出，只影响剩余课次安排。'
  }
  return '取消后这一次不再出现在课表中，已支付账单会保留。'
}

export function findChargeForOccurrence(charges: Charge[], occurrenceId: string) {
  return charges.find((charge) => charge.occurrenceId === occurrenceId && charge.status !== 'reversed')
}

export function shouldAccrueUsage(course: Course, status: OccurrenceAttendance, billable: boolean) {
  if (course.source === 'temporary') return false
  return isUsagePriced(course) && status === 'completed' && billable
}

