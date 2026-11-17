import { SHEET_FOLLOW_NAME, SHEET_FOLLOW_PREFIX, SHEET_FOLLOW_SUFFIX, SHEET_PRACTICE, SHEET_TRACE } from './grades'
import { readingOfChar } from './readings'
import { strokesOf } from './strokes'

/** A4 比例的画布。1240×1754 约等于 150dpi，打印清晰，内存也扛得住。 */
export const PAGE_W = 1240
export const PAGE_H = 1754
export const MAX_PAGES = 8

export type GridStyle = 'tian' | 'mi' | 'line'

type PenGradient = { addColorStop: (offset: number, color: string) => void }

export type SheetOptions = {
  text: string
  style: GridStyle
  traceCount: number
  practiceCount: number
  columns: 1 | 2
  pinyin: boolean
  /** 临摹字的不透明度，0.1–0.8。 */
  alpha: number
}

export type SheetPen = {
  fillStyle: string | PenGradient
  strokeStyle: string
  lineWidth: number
  lineCap: CanvasLineCap
  lineJoin: CanvasLineJoin
  font: string
  textAlign: CanvasTextAlign
  textBaseline: CanvasTextBaseline
  setLineDash: (segments: number[]) => void
  fillRect: (x: number, y: number, w: number, h: number) => void
  strokeRect: (x: number, y: number, w: number, h: number) => void
  beginPath: () => void
  closePath: () => void
  moveTo: (x: number, y: number) => void
  lineTo: (x: number, y: number) => void
  arc: (x: number, y: number, radius: number, start: number, end: number, counterclockwise?: boolean) => void
  fill: () => void
  stroke: () => void
  fillText: (text: string, x: number, y: number) => void
  createLinearGradient: (x0: number, y0: number, x1: number, y1: number) => PenGradient
}

type CellBlock = {
  char: string
  reading: string
  x: number
  y: number
  cell: number
  perRow: number
  strokes: number[][][]
  headerH: number
  strokeBox: number
  strokePer: number
}

type LineBlock = {
  text: string
  trace: boolean
  x: number
  y: number
  width: number
  height: number
}

type BlankCell = { x: number; y: number; size: number; band: number }

export type SheetPage = {
  cells: CellBlock[]
  lines: LineBlock[]
  blanks: BlankCell[]
}

const MARGIN_X = 48
/** 页眉横线、页脚横线，以及正文离这两条线的相同间距。 */
const HEADER_RULE = 112
const FOOTER_GAP = 56
const CONTENT_GAP = 64
const MARGIN_TOP = HEADER_RULE + CONTENT_GAP
const MARGIN_BOTTOM = FOOTER_GAP + CONTENT_GAP
const CELL_GAP = 8
const COL_GAP = CELL_GAP
const ROW_GAP = 36
const ROW_SLOTS = 12
const PINYIN_H = 28
const MODEL = 70
const MODEL_GAP = 18
const READING_LEAD = 22
const CAPTION_H = 20
const BLANK_GAP = 14
const TRACE_GREEN = '#17824a'
/** 不加粗。楷体往往没有粗体，写上 700 会被换成黑体。 */
const KAI = 'STKaiti, "Kaiti SC", KaiTi, "\u6977\u4f53", "\u6977\u4f53_GB2312", "FZKai-Z03", serif'

function kaiFont(size: number) {
  return `${Math.round(size)}px ${KAI}`
}

