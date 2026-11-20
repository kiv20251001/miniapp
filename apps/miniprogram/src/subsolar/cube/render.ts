/**
 * 正方体练习题 A4 排版：每页 2 列 × 3 行，一格一道题。
 * 方块堆用等轴测画法（看得到上面、正面、左面），长方体用斜二测画法，看不见的棱画虚线。
 */
import { drawSheetPage, sheetBodyHeight, sheetBodyTop } from '@/print/frame'
import { contentWidth, MARGIN_X, roundRect, textWidth, type SheetPen } from '@/print/sheet'
import { netBounds, oppositeCell, paintCounts, edgeSum, surfaceArea, volume, stackSize, stackView, trimView, type Cell, type Stack, type ViewGrid } from './geometry'
import { CUBE_ANSWER_TITLE, CUBE_SHEET_TITLE, SHEET_TEXT } from './labels'
import type { SheetItem } from './worksheet'

export const PER_PAGE = 6
const COLS = 2
const ROWS = 3
const COL_GAP = 32
const ROW_GAP = 28
const INK = '#1c2430'
const MUTED = '#6b7385'
const LINE = '#c3c9d4'
const RED = '#e5492d'

type Rect = { x: number; y: number; w: number; h: number }

function cellRect(slot: number): Rect {
  const w = (contentWidth() - COL_GAP * (COLS - 1)) / COLS
  const h = (sheetBodyHeight() - ROW_GAP * (ROWS - 1)) / ROWS
  const col = slot % COLS
  const row = Math.floor(slot / COLS)
  return { x: MARGIN_X + col * (w + COL_GAP), y: sheetBodyTop() + row * (h + ROW_GAP), w, h }
}

/** 按估算宽度折行。 */
function wrap(text: string, size: number, width: number) {
  const lines: string[] = []
  let line = ''
  for (const char of Array.from(text)) {
    if (textWidth(line + char, size) > width && line) {
      lines.push(line)
      line = char
    } else line += char
  }
  if (line) lines.push(line)
  return lines
}

function text(pen: SheetPen, value: string, x: number, y: number, size: number, color = INK, align: CanvasTextAlign = 'left', weight = 500) {
  pen.font = `${weight} ${size}px sans-serif`
  pen.fillStyle = color
  pen.textAlign = align
  pen.textBaseline = 'middle'
  pen.fillText(value, x, y)
}

function line(pen: SheetPen, x1: number, y1: number, x2: number, y2: number, color = INK, width = 2, dash: number[] = []) {
  pen.strokeStyle = color
  pen.lineWidth = width
  pen.setLineDash(dash)
  pen.beginPath()
  pen.moveTo(x1, y1)
  pen.lineTo(x2, y2)
  pen.stroke()
  pen.setLineDash([])
}

function poly(pen: SheetPen, points: Array<[number, number]>, fill: string | null, stroke = INK, width = 2) {
  pen.beginPath()
  points.forEach(([x, y], index) => (index ? pen.lineTo(x, y) : pen.moveTo(x, y)))
  pen.closePath()
  if (fill) {
    pen.fillStyle = fill
    pen.fill()
  }
  pen.strokeStyle = stroke
  pen.lineWidth = width
  pen.setLineDash([])
  pen.stroke()
}

/** 答题横线，前面是提示字，后面是单位。返回横线右端。 */
function blank(pen: SheetPen, label: string, x: number, y: number, width: number, unit = '', size = 22) {
  text(pen, label, x, y, size, INK)
  const start = x + textWidth(label, size) + 8
  line(pen, start, y + 16, start + width, y + 16, LINE, 1.5)
  if (unit) text(pen, unit, start + width + 8, y, size, INK)
}

// ---- 展开图 ----

