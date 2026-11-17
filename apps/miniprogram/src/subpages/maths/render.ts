import { SHEET_DATE_LABEL, SHEET_NAME_LABEL, SHEET_TIME_LABEL } from '../print/labels'
import { contentWidth, drawBrand, MARGIN_BOTTOM, MARGIN_TOP, MARGIN_X, PAGE_H, PAGE_W, textWidth, type SheetPen } from '../print/sheet'
import { SHEET_TITLES } from './labels'
import type { MathKind, Problem, TenKind } from './problems'

export const MAX_PAGES = 8
export const PER_ROW = 4

export type MathOptions = {
  kind: TenKind
  problems: Problem[]
  /** 用半透明红色写出要凑或要破的 10。 */
  hint: boolean
}

export type MathPage = { items: Array<{ problem: Problem; x: number; y: number }> }

const INK = '#2b3340'
const LINE = '#5b6474'
const HINT = 'rgba(226, 74, 74, 0.55)'
const BOX = 38
const ANSWER = 46
/** 一道题的宽度和高度，坐标以等式中线为 0。 */
const ITEM_W = 244
const ITEM_TOP = -ANSWER / 2
const ITEM_BOTTOM = 166
const ITEM_H = ITEM_BOTTOM - ITEM_TOP
const TITLE_H = 112
const MIN_ROW_GAP = 36

const X_A = 40
const X_OP = 86
const X_B = 130
const X_EQ = 176
const X_ANSWER = 196
const SPLIT_TOP = 52
const JOIN_Y = 114
const RESULT_TOP = 128

export function bodyTop() {
  return MARGIN_TOP + TITLE_H
}

function rowsPerPage() {
  const avail = PAGE_H - MARGIN_BOTTOM - bodyTop()
  return Math.max(1, Math.floor((avail + MIN_ROW_GAP) / (ITEM_H + MIN_ROW_GAP)))
}

export function perPage() {
  return rowsPerPage() * PER_ROW
}

export function layoutMath(options: MathOptions): MathPage[] {
  const rows = rowsPerPage()
  const avail = PAGE_H - MARGIN_BOTTOM - bodyTop()
  const gap = rows > 1 ? (avail - rows * ITEM_H) / (rows - 1) : 0
  const colW = contentWidth() / PER_ROW
  const inset = (colW - ITEM_W) / 2
  const pages: MathPage[] = []
  options.problems.forEach((problem, index) => {
    const slot = index % (rows * PER_ROW)
    if (slot === 0) pages.push({ items: [] })
    const row = Math.floor(slot / PER_ROW)
    const col = slot % PER_ROW
    pages[pages.length - 1].items.push({
      problem,
      x: MARGIN_X + col * colW + inset,
      y: bodyTop() + row * (ITEM_H + gap) - ITEM_TOP,
    })
  })
  return pages
}

function box(pen: SheetPen, cx: number, top: number, size: number, hint?: string) {
  pen.setLineDash([])
  pen.lineWidth = 2
  pen.strokeStyle = hint ? HINT : LINE
  pen.strokeRect(cx - size / 2, top, size, size)
  if (!hint) return
  pen.font = `600 ${Math.round(size * 0.56)}px sans-serif`
  pen.fillStyle = HINT
  pen.textAlign = 'center'
  pen.textBaseline = 'middle'
  pen.fillText(hint, cx, top + size / 2 + 1)
}

function line(pen: SheetPen, points: Array<[number, number]>) {
  pen.strokeStyle = LINE
  pen.lineWidth = 2
  pen.lineCap = 'round'
  pen.lineJoin = 'round'
  pen.setLineDash([])
  pen.beginPath()
  points.forEach(([px, py], index) => (index === 0 ? pen.moveTo(px, py) : pen.lineTo(px, py)))
  pen.stroke()
}

function sign(pen: SheetPen, text: string, x: number, y: number) {
  pen.font = '600 22px sans-serif'
  pen.fillStyle = INK
  pen.textAlign = 'center'
  pen.textBaseline = 'middle'
  pen.fillText(text, x, y)
}

