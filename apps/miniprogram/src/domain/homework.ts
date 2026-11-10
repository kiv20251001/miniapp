import type { Homework } from '@server-domain/types'

/** 作业卡片固定用这一个颜色，和课程的随机色分开，一眼能认出是作业。 */
export const HOMEWORK_COLOR = '#6C63FF'
export const HOMEWORK_DONE_COLOR = '#2FB57C'

export type HomeworkDayStatus = 'none' | 'pending' | 'done' | 'missed'

export function homeworkOn(list: Homework[], date: string) {
  return list
    .filter((item) => item.date === date)
    .sort((a, b) => Number(a.done) - Number(b.done) || a.createdAt.localeCompare(b.createdAt))
}

/** 日期格右上角的作业标记：全部完成打勾，过了当天还没完成打叉。 */
export function homeworkDayStatus(list: Homework[], date: string, today: string): HomeworkDayStatus {
  const day = list.filter((item) => item.date === date)
  if (!day.length) return 'none'
  if (day.every((item) => item.done)) return 'done'
  return date < today ? 'missed' : 'pending'
}

export function homeworkStatusMap(list: Homework[], dates: Array<string | null>, today: string) {
  const map: Record<string, HomeworkDayStatus> = {}
  for (const date of dates) {
    if (date) map[date] = homeworkDayStatus(list, date, today)
  }
  return map
}