function pinyinBand(cell: number, enabled: boolean) {
  return enabled ? Math.round(cell * 0.46) : 0
}
/** 和登录页同一份白色 U 标，画在橙色圆角底上。 */
const LOGO_PATH = 'M23.8 87.4l5.4 3 4.1 1.7 5.5 1.6 7.2 1.1 8 0 7-1.1 5.2-1.5 6.4-2.7 3.4-2.1zM10.5 75.4l3.2 3.9 3.3 3.1 65.8 0 3.2-2.9 3.3-3.9zM3.5 63.6l2.4 5.2 1.1 1.6 85.8 0 .9-1.3 2.6-5.3 0-.4zM49.9 15.3l-.2 2.3-1.5 6.6-.9 2.4-2 3-1.5 1.3-2.8 1.6-3.5 1.3-3.7 1 3.7 .7 3.5 1.3 2.8 1.6 2 2.1 1 1.3 1.4 3.5 1.5 6.5 .2 2.2 2-9.1 2.3-4.2 2.2-2.3 2.7-1.6 3.6-1.3 3.7-.7-6.9-2.1-2.9-1.6-2.3-2.1-1.6-2.6-.8-2zM80.8 0l-1.9 .9-.9 1.1-.4 1.1 0 40.5-.3 2.4-1 3.2-1.6 3.5-2.4 3.3-2.8 2.6 28.1 0 1.8-7 .6-5 0-43.6-.6-1.3-1.1-1.1-1.3-.6zM2.4 .2l-1.7 1.3-.7 1.6 0 43.7 .7 5.9 1.5 5.7 28.3 .2-3.1-3.1-2.1-3-1.5-3.1-1.1-4.1-.3-42.9-1.3-1.7-1.7-.7z'

function emptyPage(): SheetPage {
  return { cells: [], lines: [], blanks: [] }
}

function glyphs(text: string) {
  return Array.from(text).filter((char) => !/\s/u.test(char))
}

function isHanzi(char: string) {
  return /[\u3400-\u9fff]/.test(char)
}

function readingOf(char: string) {
  if (!isHanzi(char)) return ''
  return readingOfChar(char)
}

function contentWidth() {
  return PAGE_W - MARGIN_X * 2
}

function columnWidth(columns: number) {
  return (contentWidth() - (columns - 1) * COL_GAP) / columns
}

function slotsOf(options: SheetOptions) {
  return Math.max(1, options.traceCount + options.practiceCount)
}

/** 12 格正好铺满内容宽，双列时每列正好 6 格。 */
function pageCell() {
  const gaps = (ROW_SLOTS - 1) * CELL_GAP
  return Math.floor((contentWidth() - gaps) / ROW_SLOTS)
}

function perRow(cell: number, width: number) {
  return Math.max(1, Math.floor((width + CELL_GAP) / (cell + CELL_GAP)))
}

function textWidth(text: string, fontSize: number) {
  let width = 0
  for (const char of Array.from(text)) {
    const wide = isHanzi(char) || /[\u3000-\u303f\uff00-\uffef]/.test(char)
    width += wide ? fontSize : fontSize * 0.56
  }
  return width
}

function wrapParagraph(text: string, maxWidth: number, fontSize: number) {
  const lines: string[] = []
  for (const para of text.split(/\n/)) {
    const tokens = para.split(/(\s+)/).filter((token) => token && !/^\s+$/.test(token))
    if (!tokens.length) continue
    let line = ''
    const push = () => {
      if (line.trim()) lines.push(line.trimEnd())
      line = ''
    }
    for (const token of tokens) {
      const withSpace = line ? `${line} ${token}` : token
      if (textWidth(withSpace, fontSize) <= maxWidth) {
        line = withSpace
        continue
      }
      if (line) push()
      if (textWidth(token, fontSize) <= maxWidth) {
        line = token
        continue
      }
      for (const char of Array.from(token)) {
        if (line && textWidth(line + char, fontSize) > maxWidth) push()
        line += char
      }
    }
    push()
  }
  return lines
}

function strokeMetrics(count: number, width: number) {
  const gap = 6
  let box = 40
  const avail = Math.max(box, width - MODEL - 18)
  let across = Math.max(1, Math.floor((avail + gap) / (box + gap)))
  while (count > across * 3 && box > 30) {
    box -= 2
    across = Math.max(1, Math.floor((avail + gap) / (box + gap)))
  }
  const rows = Math.ceil(count / across)
  const rowH = box + 16
  return {
    box,
    per: across,
    height: rows * rowH + Math.max(0, rows - 1) * 6,
  }
}