function drawNet(pen: SheetPen, cells: Cell[], cx: number, cy: number, maxW: number, maxH: number, letters?: string[] | null, maxUnit = 64) {
  const { minX, minY, cols, rows } = netBounds(cells)
  const unit = Math.min(maxUnit, maxW / cols, maxH / rows)
  const left = cx - (cols * unit) / 2
  const top = cy - (rows * unit) / 2
  cells.forEach(([x, y], index) => {
    const px = left + (x - minX) * unit
    const py = top + (y - minY) * unit
    pen.fillStyle = letters?.[index] === '★' ? '#fff1e8' : '#ffffff'
    pen.fillRect(px, py, unit, unit)
    pen.strokeStyle = INK
    pen.lineWidth = 2
    pen.setLineDash([])
    pen.strokeRect(px, py, unit, unit)
    const letter = letters?.[index]
    if (letter) text(pen, letter, px + unit / 2, py + unit / 2 + 1, unit * 0.48, letter === '★' ? RED : INK, 'center', 700)
  })
  return { bottom: top + rows * unit }
}

// ---- 方块堆（等轴测）----

const COS30 = Math.cos(Math.PI / 6)

function isoMetrics(stack: Stack, maxW: number, maxH: number, maxUnit = 46) {
  const { width, depth, height } = stackSize(stack)
  const unit = Math.min(maxUnit, maxW / ((width + depth) * COS30), maxH / (height + (width + depth) * 0.5))
  return { unit, w: (width + depth) * COS30 * unit, h: (height + (width + depth) * 0.5) * unit, width, depth, height }
}

/** 屏幕上 X = (x + z)·cos30，Y = (z − x)/2 − y：看得到上面、正面（+z）、左面（−x）。 */
function drawStack(pen: SheetPen, stack: Stack, cx: number, cy: number, maxW: number, maxH: number, maxUnit = 46, front = true) {
  const m = isoMetrics(stack, maxW, maxH, maxUnit)
  const s = m.unit
  const originX = cx - m.w / 2
  // 最高点在 x = width、z = 0、y = height
  const originY = cy - m.h / 2 + (m.height + m.width * 0.5) * s
  const p = (x: number, y: number, z: number): [number, number] => [originX + (x + z) * COS30 * s, originY + ((z - x) * 0.5 - y) * s]
  for (let x = m.width - 1; x >= 0; x -= 1) {
    for (let z = 0; z < m.depth; z += 1) {
      for (let y = 0; y < stack[z][x]; y += 1) {
        poly(pen, [p(x, y + 1, z), p(x + 1, y + 1, z), p(x + 1, y + 1, z + 1), p(x, y + 1, z + 1)], '#f1f3f7')
        poly(pen, [p(x, y, z + 1), p(x + 1, y, z + 1), p(x + 1, y + 1, z + 1), p(x, y + 1, z + 1)], '#ffffff')
        poly(pen, [p(x, y, z), p(x, y, z + 1), p(x, y + 1, z + 1), p(x, y + 1, z)], '#d9dee8')
      }
    }
  }
  if (front) {
    // 「正面」箭头：从正前方指向方块
    const [fx, fy] = p(m.width / 2, 0, m.depth)
    const ax = fx + 0.9 * COS30 * s
    const ay = fy + 0.9 * 0.5 * s
    line(pen, ax, ay, fx + 0.15 * COS30 * s, fy + 0.15 * 0.5 * s, RED, 2.5)
    const angle = Math.atan2(fy - ay, fx - ax)
    const tipX = fx + 0.15 * COS30 * s
    const tipY = fy + 0.15 * 0.5 * s
    poly(pen, [
      [tipX, tipY],
      [tipX - Math.cos(angle - 0.45) * 14, tipY - Math.sin(angle - 0.45) * 14],
      [tipX - Math.cos(angle + 0.45) * 14, tipY - Math.sin(angle + 0.45) * 14],
    ], RED, RED, 1)
    text(pen, SHEET_TEXT.front, ax + 6, ay + 14, 18, RED, 'left', 700)
  }
}

function drawGrid(pen: SheetPen, x: number, y: number, cols: number, rows: number, unit: number, fill?: ViewGrid) {
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const on = fill?.[r]?.[c]
      if (on) {
        pen.fillStyle = '#dbe9ff'
        pen.fillRect(x + c * unit, y + r * unit, unit, unit)
      }
    }
  }
  for (let r = 0; r <= rows; r += 1) line(pen, x, y + r * unit, x + cols * unit, y + r * unit, '#b7c0ce', 1, [4, 4])
  for (let c = 0; c <= cols; c += 1) line(pen, x + c * unit, y, x + c * unit, y + rows * unit, '#b7c0ce', 1, [4, 4])
  if (fill) {
    fill.forEach((row, r) => row.forEach((on, c) => {
      if (!on) return
      pen.strokeStyle = INK
      pen.lineWidth = 2
      pen.setLineDash([])
      pen.strokeRect(x + c * unit, y + r * unit, unit, unit)
    }))
  }
}

