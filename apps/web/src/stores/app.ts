import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
  ChildAvatarKey,
  ChildProfile,
  Course,
  CourseDateSlot,
  Expense,
  OccurrenceAttendance,
  QuickArrangementInput,
  ScheduleException,
} from '@/domain/types'
import { emptySnapshot } from '@/domain/constants'
import { currentPeriod } from '@/services/billing'
import {
  coursesForParticipants,
  findScheduleConflicts,
  occurrencesOnDate,
  type ScheduleSlot,
} from '@/services/schedule'
import * as api from '@/services/api'
import dayjs from 'dayjs'

export const useAppStore = defineStore('app', () => {
  const snapshot = ref(emptySnapshot())
  const ready = ref(false)

  let refreshSeq = 0
  let lastRangeKey = ''
  let inflight: Promise<void> | null = null
  let inflightKey = ''

  async function fetchSnapshot(range?: { from?: string; to?: string }) {
    const key = range?.from && range?.to ? `${range.from}|${range.to}` : '*'
    if (inflight && inflightKey === key) return inflight
    const seq = ++refreshSeq
    inflightKey = key
    const pending = (async () => {
      const data = await api.getSnapshot(range)
      if (seq !== refreshSeq) return
      snapshot.value = data
      lastRangeKey = key
      ready.value = true
    })().finally(() => {
      if (inflightKey === key) inflight = null
    })
    inflight = pending
    return pending
  }

  async function hydrate(range?: { from?: string; to?: string }) {
    await fetchSnapshot(range)
  }

  async function refreshRange(from: string, to: string) {
    if (!from || !to) return
    const key = `${from}|${to}`
    if (ready.value && lastRangeKey === key && !inflight) return
    await fetchSnapshot({ from, to })
  }

  function applySnapshot(next: typeof snapshot.value) {
    snapshot.value = next
  }

  async function mutate<T>(task: () => Promise<{ snapshot: typeof snapshot.value; result: T }>) {
    const response = await task()
    applySnapshot(response.snapshot)
    lastRangeKey = ''
    return response.result
  }

  function logout() {
    api.clearSession()
    snapshot.value = emptySnapshot()
    ready.value = false
    lastRangeKey = ''
    inflight = null
    inflightKey = ''
  }

  const child = computed(
    () => snapshot.value.children.find((c) => c.id === snapshot.value.session.childId) ?? snapshot.value.children[0],
  )

  const childId = computed(() => child.value?.id ?? '')
  const isParentSession = computed(() => snapshot.value.session.role === 'parent')

  function belongsToChild(course: Course, targetChildId: string) {
    const assignedChildIds = course.childIds?.length ? course.childIds : [course.childId]
    return assignedChildIds.includes(targetChildId)
  }

  function coursesForChild(targetChildId: string, includeArchived = false) {
    return snapshot.value.courses.filter(
      (course) => belongsToChild(course, targetChildId) && (includeArchived || !course.archived),
    )
  }

  const courses = computed(() => coursesForChild(childId.value))
  const allCourses = computed(() => coursesForChild(childId.value, true))
  const expenses = computed(() => snapshot.value.expenses.filter((e) => e.childId === childId.value))
  const goals = computed(() => snapshot.value.goals.filter((g) => g.childId === childId.value))
  const scheduleExceptions = computed(() => {
    const visibleCourseIds = new Set(allCourses.value.map((course) => course.id))
    return snapshot.value.scheduleExceptions.filter((item) => visibleCourseIds.has(item.courseId))
  })
  const familyCourses = computed(() => snapshot.value.courses.filter((course) => !course.archived))
  const familyScheduleExceptions = computed(() => {
    const familyCourseIds = new Set(familyCourses.value.map((course) => course.id))
    return snapshot.value.scheduleExceptions.filter((item) => familyCourseIds.has(item.courseId))
  })
  const charges = computed(() => snapshot.value.charges?.filter((item) => item.childId === childId.value) ?? [])
  const payments = computed(() => snapshot.value.payments?.filter((item) => item.childId === childId.value) ?? [])
  const occurrenceRecords = computed(() => snapshot.value.occurrenceRecords ?? [])
  const overviewCharges = computed(() => (isParentSession.value ? snapshot.value.charges ?? [] : charges.value))
  const overviewPayments = computed(() => (isParentSession.value ? snapshot.value.payments ?? [] : payments.value))
  const overviewCourses = computed(() => (isParentSession.value ? familyCourses.value : courses.value))
  const overviewExpenses = computed(() => (isParentSession.value ? snapshot.value.expenses : expenses.value))
  const overviewScheduleExceptions = computed(() =>
    isParentSession.value ? familyScheduleExceptions.value : scheduleExceptions.value,
  )
  const todayItems = computed(() =>
    occurrencesOnDate(overviewCourses.value, dayjs().format('YYYY-MM-DD'), overviewScheduleExceptions.value),
  )
  const monthOpenAmount = computed(() =>
    overviewExpenses.value
      .filter((e) => e.period === currentPeriod() && e.status !== 'paid')
      .reduce((s, e) => s + e.amount, 0),
  )

  function findCourse(courseId: string) {
    return snapshot.value.courses.find((item) => item.id === courseId)
  }

  function findExpense(expenseId: string) {
    return snapshot.value.expenses.find((item) => item.id === expenseId)
  }

  function findOccurrenceExpense(courseId: string, date: string) {
    const sameDay = snapshot.value.expenses.find(
      (item) => item.courseId === courseId && item.status !== 'void' && item.dueDate === date,
    )
    if (sameDay) return sameDay
    const course = findCourse(courseId)
    if (course?.source === 'temporary') {
      return snapshot.value.expenses.find((item) => item.courseId === courseId && item.status !== 'void')
    }
    return undefined
  }

  function findCourseScheduleConflicts(slots: ScheduleSlot[], exceptCourseId?: string, childIds?: string[]) {
    const participants = childIds?.length ? childIds : child.value ? [child.value.id] : []
    return findScheduleConflicts(
      slots,
      coursesForParticipants(overviewCourses.value, participants),
      overviewScheduleExceptions.value,
      exceptCourseId,
      participants,
    )
  }

  async function upsertCourse(input: Omit<Course, 'id' | 'childId' | 'archived'> & { id?: string; childIds?: string[] }) {
    return mutate(() => api.upsertCourse(input))
  }

  async function archiveCourse(id: string) {
    await mutate(() => api.archiveCourse(id))
  }

  async function restoreCourse(id: string) {
    await mutate(() => api.restoreCourse(id))
  }

  async function removeCourse(id: string) {
    return mutate(() => api.removeCourse(id))
  }

  async function updateChild(input: Pick<ChildProfile, 'id'> & Partial<Pick<ChildProfile, 'name' | 'avatarKey'>>) {
    await mutate(() => api.updateChild(input))
  }

  async function addChild(name: string, avatarKey?: ChildAvatarKey) {
    return mutate(() => api.addChild(name, avatarKey))
  }

  async function removeChild(id: string) {
    return mutate(() => api.removeChild(id))
  }

  async function selectChild(id: string) {
    if (!snapshot.value.children.some((item) => item.id === id)) return
    await mutate(() => api.selectChild(id))
  }

  async function setOccurrenceAttendance(
    courseId: string,
    date: string,
    status: OccurrenceAttendance,
    options: { billable?: boolean; actualMinutes?: number } = {},
  ) {
    await mutate(() => api.setOccurrenceAttendance(courseId, date, status, options))
  }

  async function upsertScheduleException(input: Omit<ScheduleException, 'id' | 'childId'> & { id?: string }) {
    return mutate(() => api.upsertScheduleException(input))
  }

  async function restoreOccurrenceSlot(courseId: string, slot: CourseDateSlot) {
    await mutate(() => api.restoreOccurrenceSlot(courseId, slot))
  }

  async function dropOccurrenceSlot(courseId: string, date: string) {
    await mutate(() => api.dropOccurrenceSlot(courseId, date))
  }

  async function clearScheduleExceptionsForCourse(courseId: string) {
    await mutate(() => api.clearScheduleExceptionsForCourse(courseId))
  }

  async function upsertExpense(input: Omit<Expense, 'id' | 'childId'> & { id?: string }) {
    return mutate(() => api.upsertExpense(input))
  }

  async function generateBillingStatements(period: string) {
    return mutate(() => api.generateBillingStatements(period))
  }

  async function syncCourseUpfrontExpense(courseId: string, status: 'unpaid' | 'paid') {
    return mutate(() => api.syncCourseUpfrontExpense(courseId, status))
  }

  async function addPresetOccurrence(courseId: string, date: string | string[]) {
    try {
      return await mutate(() => api.addPresetOccurrence(courseId, date))
    } catch (error) {
      if (error instanceof api.ApiError && error.code === 'SCHEDULE_CONFLICT') {
        return { ok: false as const, reason: 'conflict' as const, conflict: undefined }
      }
      if (error instanceof api.ApiError && error.code === 'OCCURRENCE_DUPLICATE') {
        return { ok: false as const, reason: 'duplicate' as const }
      }
      if (error instanceof api.ApiError && error.code === 'INVALID_OCCURRENCE') {
        return { ok: false as const, reason: 'invalid' as const }
      }
      throw error
    }
  }

  async function createQuickArrangement(input: QuickArrangementInput) {
    try {
      return await mutate(() => api.createQuickArrangement(input))
    } catch (error) {
      if (error instanceof api.ApiError && error.code === 'SCHEDULE_CONFLICT') {
        return { ok: false as const, reason: 'conflict' as const, conflict: undefined }
      }
      if (error instanceof api.ApiError && error.code === 'INVALID_TIME_RANGE') {
        return { ok: false as const, reason: 'invalid' as const }
      }
      throw error
    }
  }

  async function upsertOccurrenceExpense(courseId: string, date: string, input: { amount: number; paid: boolean }) {
    return mutate(() => api.upsertOccurrenceExpense(courseId, date, input))
  }

  async function setExpenseStatus(id: string, status: Expense['status']) {
    return mutate(() => api.setExpenseStatus(id, status))
  }

  async function refundExpense(id: string, amount: number, note = '') {
    try {
      return await mutate(() => api.refundExpense(id, amount, note))
    } catch (error) {
      if (error instanceof api.ApiError && error.code === 'REFUND_EXCEEDS_PAYMENT') {
        return { ok: false as const, reason: 'invalid-amount' as const, remaining: 0 }
      }
      return { ok: false as const, reason: 'not-paid' as const }
    }
  }

  async function removeExpense(id: string) {
    try {
      return await mutate(() => api.removeExpense(id))
    } catch (error) {
      if (error instanceof api.ApiError && error.code === 'PAID_BILL_IMMUTABLE') return 'paid-immutable' as const
      if (error instanceof api.ApiError && error.code === 'BILL_NOT_FOUND') return 'not-found' as const
      throw error
    }
  }

  async function addGoalProgress(_id: string, _delta: number) {
    // 目标页尚未接入，一期先保留签名。
  }

  return {
    snapshot,
    ready,
    hydrate,
    refreshRange,
    logout,
    child,
    courses,
    allCourses,
    expenses,
    goals,
    scheduleExceptions,
    isParentSession,
    overviewCourses,
    overviewExpenses,
    overviewScheduleExceptions,
    coursesForChild,
    todayItems,
    monthOpenAmount,
    overviewCharges,
    overviewPayments,
    occurrenceRecords,
    charges,
    payments,
    updateChild,
    addChild,
    removeChild,
    selectChild,
    findCourse,
    findExpense,
    findOccurrenceExpense,
    upsertCourse,
    findCourseScheduleConflicts,
    archiveCourse,
    restoreCourse,
    removeCourse,
    upsertScheduleException,
    restoreOccurrenceSlot,
    dropOccurrenceSlot,
    clearScheduleExceptionsForCourse,
    upsertExpense,
    syncCourseUpfrontExpense,
    generateBillingStatements,
    addPresetOccurrence,
    createQuickArrangement,
    upsertOccurrenceExpense,
    setOccurrenceAttendance,
    setExpenseStatus,
    refundExpense,
    removeExpense,
    addGoalProgress,
  }
})
