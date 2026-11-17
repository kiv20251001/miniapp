import { contentWidth, drawBrand, MARGIN_BOTTOM, MARGIN_X, PAGE_H, PAGE_W, textWidth, type SheetPen } from '../print/sheet'
import { chainValue, type MixedItem } from './mixed'
import { bodyTop, drawTitle } from './render'

export const MIXED_PER_ROW = 3
const ROWS = 10

export type MixedOptions = { items: MixedItem[] }
export type MixedPage = { items: Array<{ item: MixedItem; x: number; y: number }> }

const INK = '#2b3340'
const LINE = '#5b6474'
const FONT = 40
const BOX_W = 76
const BOX_H = 56
const GAP = 10
const INSET = 28

export function mixedPerPage() {
  return ROWS * MIXED_PER_ROW
}

export function layoutMixed(options: MixedOptions): MixedPage[] {
  const pitch = (PAGE_H - MARGIN_BOTTOM - bodyTop()) / ROWS
  const colW = contentWidth() / MIXED_PER_ROW
  const pages: MixedPage[] = []
  options.items.forEach((item, index) => {
    const slot = index % mixedPerPage()
    if (slot === 0) pages.push({ items: [] })
    const row = Math.floor(slot / MIXED_PER_ROW)
    const col = slot % MIXED_PER_ROW
    pages[pages.length - 1].items.push({
      item,
      x: MARGIN_X + col * colW + INSET,
      y: bodyTop() + pitch * (row + 0.5),
    })
  })
  return pages
}

type Token = { text?: string; box?: true }

function tokens(item: MixedItem): Token[] {
  const list: Token[] = []
  item.nums.forEach((num, index) => {
    if (index > 0) list.push({ text: item.ops[index - 1] === '+' ? '+' : '−' })
    list.push(index === item.blank ? { box: true } : { text: String(num) })
  })
  list.push({ text: '=' })
  list.push(item.blank === item.nums.length ? { box: true } : { text: String(chainValue(item) ?? '') })
  return list
}

function drawItem(pen: SheetPen, item: MixedItem, x: number, y: number) {
  const list = tokens(item)
  const natural = list.reduce((sum, token) => sum + (token.box ? BOX_W : textWidth(token.text ?? '', FONT)), 0) + GAP * (list.length - 1)
  const room = contentWidth() / MIXED_PER_ROW - INSET * 1.5
  const scale = Math.min(1, room / natural)
  const font = FONT * scale
  const boxW = BOX_W * scale
  const boxH = BOX_H * scale
  pen.font = `500 ${Math.round(font)}px sans-serif`
  pen.fillStyle = INK
  pen.textAlign = 'left'
  pen.textBaseline = 'middle'
  pen.strokeStyle = LINE
  pen.lineWidth = 2
  pen.setLineDash([])
  let cursor = x
  for (const token of list) {
    if (token.box) {
      pen.strokeRect(cursor, y - boxH / 2, boxW, boxH)
      cursor += boxW + GAP * scale
    } else {
      const text = token.text ?? ''
      pen.fillText(text, cursor, y + 1)
      cursor += textWidth(text, font) + GAP * scale
    }
  }
}

export function drawMixedSheet(pen: SheetPen, page: MixedPage, pageIndex: number, pageCount: number) {
  pen.fillStyle = '#ffffff'
  pen.fillRect(0, 0, PAGE_W, PAGE_H)
  drawTitle(pen, 'mixed')
  for (const entry of page.items) drawItem(pen, entry.item, entry.x, entry.y)
  drawBrand(pen, pageIndex, pageCount)
}
