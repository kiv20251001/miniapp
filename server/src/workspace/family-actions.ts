import dayjs from 'dayjs'
import type { ChildAvatarKey, Expense, OccurrenceAttendance } from '../domain/types'
import { createFamilyWorkspace } from './family-workspace'

export class FamilyActionError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

type Workspace = ReturnType<typeof createFamilyWorkspace>

function raiseObject(result: unknown) {
  if (!result || typeof result !== 'object' || !('ok' in result) || result.ok !== false) return result
  const reason = 'reason' in result ? String(result.reason) : ''
  if (reason === 'conflict') throw new FamilyActionError('SCHEDULE_CONFLICT', '该孩子此时已有其他课程')
  if (reason === 'duplicate') throw new FamilyActionError('OCCURRENCE_DUPLICATE', '所选日期都已有这门课')
  if (reason === 'temporary') throw new FamilyActionError('INVALID_INPUT', '临时计划不能加入已有课程')
  if (reason === 'invalid-amount') throw new FamilyActionError('REFUND_EXCEEDS_PAYMENT', '退款金额应大于 0，且不超过剩余可退金额')
  if (reason === 'not-paid' || reason === 'payment-missing') throw new FamilyActionError('REFUND_NOT_ALLOWED', '当前账单无法退款')
  throw new FamilyActionError('INVALID_INPUT', '请完整填写后再保存')
}

function raiseCode(result: unknown, map: Record<string, [string, string]>) {
  if (typeof result === 'string' && map[result]) {
    const [code, message] = map[result]
    throw new FamilyActionError(code, message)
  }
  return result
}

function billWindow(payload: Record<string, unknown>) {
  const from = typeof payload.from === 'string' ? payload.from : dayjs().startOf('month').format('YYYY-MM-DD')
  const to = typeof payload.to === 'string' ? payload.to : dayjs().endOf('month').format('YYYY-MM-DD')
  return { from, to }
}

function ensureRange(workspace: Workspace, from: string, to: string) {
  for (const course of workspace.snapshot.value.courses.filter((item) => !item.archived)) {
    const dates = course.recurrence.dates?.map((slot) => slot.date) ?? []
    if (dates.some((date) => date >= from && date <= to)) workspace.ensureCourseBilling(course)
  }
  workspace.ensureBillingForRange(from, to)
}

