export type Role = 'parent' | 'child'

export type CourseType = 'interest' | 'sport' | 'culture' | 'school' | 'other'

export type BillingMode = 'monthly' | 'session' | 'term' | 'free'

export type CoursePricingMode = 'free' | 'prepaid' | 'per_session' | 'per_hour' | 'fixed_period'

export type SettlementCycle = 'upfront' | 'weekly' | 'monthly' | 'manual'

export type PackageUnit = 'session' | 'minute'

export interface CourseBillingPolicy {
  pricingMode: CoursePricingMode
  settlementCycle: SettlementCycle
  /** 可选课包总量；仅 prepaid 使用，未填写则只记总价不追踪余额。 */
  packageUnits?: number
  packageUnit?: PackageUnit
}

export interface BillingMigrationAudit {
  fromVersion: number
  toVersion: number
  at: string
  notes: string[]
  preservedPaidExpenseIds: string[]
  coursesNeedingReview: string[]
}

export type OccurrenceAttendance =
  | 'scheduled'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'pending_confirmation'

export type ChargeStatus = 'unbilled' | 'billed' | 'waived' | 'reversed'

export type ChargeSource = 'session' | 'hour' | 'fixed_period' | 'adjustment'

/** 家长明确确认过的课次事实；未确认的历史课次只按日期推断，不落库。 */
export interface OccurrenceRecord {
  id: string
  courseId: string
  originDate: string
  date: string
  status: OccurrenceAttendance
  billable: boolean
  actualMinutes?: number
  confirmedAt?: string
}

/** 费用明细。本地过渡期与 Expense（账单）并存，不替代已支付记录。 */
export interface Charge {
  id: string
  childId: string
  courseId: string
  occurrenceId: string
  amount: number
  status: ChargeStatus
  source: ChargeSource
  billedExpenseId?: string
  adjustmentOfChargeId?: string
  estimated?: boolean
  note?: string
}

export type PaymentKind = 'payment' | 'refund'

/** 真实资金流水；退款金额保持为正数，由 kind 决定统计正负。 */
export interface Payment {
  id: string
  childId: string
  expenseId: string
  kind: PaymentKind
  amount: number
  paidAt: string
  refundOfPaymentId?: string
  note?: string
}

export type ExpenseStatus = 'pending' | 'unpaid' | 'paid' | 'void'

export type ExpenseCategory = CourseType | 'temporary' | 'material' | 'other'

export type CourseIcon =
  | 'school'
  | 'sport'
  | 'math'
  | 'reading'
  | 'music'
  | 'swimming'
  | 'english'
  | 'calligraphy'
  | 'homework'
  | 'generic'

export type ChildAvatarKey = 'boy-blue' | 'boy-cap' | 'girl-flower' | 'girl-bow'

export interface ChildProfile {
  id: string
  name: string
  grade: string
  avatarLabel: string
  avatarColor?: string
  /** 对应 `user_icon.png` 四宫格雪碧图中的一张圆形头像。 */
  avatarKey?: ChildAvatarKey
}

export interface Recurrence {
  freq: 'weekly' | 'once' | 'dates'
  byWeekday: number[]
  startDate: string
  endDate?: string
  startTime: string
  endTime: string
  dates?: CourseDateSlot[]
}

export interface CourseDateSlot {
  date: string
  startTime: string
  endTime: string
}

export interface Course {
  id: string
  childId: string
  childIds?: string[]
  /** 临时安排不进入长期课程档案，但仍参与日程与统计。 */
  source?: 'preset' | 'temporary'
  title: string
  type: CourseType
  teacher: string
  location: string
  icon: CourseIcon
  color: string
  /** V2 计费规则；billingMode/amount 暂保留用于兼容旧数据和页面。 */
  billingPolicy?: CourseBillingPolicy
  /** 旧按月/按期数据含义不明确，需用户在课程编辑页确认一次。 */
  needsBillingReview?: boolean
  billingMode: BillingMode
  amount: number
  recurrence: Recurrence
  archived: boolean
  note: string
}

export interface Expense {
  id: string
  childId: string
  courseId?: string
  source?: 'manual' | 'course_upfront' | 'course_period' | 'course_usage' | 'temporary'
  title: string
  category: ExpenseCategory
  billingMode: Exclude<BillingMode, 'free'>
  amount: number
  period: string
  dueDate: string
  status: ExpenseStatus
  paidAt?: string
  note: string
  chargeIds?: string[]
  statementKey?: string
}

export interface Goal {
  id: string
  childId: string
  title: string
  targetCount: number
  doneCount: number
  period: string
  status: 'active' | 'done' | 'paused'
}

export interface ScheduleException {
  id: string
  childId: string
  courseId: string
  date: string
  status: 'cancelled' | 'rescheduled' | 'added'
  title?: string
  startTime?: string
  endTime?: string
  location?: string
  note?: string
}

export interface QuickArrangementInput {
  date?: string
  dates?: string[]
  title: string
  startTime: string
  endTime: string
  amount: number
  expenseStatus: ExpenseStatus
  /** 临时计划的说明。不是课程时用来代替老师和地点。 */
  note?: string
}

export interface SessionState {
  role: Role
  childId: string
}

export interface AppSnapshot {
  version: 1
  /** 本地计费结构版本。4：课包余额、实际时长与预算预测；不重算历史账单。 */
  billingSchemaVersion?: number
  session: SessionState
  children: ChildProfile[]
  courses: Course[]
  expenses: Expense[]
  goals: Goal[]
  scheduleExceptions: ScheduleException[]
  occurrenceRecords?: OccurrenceRecord[]
  charges?: Charge[]
  payments?: Payment[]
  billingMigrationAudits?: BillingMigrationAudit[]
  /** 小程序记录的作业。H5 暂不展示，只保持契约一致。 */
  homework?: Homework[]
}

export interface Homework {
  id: string
  childId: string
  date: string
  subject: string
  content: string
  note: string
  done: boolean
  doneAt?: string
  createdAt: string
}

export interface DayOccurrence {
  id: string
  occurrenceId: string
  date: string
  course: Course
  exception?: ScheduleException
}
