import { drawSheetPage, sheetBodyHeight, sheetBodyTop } from '../print/frame'
import { contentWidth, MARGIN_X, type SheetPen } from '../print/sheet'
import { drawYimu } from './brand'
import { CLOCK_SHEET_TITLE } from './labels'
import { formatSheetTime, type ClockItem, type PerRow } from './worksheet'

export const MAX_PAGES = 8

export type ClockSheetOptions = { items: ClockItem[]; perRow: PerRow; seconds: boolean }
export type ClockPage = { items: Array<{ item: ClockItem; cx: number; cy: number }> }

const INK = '#2b3340'
const LINE = '#5b6474'
const MIN_ROW_GAP = 32
/** 每行 2 / 3 / 4 个时分别排 3 / 3 / 4 行。 */
const CLOCK_SIZE: Record<PerRow, number> = { 2: 320, 3: 300, 4: 228 }

/** 一个钟和下面答题区的尺寸，都按表盘直径换算，和小程序里的 ClockFace 比例一致。 */
function metrics(perRow: PerRow) {
  const colW = contentWidth() / perRow
  const size = Math.min(CLOCK_SIZE[perRow], colW * 0.8)
  const answer = Math.max(56, size * 0.2)
  const gap = size * 0.08
  return { colW, size, answer, gap, height: size + gap + answer }
}

function rowsPerPage(perRow: PerRow) {
  const { height } = metrics(perRow)
  return Math.max(1, Math.floor((sheetBodyHeight() + MIN_ROW_GAP) / (height + MIN_ROW_GAP)))
}

export function clockPerPage(perRow: PerRow) {
  return rowsPerPage(perRow) * perRow
}

export function layoutClocks(options: ClockSheetOptions): ClockPage[] {
  const { colW, size, height } = metrics(options.perRow)
  const rows = rowsPerPage(options.perRow)
  const gap = rows > 1 ? (sheetBodyHeight() - rows * height) / (rows - 1) : 0
  const pages: ClockPage[] = []
  options.items.forEach((item, index) => {
    const slot = index % (rows * options.perRow)
    if (slot === 0) pages.push({ items: [] })
    const row = Math.floor(slot / options.perRow)
    const col = slot % options.perRow
    pages[pages.length - 1].items.push({
      item,
      cx: MARGIN_X + col * colW + colW / 2,
      cy: sheetBodyTop() + row * (height + gap) + size / 2,
    })
  })
  return pages
}

function circle(pen: SheetPen, cx: number, cy: number, radius: number) {
  pen.beginPath()
  pen.arc(cx, cy, radius, 0, Math.PI * 2)
  pen.closePath()
}

function hand(pen: SheetPen, cx: number, cy: number, degrees: number, length: number, width: number, color = INK) {
  const angle = (degrees * Math.PI) / 180
  pen.strokeStyle = color
  pen.lineWidth = width
  pen.lineCap = 'round'
  pen.setLineDash([])
  pen.beginPath()
  pen.moveTo(cx, cy)
  pen.lineTo(cx + Math.sin(angle) * length, cy - Math.cos(angle) * length)
  pen.stroke()
}

