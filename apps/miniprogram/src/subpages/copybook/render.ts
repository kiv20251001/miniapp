import { readingOfChar } from './readings'
import { strokesOf } from './strokes'
import { KAI_FAMILY, kaiFontReady } from './font'
import {
  contentWidth,
  drawBrand,
  isHanzi,
  MARGIN_BOTTOM,
  MARGIN_TOP,
  MARGIN_X,
  PAGE_H,
  PAGE_W,
  textWidth,
  type SheetPen,
} from '../print/sheet'

export { PAGE_H, PAGE_W, type SheetPen } from '../print/sheet'
export const MAX_PAGES = 8

export type GridStyle = 'tian' | 'mi' | 'line'

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

/** 英文单词在四线格里的一次书写，x 相对这一行的左边。 */
type WordSlot = { x: number; text: string; model: boolean }

type LineBlock = {
  text: string
  trace: boolean
  x: number
  y: number
  width: number
  height: number
  words?: WordSlot[]
}

type StaffDraft = Pick<LineBlock, 'text' | 'trace' | 'words'>

type BlankCell = { x: number; y: number; size: number; band: number }

export type SheetPage = {
  cells: CellBlock[]
  lines: LineBlock[]
  blanks: BlankCell[]
}

const CELL_GAP = 8
const COL_GAP = CELL_GAP
const ROW_GAP = 36
const ROW_SLOTS = 12
const PINYIN_H = 28
const MODEL = 70
const MODEL_GAP = 18
const READING_LEAD = 22
/** 一个字的格子折成多行时，行与行之间的空隙。 */
const CELL_ROW_GAP = 8
const BLANK_GAP = 14
const TRACE_GREEN = '#17824a'
/** 不加粗。楷体往往没有粗体，写上 700 会被换成黑体。 */
const KAI = 'STKaiti, "Kaiti SC", KaiTi, "\u6977\u4f53", "\u6977\u4f53_GB2312", "FZKai-Z03", serif'

const LATIN = '"Helvetica Neue", Helvetica, Arial, sans-serif'
const STAFF_H = 78
const STAFF_GAP = 18
const STAFF_INSET = 4
const STAFF_PAD = 10

/** 手机画布对多字体列表支持不一，楷体加载好后只写这一个名字。 */
function kaiFont(size: number) {
  return `${Math.round(size)}px ${kaiFontReady() ? `"${KAI_FAMILY}"` : KAI}`
}

/** 小写字母正好占四线格的中间一格（x 高约 0.52 em）。 */
function latinSize(height: number) {
  return Math.round((height - STAFF_INSET * 2) / 3 / 0.52)
}

/**
 * 拼音四线三格：a、o、e 这类字母写满中格，b、d、l 出头到上格，g、p、y 伸到下格，
 * 声调写在上格。字号让 x 高正好等于中格。
 */
function pinyinSize(zone: number) {
  return Math.max(10, Math.round(zone / 0.52))
}

/** 没有汉字、有英文字母时按英文单词字帖排版。 */
export function isEnglishText(text: string) {
  return /[A-Za-z]/.test(text) && !Array.from(text).some(isHanzi)
}