function makeBlock(char: string, options: SheetOptions, width: number, cell: number, x: number): CellBlock {
  const hanzi = isHanzi(char)
  const strokes = hanzi ? strokesOf(char) : []
  const reading = options.pinyin ? readingOf(char) : ''
  const metrics = strokes.length ? strokeMetrics(strokes.length, width) : { box: 0, per: 1, height: 0 }
  const labelH = hanzi ? MODEL + (reading ? READING_LEAD : 0) : reading ? PINYIN_H : 0
  return {
    char,
    reading,
    x,
    y: 0,
    cell,
    perRow: perRow(cell, width),
    strokes,
    headerH: Math.max(labelH, metrics.height),
    strokeBox: metrics.box,
    strokePer: metrics.per,
  }
}

function blockHeight(block: CellBlock, slots: number, pinyin: boolean) {
  const rows = Math.ceil(slots / block.perRow)
  const lead = block.headerH + (isHanzi(block.char) ? MODEL_GAP : 0)
  return lead + rows * (pinyinBand(block.cell, pinyin) + block.cell + CAPTION_H)
}

function blankBandOf(options: SheetOptions, cell: number) {
  return pinyinBand(cell, options.pinyin && options.style !== 'line')
}

function fillOpenColumns(page: SheetPage, row: CellBlock[], options: SheetOptions) {
  if (!row.length || row.length >= options.columns) return
  const sample = row[0]
  const width = columnWidth(options.columns)
  const slots = slotsOf(options)
  const band = blankBandOf(options, sample.cell)
  const unit = band + sample.cell + CAPTION_H
  const top = sample.y + sample.headerH + (isHanzi(sample.char) ? MODEL_GAP : 0)
  const used = new Set(row.map((item) => item.x))
  for (let column = 0; column < options.columns; column += 1) {
    const x0 = MARGIN_X + column * (width + COL_GAP)
    if (used.has(x0)) continue
    for (let index = 0; index < slots; index += 1) {
      const col = index % sample.perRow
      const line = Math.floor(index / sample.perRow)
      page.blanks.push({
        x: x0 + col * (sample.cell + CELL_GAP),
        y: top + line * unit,
        size: sample.cell,
        band,
      })
    }
  }
}

function fillPageTail(page: SheetPage, y: number, options: SheetOptions) {
  const cell = pageCell()
  const band = blankBandOf(options, cell)
  const unit = band + cell
  const limit = PAGE_H - MARGIN_BOTTOM
  let cursor = y
  while (cursor + unit <= limit) {
    for (let col = 0; col < ROW_SLOTS; col += 1) {
      page.blanks.push({ x: MARGIN_X + col * (cell + CELL_GAP), y: cursor, size: cell, band })
    }
    cursor += unit + BLANK_GAP
  }
}

function layoutCells(options: SheetOptions): SheetPage[] {
  const chars = glyphs(options.text)
  if (!chars.length) return []
  const columns = options.columns
  const width = columnWidth(columns)
  const slots = slotsOf(options)
  const cell = pageCell()
  const limit = PAGE_H - MARGIN_BOTTOM
  const pages: SheetPage[] = []
  let page = emptyPage()
  let y = MARGIN_TOP
  let row: CellBlock[] = []
  let lastRow: CellBlock[] = []
  const flush = () => {
    if (!row.length) return
    const header = Math.max(...row.map((item) => item.headerH))
    for (const item of row) item.headerH = header
    const height = Math.max(...row.map((item) => blockHeight(item, slots, options.pinyin)))
    if (y + height > limit && page.cells.length) {
      fillPageTail(page, y, options)
      pages.push(page)
      page = emptyPage()
      y = MARGIN_TOP
    }
    for (const item of row) {
      item.y = y
      page.cells.push(item)
    }
    lastRow = row
    y += height + ROW_GAP
    row = []
  }
  chars.forEach((char, index) => {
    const column = index % columns
    const x = MARGIN_X + column * (width + COL_GAP)
    row.push(makeBlock(char, options, width, cell, x))
    if (row.length >= columns) flush()
  })
  flush()
  if (page.cells.length) {
    fillOpenColumns(page, lastRow, options)
    fillPageTail(page, y, options)
    pages.push(page)
  }
  return pages
}