// ---- 长方体（斜二测）----

function drawBox(pen: SheetPen, [l, w, h]: [number, number, number], cx: number, cy: number, maxW: number, maxH: number, labels: [string, string, string] | null, paintN = 0) {
  const depth = 0.5
  const k = Math.min(maxW / (l + w * depth * Math.SQRT1_2), maxH / (h + w * depth * Math.SQRT1_2), 46)
  const L = l * k
  const H = h * k
  const dx = w * k * depth * Math.SQRT1_2
  const dy = -dx
  const x0 = cx - (L + dx) / 2
  const y0 = cy + (H - dy) / 2
  const A: [number, number] = [x0, y0]
  const B: [number, number] = [x0 + L, y0]
  const C: [number, number] = [x0 + L, y0 - H]
  const D: [number, number] = [x0, y0 - H]
  const off = (p: [number, number]): [number, number] => [p[0] + dx, p[1] + dy]
  const fill = paintN ? '#ffd9d0' : '#ffffff'
  poly(pen, [A, B, C, D], fill)
  poly(pen, [D, C, off(C), off(D)], paintN ? '#ffcabd' : '#f1f3f7')
  poly(pen, [B, off(B), off(C), C], paintN ? '#ffb9a8' : '#e3e7ef')
  // 看不见的三条棱
  line(pen, ...A, ...off(A), MUTED, 1.5, [8, 6])
  line(pen, ...off(A), ...off(B), MUTED, 1.5, [8, 6])
  line(pen, ...off(A), ...off(D), MUTED, 1.5, [8, 6])
  if (paintN) {
    for (let i = 1; i < paintN; i += 1) {
      const t = i / paintN
      line(pen, A[0] + L * t, A[1], D[0] + L * t, D[1], RED, 1.2)
      line(pen, A[0], A[1] - H * t, B[0], B[1] - H * t, RED, 1.2)
      line(pen, D[0] + L * t, D[1], D[0] + L * t + dx, D[1] + dy, RED, 1.2)
      line(pen, D[0] + dx * t, D[1] + dy * t, C[0] + dx * t, C[1] + dy * t, RED, 1.2)
      line(pen, B[0] + dx * t, B[1] + dy * t, C[0] + dx * t, C[1] + dy * t, RED, 1.2)
      line(pen, B[0], B[1] - H * t, B[0] + dx, B[1] - H * t + dy, RED, 1.2)
    }
    poly(pen, [A, B, C, D], null)
    poly(pen, [D, C, off(C), off(D)], null)
    poly(pen, [B, off(B), off(C), C], null)
  }
  if (labels) {
    text(pen, labels[0], (A[0] + B[0]) / 2, A[1] + 22, 20, INK, 'center')
    text(pen, labels[1], B[0] + dx / 2 + 12, B[1] + dy / 2 + 8, 20, INK, 'left')
    text(pen, labels[2], A[0] - 10, (A[1] + D[1]) / 2, 20, INK, 'right')
  }
}

// ---- 一道题 ----

function drawHeader(pen: SheetPen, rect: Rect, number: number, question: string) {
  pen.strokeStyle = '#e3e7ef'
  pen.lineWidth = 2
  pen.setLineDash([])
  pen.fillStyle = '#ffffff'
  roundRect(pen, rect.x, rect.y, rect.w, rect.h, 22)
  pen.stroke()
  pen.fillStyle = '#fff1e8'
  pen.beginPath()
  pen.arc(rect.x + 34, rect.y + 36, 18, 0, Math.PI * 2)
  pen.fill()
  text(pen, String(number), rect.x + 34, rect.y + 37, 20, '#e85b2a', 'center', 800)
  const lines = wrap(question, 22, rect.w - 84)
  lines.slice(0, 2).forEach((value, index) => text(pen, value, rect.x + 62, rect.y + 36 + index * 32, 22, INK))
  return rect.y + 36 + Math.min(2, lines.length) * 32
}

