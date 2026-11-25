import { renderPages } from '@/print/export'
import { drawSheetPage, sheetBodyHeight, sheetBodyTop } from '@/print/frame'
import { contentWidth, MARGIN_X, textWidth, type SheetPen } from '@/print/sheet'
import { ANSWER_SUFFIX, PINYIN_SHEET_TITLES } from './labels'
import type { NasalItem, PieceKind, PinyinSheetKind, SheetWord } from './worksheet'

export const MAX_PAGES = 6

const INK = '#1c2430'
const RED = '#e5484d'
const LINE = '#9db0cf'
const GRID = '#7d8ba3'
const DASH = '#c9d1de'
const CELL = 104
const STRIP = 72
const PY_FONT = 40
const HAN_FONT = 64
const GAP_X = 46
const ROW_GAP = 46
const STACK_GAP = 10

type Piece = { kind: PieceKind; word?: SheetWord; nasal?: NasalItem; width: number; height: number }
type Placed = { piece: Piece; x: number; y: number }
export type PinyinSheetOptions = { kind: PinyinSheetKind; words: SheetWord[]; nasal: NasalItem[]; answers: boolean }

function pyWidth(text: string) {
  return textWidth(text, PY_FONT) + 16
}

/** 每个字占一格，拼音太长时这一格放宽，田字格仍在格子中间。 */
function slots(word: SheetWord) {
  return word.chars.map((_, index) => Math.max(CELL, pyWidth(word.marked[index])))
}

const NASAL_W = 280
const NASAL_H = CELL + 16 + 56

/** 随机题型：三种轮流出现、次序打乱，每种出现的次数最多差一个。 */
function mixedKinds(count: number): PieceKind[] {
  const out: PieceKind[] = []
  while (out.length < count) {
    const round: PieceKind[] = ['write', 'note', 'tone']
    for (let index = round.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1))
      ;[round[index], round[other]] = [round[other], round[index]]
    }
    out.push(...round)
  }
  return out.slice(0, count)
}

function pieces(options: PinyinSheetOptions): Piece[] {
  if (options.kind === 'nasal') return options.nasal.map((nasal) => ({ kind: 'nasal', nasal, width: NASAL_W, height: NASAL_H }))
  const kinds = options.kind === 'mixed' ? mixedKinds(options.words.length) : []
  return options.words.map((word, index) => ({
    kind: options.kind === 'mixed' ? kinds[index] : options.kind,
    word,
    width: Math.min(contentWidth(), slots(word).reduce((sum, value) => sum + value, 0)),
    height: STRIP + STACK_GAP + CELL,
  }))
}

export function layoutPinyin(options: PinyinSheetOptions): Placed[][] {
  const list = pieces(options)
  if (!list.length) return []
  const rowH = list[0].height
  const perPage = Math.max(1, Math.floor((sheetBodyHeight() + ROW_GAP) / (rowH + ROW_GAP)))
  const right = MARGIN_X + contentWidth()
  const pages: Placed[][] = [[]]
  let row = 0
  let x = MARGIN_X
  for (const piece of list) {
    if (x > MARGIN_X && x + piece.width > right) {
      row += 1
      x = MARGIN_X
    }
    if (row >= perPage) {
      pages.push([])
      row = 0
      x = MARGIN_X
    }
    pages[pages.length - 1].push({ piece, x, y: sheetBodyTop() + row * (rowH + ROW_GAP) })
    x += piece.width + GAP_X
  }
  return pages
}

/** 四线三格，拼音的中间部分写在第二格。 */
function drawStrip(pen: SheetPen, x: number, y: number, width: number) {
  pen.setLineDash([])
  pen.lineCap = 'butt'
  for (let index = 0; index < 4; index += 1) {
    pen.strokeStyle = index === 2 ? '#d98c8c' : LINE
    pen.lineWidth = index === 2 ? 1.8 : 1.4
    pen.beginPath()
    pen.moveTo(x, y + (STRIP / 3) * index)
    pen.lineTo(x + width, y + (STRIP / 3) * index)
    pen.stroke()
  }
}

function drawPinyin(pen: SheetPen, text: string, cx: number, y: number, color: string) {
  pen.font = `500 ${PY_FONT}px sans-serif`
  pen.fillStyle = color
  pen.textAlign = 'center'
  pen.textBaseline = 'alphabetic'
  pen.fillText(text, cx, y + (STRIP / 3) * 2)
}

