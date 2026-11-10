import type { Course, OccurrenceRecord, PackageUnit } from '@/domain/types'
import { minutesBetween } from '@/services/schedule'

function durationMinutes(startTime: string, endTime: string) {
  let minutes = minutesBetween(startTime, endTime)
  if (minutes < 0) minutes += 24 * 60
  return Math.max(0, minutes)
}

function roundMoney(amount: number) {
  return Math.round((Number(amount) || 0) * 100) / 100
}

export interface PackageBalance {
  courseId: string
  unit: PackageUnit
  total: number
  consumed: number
  remaining: number
}

export function hasCoursePackage(course: Course) {
  const units = Number(course.billingPolicy?.packageUnits) || 0
  return course.billingPolicy?.pricingMode === 'prepaid' && units > 0
}

export function packageUnitOf(course: Course): PackageUnit {
  return course.billingPolicy?.packageUnit === 'minute' ? 'minute' : 'session'
}

function scheduledMinutesOf(course: Course, date: string) {
  const slot = course.recurrence.dates?.find((item) => item.date === date)
  return durationMinutes(
    slot?.startTime ?? course.recurrence.startTime,
    slot?.endTime ?? course.recurrence.endTime,
  )
}

export function consumedPackageUnits(course: Course, records: OccurrenceRecord[]) {
  if (!hasCoursePackage(course)) return 0
  const unit = packageUnitOf(course)
  return records
    .filter((record) => record.courseId === course.id && record.status === 'completed' && record.billable)
    .reduce((sum, record) => {
      if (unit === 'minute') {
        const minutes = record.actualMinutes && record.actualMinutes > 0
          ? record.actualMinutes
          : scheduledMinutesOf(course, record.date)
        return sum + minutes
      }
      return sum + 1
    }, 0)
}

export function getPackageBalance(course: Course, records: OccurrenceRecord[]): PackageBalance | null {
  if (!hasCoursePackage(course)) return null
  const total = Number(course.billingPolicy?.packageUnits) || 0
  const consumed = consumedPackageUnits(course, records)
  return {
    courseId: course.id,
    unit: packageUnitOf(course),
    total,
    consumed,
    remaining: Math.max(0, total - consumed),
  }
}

export function packageUnitLabel(unit: PackageUnit) {
  return unit === 'minute' ? '分钟' : '次'
}

export function packageCaption(balance: PackageBalance, paid = true) {
  const unitLabel = packageUnitLabel(balance.unit)
  const paidLabel = paid ? '已支付' : '待支付'
  if (balance.remaining <= 0) {
    return `课包${paidLabel} · 已用完 ${balance.total}${unitLabel}`
  }
  return `课包${paidLabel} · 剩余 ${balance.remaining}/${balance.total} ${unitLabel}`
}

export function consumedPackageValue(course: Course, records: OccurrenceRecord[]) {
  const balance = getPackageBalance(course, records)
  if (!balance || !course.amount || !balance.total) return 0
  return roundMoney((course.amount * balance.consumed) / balance.total)
}

export function remainingPackageValue(course: Course, records: OccurrenceRecord[]) {
  const balance = getPackageBalance(course, records)
  if (!balance || !course.amount || !balance.total) return 0
  return roundMoney((course.amount * balance.remaining) / balance.total)
}
