import { drawSheetPage, sheetBodyHeight, sheetBodyTop } from '../print/frame'
import { contentWidth, MARGIN_X, type SheetPen } from '../print/sheet'
import { PIZZA_SHEET_TITLE } from './labels'
import { TOPPINGS, crustWobble, inSlice } from './pizza-art'
import type { Fraction } from './fraction'
import { PER_ROW, type PizzaItem } from './worksheet'

export const MAX_PAGES = 8

export type PizzaSheetOptions = { items: PizzaItem[] }
export type PizzaPage = { items: Array<{ item: PizzaItem; cx: number; cy: number }> }

const INK = '#1c2430'
const CRUST = '#e39a4e'
const CHEESE = '#f7c873'
const PLATE = '#f6f1e8'
const PEPPERONI = '#e23b2f'
const PIZZA_SIZE = 250
const MIN_ROW_GAP = 28

function metrics() {
  const colW = contentWidth() / PER_ROW
  const size = Math.min(PIZZA_SIZE, colW * 0.82)
  const answer = Math.max(84, size * 0.28)
  const gap = size * 0.08
  return { colW, size, answer, gap, height: size + gap + answer }
}

function rowsPerPage() {
  const { height } = metrics()
  return Math.max(1, Math.floor((sheetBodyHeight() + MIN_ROW_GAP) / (height + MIN_ROW_GAP)))
}

export function pizzaPerPage() {
  return rowsPerPage() * PER_ROW
}

