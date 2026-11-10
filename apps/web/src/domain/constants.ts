import type {
  AppSnapshot,
  BillingMode,
  ChildAvatarKey,
  CourseIcon,
  CourseType,
  ExpenseCategory,
  ExpenseStatus,
} from './types'

export const STORAGE_KEY = 'myhome.v1'

export const COURSE_TYPE_LABEL: Record<CourseType, string> = {
  interest: '兴趣课',
  sport: '运动课',
  culture: '文化课',
  school: '学校课',
  other: '其它',
}

export const COURSE_TYPE_OPTIONS: Array<{ value: CourseType; label: string }> = [
  { value: 'interest', label: '兴趣课' },
  { value: 'sport', label: '运动课' },
  { value: 'culture', label: '文化课' },
  { value: 'school', label: '学校课' },
  { value: 'other', label: '其它' },
]

export function normalizeCourseType(value: string | undefined): CourseType {
  if (value === 'online') return 'other'
  if (value && value in COURSE_TYPE_LABEL) return value as CourseType
  return 'interest'
}

export const BILLING_MODE_LABEL: Record<BillingMode, string> = {
  monthly: '按月结算',
  session: '单次结算',
  term: '按期结算',
  free: '无需缴费',
}

export const EXPENSE_STATUS_LABEL: Record<ExpenseStatus, string> = {
  pending: '待出账',
  unpaid: '待支付',
  paid: '已支付',
  void: '已作废',
}

export const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  interest: '兴趣课',
  sport: '运动课',
  culture: '文化课',
  school: '学校课',
  other: '其它',
  temporary: '临时课程',
  material: '学习用品',
}

export const WEEKDAY_SHORT = ['日', '一', '二', '三', '四', '五', '六']

// 课程主色使用饱和品牌色，界面按需派生浅色底与渐变。
export const COURSE_COLORS = [
  '#7B61FF',
  '#FF6B8A',
  '#26C281',
  '#3E9BFF',
  '#C265F0',
  '#FF9A3D',
  '#22C4CC',
  '#DC5454',
  '#FFC233',
]

export const COURSE_ICON_COLORS: Record<CourseIcon, string> = {
  school: '#7B61FF',
  sport: '#26C281',
  math: '#FF9A3D',
  reading: '#FF6B8A',
  music: '#C265F0',
  swimming: '#22C4CC',
  english: '#3E9BFF',
  calligraphy: '#DC5454',
  homework: '#FFC233',
  generic: '#DC5454',
}

export const CHILD_AVATAR_OPTIONS: Array<{
  key: ChildAvatarKey
  label: string
  color: string
}> = [
  { key: 'boy-blue', label: '蓝衣男孩', color: '#5B8DEF' },
  { key: 'boy-cap', label: '白帽男孩', color: '#6EA0F0' },
  { key: 'girl-flower', label: '粉衣女孩', color: '#FF8AAE' },
  { key: 'girl-bow', label: '紫衣女孩', color: '#B388FF' },
]

export const DEFAULT_CHILD_AVATAR = CHILD_AVATAR_OPTIONS[0]

export function childAvatarOption(key?: ChildAvatarKey) {
  return CHILD_AVATAR_OPTIONS.find((item) => item.key === key) ?? DEFAULT_CHILD_AVATAR
}

export function unusedCourseColor(
  courses: Array<{ id?: string; color?: string }>,
  options?: { preferred?: string; exceptId?: string },
) {
  const used = new Set(
    courses
      .filter((course) => course.id !== options?.exceptId)
      .map((course) => course.color?.toUpperCase())
      .filter(Boolean),
  )
  const preferred = options?.preferred
  const palette = preferred
    ? [preferred, ...COURSE_COLORS.filter((color) => color.toUpperCase() !== preferred.toUpperCase())]
    : COURSE_COLORS
  return palette.find((color) => !used.has(color.toUpperCase())) ?? preferred ?? COURSE_COLORS[0]
}

export function randomCourseColor(
  courses: Array<{ id?: string; color?: string }>,
  options?: { exceptId?: string },
) {
  const used = new Set(
    courses
      .filter((course) => course.id !== options?.exceptId)
      .map((course) => course.color?.toUpperCase())
      .filter(Boolean),
  )
  const unused = COURSE_COLORS.filter((color) => !used.has(color.toUpperCase()))
  const palette = unused.length ? unused : COURSE_COLORS
  return palette[Math.floor(Math.random() * palette.length)]
}

export const COURSE_ICON_OPTIONS: Array<{ value: CourseIcon; label: string }> = [
  { value: 'school', label: '学校' },
  { value: 'sport', label: '运动' },
  { value: 'math', label: '数学' },
  { value: 'reading', label: '阅读' },
  { value: 'music', label: '音乐' },
  { value: 'swimming', label: '游泳' },
  { value: 'english', label: '英语' },
  { value: 'calligraphy', label: '书法' },
  { value: 'homework', label: '作业' },
  { value: 'generic', label: '通用' },
]

export const BILLING_SCHEMA_VERSION = 4

export function emptySnapshot(): AppSnapshot {
  return {
    version: 1,
    billingSchemaVersion: BILLING_SCHEMA_VERSION,
    session: { role: 'parent', childId: '' },
    children: [],
    courses: [],
    expenses: [],
    goals: [],
    scheduleExceptions: [],
    occurrenceRecords: [],
    charges: [],
    payments: [],
    billingMigrationAudits: [],
  }
}

export function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
