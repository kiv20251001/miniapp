import type {
  AppSnapshot,
  ChildAvatarKey,
  ChildProfile,
  Course,
  CourseDateSlot,
  Expense,
  OccurrenceAttendance,
  QuickArrangementInput,
  ScheduleException,
} from '@/domain/types'

export const TOKEN_KEY = 'myhome.tokens'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}

export function getToken() {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    if (!raw) return ''
    const parsed = JSON.parse(raw) as { accessToken?: string }
    return parsed.accessToken ?? ''
  } catch {
    return ''
  }
}

export function setSession(payload: { accessToken: string }) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(payload))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
}

type MutateResult<T = unknown> = { snapshot: AppSnapshot; result: T }

const API_BASE = import.meta.env.DEV ? 'http://127.0.0.1:3000/api' : '/api'

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/')) clearSession()
    throw new ApiError(
      response.status,
      String(data.code || 'HTTP_ERROR'),
      String(data.message || '请求失败'),
    )
  }
  return data as T
}

export function register(input: { username: string; password: string; name?: string }) {
  return request<{
    accessToken: string
    account: { id: string; username: string; name: string }
    family: { id: string; role: string }
  }>('/auth/register', { method: 'POST', body: JSON.stringify(input) })
}

export function login(input: { username: string; password: string }) {
  return request<{
    accessToken: string
    account: { id: string; username: string; name: string }
    family: { id: string; role: string }
  }>('/auth/login', { method: 'POST', body: JSON.stringify(input) })
}

export function getSnapshot(range?: { from?: string; to?: string }) {
  const query = new URLSearchParams()
  if (range?.from) query.set('from', range.from)
  if (range?.to) query.set('to', range.to)
  const suffix = query.toString()
  return request<AppSnapshot>(`/families/current/snapshot${suffix ? `?${suffix}` : ''}`)
}

export function addChild(name: string, avatarKey?: ChildAvatarKey) {
  return request<MutateResult<string>>('/children', {
    method: 'POST',
    body: JSON.stringify({ name, avatarKey }),
  })
}

export function updateChild(input: Pick<ChildProfile, 'id'> & Partial<Pick<ChildProfile, 'name' | 'avatarKey'>>) {
  return request<MutateResult>(`/children/${input.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: input.name, avatarKey: input.avatarKey }),
  })
}

export function removeChild(id: string) {
  return request<MutateResult<'removed'>>(`/children/${id}`, { method: 'DELETE' })
}

export function selectChild(childId: string) {
  return request<MutateResult>('/me/current-child', {
    method: 'POST',
    body: JSON.stringify({ childId }),
  })
}

export function upsertCourse(
  input: Omit<Course, 'id' | 'childId' | 'archived'> & { id?: string; childIds?: string[] },
) {
  return request<MutateResult<string>>('/courses', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function archiveCourse(id: string) {
  return request<MutateResult>(`/courses/${id}/archive`, { method: 'POST' })
}

export function restoreCourse(id: string) {
  return request<MutateResult>(`/courses/${id}/restore`, { method: 'POST' })
}

export function removeCourse(id: string) {
  return request<MutateResult<'removed'>>(`/courses/${id}`, { method: 'DELETE' })
}

export function syncCourseUpfrontExpense(courseId: string, status: 'unpaid' | 'paid') {
  return request<MutateResult>(`/courses/${courseId}/upfront`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  })
}

export function clearScheduleExceptionsForCourse(courseId: string) {
  return request<MutateResult>(`/courses/${courseId}/exceptions`, { method: 'DELETE' })
}

export function addPresetOccurrence(courseId: string, dates: string | string[]) {
  return request<MutateResult<{ ok: true }>>(`/courses/${courseId}/occurrences`, {
    method: 'POST',
    body: JSON.stringify({ dates: Array.isArray(dates) ? dates : [dates] }),
  })
}

export function upsertScheduleException(input: Omit<ScheduleException, 'id' | 'childId'> & { id?: string }) {
  return request<MutateResult<ScheduleException>>('/exceptions', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function restoreOccurrenceSlot(courseId: string, slot: CourseDateSlot) {
  return request<MutateResult>(`/occurrences/${courseId}/restore`, {
    method: 'POST',
    body: JSON.stringify(slot),
  })
}

export function dropOccurrenceSlot(courseId: string, date: string) {
  return request<MutateResult>(`/occurrences/${courseId}/${date}`, { method: 'DELETE' })
}

export function setOccurrenceAttendance(
  courseId: string,
  date: string,
  status: OccurrenceAttendance,
  options: { billable?: boolean; actualMinutes?: number } = {},
) {
  return request<MutateResult>(`/occurrences/${courseId}/${date}/attendance`, {
    method: 'PATCH',
    body: JSON.stringify({ status, ...options }),
  })
}

export function upsertOccurrenceExpense(courseId: string, date: string, input: { amount: number; paid: boolean }) {
  return request<MutateResult<'updated' | 'cleared'>>(`/occurrences/${courseId}/${date}/expense`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function createQuickArrangement(input: QuickArrangementInput) {
  return request<MutateResult<{ ok: true; courseId: string; expenseId?: string }>>('/quick-arrangements', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function upsertExpense(input: Omit<Expense, 'id' | 'childId'> & { id?: string }) {
  return request<MutateResult<string>>('/bills', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function generateBillingStatements(period: string) {
  return request<MutateResult<{ created: number; updated: number }>>('/bills/generate', {
    method: 'POST',
    body: JSON.stringify({ period }),
  })
}

export function setExpenseStatus(id: string, status: Expense['status']) {
  return request<MutateResult<'updated'>>(`/bills/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  })
}

export function refundExpense(id: string, amount: number, note = '') {
  return request<MutateResult<{ ok: true; refundId: string; remaining: number }>>(`/bills/${id}/refunds`, {
    method: 'POST',
    body: JSON.stringify({ amount, note }),
  })
}

export function removeExpense(id: string) {
  return request<MutateResult<'removed'>>(`/bills/${id}`, { method: 'DELETE' })
}