function drawItem(pen: SheetPen, item: SheetItem, rect: Rect, number: number) {
  const pad = 26
  const inner = { x: rect.x + pad, w: rect.w - pad * 2 }
  if (item.kind === 'net') {
    const top = drawHeader(pen, rect, number, SHEET_TEXT.net) + 6
    const bottom = rect.y + rect.h - 64
    const half = inner.w / 2
    item.nets.forEach((net, index) => {
      const cx = inner.x + half * index + half / 2
      drawNet(pen, net.cells, cx, (top + bottom) / 2, half - 30, bottom - top, null, 46)
      text(pen, '(        )', cx, rect.y + rect.h - 36, 22, INK, 'center')
    })
    return
  }
  if (item.kind === 'opposite') {
    const top = drawHeader(pen, rect, number, SHEET_TEXT.opposite) + 6
    const bottom = rect.y + rect.h - 70
    drawNet(pen, item.cells, rect.x + rect.w / 2, (top + bottom) / 2, inner.w, bottom - top, item.letters, 62)
    blank(pen, SHEET_TEXT.oppositeAnswer, inner.x, rect.y + rect.h - 40, 120)
    return
  }
  if (item.kind === 'count') {
    const top = drawHeader(pen, rect, number, SHEET_TEXT.count) + 4
    const bottom = rect.y + rect.h - 70
    drawStack(pen, item.stack, rect.x + rect.w / 2, (top + bottom) / 2, inner.w * 0.8, bottom - top - 10, 52, false)
    blank(pen, SHEET_TEXT.countAnswer, inner.x, rect.y + rect.h - 40, 120, SHEET_TEXT.countUnit)
    return
  }
  if (item.kind === 'views') {
    const top = drawHeader(pen, rect, number, SHEET_TEXT.views) + 4
    const gridUnit = 26
    const gridTop = rect.y + rect.h - 30 - gridUnit * 3
    drawStack(pen, item.stack, rect.x + rect.w / 2, (top + gridTop - 34) / 2, inner.w * 0.8, gridTop - 40 - top, 40, true)
    const labels = [SHEET_TEXT.front, SHEET_TEXT.top, SHEET_TEXT.left]
    const slot = inner.w / 3
    labels.forEach((label, index) => {
      const gx = inner.x + slot * index + (slot - gridUnit * 3) / 2
      text(pen, label, gx + (gridUnit * 3) / 2, gridTop - 16, 18, MUTED, 'center', 700)
      drawGrid(pen, gx, gridTop, 3, 3, gridUnit)
    })
    return
  }
  if (item.kind === 'calc') {
    const [l, w, h] = item.box
    const question = item.cube ? SHEET_TEXT.calcCube(l) : SHEET_TEXT.calcCuboid
    const top = drawHeader(pen, rect, number, question) + 8
    const bottom = rect.y + rect.h - 24
    const figW = inner.w * 0.5
    const labels: [string, string, string] | null = item.cube ? null : [`${l} cm`, `${w} cm`, `${h} cm`]
    drawBox(pen, item.box, inner.x + figW / 2 + 10, (top + bottom) / 2, figW - 50, bottom - top - 60, labels)
    const rows: Array<[string, string]> = [[SHEET_TEXT.edge, 'cm'], [SHEET_TEXT.area, 'cm²'], [SHEET_TEXT.volume, 'cm³']]
    const rowGap = Math.min(60, (bottom - top) / 3)
    rows.forEach(([label, unit], index) => blank(pen, `${label}：`, inner.x + figW + 6, top + 30 + index * rowGap, 96, unit, 20))
    return
  }
  const top = drawHeader(pen, rect, number, SHEET_TEXT.paint(item.n)) + 8
  const bottom = rect.y + rect.h - 24
  const figW = inner.w * 0.48
  drawBox(pen, [item.n, item.n, item.n], inner.x + figW / 2 + 6, (top + bottom) / 2, figW - 30, bottom - top - 30, null, item.n)
  const rows = [SHEET_TEXT.paint3, SHEET_TEXT.paint2, SHEET_TEXT.paint1, SHEET_TEXT.paint0]
  const rowGap = Math.min(52, (bottom - top) / 4)
  rows.forEach((label, index) => blank(pen, `${label}：`, inner.x + figW + 6, top + 24 + index * rowGap, 72, SHEET_TEXT.piece, 20))
}