export function layoutPizzas(options: PizzaSheetOptions): PizzaPage[] {
  const { colW, size, height } = metrics()
  const rows = rowsPerPage()
  const gap = rows > 1 ? (sheetBodyHeight() - rows * height) / (rows - 1) : 0
  const pages: PizzaPage[] = []
  options.items.forEach((item, index) => {
    const slot = index % (rows * PER_ROW)
    if (slot === 0) pages.push({ items: [] })
    const row = Math.floor(slot / PER_ROW)
    const col = slot % PER_ROW
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

function wedge(pen: SheetPen, cx: number, cy: number, a0: number, a1: number, radius: number, apex: number) {
  const steps = Math.max(8, Math.ceil((a1 - a0) * 8))
  pen.beginPath()
  pen.moveTo(cx + Math.cos(a0) * apex, cy + Math.sin(a0) * apex)
  for (let index = 0; index <= steps; index += 1) {
    const angle = a0 + ((a1 - a0) * index) / steps
    const rr = radius * crustWobble(angle)
    pen.lineTo(cx + Math.cos(angle) * rr, cy + Math.sin(angle) * rr)
  }
  pen.closePath()
}

function pepperoni(pen: SheetPen, x: number, y: number, radius: number) {
  pen.fillStyle = PEPPERONI
  circle(pen, x, y, radius)
  pen.fill()
  pen.fillStyle = '#ffb0a4'
  circle(pen, x - radius * 0.28, y - radius * 0.3, radius * 0.18)
  pen.fill()
}

/** divided 为 false 时画一整块，让孩子自己画线涂色；为 true 时切开，涂色的块再向外拉开一点。 */
function drawPizza(pen: SheetPen, cx: number, cy: number, size: number, fraction: Fraction, divided: boolean) {
  const radius = size / 2
  pen.fillStyle = '#f6f1ea'
  circle(pen, cx, cy, radius * 1.08)
  pen.fill()
  if (!divided) {
    wedge(pen, cx, cy, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 - 0.001, radius, radius)
    pen.fillStyle = CRUST
    pen.fill()
    pen.fillStyle = '#c4472d'
    circle(pen, cx, cy, radius * 0.84)
    pen.fill()
    pen.fillStyle = CHEESE
    circle(pen, cx, cy, radius * 0.78)
    pen.fill()
    for (const topping of TOPPINGS) {
      const x = cx + Math.cos(topping.a) * radius * topping.r
      const y = cy + Math.sin(topping.a) * radius * topping.r
      if (topping.basil) {
        pen.fillStyle = '#2f9a4a'
        circle(pen, x, y, radius * topping.s * 0.7)
        pen.fill()
      } else pepperoni(pen, x, y, radius * topping.s)
    }
    return
  }
  const span = (Math.PI * 2) / fraction.den
  for (let index = 0; index < fraction.den; index += 1) {
    const a0 = -Math.PI / 2 + index * span
    const mid = a0 + span / 2
    const taken = index < fraction.num
    const out = radius * (0.045 + (taken ? 0.11 : 0))
    const ox = Math.cos(mid) * out
    const oy = Math.sin(mid) * out
    wedge(pen, cx + ox, cy + oy, a0, a0 + span, radius, radius * 0.06)
    pen.fillStyle = CRUST
    pen.fill()
    wedge(pen, cx + ox, cy + oy, a0 + 0.02, a0 + span - 0.02, radius * 0.8, radius * 0.1)
    pen.fillStyle = taken ? CHEESE : PLATE
    pen.fill()
    if (taken) {
      for (const topping of TOPPINGS) {
        if (!inSlice(topping.a, a0, span) || topping.basil) continue
        pepperoni(
          pen,
          cx + ox + Math.cos(topping.a) * radius * topping.r,
          cy + oy + Math.sin(topping.a) * radius * topping.r,
          radius * topping.s,
        )
      }
    }
    pen.strokeStyle = 'rgba(90, 42, 16, 0.55)'
    pen.lineWidth = Math.max(2, radius * 0.02)
    pen.lineCap = 'round'
    pen.setLineDash([])
    pen.beginPath()
    pen.moveTo(cx + ox + Math.cos(a0) * radius * 0.14, cy + oy + Math.sin(a0) * radius * 0.14)
    pen.lineTo(cx + ox + Math.cos(a0) * radius * 0.96, cy + oy + Math.sin(a0) * radius * 0.96)
    pen.moveTo(cx + ox + Math.cos(a0 + span) * radius * 0.14, cy + oy + Math.sin(a0 + span) * radius * 0.14)
    pen.lineTo(cx + ox + Math.cos(a0 + span) * radius * 0.96, cy + oy + Math.sin(a0 + span) * radius * 0.96)
    pen.stroke()
  }
}

/** 0 到 1 的空线段，只画两端，分几份、涂到哪由孩子看着分数自己画。 */
function drawNumberLine(pen: SheetPen, cx: number, cy: number, width: number) {
  const left = cx - width / 2
  const right = cx + width / 2
  const tick = 14
  pen.setLineDash([])
  pen.strokeStyle = INK
  pen.lineCap = 'round'
  pen.lineWidth = 3
  pen.beginPath()
  pen.moveTo(left, cy)
  pen.lineTo(right, cy)
  pen.stroke()
  pen.lineWidth = 2.4
  for (const x of [left, right]) {
    pen.beginPath()
    pen.moveTo(x, cy - tick)
    pen.lineTo(x, cy + tick)
    pen.stroke()
  }
  pen.font = '700 26px sans-serif'
  pen.fillStyle = INK
  pen.textAlign = 'center'
  pen.textBaseline = 'top'
  pen.fillText('0', left, cy + tick + 8)
  pen.fillText('1', right, cy + tick + 8)
}

/** 和屏幕上同一套写法：分子在上，分母在下。看图写分数时两个格子留空。 */
function drawAnswer(pen: SheetPen, item: PizzaItem, cx: number, top: number, width: number, height: number) {
  const font = Math.round(Math.min(height * 0.32, 34))
  const tag = Math.round(font * 0.48)
  const yNum = top + height * 0.28
  const yDen = top + height * 0.74
  const numberX = cx + tag * 0.35
  pen.setLineDash([])
  pen.textBaseline = 'middle'
  pen.font = `600 ${tag}px sans-serif`
  pen.fillStyle = '#8a93a3'
  pen.textAlign = 'right'
  pen.fillText('分子', numberX - font * 0.85, yNum)
  pen.fillText('分母', numberX - font * 0.85, yDen)
  const line = Math.min(font * 1.5, width * 0.34)
  pen.strokeStyle = INK
  pen.lineWidth = 2.2
  pen.beginPath()
  pen.moveTo(numberX - line / 2, (yNum + yDen) / 2)
  pen.lineTo(numberX + line / 2, (yNum + yDen) / 2)
  pen.stroke()
  const slot = (text: string | null, y: number) => {
    if (text) {
      pen.font = `700 ${font}px sans-serif`
      pen.fillStyle = INK
      pen.textAlign = 'center'
      pen.fillText(text, numberX, y)
      return
    }
    const box = font * 1.15
    pen.strokeStyle = '#5b6474'
    pen.lineWidth = 1.6
    pen.strokeRect(numberX - box / 2, y - box * 0.42, box, box * 0.84)
  }
  if (item.mode === 'line') {
    slot(String(item.fraction.num), yNum)
    slot(String(item.fraction.den), yDen)
  } else {
    slot(null, yNum)
    slot(null, yDen)
  }
}

export function drawPizzaSheet(pen: SheetPen, page: PizzaPage, pageIndex: number, pageCount: number) {
  const { colW, size, gap, answer } = metrics()
  drawSheetPage(pen, PIZZA_SHEET_TITLE, pageIndex, pageCount, () => {
    for (const { item, cx, cy } of page.items) {
      if (item.mode === 'line') drawNumberLine(pen, cx, cy, Math.min(size * 1.15, colW * 0.78))
      else drawPizza(pen, cx, cy, size, item.fraction, true)
      drawAnswer(pen, item, cx, cy + size / 2 + gap, size * 1.3, answer)
    }
  })
}