/** size 是外圈直径；画指针的题只留中心轴，让孩子自己画。 */
export function drawClockFace(pen: SheetPen, cx: number, cy: number, size: number, item: ClockItem, seconds: boolean) {
  const outer = size / 2
  const ring = gradientRing(pen, cx, cy, outer)
  pen.fillStyle = ring
  circle(pen, cx, cy, outer)
  pen.fill()
  pen.strokeStyle = '#e1e5ec'
  pen.lineWidth = 1.5
  pen.setLineDash([])
  pen.stroke()

  const dial = size * (1 - (26 / 560) * 2)
  const r = dial / 2
  pen.fillStyle = '#ffffff'
  circle(pen, cx, cy, r)
  pen.fill()
  pen.strokeStyle = '#dde1e9'
  pen.lineWidth = 1.5
  pen.stroke()

  pen.lineCap = 'round'
  for (let index = 0; index < 60; index += 1) {
    const major = index % 5 === 0
    const angle = (index * 6 * Math.PI) / 180
    const start = r - dial * 0.03
    const length = dial * (major ? 0.047 : 0.024)
    pen.strokeStyle = major ? INK : '#9aa1b2'
    pen.lineWidth = Math.max(1.2, dial * (major ? 0.012 : 0.006))
    pen.beginPath()
    pen.moveTo(cx + Math.sin(angle) * start, cy - Math.cos(angle) * start)
    pen.lineTo(cx + Math.sin(angle) * (start - length), cy - Math.cos(angle) * (start - length))
    pen.stroke()
  }

  pen.font = `700 ${Math.round(dial * 0.079)}px "Helvetica Neue", Helvetica, Arial, sans-serif`
  pen.fillStyle = INK
  pen.textAlign = 'center'
  pen.textBaseline = 'middle'
  for (let value = 1; value <= 12; value += 1) {
    const angle = (value * 30 * Math.PI) / 180
    pen.fillText(String(value), cx + Math.sin(angle) * dial * 0.365, cy - Math.cos(angle) * dial * 0.365 + 1)
  }

  drawYimu(pen, cx, cy - dial * 0.23, dial * 0.21, 'rgba(43, 51, 64, 0.78)')

  if (item.mode === 'read') {
    const { h, m, s } = item.time
    hand(pen, cx, cy, (h % 12) * 30 + m * 0.5 + s / 120, dial * 0.25, dial * 0.031)
    hand(pen, cx, cy, m * 6 + s * 0.1, dial * 0.37, dial * 0.02)
    if (seconds) hand(pen, cx, cy, s * 6, dial * 0.41, Math.max(1.5, dial * 0.008), '#f15a36')
  }
  pen.fillStyle = INK
  circle(pen, cx, cy, dial * 0.032)
  pen.fill()
  pen.fillStyle = '#f15a36'
  circle(pen, cx, cy, dial * 0.012)
  pen.fill()
}

function gradientRing(pen: SheetPen, cx: number, cy: number, outer: number) {
  const gradient = pen.createLinearGradient(cx - outer, cy - outer, cx + outer, cy + outer)
  gradient.addColorStop(0, '#ffffff')
  gradient.addColorStop(1, '#eceef4')
  return gradient
}

function colonDots(pen: SheetPen, cx: number, mid: number, boxH: number) {
  pen.fillStyle = INK
  circle(pen, cx, mid - boxH * 0.17, Math.max(2.5, boxH * 0.055))
  pen.fill()
  circle(pen, cx, mid + boxH * 0.17, Math.max(2.5, boxH * 0.055))
  pen.fill()
}

/** 填时间的题留「□:□」，带秒针时是「□:□:□」，整组不超过钟面宽度。 */
function drawAnswer(pen: SheetPen, item: ClockItem, cx: number, top: number, size: number, height: number, seconds: boolean) {
  const mid = top + height / 2
  if (item.mode === 'draw') {
    pen.font = `700 ${Math.round(Math.min(height * 0.8, size * 0.15))}px "Helvetica Neue", Helvetica, Arial, sans-serif`
    pen.fillStyle = '#1c2430'
    pen.textAlign = 'center'
    pen.textBaseline = 'middle'
    pen.fillText(formatSheetTime(item.time, seconds), cx, mid + 1)
    return
  }
  const boxes = seconds ? 3 : 2
  let boxH = height * 0.9
  let boxW = boxH * 1.25
  let colon = boxH * 0.8
  const natural = boxes * boxW + (boxes - 1) * colon
  const fit = Math.min(1, size / natural)
  boxH *= fit
  boxW *= fit
  colon *= fit
  pen.strokeStyle = LINE
  pen.lineWidth = 2
  pen.setLineDash([])
  let x = cx - (boxes * boxW + (boxes - 1) * colon) / 2
  for (let index = 0; index < boxes; index += 1) {
    pen.strokeRect(x, mid - boxH / 2, boxW, boxH)
    x += boxW
    if (index < boxes - 1) {
      colonDots(pen, x + colon / 2, mid, boxH)
      x += colon
    }
  }
}

export function drawClockSheet(pen: SheetPen, page: ClockPage, pageIndex: number, pageCount: number, options: Omit<ClockSheetOptions, 'items'>) {
  const { size, gap, answer } = metrics(options.perRow)
  drawSheetPage(pen, CLOCK_SHEET_TITLE, pageIndex, pageCount, () => {
    for (const { item, cx, cy } of page.items) {
      drawClockFace(pen, cx, cy, size, item, options.seconds)
      drawAnswer(pen, item, cx, cy + size / 2 + gap, size, answer, options.seconds)
    }
  })
}