// ---- 答案 ----

function answerLines(item: SheetItem): string[] {
  if (item.kind === 'net') return [item.nets.map((net, index) => `${index ? SHEET_TEXT.rightNet : SHEET_TEXT.leftNet} ${net.valid ? SHEET_TEXT.yes : SHEET_TEXT.no}`).join('    ')]
  if (item.kind === 'opposite') return [`★ — ${item.letters[oppositeCell(item.cells, item.star)]}`]
  if (item.kind === 'count') return [`${item.stack.flat().reduce((a, b) => a + b, 0)} ${SHEET_TEXT.countUnit}`]
  if (item.kind === 'calc') {
    return [`${SHEET_TEXT.edge} ${edgeSum(item.box)} cm`, `${SHEET_TEXT.area} ${surfaceArea(item.box)} cm²`, `${SHEET_TEXT.volume} ${volume(item.box)} cm³`]
  }
  if (item.kind === 'paint') {
    const [a, b, c, d] = paintCounts(item.n)
    return [`${SHEET_TEXT.paint3} ${a}  ${SHEET_TEXT.paint2} ${b}`, `${SHEET_TEXT.paint1} ${c}  ${SHEET_TEXT.paint0} ${d}`]
  }
  return []
}

const ANSWER_COLS = 3
const ANSWER_ROW_H = 150

export function answerPages(count: number) {
  const rows = Math.floor(sheetBodyHeight() / ANSWER_ROW_H)
  return Math.max(1, Math.ceil(count / (rows * ANSWER_COLS)))
}

function drawAnswers(pen: SheetPen, items: SheetItem[], start: number) {
  const colW = contentWidth() / ANSWER_COLS
  items.forEach((item, at) => {
    const index = start + at
    const x = MARGIN_X + (at % ANSWER_COLS) * colW
    const y = sheetBodyTop() + Math.floor(at / ANSWER_COLS) * ANSWER_ROW_H
    text(pen, `${index + 1}.`, x, y + 16, 22, '#e85b2a', 'left', 800)
    if (item.kind === 'views') {
      const unit = 18
      const views = (['front', 'top', 'left'] as const).map((view) => trimView(stackView(item.stack, view)))
      const labels = [SHEET_TEXT.front, SHEET_TEXT.top, SHEET_TEXT.left]
      let gx = x + 40
      views.forEach((grid, gi) => {
        text(pen, labels[gi], gx, y + 16, 16, MUTED, 'left', 700)
        drawGrid(pen, gx, y + 32, grid[0].length, grid.length, unit, grid)
        gx += Math.max(grid[0].length * unit, 34) + 22
      })
      return
    }
    answerLines(item).forEach((value, li) => text(pen, value, x + 40, y + 16 + li * 32, 20, INK))
  })
}

export type CubePage = { kind: 'questions'; items: SheetItem[]; start: number } | { kind: 'answers'; items: SheetItem[]; start: number }

export function layoutPages(items: SheetItem[], withAnswers: boolean): CubePage[] {
  const pages: CubePage[] = []
  for (let start = 0; start < items.length; start += PER_PAGE) pages.push({ kind: 'questions', items: items.slice(start, start + PER_PAGE), start })
  if (withAnswers) {
    const perAnswer = Math.floor(sheetBodyHeight() / ANSWER_ROW_H) * ANSWER_COLS
    for (let start = 0; start < items.length; start += perAnswer) pages.push({ kind: 'answers', items: items.slice(start, start + perAnswer), start })
  }
  return pages
}

export function drawCubePage(pen: SheetPen, page: CubePage, index: number, count: number) {
  const title = page.kind === 'answers' ? CUBE_ANSWER_TITLE : CUBE_SHEET_TITLE
  drawSheetPage(pen, title, index, count, () => {
    if (page.kind === 'answers') drawAnswers(pen, page.items, page.start)
    else page.items.forEach((item, slot) => drawItem(pen, item, cellRect(slot), page.start + slot + 1))
  })
}