function layoutLines(options: SheetOptions): SheetPage[] {
  const height = 78
  const fontSize = Math.round(height * 0.5)
  const columns = options.columns
  const width = columnWidth(columns)
  const wrapped = wrapParagraph(options.text, width - 20, fontSize)
  if (!wrapped.length) return []
  const staffs: Array<{ text: string; trace: boolean }> = []
  const traces = Math.max(0, options.traceCount)
  const practices = Math.max(0, options.practiceCount)
  const traceTimes = traces + practices > 0 ? traces : 1
  const practiceTimes = traces + practices > 0 ? practices : 0
  for (const line of wrapped) {
    for (let index = 0; index < traceTimes; index += 1) staffs.push({ text: line, trace: true })
    for (let index = 0; index < practiceTimes; index += 1) staffs.push({ text: line, trace: false })
  }
  const colH = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM
  const gap = 18
  const limit = PAGE_H - MARGIN_BOTTOM
  const pages: SheetPage[] = []
  let page = emptyPage()
  let col = 0
  let y = MARGIN_TOP
  const cursors = () => Array.from({ length: columns }, () => MARGIN_TOP)
  let columnY = cursors()
  const fillColumns = () => {
    for (let index = 0; index < columns; index += 1) {
      let cursor = columnY[index]
      while (cursor + height <= limit) {
        page.lines.push({ text: '', trace: false, x: MARGIN_X + index * (width + COL_GAP), y: cursor, width, height })
        cursor += height + gap
      }
    }
  }
  for (const staff of staffs) {
    if (y + height > MARGIN_TOP + colH) {
      col += 1
      y = MARGIN_TOP
      if (col >= columns) {
        pages.push(page)
        page = emptyPage()
        col = 0
        columnY = cursors()
      }
    }
    page.lines.push({
      text: staff.text,
      trace: staff.trace,
      x: MARGIN_X + col * (width + COL_GAP),
      y,
      width,
      height,
    })
    y += height + gap
    columnY[col] = y
  }
  if (page.lines.length) {
    fillColumns()
    pages.push(page)
  }
  return pages
}

function layoutBlanks(style: GridStyle, pinyin: boolean): SheetPage[] {
  if (style === 'line') return layoutBlankLines()
  const cell = pageCell()
  const band = pinyinBand(cell, pinyin)
  const unit = band + cell
  const limit = PAGE_H - MARGIN_BOTTOM
  const avail = limit - MARGIN_TOP
  const rows = Math.max(1, Math.floor((avail + BLANK_GAP) / (unit + BLANK_GAP)))
  const gap = rows > 1 ? (avail - rows * unit) / (rows - 1) : 0
  const page = emptyPage()
  for (let row = 0; row < rows; row += 1) {
    const y = MARGIN_TOP + row * (unit + gap)
    for (let col = 0; col < ROW_SLOTS; col += 1) {
      page.blanks.push({ x: MARGIN_X + col * (cell + CELL_GAP), y, size: cell, band })
    }
  }
  return [page]
}

function layoutBlankLines(): SheetPage[] {
  const height = 78
  const gap = 18
  const page = emptyPage()
  const width = contentWidth()
  for (let y = MARGIN_TOP; y + height <= PAGE_H - MARGIN_BOTTOM; y += height + gap) {
    page.lines.push({ text: '', trace: false, x: MARGIN_X, y, width, height })
  }
  return [page]
}

