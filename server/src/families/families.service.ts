import { Injectable } from '@nestjs/common'
import type { AppSnapshot, ChildAvatarKey, Expense, OccurrenceAttendance, QuickArrangementInput, ScheduleException } from '../domain/types'
import { BusinessError } from '../common/business-error'
import { JwtUser } from '../common/current-user'
import { PrismaService } from '../prisma.service'
import { createFamilyWorkspace } from '../workspace/family-workspace'

type Workspace = ReturnType<typeof createFamilyWorkspace>

@Injectable()
export class FamiliesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly familyTasks = new Map<string, Promise<unknown>>()
  private readonly billedRanges = new Map<string, { version: number; from: string; to: string }>()

  private runExclusive<T>(familyId: string, task: () => Promise<T>): Promise<T> {
    const previous = this.familyTasks.get(familyId) ?? Promise.resolve()
    const current = previous.then(task, task)
    this.familyTasks.set(familyId, current.then(() => undefined, () => undefined))
    return current
  }

  async getCurrent(user: JwtUser) {
    const [account, family, preference] = await Promise.all([
      this.prisma.account.findUnique({ where: { id: user.sub } }),
      this.prisma.family.findUnique({ where: { id: user.familyId } }),
      this.prisma.accountPreference.findUnique({
        where: { accountId_familyId: { accountId: user.sub, familyId: user.familyId } },
      }),
    ])
    if (!account || !family) {
      throw new BusinessError('FAMILY_MISMATCH', '家庭不存在或无权访问', 403)
    }
    const snapshot = this.parseSnapshot(family.snapshotJson)
    return {
      id: family.id,
      timezone: family.timezone,
      role: user.role,
      account: { id: account.id, username: account.username, name: account.name },
      defaultChildId: preference?.defaultChildId ?? snapshot.session.childId,
      children: snapshot.children,
    }
  }

  async getSnapshot(user: JwtUser, from?: string, to?: string) {
    return this.runExclusive(user.familyId, () => this.readSnapshot(user, from, to))
  }

  addChild(user: JwtUser, name: string, avatarKey?: string) {
    return this.mutate(user, (workspace) => {
      const id = workspace.addChild(name, avatarKey as ChildAvatarKey | undefined)
      if (id === 'empty') throw new BusinessError('INVALID_CHILD_NAME', '请先填写孩子名字', 400)
      if (id === 'limit') throw new BusinessError('CHILD_LIMIT', '最多添加 4 个孩子', 400)
      if (id === 'avatar-taken') throw new BusinessError('AVATAR_TAKEN', '这个头像已经有孩子在用', 409)
      return id
    })
  }

  updateChild(user: JwtUser, id: string, input: { name?: string; avatarKey?: string }) {
    return this.mutate(user, (workspace) => {
      const updated = workspace.updateChild({
        id,
        name: input.name,
        avatarKey: input.avatarKey as ChildAvatarKey | undefined,
      })
      if (updated === 'not-found') throw new BusinessError('CHILD_NOT_FOUND', '该孩子已不存在', 404)
      if (updated === 'avatar-taken') throw new BusinessError('AVATAR_TAKEN', '这个头像已经有孩子在用', 409)
    })
  }

  removeChild(user: JwtUser, id: string) {
    return this.mutate(user, (workspace) => {
      const result = workspace.removeChild(id)
      if (result === 'not-found') throw new BusinessError('CHILD_NOT_FOUND', '该孩子已不存在', 404)
      if (result === 'last-child') throw new BusinessError('LAST_CHILD_NOT_DELETABLE', '至少需要保留一个孩子', 409)
      return result
    })
  }

  selectChild(user: JwtUser, childId: string) {
    return this.mutate(user, async (workspace) => {
      workspace.selectChild(childId)
      await this.prisma.accountPreference.upsert({
        where: { accountId_familyId: { accountId: user.sub, familyId: user.familyId } },
        update: { defaultChildId: workspace.snapshot.value.session.childId },
        create: {
          id: `pref_${user.sub}`,
          accountId: user.sub,
          familyId: user.familyId,
          defaultChildId: workspace.snapshot.value.session.childId,
        },
      })
    })
  }

  upsertCourse(user: JwtUser, input: Parameters<Workspace['upsertCourse']>[0]) {
    return this.mutate(user, (workspace) => workspace.upsertCourse(input))
  }

  archiveCourse(user: JwtUser, id: string) {
    return this.mutate(user, (workspace) => workspace.archiveCourse(id))
  }

  restoreCourse(user: JwtUser, id: string) {
    return this.mutate(user, (workspace) => workspace.restoreCourse(id))
  }

  removeCourse(user: JwtUser, id: string) {
    return this.mutate(user, (workspace) => {
      const result = workspace.removeCourse(id)
      if (result === 'not-found') throw new BusinessError('COURSE_NOT_FOUND', '课程不存在', 404)
      return result
    })
  }

  syncCourseUpfrontExpense(user: JwtUser, courseId: string, status: 'unpaid' | 'paid') {
    return this.mutate(user, (workspace) => workspace.syncCourseUpfrontExpense(courseId, status))
  }

  clearScheduleExceptionsForCourse(user: JwtUser, courseId: string) {
    return this.mutate(user, (workspace) => workspace.clearScheduleExceptionsForCourse(courseId))
  }

  addPresetOccurrence(user: JwtUser, courseId: string, dates: string[]) {
    return this.mutate(user, (workspace) => {
      const result = workspace.addPresetOccurrence(courseId, dates)
      if (!result.ok && result.reason === 'conflict') {
        throw new BusinessError('SCHEDULE_CONFLICT', '该孩子此时已有其他课程', 409)
      }
      if (!result.ok && result.reason === 'duplicate') {
        throw new BusinessError('OCCURRENCE_DUPLICATE', '所选日期都已有这门课', 409)
      }
      if (!result.ok) {
        throw new BusinessError('INVALID_OCCURRENCE', '无法添加这次课', 400)
      }
      return result
    })
  }

  upsertScheduleException(user: JwtUser, input: Omit<ScheduleException, 'id' | 'childId'> & { id?: string }) {
    return this.mutate(user, (workspace) => workspace.upsertScheduleException(input))
  }

  restoreOccurrenceSlot(user: JwtUser, courseId: string, slot: { date: string; startTime: string; endTime: string }) {
    return this.mutate(user, (workspace) => workspace.restoreOccurrenceSlot(courseId, slot))
  }

  dropOccurrenceSlot(user: JwtUser, courseId: string, date: string) {
    return this.mutate(user, (workspace) => workspace.dropOccurrenceSlot(courseId, date))
  }

  setOccurrenceAttendance(
    user: JwtUser,
    courseId: string,
    date: string,
    status: OccurrenceAttendance,
    options: { billable?: boolean; actualMinutes?: number } = {},
  ) {
    return this.mutate(user, (workspace) => workspace.setOccurrenceAttendance(courseId, date, status, options))
  }

  upsertOccurrenceExpense(user: JwtUser, courseId: string, date: string, input: { amount: number; paid: boolean }) {
    return this.mutate(user, (workspace) => {
      const result = workspace.upsertOccurrenceExpense(courseId, date, input)
      if (result === 'not-found') throw new BusinessError('COURSE_NOT_FOUND', '课程不存在', 404)
      if (result === 'paid-immutable') throw new BusinessError('PAID_BILL_IMMUTABLE', '已支付账单不能改金额', 409)
      return result
    })
  }

  createQuickArrangement(user: JwtUser, input: QuickArrangementInput) {
    return this.mutate(user, (workspace) => {
      const result = workspace.createQuickArrangement(input)
      if (!result.ok && result.reason === 'conflict') {
        throw new BusinessError('SCHEDULE_CONFLICT', '该孩子此时已有其他课程', 409)
      }
      if (!result.ok) {
        throw new BusinessError('INVALID_TIME_RANGE', '请完整填写安排信息', 400)
      }
      return result
    })
  }

  upsertExpense(user: JwtUser, input: Omit<Expense, 'id' | 'childId'> & { id?: string }) {
    return this.mutate(user, (workspace) => workspace.upsertExpense(input))
  }

  generateBillingStatements(user: JwtUser, period: string) {
    return this.mutate(user, (workspace) => workspace.generateBillingStatements(period))
  }

  setExpenseStatus(user: JwtUser, id: string, status: Expense['status']) {
    return this.mutate(user, (workspace) => {
      const result = workspace.setExpenseStatus(id, status)
      if (result === 'not-found') throw new BusinessError('BILL_NOT_FOUND', '账单不存在', 404)
      if (result === 'paid-immutable') throw new BusinessError('PAID_BILL_IMMUTABLE', '已支付账单不能改回未支付', 409)
      return result
    })
  }

  refundExpense(user: JwtUser, id: string, amount: number, note?: string) {
    return this.mutate(user, (workspace) => {
      const result = workspace.refundExpense(id, amount, note)
      if (!result.ok && result.reason === 'invalid-amount') {
        throw new BusinessError('REFUND_EXCEEDS_PAYMENT', `退款金额应大于 0，且不超过剩余可退金额`, 400)
      }
      if (!result.ok) {
        throw new BusinessError('REFUND_NOT_ALLOWED', '当前账单无法退款', 409)
      }
      return result
    })
  }

  removeExpense(user: JwtUser, id: string) {
    return this.mutate(user, (workspace) => {
      const result = workspace.removeExpense(id)
      if (result === 'not-found') throw new BusinessError('BILL_NOT_FOUND', '账单不存在', 404)
      if (result === 'paid-immutable') throw new BusinessError('PAID_BILL_IMMUTABLE', '已支付账单不能删除', 409)
      return result
    })
  }

  private parseSnapshot(raw: string): AppSnapshot {
    return JSON.parse(raw) as AppSnapshot
  }

  private async load(user: JwtUser) {
    const family = await this.prisma.family.findUnique({ where: { id: user.familyId } })
    if (!family) {
      throw new BusinessError('FAMILY_MISMATCH', '家庭不存在或无权访问', 403)
    }
    return {
      family,
      snapshot: this.parseSnapshot(family.snapshotJson),
    }
  }

  private async readSnapshot(user: JwtUser, from?: string, to?: string) {
    const { family, snapshot } = await this.load(user)
    if (!from || !to) return snapshot
    const billed = this.billedRanges.get(family.id)
    if (billed && billed.version === family.version && billed.from === from && billed.to === to) {
      return snapshot
    }
    const workspace = createFamilyWorkspace(snapshot)
    for (const course of workspace.snapshot.value.courses.filter((item) => !item.archived)) {
      const dates = course.recurrence.dates?.map((slot) => slot.date) ?? []
      if (dates.some((date) => date >= from && date <= to)) {
        workspace.ensureCourseBilling(course)
      }
    }
    workspace.ensureBillingForRange(from, to)
    const nextJson = JSON.stringify(workspace.snapshot.value)
    let version = family.version
    if (nextJson !== family.snapshotJson) {
      const updated = await this.prisma.family.update({
        where: { id: family.id },
        data: {
          snapshotJson: nextJson,
          version: { increment: 1 },
        },
      })
      version = updated.version
    }
    this.billedRanges.set(family.id, { version, from, to })
    return workspace.snapshot.value
  }

  private async mutate(user: JwtUser, apply: (workspace: Workspace) => unknown | Promise<unknown>) {
    return this.runExclusive(user.familyId, async () => {
      const { family, snapshot } = await this.load(user)
      const workspace = createFamilyWorkspace(snapshot)
      const result = await apply(workspace)
      const nextJson = JSON.stringify(workspace.snapshot.value)
      if (nextJson !== family.snapshotJson) {
        await this.prisma.family.update({
          where: { id: family.id },
          data: {
            snapshotJson: nextJson,
            version: { increment: 1 },
          },
        })
        this.billedRanges.delete(family.id)
      }
      return {
        snapshot: workspace.snapshot.value,
        result: result ?? null,
      }
    })
  }
}
