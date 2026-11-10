import dayjs from 'dayjs'
import type { Course, CourseDateSlot, ScheduleException } from '@/domain/types'
import { WEEKDAY_SHORT } from '@/domain/constants'
import { occurrencesInRange } from '@/services/schedule'

function sortedSlots(slots: CourseDateSlot[]) {
  return [...slots].sort((a, b) => a.date.localeCompare(b.date))
}

export function stampCourseDates(course: Course, slots: CourseDateSlot[]) {
  const dates = sortedSlots(slots)
  course.recurrence.freq = 'dates'
  course.recurrence.dates = dates
  course.recurrence.byWeekday = []
  if (dates.length) {
    course.recurrence.startDate = dates[0].date
    course.recurrence.endDate = dates[dates.length - 1].date
    course.recurrence.startTime = dates[0].startTime
    course.recurrence.endTime = dates[0].endTime
  }
}

export function expandCourseToDates(course: Course, exceptions: ScheduleException[] = []): CourseDateSlot[] {
  if (course.recurrence.freq === 'dates') {
    return sortedSlots((course.recurrence.dates ?? []).map((slot) => ({ ...slot })))
  }
  const start = dayjs().startOf('month')
  const end = start.add(11, 'month').endOf('month')
  return occurrencesInRange(
    [{ ...course, recurrence: { ...course.recurrence } }],
    start.format('YYYY-MM-DD'),
    end.format('YYYY-MM-DD'),
    exceptions,
  ).map((item) => ({
    date: item.date,
    startTime: item.course.recurrence.startTime,
    endTime: item.course.recurrence.endTime,
  }))
}

export function effectiveCourseSlots(course: Course, exceptions: ScheduleException[] = []): CourseDateSlot[] {
  const map = new Map(expandCourseToDates(course, []).map((slot) => [slot.date, { ...slot }]))
  for (const exception of exceptions.filter((item) => item.courseId === course.id)) {
    if (exception.status === 'cancelled') {
      map.delete(exception.date)
      continue
    }
    const current = map.get(exception.date)
    if (current || exception.status === 'added' || exception.status === 'rescheduled') {
      map.set(exception.date, {
        date: exception.date,
        startTime: exception.startTime ?? current?.startTime ?? course.recurrence.startTime,
        endTime: exception.endTime ?? current?.endTime ?? course.recurrence.endTime,
      })
    }
  }
  return sortedSlots([...map.values()])
}

export function applyExceptionToCourse(course: Course, exception: ScheduleException) {
  const slots = expandCourseToDates(course)
  const index = slots.findIndex((slot) => slot.date === exception.date)
  if (exception.status === 'cancelled') {
    if (index >= 0) slots.splice(index, 1)
  } else {
    const next: CourseDateSlot = {
      date: exception.date,
      startTime: exception.startTime ?? slots[index]?.startTime ?? course.recurrence.startTime,
      endTime: exception.endTime ?? slots[index]?.endTime ?? course.recurrence.endTime,
    }
    if (index >= 0) slots[index] = next
    else slots.push(next)
  }
  stampCourseDates(course, slots)
}

export function restoreCourseSlot(course: Course, slot: CourseDateSlot) {
  const slots = expandCourseToDates(course)
  const index = slots.findIndex((item) => item.date === slot.date)
  if (index >= 0) slots[index] = { ...slot }
  else slots.push({ ...slot })
  stampCourseDates(course, slots)
}

export function removeCourseSlot(course: Course, date: string) {
  const slots = expandCourseToDates(course).filter((slot) => slot.date !== date)
  stampCourseDates(course, slots)
}

export function reconcileCoursesWithExceptions(courses: Course[], exceptions: ScheduleException[]) {
  let changed = false
  for (const course of courses) {
    const related = exceptions.filter((item) => item.courseId === course.id)
    if (!related.length && course.recurrence.freq === 'dates') continue
    if (!related.length) continue
    const before = JSON.stringify(course.recurrence.dates ?? [])
    const slots = effectiveCourseSlots(course, related)
    stampCourseDates(course, slots)
    if (JSON.stringify(course.recurrence.dates ?? []) !== before) changed = true
  }
  return changed
}

export function courseScheduleSummary(course: Course, exceptions: ScheduleException[] = []) {
  const dates = effectiveCourseSlots(course, exceptions)
  if (!dates.length) {
    if (course.recurrence.freq !== 'dates' && course.recurrence.byWeekday?.length) {
      return `周${course.recurrence.byWeekday.map((day) => WEEKDAY_SHORT[day]).join(' / ')} ${course.recurrence.startTime}-${course.recurrence.endTime}`
    }
    return '暂未安排上课日期'
  }
  return `已安排 ${dates.length} 次 · ${dayjs(dates[0].date).format('M月D日')}起`
}

export function courseScheduleProgress(
  course: Course,
  throughDate: string,
  exceptions: ScheduleException[] = [],
) {
  const slots = effectiveCourseSlots(course, exceptions)
  const completed = slots.filter((slot) => !dayjs(slot.date).isAfter(throughDate, 'day')).length
  const total = slots.length
  return {
    completed,
    total,
    percent: total ? Math.min(100, Math.round((completed / total) * 100)) : 0,
  }
}
