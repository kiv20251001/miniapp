import dayjs from 'dayjs'
import type { Course, DayOccurrence, ScheduleException } from './types'

export function occurrencesInRange(
  courses: Course[],
  start: string,
  end: string,
  exceptions: ScheduleException[] = [],
): DayOccurrence[] {
  const startDay = dayjs(start).startOf('day')
  const endDay = dayjs(end).endOf('day')
  const list: DayOccurrence[] = []

  function addOccurrence(course: Course, date: string, startTime: string, endTime: string) {
    const exception = exceptions.find((item) => item.courseId === course.id && item.date === date)
    if (exception?.status === 'cancelled') return
    const effectiveCourse = {
      ...course,
      title: exception?.title ?? course.title,
      location: exception?.location ?? course.location,
      note: exception?.note ?? course.note,
      recurrence: {
        ...course.recurrence,
        startTime: exception?.startTime ?? startTime,
        endTime: exception?.endTime ?? endTime,
      },
    }
    list.push({
      id: `${course.id}_${date}`,
      occurrenceId: `occ_${course.id}_${date}`,
      date,
      course: effectiveCourse,
      exception,
    })
  }

  for (const course of courses) {
    if (course.archived) continue
    if (course.recurrence.freq === 'dates') {
      for (const slot of course.recurrence.dates ?? []) {
        const slotDate = dayjs(slot.date)
        if (slotDate.isBefore(startDay, 'day') || slotDate.isAfter(endDay, 'day')) continue
        addOccurrence(course, slot.date, slot.startTime, slot.endTime)
      }
      continue
    }
    const recStart = dayjs(course.recurrence.startDate)
    const recEnd = course.recurrence.endDate ? dayjs(course.recurrence.endDate) : null
    let cursor = startDay.isAfter(recStart) ? startDay : recStart

    while (!cursor.isAfter(endDay)) {
      const inWindow = !recEnd || !cursor.isAfter(recEnd)
      const weekdayMatch =
        course.recurrence.freq === 'once'
          ? cursor.isSame(recStart, 'day')
          : course.recurrence.byWeekday.includes(cursor.day())

      if (inWindow && weekdayMatch) {
        const date = cursor.format('YYYY-MM-DD')
        addOccurrence(
          course,
          date,
          course.recurrence.startTime,
          course.recurrence.endTime,
        )
      }
      cursor = cursor.add(1, 'day')
    }
  }

  for (const exception of exceptions) {
    if (exception.status !== 'added') continue
    const date = dayjs(exception.date)
    if (date.isBefore(startDay, 'day') || date.isAfter(endDay, 'day')) continue
    if (list.some((item) => item.id === `${exception.courseId}_${exception.date}`)) continue
    const course = courses.find((item) => item.id === exception.courseId)
    if (!course || course.archived) continue
    list.push({
      id: `${course.id}_${exception.date}`,
      occurrenceId: `occ_${course.id}_${exception.date}`,
      date: exception.date,
      exception,
      course: {
        ...course,
        title: exception.title ?? course.title,
        location: exception.location ?? course.location,
        note: exception.note ?? course.note,
        recurrence: {
          ...course.recurrence,
          startTime: exception.startTime ?? course.recurrence.startTime,
          endTime: exception.endTime ?? course.recurrence.endTime,
        },
      },
    })
  }

  return list.sort((a, b) => {
    const t = a.course.recurrence.startTime.localeCompare(b.course.recurrence.startTime)
    if (t !== 0) return t
    return a.course.title.localeCompare(b.course.title, 'zh-CN')
  })
}

export function occurrencesOnDate(
  courses: Course[],
  date: string,
  exceptions: ScheduleException[] = [],
) {
  return occurrencesInRange(courses, date, date, exceptions)
}

export interface BusyInterval {
  start: string
  end: string
  title: string
}

export interface TimeSlotOption {
  value: string
  label: string
  disabled: boolean
  caption?: string
}

export const TIME_SLOT_STEP_MINUTES = 15
const TIME_SLOT_FIRST = '06:00'
const TIME_SLOT_LAST = '22:45'

function toMinutes(time: string) {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

function toTime(minutes: number) {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/** 某一天已经被占用的时间段，用于排课时避免重叠。 */
export function busyIntervalsOnDate(
  courses: Course[],
  date: string,
  exceptions: ScheduleException[] = [],
): BusyInterval[] {
  return occurrencesOnDate(courses, date, exceptions)
    .map((item) => ({
      start: item.course.recurrence.startTime,
      end: item.course.recurrence.endTime,
      title: item.course.title,
    }))
    .sort((a, b) => a.start.localeCompare(b.start))
}

/** 多日占用合并：同一孩子在任一选中日期冲突的时段都会置灰。 */
export function busyIntervalsForDates(
  courses: Course[],
  dates: string[],
  exceptions: ScheduleException[] = [],
  exceptCourseId?: string,
  childIds?: string[],
): BusyInterval[] {
  const scoped = childIds?.length ? coursesForParticipants(courses, childIds) : courses
  const uniqueDates = [...new Set(dates.filter(Boolean))]
  const seen = new Set<string>()
  const intervals: BusyInterval[] = []
  for (const date of uniqueDates) {
    for (const item of occurrencesOnDate(scoped, date, exceptions)) {
      if (item.course.id === exceptCourseId) continue
      const interval = {
        start: item.course.recurrence.startTime,
        end: item.course.recurrence.endTime,
        title: item.course.title,
      }
      const key = `${interval.start}-${interval.end}-${interval.title}`
      if (seen.has(key)) continue
      seen.add(key)
      intervals.push(interval)
    }
  }
  return intervals.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end))
}