/** 田字格：实线外框，虚线十字。 */
function drawTian(pen: SheetPen, x: number, y: number) {
  pen.setLineDash([8, 6])
  pen.strokeStyle = DASH
  pen.lineWidth = 1.4
  pen.beginPath()
  pen.moveTo(x + CELL / 2, y)
  pen.lineTo(x + CELL / 2, y + CELL)
  pen.moveTo(x, y + CELL / 2)
  pen.lineTo(x + CELL, y + CELL / 2)
  pen.stroke()
  pen.setLineDash([])
  pen.strokeStyle = GRID
  pen.lineWidth = 2
  pen.strokeRect(x, y, CELL, CELL)
}

function drawHan(pen: SheetPen, char: string, cx: number, cy: number, color: string) {
  pen.font = `500 ${HAN_FONT}px sans-serif`
  pen.fillStyle = color
  pen.textAlign = 'center'
  pen.textBaseline = 'middle'
  pen.fillText(char, cx, cy + 2)
}

function drawWord(pen: SheetPen, piece: Piece, x: number, y: number, answers: boolean) {
  const word = piece.word!
  drawStrip(pen, x, y, piece.width)
  const boxY = y + STRIP + STACK_GAP
  let left = x
  slots(word).forEach((width, index) => {
    const cx = left + width / 2
    if (piece.kind === 'write') {
      drawPinyin(pen, word.marked[index], cx, y, INK)
      drawTian(pen, cx - CELL / 2, boxY)
      if (answers) drawHan(pen, word.chars[index], cx, boxY + CELL / 2, RED)
    } else {
      if (piece.kind === 'tone') drawPinyin(pen, answers ? word.marked[index] : word.bare[index], cx, y, answers ? RED : INK)
      else if (answers) drawPinyin(pen, word.marked[index], cx, y, RED)
      drawHan(pen, word.chars[index], cx, boxY + CELL / 2, INK)
    }
    left += width
  })
}

function drawNasal(pen: SheetPen, piece: Piece, x: number, y: number, answers: boolean) {
  const item = piece.nasal!
  const cx = x + piece.width / 2
  drawTian(pen, cx - CELL / 2, y)
  drawHan(pen, item.char, cx, y + CELL / 2, INK)
  const optionY = y + CELL + 16 + 28
  const offset = piece.width / 4
  pen.font = `500 ${PY_FONT}px sans-serif`
  pen.textBaseline = 'middle'
  item.options.forEach((option, index) => {
    const ox = cx + (index === 0 ? -offset : offset)
    pen.fillStyle = INK
    pen.textAlign = 'center'
    pen.fillText(option, ox, optionY)
    if (answers && index === item.answer) {
      const rx = pyWidth(option) / 2 + 4
      pen.strokeStyle = RED
      pen.lineWidth = 3
      pen.setLineDash([])
      pen.beginPath()
      for (let step = 0; step <= 48; step += 1) {
        const angle = (step / 48) * Math.PI * 2
        const px = ox + Math.cos(angle) * rx
        const py = optionY + Math.sin(angle) * 30
        if (step === 0) pen.moveTo(px, py)
        else pen.lineTo(px, py)
      }
      pen.stroke()
    }
  })
  pen.fillStyle = '#b4bccb'
  pen.textAlign = 'center'
  pen.fillText('/', cx, optionY)
}

export function drawPinyinSheet(pen: SheetPen, kind: PinyinSheetKind, page: Placed[], answers: boolean, pageIndex: number, pageCount: number) {
  const title = PINYIN_SHEET_TITLES[kind] + (answers ? ANSWER_SUFFIX : '')
  drawSheetPage(pen, title, pageIndex, pageCount, () => {
    for (const { piece, x, y } of page) {
      if (piece.kind === 'nasal') drawNasal(pen, piece, x, y, answers)
      else drawWord(pen, piece, x, y, answers)
    }
  })
}

export function countPages(options: PinyinSheetOptions) {
  return layoutPinyin(options).length
}

export function renderPinyinFiles(options: PinyinSheetOptions) {
  const pages = layoutPinyin(options)
  const total = options.answers ? pages.length * 2 : pages.length
  return renderPages(total, (pen, index) => {
    const answers = index >= pages.length
    drawPinyinSheet(pen, options.kind, pages[index % pages.length], answers, index, total)
  })
}
