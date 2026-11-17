/**
 * 时钟用一个不取模的总秒数表示时间：指针角度直接由它算出，倒着拨也不会让指针绕一大圈。
 * 显示时再按一天取模。
 */
export const DAY = 86400
export const HALF_DAY = 43200

export type Level = 'easy' | 'medium' | 'hard'
export type ClockTime = { h: number; m: number }

export function mod(value: number, base: number) {
  return ((value % base) + base) % base
}

export function partsOf(total: number) {
  const day = Math.floor(mod(total, DAY))
  const h24 = Math.floor(day / 3600)
  const m = Math.floor((day % 3600) / 60)
  const s = day % 60
  return { day, h24, h12: h24 % 12 || 12, m, s }
}

export function pad(value: number) {
  return String(value).padStart(2, '0')
}

export function formatClock(h: number, m: number) {
  return `${h}:${pad(m)}`
}

/** 一天里的时段，孩子更容易理解的叫法。 */
export function periodOf(h24: number) {
  if (h24 < 5) return '凌晨'
  if (h24 < 8) return '早上'
  if (h24 < 11) return '上午'
  if (h24 < 13) return '中午'
  if (h24 < 17) return '下午'
  if (h24 < 19) return '傍晚'
  return '晚上'
}

/** 把目标时间（一天或半天内的秒数）换成离当前最近的总秒数，指针只转最短的路。 */
export function nearestTotal(current: number, target: number, period: number) {
  const base = current - mod(current, period)
  const options = [base - period + target, base + target, base + period + target]
  return options.reduce((best, item) => (Math.abs(item - current) < Math.abs(best - current) ? item : best))
}

export function nowSeconds() {
  const now = new Date()
  return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
}

type Stop = { at: number; top: string; bottom: string }

const SKY: Stop[] = [
  { at: 0, top: '#141a35', bottom: '#2a3160' },
  { at: 4.5, top: '#1d2348', bottom: '#3a3f74' },
  { at: 6, top: '#5b5b9a', bottom: '#f7b28a' },
  { at: 7.5, top: '#a9d0f5', bottom: '#ffe8c8' },
  { at: 10, top: '#d6eaff', bottom: '#f6faff' },
  { at: 14, top: '#d9ecff', bottom: '#f8fbff' },
  { at: 17, top: '#ffd9ae', bottom: '#fff3e2' },
  { at: 18.5, top: '#ee8a6e', bottom: '#7b5ea7' },
  { at: 20, top: '#2f3466', bottom: '#3c3a72' },
  { at: 24, top: '#141a35', bottom: '#2a3160' },
]

function rgb(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function mix(a: string, b: string, ratio: number) {
  const ca = rgb(a)
  const cb = rgb(b)
  return `rgb(${ca.map((value, index) => Math.round(value + (cb[index] - value) * ratio)).join(',')})`
}

function lightness(color: string) {
  const [r, g, b] = color.match(/\d+/g)!.map(Number)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/** 按一天中的小时数（可带小数）算天空颜色，夜里文字换成浅色。 */
export function skyAt(hours: number) {
  const h = mod(hours, 24)
  const index = SKY.findIndex((stop) => stop.at > h)
  const next = SKY[index]
  const prev = SKY[index - 1]
  const ratio = (h - prev.at) / (next.at - prev.at)
  const top = mix(prev.top, next.top, ratio)
  const bottom = mix(prev.bottom, next.bottom, ratio)
  const night = lightness(top) < 0.42
  const stars = h < 5 || h > 20 ? 1 : h < 6 ? 6 - h : h > 19 ? h - 19 : 0
  return { top, bottom, night, stars }
}

/** 太阳 6 点升起、18 点落下；月亮反过来。返回 0–1 的进度和是否白天。 */
export function celestialAt(hours: number) {
  const h = mod(hours, 24)
  const day = h >= 6 && h < 18
  const progress = day ? (h - 6) / 12 : (mod(h - 18, 24)) / 12
  return { day, progress }
}

function randomInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

export function randomQuizTime(level: Level, avoid?: ClockTime): ClockTime {
  for (;;) {
    const h = randomInt(1, 12)
    const m = level === 'easy' ? randomInt(0, 1) * 30 : level === 'medium' ? randomInt(0, 11) * 5 : randomInt(0, 59)
    if (!avoid || avoid.h !== h || avoid.m !== m) return { h, m }
  }
}

function sameTime(a: ClockTime, b: ClockTime) {
  return a.h === b.h && a.m === b.m
}

function wrapHour(h: number) {
  return mod(h - 1, 12) + 1
}

/** 看时间的四个选项：常见的读错方式（时针分针看反、时针看成下一格、分钟差一点）。 */
export function quizOptions(answer: ClockTime, level: Level) {
  const step = level === 'easy' ? 30 : level === 'medium' ? 5 : 1
  const pool: ClockTime[] = []
  if (answer.m % 5 === 0 && answer.m !== 0) pool.push({ h: answer.m / 5, m: (answer.h % 12) * 5 })
  pool.push({ h: wrapHour(answer.h + 1), m: answer.m })
  pool.push({ h: wrapHour(answer.h - 1), m: answer.m })
  pool.push({ h: answer.h, m: mod(answer.m + step * (level === 'hard' ? 5 : 1), 60) })
  pool.push({ h: answer.h, m: mod(answer.m - step * (level === 'hard' ? 5 : 1), 60) })
  pool.push({ h: answer.h, m: mod(answer.m + 30, 60) })
  const options: ClockTime[] = [answer]
  for (const item of pool.sort(() => Math.random() - 0.5)) {
    if (options.length >= 4) break
    if (!options.some((option) => sameTime(option, item))) options.push(item)
  }
  while (options.length < 4) {
    const item = randomQuizTime(level)
    if (!options.some((option) => sameTime(option, item))) options.push(item)
  }
  return options.sort(() => Math.random() - 0.5)
}