export function layoutSheet(options: SheetOptions) {
  const traceCount = clampCount(options.traceCount, 0, ROW_SLOTS)
  let practiceCount = clampCount(options.practiceCount, 0, ROW_SLOTS)
  if (traceCount + practiceCount > ROW_SLOTS) practiceCount = ROW_SLOTS - traceCount
  const sheet = {
    ...options,
    traceCount,
    practiceCount: traceCount + practiceCount < 1 ? 1 : practiceCount,
    columns: options.columns === 2 ? 2 : 1,
    alpha: Math.min(0.8, Math.max(0.1, options.alpha)),
    style: options.style === 'mi' || options.style === 'line' ? options.style : 'tian',
  } satisfies SheetOptions
  if (!glyphs(sheet.text).length) return layoutBlanks(sheet.style, sheet.pinyin && sheet.style !== 'line')
  return sheet.style === 'line' ? layoutLines(sheet) : layoutCells(sheet)
}

function clampCount(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value) || 0))
}

function rgba(hex: string, alpha: number) {
  const value = Number.parseInt(hex.slice(1), 16)
  const red = (value >> 16) & 255
  const green = (value >> 8) & 255
  const blue = value & 255
  return `rgba(${red},${green},${blue},${alpha})`
}

function drawGuides(pen: SheetPen, x: number, y: number, size: number, style: GridStyle) {
  pen.strokeStyle = '#7d8798'
  pen.lineWidth = 2
  pen.lineCap = 'butt'
  pen.setLineDash([])
  pen.strokeRect(x + 1, y + 1, size - 2, size - 2)
  pen.strokeStyle = '#b7c0ce'
  pen.lineWidth = 1.5
  pen.setLineDash([5, 5])
  if (style === 'tian' || style === 'mi') {
    pen.beginPath()
    pen.moveTo(x + size / 2, y + 3)
    pen.lineTo(x + size / 2, y + size - 3)
    pen.moveTo(x + 3, y + size / 2)
    pen.lineTo(x + size - 3, y + size / 2)
    pen.stroke()
  }
  if (style === 'mi') {
    pen.beginPath()
    pen.moveTo(x + 4, y + 4)
    pen.lineTo(x + size - 4, y + size - 4)
    pen.moveTo(x + size - 4, y + 4)
    pen.lineTo(x + 4, y + size - 4)
    pen.stroke()
  }
  pen.setLineDash([])
}

function drawCellChar(pen: SheetPen, char: string, x: number, y: number, size: number, color: string, alpha: number) {
  pen.font = kaiFont(size * 0.72)
  pen.fillStyle = rgba(color, alpha)
  pen.textAlign = 'center'
  pen.textBaseline = 'middle'
  pen.fillText(char, x + size / 2, y + size / 2)
}

function drawMedian(pen: SheetPen, points: number[][], x: number, y: number, size: number) {
  if (points.length < 2) return
  const pad = size * 0.16
  const inner = size - pad * 2
  pen.beginPath()
  points.forEach(([px, py], index) => {
    const sx = x + pad + (px / 255) * inner
    const sy = y + pad + ((255 - py) / 255) * inner
    if (index === 0) pen.moveTo(sx, sy)
    else pen.lineTo(sx, sy)
  })
  pen.stroke()
}