/**
 * 被拆的数下面分出两个格；靠近另一个数的格和它连成第一步（凑十或 10 减几），
 * 另一个格再和第一步的结果连成第二步。
 */
function drawProblem(pen: SheetPen, kind: TenKind, problem: Problem, x: number, y: number, hint: boolean) {
  const { a, b, op } = problem
  pen.font = '500 36px sans-serif'
  pen.fillStyle = INK
  pen.textAlign = 'center'
  pen.textBaseline = 'middle'
  pen.fillText(String(a), x + X_A, y + 1)
  pen.fillText(op === '+' ? '+' : '−', x + X_OP, y + 1)
  pen.fillText(String(b), x + X_B, y + 1)
  pen.fillText('=', x + X_EQ, y + 1)
  pen.setLineDash([])
  pen.lineWidth = 2
  pen.strokeStyle = LINE
  pen.strokeRect(x + X_ANSWER, y - ANSWER / 2, ANSWER, ANSWER)

  const splitFirst = kind === 'break10' || a < b
  const splitX = x + (splitFirst ? X_A : X_B)
  const otherX = x + (splitFirst ? X_B : X_A)
  const leftX = splitX - 24
  const rightX = splitX + 24
  const partnerX = splitFirst ? rightX : leftX
  const restX = splitFirst ? leftX : rightX
  const boxTop = y + SPLIT_TOP
  const boxBottom = boxTop + BOX

  line(pen, [[leftX, boxTop], [splitX, y + 22], [rightX, boxTop]])
  box(pen, leftX, boxTop, BOX)
  box(pen, rightX, boxTop, BOX, kind === 'break10' && hint && partnerX === rightX ? '10' : undefined)

  const joinY = y + JOIN_Y
  const midX = (otherX + partnerX) / 2
  line(pen, [[otherX, y + 22], [otherX, joinY], [partnerX, joinY], [partnerX, boxBottom]])
  line(pen, [[midX, joinY], [midX, y + RESULT_TOP]])
  sign(pen, kind === 'make10' ? '+' : '−', midX, joinY - 14)
  box(pen, midX, y + RESULT_TOP, BOX, kind === 'make10' && hint ? '10' : undefined)

  const resultY = y + RESULT_TOP + BOX / 2
  const edgeX = restX < midX ? midX - BOX / 2 : midX + BOX / 2
  line(pen, [[restX, boxBottom], [restX, resultY], [edgeX, resultY]])
  sign(pen, '+', (restX + edgeX) / 2, resultY - 14)
}

export function drawTitle(pen: SheetPen, kind: MathKind) {
  pen.font = '700 34px sans-serif'
  pen.fillStyle = '#1c2430'
  pen.textAlign = 'center'
  pen.textBaseline = 'middle'
  pen.fillText(SHEET_TITLES[kind], PAGE_W / 2, MARGIN_TOP + 18)
  const fields = [SHEET_NAME_LABEL, SHEET_DATE_LABEL, SHEET_TIME_LABEL]
  const y = MARGIN_TOP + 72
  const slot = contentWidth() / fields.length
  pen.font = '500 20px sans-serif'
  pen.fillStyle = '#6b7385'
  pen.textAlign = 'left'
  pen.strokeStyle = '#c3c9d4'
  pen.lineWidth = 1.5
  pen.setLineDash([])
  fields.forEach((label, index) => {
    const left = MARGIN_X + index * slot + 40
    const text = `${label}：`
    pen.fillText(text, left, y)
    const start = left + textWidth(text, 20) + 4
    pen.beginPath()
    pen.moveTo(start, y + 14)
    pen.lineTo(start + 180, y + 14)
    pen.stroke()
  })
}

export function drawMathSheet(pen: SheetPen, page: MathPage, pageIndex: number, pageCount: number, options: MathOptions) {
  pen.fillStyle = '#ffffff'
  pen.fillRect(0, 0, PAGE_W, PAGE_H)
  drawTitle(pen, options.kind)
  for (const item of page.items) drawProblem(pen, options.kind, item.problem, item.x, item.y, options.hint)
  drawBrand(pen, pageIndex, pageCount)
}