export function applyFamilyAction(workspace: Workspace, action: string, payload: Record<string, unknown>) {
  switch (action) {
    case 'snapshot': {
      const { from, to } = billWindow(payload)
      ensureRange(workspace, from, to)
      return null
    }
    case 'addChild': {
      const id = workspace.addChild(String(payload.name || ''), payload.avatarKey as ChildAvatarKey | undefined)
      if (id === 'empty') throw new FamilyActionError('INVALID_CHILD_NAME', '请先填写孩子名字')
      if (id === 'limit') throw new FamilyActionError('CHILD_LIMIT', '最多添加 4 个孩子')
      if (id === 'avatar-taken') throw new FamilyActionError('AVATAR_TAKEN', '这个头像已经有孩子在用')
      return id
    }
    case 'updateChild': {
      const updated = workspace.updateChild({
        id: String(payload.id || ''),
        name: typeof payload.name === 'string' ? payload.name : undefined,
        avatarKey: payload.avatarKey as ChildAvatarKey | undefined,
      })
      if (updated === 'not-found') throw new FamilyActionError('CHILD_NOT_FOUND', '该孩子已不存在')
      if (updated === 'avatar-taken') throw new FamilyActionError('AVATAR_TAKEN', '这个头像已经有孩子在用')
      return null
    }
    case 'removeChild':
      return raiseCode(workspace.removeChild(String(payload.id || '')), {
        'not-found': ['CHILD_NOT_FOUND', '该孩子已不存在'],
        'last-child': ['LAST_CHILD_NOT_DELETABLE', '至少需要保留一个孩子'],
      })
    case 'selectChild': {
      const childId = String(payload.childId || '')
      if (!workspace.snapshot.value.children.some((item) => item.id === childId)) {
        throw new FamilyActionError('CHILD_NOT_FOUND', '孩子不存在')
      }
      workspace.selectChild(childId)
      return childId
    }
    case 'saveCourse': {
      const course = payload.course as Parameters<Workspace['upsertCourse']>[0]
      if (!course?.title?.trim() || !course.recurrence?.dates?.length) {
        throw new FamilyActionError('INVALID_INPUT', '请填写课程名称并至少选择一个上课日期')
      }
      const dates = course.recurrence.dates
      const [conflict] = workspace.findCourseScheduleConflicts(dates, course.id, course.childIds)
      if (conflict) throw new FamilyActionError('SCHEDULE_CONFLICT', `与「${conflict.title}」时间重叠`)
      const id = workspace.upsertCourse(course)
      const paymentStatus = payload.paymentStatus === 'paid' ? 'paid' : 'unpaid'
      workspace.syncCourseUpfrontExpense(id, paymentStatus)
      workspace.clearScheduleExceptionsForCourse(id)
      return id
    }
    case 'archiveCourse':
      return workspace.archiveCourse(String(payload.id || ''))
    case 'restoreCourse':
      return workspace.restoreCourse(String(payload.id || ''))
    case 'removeCourse':
      return raiseCode(workspace.removeCourse(String(payload.id || '')), {
        'not-found': ['COURSE_NOT_FOUND', '课程不存在'],
      })
    case 'addOccurrences':
      return raiseObject(workspace.addPresetOccurrence(String(payload.courseId || ''), payload.dates as string[]))
    case 'updateCourseNote':
      return raiseCode(workspace.updateCourseNote(String(payload.courseId || ''), String(payload.note ?? '')), {
        'not-found': ['COURSE_NOT_FOUND', '课程不存在'],
        'not-temporary': ['INVALID_INPUT', '只有临时计划可以改备注'],
      })
    case 'saveHomework':
      return raiseCode(workspace.saveHomework({
        id: typeof payload.id === 'string' && payload.id ? payload.id : undefined,
        date: String(payload.date || ''),
        subject: String(payload.subject || ''),
        content: String(payload.content || ''),
        note: typeof payload.note === 'string' ? payload.note : '',
      }), {
        invalid: ['INVALID_INPUT', '请填写作业科目和作业内容'],
        'not-found': ['HOMEWORK_NOT_FOUND', '这条作业已经不在了'],
      })
    case 'setHomeworkDone':
      return raiseCode(workspace.setHomeworkDone(String(payload.id || ''), Boolean(payload.done)), {
        'not-found': ['HOMEWORK_NOT_FOUND', '这条作业已经不在了'],
      })
    case 'removeHomework':
      return raiseCode(workspace.removeHomework(String(payload.id || '')), {
        'not-found': ['HOMEWORK_NOT_FOUND', '这条作业已经不在了'],
      })
    case 'quickArrangement':
      return raiseObject(workspace.createQuickArrangement({
        dates: payload.dates as string[] | undefined,
        date: typeof payload.date === 'string' ? payload.date : undefined,
        title: String(payload.title || ''),
        startTime: String(payload.startTime || ''),
        endTime: String(payload.endTime || ''),
        amount: Number(payload.amount) || 0,
        expenseStatus: payload.expenseStatus === 'paid' ? 'paid' : 'unpaid',
        note: typeof payload.note === 'string' ? payload.note : '',
      }))
    case 'upsertException':
      return workspace.upsertScheduleException(payload as never)
    case 'restoreOccurrence':
      return workspace.restoreOccurrenceSlot(String(payload.courseId || ''), {
        date: String(payload.date || ''),
        startTime: String(payload.startTime || ''),
        endTime: String(payload.endTime || ''),
      })
    case 'dropOccurrence':
      workspace.dropOccurrenceSlot(String(payload.courseId || ''), String(payload.date || ''))
      return null
    case 'attendance':
      return workspace.setOccurrenceAttendance(
        String(payload.courseId || ''),
        String(payload.date || ''),
        payload.status as OccurrenceAttendance,
        {
          billable: Boolean(payload.billable),
          actualMinutes: payload.actualMinutes == null ? undefined : Number(payload.actualMinutes),
        },
      )
    case 'occurrenceExpense':
      return raiseCode(
        workspace.upsertOccurrenceExpense(String(payload.courseId || ''), String(payload.date || ''), {
          amount: Number(payload.amount) || 0,
          paid: Boolean(payload.paid),
        }),
        {
          'not-found': ['COURSE_NOT_FOUND', '课程不存在'],
          'paid-immutable': ['PAID_BILL_IMMUTABLE', '已支付账单不能改金额'],
        },
      )
    case 'upsertExpense':
      return workspace.upsertExpense(payload as Omit<Expense, 'id' | 'childId'> & { id?: string })
    case 'generateBills': {
      const period = String(payload.period || '')
      if (!/^\d{4}-\d{2}$/.test(period)) throw new FamilyActionError('INVALID_PERIOD', '账期格式应为 YYYY-MM')
      return workspace.generateBillingStatements(period)
    }
    case 'setExpenseStatus':
      return raiseCode(
        workspace.setExpenseStatus(String(payload.id || ''), payload.status as Expense['status']),
        {
          'not-found': ['BILL_NOT_FOUND', '账单不存在'],
          'paid-immutable': ['PAID_BILL_IMMUTABLE', '已支付账单不能改回未支付'],
        },
      )
    case 'refund':
      return raiseObject(
        workspace.refundExpense(String(payload.id || ''), Number(payload.amount) || 0, String(payload.note || '')),
      )
    case 'removeExpense':
      return raiseCode(workspace.removeExpense(String(payload.id || '')), {
        'not-found': ['BILL_NOT_FOUND', '账单不存在'],
        'paid-immutable': ['PAID_BILL_IMMUTABLE', '已支付账单不能删除'],
      })
    default:
      throw new FamilyActionError('UNKNOWN_ACTION', '不支持的操作')
  }
}