function drawStrokeHeader(pen: SheetPen, block: CellBlock) {
  if (!isHanzi(block.char)) {
    if (!block.reading) return
    pen.font = '600 18px sans-serif'
    pen.fillStyle = '#2a5bd7'
    pen.textAlign = 'left'
    pen.textBaseline = 'bottom'
    pen.fillText(block.reading, block.x, block.y + block.headerH - 4)
    return
  }
  const lead = block.reading ? READING_LEAD : 0
  if (block.reading) {
    pen.font = '600 15px sans-serif'
    pen.fillStyle = '#2a5bd7'
    pen.textAlign = 'center'
    pen.textBaseline = 'middle'
    pen.fillText(block.reading, block.x + MODEL / 2, block.y + READING_LEAD / 2)
  }
  pen.font = kaiFont(MODEL * 0.82)
  pen.fillStyle = '#1c2430'
  pen.textAlign = 'center'
  pen.textBaseline = 'middle'
  pen.fillText(block.char, block.x + MODEL / 2, block.y + lead + MODEL * 0.5)
  const box = block.strokeBox
  const gap = 5
  const originX = block.x + MODEL + 12
  block.strokes.forEach((_, strokeIndex) => {
    const col = strokeIndex % block.strokePer
    const row = Math.floor(strokeIndex / block.strokePer)
    const x = originX + col * (box + gap)
    const y = block.y + lead + row * (box + 22)
    pen.strokeStyle = '#d5dbe3'
    pen.lineWidth = 1
    pen.lineCap = 'butt'
    pen.setLineDash([])
    pen.strokeRect(x + 0.5, y + 0.5, box - 1, box - 1)
    for (let index = 0; index <= strokeIndex; index += 1) {
      const current = index === strokeIndex
      pen.strokeStyle = current ? '#243044' : '#b7c0cc'
      pen.lineWidth = current ? Math.max(1.7, box * 0.08) : Math.max(1.2, box * 0.055)
      pen.lineCap = 'round'
      pen.lineJoin = 'round'
      drawMedian(pen, block.strokes[index], x, y, box)
    }
    pen.font = '600 11px sans-serif'
    pen.fillStyle = '#98a2b3'
    pen.textAlign = 'center'
    pen.textBaseline = 'top'
    pen.fillText(String(strokeIndex + 1), x + box / 2, y + box + 1)
  })
}

function drawStaff(pen: SheetPen, block: LineBlock, color: string, alpha: number) {
  const inset = 4
  const top = block.y + inset
  const bottom = block.y + block.height - inset
  const span = bottom - top
  pen.strokeStyle = '#7d8798'
  pen.lineWidth = 1.6
  pen.lineCap = 'butt'
  pen.setLineDash([])
  pen.beginPath()
  pen.moveTo(block.x, top)
  pen.lineTo(block.x + block.width, top)
  pen.moveTo(block.x, bottom)
  pen.lineTo(block.x + block.width, bottom)
  pen.stroke()
  pen.strokeStyle = '#b7c0ce'
  pen.setLineDash([4, 4])
  pen.beginPath()
  pen.moveTo(block.x, top + span / 3)
  pen.lineTo(block.x + block.width, top + span / 3)
  pen.moveTo(block.x, top + (span * 2) / 3)
  pen.lineTo(block.x + block.width, top + (span * 2) / 3)
  pen.stroke()
  pen.setLineDash([])
  if (!block.trace || !block.text) return
  pen.font = kaiFont(block.height * 0.46)
  pen.fillStyle = rgba(color, alpha)
  pen.textAlign = 'left'
  pen.textBaseline = 'middle'
  pen.fillText(block.text, block.x + 10, (top + bottom) / 2)
}

function roundRect(pen: SheetPen, x: number, y: number, w: number, h: number, r: number) {
  pen.beginPath()
  pen.moveTo(x + r, y)
  pen.lineTo(x + w - r, y)
  pen.arc(x + w - r, y + r, r, -Math.PI / 2, 0)
  pen.lineTo(x + w, y + h - r)
  pen.arc(x + w - r, y + h - r, r, 0, Math.PI / 2)
  pen.lineTo(x + r, y + h)
  pen.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI)
  pen.lineTo(x, y + r)
  pen.arc(x + r, y + r, r, Math.PI, (Math.PI * 3) / 2)
  pen.closePath()
  pen.fill()
}

