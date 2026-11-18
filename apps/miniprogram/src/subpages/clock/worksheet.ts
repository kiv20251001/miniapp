import { formatClock, pad, randomQuizTime, type ClockTime, type Level } from './time'

/** 看时间画指针：钟面没有指针，下面写好时间；看指针填时间：钟面有指针，下面留空格。 */
export type ClockMode = 'draw' | 'read'
export type ClockSheetKind = ClockMode | 'mixed'
export type SheetTime = ClockTime & { s: number }
export type ClockItem = { time: SheetTime; mode: ClockMode }

export const SHEET_KINDS: Array<{ value: ClockSheetKind; label: string }> = [
  { value: 'draw', label: '看时间画指针' },
  { value: 'read', label: '看指针填时间' },
  { value: 'mixed', label: '随机混合' },
]

export const PER_ROW_OPTIONS = [2, 3, 4] as const
export type PerRow = (typeof PER_ROW_OPTIONS)[number]

export const SHEET_LEVELS: Array<{ value: Level; label: string }> = [
  { value: 'easy', label: '整点半点' },
  { value: 'medium', label: '5 分钟' },
  { value: 'hard', label: '任意分钟' },
]

function toTime(h: number, m: number, s: number): SheetTime | null {
  const valid = [h, m, s].every(Number.isInteger) && h >= 0 && h <= 23 && m >= 0 && m <= 59 && s >= 0 && s <= 59
  return valid ? { h: h % 12 || 12, m, s } : null
}

/** 支持 3:30、3:30:15、3点、3点半、3点15分、3点15分20秒，用空格、逗号或换行隔开。 */
export function parseTimes(text: string) {
  const times: SheetTime[] = []
  const skipped: string[] = []
  for (const raw of text.split(/[\s,，、;；]+/)) {
    const token = raw.trim()
    if (!token) continue
    const colon = token.match(/^(\d{1,2})[:：.](\d{1,2})(?:[:：.](\d{1,2}))?$/)
    const spoken = token.match(/^(\d{1,2})点(?:(半)|(\d{1,2})分?|整)?(?:(\d{1,2})秒)?$/)
    let time: SheetTime | null = null
    if (colon) time = toTime(Number(colon[1]), Number(colon[2]), Number(colon[3] || 0))
    else if (spoken) time = toTime(Number(spoken[1]), spoken[2] ? 30 : Number(spoken[3] || 0), Number(spoken[4] || 0))
    if (time) times.push(time)
    else skipped.push(token)
  }
  return { times, skipped }
}

export function formatSheetTime(time: SheetTime, seconds: boolean) {
  const text = formatClock(time.h, time.m)
  return seconds ? `${text}:${pad(time.s)}` : text
}

export function joinTimes(times: SheetTime[], seconds: boolean) {
  return times.map((time) => formatSheetTime(time, seconds)).join('  ')
}

export function randomTimes(level: Level, count: number, seconds: boolean) {
  const times: SheetTime[] = []
  for (let index = 0; index < count; index += 1) {
    const time = randomQuizTime(level, times[index - 1])
    times.push({ ...time, s: seconds ? Math.floor(Math.random() * 60) : 0 })
  }
  return times
}

/** 关掉秒针时输入里的秒数不画。混合题型一半画指针、一半填时间，顺序打乱。 */
export function assignModes(times: SheetTime[], kind: ClockSheetKind, seconds: boolean): ClockItem[] {
  const list = seconds ? times : times.map((time) => ({ ...time, s: 0 }))
  if (kind !== 'mixed') return list.map((time) => ({ time, mode: kind }))
  const modes = list.map((_, index): ClockMode => (index % 2 === 0 ? 'draw' : 'read')).sort(() => Math.random() - 0.5)
  return list.map((time, index) => ({ time, mode: modes[index] }))
}