/** 把当前已填时间补进候选，避免自定义时间点从选择器里消失。 */
export function ensureTimeOption(options: TimeSlotOption[], value: string): TimeSlotOption[] {
  if (!value || options.some((option) => option.value === value)) return options
  return [...options, { value, label: value, disabled: false }]
    .sort((a, b) => a.value.localeCompare(b.value))
}

/** 返回与 [start, end) 重叠的第一个已有安排。 */
export function findBusyConflict(intervals: BusyInterval[], start: string, end: string) {
  if (!start || !end || end <= start) return undefined
  return intervals.find((item) => start < item.end && end > item.start)
}

export interface ScheduleSlot {
  date: string
  startTime: string
  endTime: string
}

export interface ScheduleConflict extends ScheduleSlot {
  title: string
}

/** 一组待写入的课次是否与已有安排重叠。创建/加课时统一走这里。 */
export function courseParticipantIds(course: Pick<Course, 'childId' | 'childIds'>) {
  return course.childIds?.length ? course.childIds : [course.childId]
}

/** 只保留与指定孩子有交集的课程。不同孩子可以同一时间上课。 */
export function coursesForParticipants(courses: Course[], childIds: string[]) {
  const ids = new Set(childIds.filter(Boolean))
  if (!ids.size) return []
  return courses.filter((course) => courseParticipantIds(course).some((id) => ids.has(id)))
}

/** 一组待写入的课次是否与已有安排重叠。只比同一孩子的课，不比全家日历。 */
export function findScheduleConflicts(
  slots: ScheduleSlot[],
  courses: Course[],
  exceptions: ScheduleException[] = [],
  exceptCourseId?: string,
  childIds?: string[],
): ScheduleConflict[] {
  const scoped = childIds?.length ? coursesForParticipants(courses, childIds) : courses
  const conflicts: ScheduleConflict[] = []
  for (const slot of slots) {
    if (!slot.date || !slot.startTime || !slot.endTime || slot.endTime <= slot.startTime) continue
    const intervals = occurrencesOnDate(scoped, slot.date, exceptions)
      .filter((item) => item.course.id !== exceptCourseId)
      .map((item) => ({
        start: item.course.recurrence.startTime,
        end: item.course.recurrence.endTime,
        title: item.course.title,
      }))
    const conflict = findBusyConflict(intervals, slot.startTime, slot.endTime)
    if (conflict) {
      conflicts.push({
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        title: conflict.title,
      })
    }
  }
  return conflicts
}

export function scheduleConflictMessage(conflict: ScheduleConflict) {
  return `${dayjs(conflict.date).format('M月D日')} ${conflict.startTime}–${conflict.endTime} 与「${conflict.title}」时间冲突`
}

export function timeSlots(step = TIME_SLOT_STEP_MINUTES) {
  const first = toMinutes(TIME_SLOT_FIRST)
  const last = toMinutes(TIME_SLOT_LAST)
  const list: string[] = []
  for (let minutes = first; minutes <= last; minutes += step) list.push(toTime(minutes))
  return list
}

/** 开始时间候选：落在已有安排内的时间点不可选。 */
export function startTimeOptions(intervals: BusyInterval[], step = TIME_SLOT_STEP_MINUTES): TimeSlotOption[] {
  return timeSlots(step).map((value) => {
    const busy = intervals.find((item) => value >= item.start && value < item.end)
    return {
      value,
      label: value,
      disabled: Boolean(busy),
      caption: busy ? `已排 ${busy.title}` : undefined,
    }
  })
}

/** 结束时间候选：必须晚于开始时间，且区间不能跨过已有安排。 */
export function endTimeOptions(
  intervals: BusyInterval[],
  startTime: string,
  step = TIME_SLOT_STEP_MINUTES,
): TimeSlotOption[] {
  return timeSlots(step).map((value) => {
    if (!startTime || value <= startTime) {
      return { value, label: value, disabled: true, caption: '早于开始时间' }
    }
    const busy = findBusyConflict(intervals, startTime, value)
    return {
      value,
      label: value,
      disabled: Boolean(busy),
      caption: busy ? `冲突 ${busy.title}` : undefined,
    }
  })
}

/** 在候选时间里找到时长最接近期望值且可选的结束时间。 */
export function nextAvailableEndTime(
  intervals: BusyInterval[],
  startTime: string,
  desiredMinutes: number,
  step = TIME_SLOT_STEP_MINUTES,
) {
  const options = endTimeOptions(intervals, startTime, step).filter((item) => !item.disabled)
  if (!options.length) return ''
  const desired = toTime(toMinutes(startTime) + Math.max(step, desiredMinutes))
  return options.find((item) => item.value >= desired)?.value ?? options[options.length - 1].value
}

export function minutesBetween(start: string, end: string) {
  if (!start || !end) return 0
  return toMinutes(end) - toMinutes(start)
}
