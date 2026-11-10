/** 表单字段长度上限。云函数另有一层兜底（见 cloudfunctions/api/src/index.ts 的 TEXT_LIMITS）。 */
export const TEXT_LIMIT = {
  childName: 8,
  displayName: 16,
  nickName: 20,
  inviteCode: 8,
  courseTitle: 20,
  teacher: 12,
  location: 30,
  note: 200,
  expenseTitle: 20,
  refundNote: 50,
  homeworkSubject: 12,
  homeworkContent: 1000,
  /** 金额输入框字符数：最多 6 位整数 + 小数点 + 2 位小数 */
  amount: 9,
} as const

/** 单笔金额上限（元） */
export const MAX_AMOUNT = 999999