/** 按空格和标点拆成单词，保留 don't、well-known 这类词内的符号。 */
export function englishWords(text: string) {
  return text
    .split(/[\s,，、;；:：.。!！?？"“”()（）[\]【】]+/)
    .map((word) => word.replace(/^['’-]+|['’-]+$/g, ''))
    .filter(Boolean)
}

function pinyinBand(cell: number, enabled: boolean) {
  return enabled ? Math.round(cell * 0.46) : 0
}
function emptyPage(): SheetPage {
  return { cells: [], lines: [], blanks: [] }
}

function glyphs(text: string) {
  return Array.from(text).filter((char) => !/\s/u.test(char))
}

function readingOf(char: string) {
  if (!isHanzi(char)) return ''
  return readingOfChar(char)
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
  return lead + rows * (pinyinBand(block.cell, pinyin) + block.cell + CELL_ROW_GAP) - CELL_ROW_GAP
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
  const unit = band + sample.cell + CELL_ROW_GAP
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

/**
 * 把几组四线格从上往下、从左列到右列排开。一组（同一句或同一个单词）能放进
 * 一列时不拆开；每页剩下的地方补空白四线格。
 */
function flowStaffs(groups: StaffDraft[][], columns: number): SheetPage[] {
  const width = columnWidth(columns)
  const limit = PAGE_H - MARGIN_BOTTOM
  const pages: SheetPage[] = []
  let page = emptyPage()
  let col = 0
  let y = MARGIN_TOP
  const cursors = () => Array.from({ length: columns }, () => MARGIN_TOP)
  let columnY = cursors()
  const nextColumn = () => {
    col += 1
    y = MARGIN_TOP
    if (col < columns) return
    pages.push(page)
    page = emptyPage()
    col = 0
    columnY = cursors()
  }
  for (const group of groups) {
    const groupH = group.length * (STAFF_H + STAFF_GAP) - STAFF_GAP
    if (y > MARGIN_TOP && y + groupH > limit && groupH <= limit - MARGIN_TOP) nextColumn()
    for (const staff of group) {
      if (y + STAFF_H > limit) nextColumn()
      page.lines.push({ ...staff, x: MARGIN_X + col * (width + COL_GAP), y, width, height: STAFF_H })
      y += STAFF_H + STAFF_GAP
      columnY[col] = y
    }
  }
  if (!page.lines.length) return pages
  for (let index = 0; index < columns; index += 1) {
    for (let cursor = columnY[index]; cursor + STAFF_H <= limit; cursor += STAFF_H + STAFF_GAP) {
      page.lines.push({ text: '', trace: false, x: MARGIN_X + index * (width + COL_GAP), y: cursor, width, height: STAFF_H })
    }
  }
  pages.push(page)
  return pages
}

function layoutLines(options: SheetOptions): SheetPage[] {
  const fontSize = Math.round(STAFF_H * 0.5)
  const wrapped = wrapParagraph(options.text, columnWidth(options.columns) - STAFF_PAD * 2, fontSize)
  if (!wrapped.length) return []
  const traces = Math.max(0, options.traceCount)
  const practices = Math.max(0, options.practiceCount)
  const traceTimes = traces + practices > 0 ? traces : 1
  const practiceTimes = traces + practices > 0 ? practices : 0
  const groups = wrapped.map((line) => [
    ...Array.from({ length: traceTimes }, () => ({ text: line, trace: true })),
    ...Array.from({ length: practiceTimes }, () => ({ text: line, trace: false })),
  ])
  return flowStaffs(groups, options.columns)
}

/** 双列时同一行左右各放一组，和田字格的双列一样按行排；每页剩下的地方补空白四线格。 */
function flowRows(groups: StaffDraft[][], columns: number): SheetPage[] {
  const width = columnWidth(columns)
  const limit = PAGE_H - MARGIN_BOTTOM
  const unit = STAFF_H + STAFF_GAP
  const pages: SheetPage[] = []
  let page = emptyPage()
  let y = MARGIN_TOP
  for (let start = 0; start < groups.length; start += columns) {
    const row = groups.slice(start, start + columns)
    const count = Math.max(...row.map((group) => group.length))
    if (y > MARGIN_TOP && y + count * unit - STAFF_GAP > limit) {
      pages.push(page)
      page = emptyPage()
      y = MARGIN_TOP
    }
    for (let line = 0; line < count; line += 1) {
      if (y + STAFF_H > limit) {
        pages.push(page)
        page = emptyPage()
        y = MARGIN_TOP
      }
      for (let col = 0; col < columns; col += 1) {
        const staff = row[col]?.[line] ?? { text: '', trace: false }
        page.lines.push({ ...staff, x: MARGIN_X + col * (width + COL_GAP), y, width, height: STAFF_H })
      }
      y += unit
    }
  }
  if (!page.lines.length) return pages
  for (; y + STAFF_H <= limit; y += unit) {
    for (let col = 0; col < columns; col += 1) {
      page.lines.push({ text: '', trace: false, x: MARGIN_X + col * (width + COL_GAP), y, width, height: STAFF_H })
    }
  }
  pages.push(page)
  return pages
}

/**
 * 英文单词字帖：每个单词另起一行，先写一遍深色范字，再写「临摹」次数的浅色描红，
 * 「书写」次数留出同样宽的空位；一行放不下就接着下一行。
 */
function layoutWords(options: SheetOptions): SheetPage[] {
  const words = englishWords(options.text)
  if (!words.length) return []
  const width = columnWidth(options.columns)
  const fontSize = latinSize(STAFF_H)
  const groups = words.map((word) => {
    const wordW = textWidth(word, fontSize)
    const step = wordW + fontSize * 0.9
    const count = 1 + options.traceCount + options.practiceCount
    const rows: WordSlot[][] = [[]]
    let used = 0
    let x = STAFF_PAD
    for (let index = 0; index < count; index += 1) {
      if (used > 0 && x + wordW > width - STAFF_PAD) {
        rows.push([])
        used = 0
        x = STAFF_PAD
      }
      if (index <= options.traceCount) rows[rows.length - 1].push({ x, text: word, model: index === 0 })
      used += 1
      x += step
    }
    return rows.map((slots) => ({ text: word, trace: slots.length > 0, words: slots }))
  })
  return flowRows(groups, options.columns)
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
  const page = emptyPage()
  const width = contentWidth()
  for (let y = MARGIN_TOP; y + STAFF_H <= PAGE_H - MARGIN_BOTTOM; y += STAFF_H + STAFF_GAP) {
    page.lines.push({ text: '', trace: false, x: MARGIN_X, y, width, height: STAFF_H })
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
  if (isEnglishText(sheet.text)) return layoutWords(sheet)
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
  const top = block.y + STAFF_INSET
  const bottom = block.y + block.height - STAFF_INSET
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
  if (block.words) {
    pen.font = `${latinSize(block.height)}px ${LATIN}`
    pen.textAlign = 'left'
    pen.textBaseline = 'alphabetic'
    for (const slot of block.words) {
      pen.fillStyle = slot.model ? '#1c2430' : rgba(color, alpha)
      pen.fillText(slot.text, block.x + slot.x, top + (span * 2) / 3)
    }
    return
  }
  if (!block.trace || !block.text) return
  pen.font = kaiFont(block.height * 0.46)
  pen.fillStyle = rgba(color, alpha)
  pen.textAlign = 'left'
  pen.textBaseline = 'middle'
  pen.fillText(block.text, block.x + STAFF_PAD, (top + bottom) / 2)
}

function drawPinyinBand(pen: SheetPen, x: number, y: number, width: number, height: number, reading: string, trace: boolean, alpha: number) {
  pen.strokeStyle = '#7d8798'
  pen.lineWidth = 1.4
  pen.lineCap = 'butt'
  pen.setLineDash([])
  pen.strokeRect(x + 1, y + 1, width - 2, height - 2)
  const zone = (height - 2) / 3
  const upper = y + 1 + zone
  const base = y + 1 + zone * 2
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
  let size = pinyinSize(zone)
  if (textWidth(reading, size) > width - 6) size = Math.floor(((width - 6) / textWidth(reading, size)) * size)
  pen.font = `500 ${size}px ${LATIN}`
  pen.fillStyle = rgba(TRACE_GREEN, alpha)
  pen.textAlign = 'center'
  pen.textBaseline = 'alphabetic'
  pen.fillText(reading, x + width / 2, base)
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
    const unit = band + block.cell + CELL_ROW_GAP
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
    }
  }
  for (const block of page.lines) drawStaff(pen, block, TRACE_GREEN, alpha)
  drawBrand(pen, pageIndex, pageCount)
}