function drawLogoMark(pen: SheetPen, x: number, y: number, size: number) {
  const gradient = pen.createLinearGradient(x, y, x + size, y + size)
  gradient.addColorStop(0, '#ffb45c')
  gradient.addColorStop(0.48, '#ff7a45')
  gradient.addColorStop(1, '#f15a36')
  pen.fillStyle = gradient
  roundRect(pen, x, y, size, size, Math.round(size * (14 / 42)))
  const glyph = size * (22 / 42)
  const scale = glyph / 100
  const ox = x + (size - 100 * scale) / 2
  const oy = y + (size - 94.8 * scale) / 2
  const tokens = LOGO_PATH.match(/[MLmlzZ]|-?\d*\.?\d+/g) || []
  let index = 0
  let cx = 0
  let cy = 0
  let command = ''
  let drawing = false
  const place = (px: number, py: number) => [ox + px * scale, oy + py * scale] as const
  pen.beginPath()
  while (index < tokens.length) {
    const token = tokens[index]
    if (/[MLmlzZ]/.test(token)) {
      command = token
      index += 1
      if (command === 'z' || command === 'Z') pen.closePath()
      continue
    }
    const dx = Number(tokens[index])
    const dy = Number(tokens[index + 1])
    index += 2
    if (command === 'm' || command === 'l') {
      cx += dx
      cy += dy
    } else {
      cx = dx
      cy = dy
    }
    const [px, py] = place(cx, cy)
    if (command === 'M' || command === 'm') pen.moveTo(px, py)
    else pen.lineTo(px, py)
    if (command === 'M') command = 'L'
    if (command === 'm') command = 'l'
    drawing = true
  }
  if (!drawing) return
  pen.fillStyle = '#ffffff'
  pen.fill()
}

function drawBrand(pen: SheetPen, pageIndex: number, pageCount: number) {
  const x = MARGIN_X
  const y = 28
  const size = 44
  drawLogoMark(pen, x, y, size)
  pen.font = '800 28px sans-serif'
  pen.fillStyle = '#1c2430'
  pen.textAlign = 'left'
  pen.textBaseline = 'middle'
  pen.fillText('Uday', x + size + 12, y + size / 2 + 1)
  pen.font = '500 13px sans-serif'
  pen.fillStyle = '#98a2b3'
  pen.textAlign = 'left'
  pen.textBaseline = 'middle'
  pen.fillText('Plan Your Day. Grow Your Way.', x, y + size + 16)
  pen.strokeStyle = '#eceff3'
  pen.lineWidth = 1
  pen.lineCap = 'butt'
  pen.beginPath()
  pen.moveTo(MARGIN_X, HEADER_RULE)
  pen.lineTo(PAGE_W - MARGIN_X, HEADER_RULE)
  pen.moveTo(MARGIN_X, PAGE_H - FOOTER_GAP)
  pen.lineTo(PAGE_W - MARGIN_X, PAGE_H - FOOTER_GAP)
  pen.stroke()
  pen.font = '500 16px sans-serif'
  pen.fillStyle = '#98a2b3'
  pen.textAlign = 'right'
  pen.textBaseline = 'middle'
  pen.fillText(`${pageIndex + 1} / ${pageCount}`, PAGE_W - MARGIN_X, PAGE_H - 28)

  const prefix = SHEET_FOLLOW_PREFIX
  const name = SHEET_FOLLOW_NAME
  const suffix = SHEET_FOLLOW_SUFFIX
  const fontSize = 16
  const total = textWidth(prefix, fontSize) + textWidth(name, fontSize) + textWidth(suffix, fontSize)
  let cursor = PAGE_W / 2 - total / 2
  const lineY = PAGE_H - 28
  pen.textAlign = 'left'
  pen.textBaseline = 'middle'
  pen.font = `500 ${fontSize}px sans-serif`
  pen.fillStyle = '#98a2b3'
  pen.fillText(prefix, cursor, lineY)
  cursor += textWidth(prefix, fontSize)
  pen.font = `700 ${fontSize}px sans-serif`
  pen.fillStyle = '#ff7a45'
  pen.fillText(name, cursor, lineY)
  cursor += textWidth(name, fontSize)
  pen.font = `500 ${fontSize}px sans-serif`
  pen.fillStyle = '#98a2b3'
  pen.fillText(suffix, cursor, lineY)
}

function drawPinyinBand(pen: SheetPen, x: number, y: number, width: number, height: number, reading: string, trace: boolean, alpha: number) {
  pen.strokeStyle = '#7d8798'
  pen.lineWidth = 1.4
  pen.lineCap = 'butt'
  pen.setLineDash([])
  pen.strokeRect(x + 1, y + 1, width - 2, height - 2)
  const upper = y + height * 0.36
  const base = y + height * 0.7
  pen.strokeStyle = '#b7c0ce'
  pen.setLineDash([3, 3])
  pen.beginPath()
  pen.moveTo(x + 3, upper)
  pen.lineTo(x + width - 3, upper)
  pen.moveTo(x + 3, base)
  pen.lineTo(x + width - 3, base)
  pen.stroke()
  pen.setLineDash([])
  if (!trace || !reading) return
  pen.font = `600 ${Math.max(12, Math.round(height * 0.42))}px sans-serif`
  pen.fillStyle = rgba(TRACE_GREEN, alpha)
  pen.textAlign = 'center'
  pen.textBaseline = 'alphabetic'
  pen.fillText(reading, x + width / 2, base + 1)
}

export function drawSheet(pen: SheetPen, page: SheetPage, pageIndex: number, pageCount: number, options: SheetOptions) {
  const alpha = Math.min(0.8, Math.max(0.1, options.alpha))
  const traceCount = clampCount(options.traceCount, 0, ROW_SLOTS)
  const practiceCount = clampCount(options.practiceCount, 0, ROW_SLOTS)
  const slots = Math.max(1, traceCount + practiceCount)
  pen.fillStyle = '#ffffff'
  pen.fillRect(0, 0, PAGE_W, PAGE_H)
  const grid = options.style === 'line' ? 'tian' : options.style
  for (const blank of page.blanks) {
    if (blank.band) drawPinyinBand(pen, blank.x, blank.y, blank.size, blank.band, '', false, alpha)
    drawGuides(pen, blank.x, blank.y + blank.band, blank.size, grid)
  }
  for (const block of page.cells) {
    drawStrokeHeader(pen, block)
    const band = pinyinBand(block.cell, options.pinyin && options.style !== 'line')
    const unit = band + block.cell + CAPTION_H
    const top = block.y + block.headerH + (isHanzi(block.char) ? MODEL_GAP : 0)
    for (let index = 0; index < slots; index += 1) {
      const col = index % block.perRow
      const row = Math.floor(index / block.perRow)
      const x = block.x + col * (block.cell + CELL_GAP)
      const y = top + row * unit
      const trace = index < traceCount
      if (band) drawPinyinBand(pen, x, y, block.cell, band, block.reading, trace && Boolean(block.char), alpha)
      const squareY = y + band
      drawGuides(pen, x, squareY, block.cell, grid)
      if (trace && block.char) drawCellChar(pen, block.char, x, squareY, block.cell, TRACE_GREEN, alpha)
      pen.font = '500 12px sans-serif'
      pen.fillStyle = '#98a2b3'
      pen.textAlign = 'center'
      pen.textBaseline = 'top'
      pen.fillText(trace ? SHEET_TRACE : SHEET_PRACTICE, x + block.cell / 2, squareY + block.cell + 2)
    }
  }
  for (const block of page.lines) drawStaff(pen, block, TRACE_GREEN, alpha)
  drawBrand(pen, pageIndex, pageCount)
}
