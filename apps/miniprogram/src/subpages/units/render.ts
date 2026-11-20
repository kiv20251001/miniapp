/**
 * 单位换算练习题 A4 排版：每页按题型分段，每段两列；量一量画一把厘米尺和一根彩条。
 * 答案页按页、按段列出，放不下就接着下一页。
 */
import { drawSheetPage, sheetBodyHeight, sheetBodyTop } from '@/print/frame'
import { contentWidth, MARGIN_X, textWidth, type SheetPen } from '@/print/sheet'
import { SECTION_NUMBERS, SHEET_SECTIONS, SHEET_TEXT, UNITS_ANSWER_TITLE, UNITS_SHEET_TITLE } from './labels'
import { formatParts, unitName, type Part } from './units'
import { buildSection, type RulerItem, type SheetKind, type SheetSection } from './worksheet'
import type { CompareQuestion, ConvertQuestion, Level, UnitQuestion } from './quiz'

const INK = '#1c2430'
const MUTED = '#6b7385'
const LINE = '#c3c9d4'
const ACCENT = '#e85b2a'
const HEAD_H = 64
const SECTION_GAP = 30
const COL_GAP = 40
const ROW_H: Record<SheetKind, number> = { convert: 76, compare: 76, unit: 76, ruler: 220 }
const FONT = 26

const zh = (parts: Part[]) => formatParts(parts, false)

function text(pen: SheetPen, value: string, x: number, y: number, size = FONT, color = INK, align: CanvasTextAlign = 'left', weight = 500) {
  pen.font = `${weight} ${size}px sans-serif`
  pen.fillStyle = color
  pen.textAlign = align
  pen.textBaseline = 'middle'
  pen.fillText(value, x, y)
  return x + textWidth(value, size)
}

function line(pen: SheetPen, x1: number, y1: number, x2: number, y2: number, color = INK, width = 2) {
  pen.strokeStyle = color
  pen.lineWidth = width
  pen.setLineDash([])
  pen.beginPath()
  pen.moveTo(x1, y1)
  pen.lineTo(x2, y2)
  pen.stroke()
}

/** 横线空，返回右端 */
function blank(pen: SheetPen, x: number, y: number, width: number) {
  line(pen, x + 4, y + 18, x + width - 4, y + 18, LINE, 1.6)
  return x + width
}

/** （    ）空，返回右端 */
function bracket(pen: SheetPen, x: number, y: number, inner = 80) {
  const left = text(pen, '（', x, y)
  return text(pen, '）', left + inner, y)
}

function columnWidth() {
  return (contentWidth() - COL_GAP) / 2
}

// ---- 每种题 ----

/** 一行放不下时整体缩小字号，最小 20 */
function fit(width: number, maxW: number) {
  return Math.max(20, Math.min(FONT, Math.floor((FONT * maxW) / width)))
}

function drawConvert(pen: SheetPen, item: ConvertQuestion, x: number, y: number, maxW: number) {
  const head = `${zh(item.given)} = `
  const units = item.target.map((unit) => ` ${unitName(unit, false)} `)
  const size = fit(textWidth(head, FONT) + units.reduce((sum, unit) => sum + textWidth(unit, FONT), 0) + 110 * units.length, maxW)
  let cursor = text(pen, head, x, y, size)
  units.forEach((unit) => {
    cursor = blank(pen, cursor, y, (110 * size) / FONT)
    cursor = text(pen, unit, cursor, y, size)
  })
}

function drawCompare(pen: SheetPen, item: CompareQuestion, x: number, y: number, maxW: number) {
  const left = zh(item.left)
  const right = zh(item.right)
  const size = fit(textWidth(left, FONT) + textWidth(right, FONT) + 68, maxW)
  const end = text(pen, left, x, y, size)
  const cx = end + 34
  pen.strokeStyle = INK
  pen.lineWidth = 2
  pen.beginPath()
  pen.arc(cx, y, 18, 0, Math.PI * 2)
  pen.stroke()
  text(pen, right, cx + 34, y, size)
}

function drawUnit(pen: SheetPen, item: UnitQuestion, x: number, y: number, maxW: number) {
  const head = `${item.fact.text.zh} ${item.fact.value}`
  const size = fit(textWidth(head, FONT) + 4 + FONT * 2 + 96, maxW)
  const end = text(pen, head, x, y, size)
  const left = text(pen, '（', end + 4, y, size)
  text(pen, '）', left + 96, y, size)
}

/** 厘米尺：8 厘米，每毫米一格 */
function drawRuler(pen: SheetPen, item: RulerItem, x: number, y: number, width: number) {
  const cms = 8
  const unit = Math.min(62, (width - 30) / cms)
  const left = x + 12
  const barTop = y + 6
  // 彩条（像一根蜡笔）
  const length = (item.mm / 10) * unit
  pen.fillStyle = '#ffd9c8'
  pen.fillRect(left, barTop, length, 26)
  pen.strokeStyle = ACCENT
  pen.lineWidth = 2
  pen.setLineDash([])
  pen.strokeRect(left, barTop, length, 26)
  const rulerTop = barTop + 40
  pen.fillStyle = '#fbfcfe'
  pen.fillRect(left - 10, rulerTop, cms * unit + 20, 64)
  pen.strokeStyle = INK
  pen.strokeRect(left - 10, rulerTop, cms * unit + 20, 64)
  for (let mm = 0; mm <= cms * 10; mm += 1) {
    const px = left + (mm / 10) * unit
    const tall = mm % 10 === 0 ? 26 : mm % 5 === 0 ? 18 : 11
    line(pen, px, rulerTop, px, rulerTop + tall, INK, mm % 10 === 0 ? 2 : 1.2)
    if (mm % 10 === 0) text(pen, String(mm / 10), px, rulerTop + 44, 20, INK, 'center', 600)
  }
  text(pen, 'cm', left + cms * unit + 2, rulerTop + 44, 16, MUTED, 'right')
  // 彩条左端对齐 0 刻度的虚线
  pen.strokeStyle = ACCENT
  pen.lineWidth = 1.2
  pen.setLineDash([5, 4])
  pen.beginPath()
  pen.moveTo(left, barTop)
  pen.lineTo(left, rulerTop)
  pen.moveTo(left + length, barTop)
  pen.lineTo(left + length, rulerTop)
  pen.stroke()
  pen.setLineDash([])
  const ay = rulerTop + 104
  let cursor = bracket(pen, x, ay, 64)
  cursor = text(pen, SHEET_TEXT.cm, cursor, ay)
  if (item.ask === 'cm') return
  cursor = bracket(pen, cursor + 4, ay, 64)
  cursor = text(pen, SHEET_TEXT.mm, cursor, ay)
  if (item.ask === 'cmmm') return
  cursor = text(pen, ' = ', cursor, ay)
  cursor = bracket(pen, cursor, ay, 64)
  text(pen, SHEET_TEXT.mm, cursor, ay)
}

// ---- 一页 ----

export type QuestionPage = { kind: 'questions'; sections: SheetSection[] }
type AnswerLine = { kind: 'head'; text: string } | { kind: 'row'; cells: string[]; cols: number }
export type AnswerPage = { kind: 'answers'; lines: AnswerLine[] }
export type UnitsPage = QuestionPage | AnswerPage

/** 每段平分正文高度，算出这一段放几题（两列） */
function sectionCounts(kinds: SheetKind[]) {
  const height = (sheetBodyHeight() - SECTION_GAP * (kinds.length - 1)) / kinds.length
  return kinds.map((kind) => Math.max(1, Math.floor((height - HEAD_H) / ROW_H[kind])) * 2)
}

export function buildPages(kinds: SheetKind[], level: Level, pages: number): QuestionPage[] {
  const order = (['convert', 'compare', 'unit', 'ruler'] as SheetKind[]).filter((kind) => kinds.includes(kind))
  const counts = sectionCounts(order)
  return Array.from({ length: pages }, () => ({ kind: 'questions', sections: order.map((kind, index) => buildSection(kind, level, counts[index])) }))
}

function drawQuestions(pen: SheetPen, page: QuestionPage) {
  const order = page.sections.map((section) => section.kind)
  const height = (sheetBodyHeight() - SECTION_GAP * (order.length - 1)) / order.length
  const colW = columnWidth()
  page.sections.forEach((section, index) => {
    const top = sheetBodyTop() + index * (height + SECTION_GAP)
    text(pen, `${SECTION_NUMBERS[index]}、${SHEET_SECTIONS[section.kind]}`, MARGIN_X, top + 22, 28, INK, 'left', 750)
    line(pen, MARGIN_X, top + 46, MARGIN_X + contentWidth(), top + 46, '#eceff3', 1.5)
    section.items.forEach((item, at) => {
      const col = at % 2
      const row = Math.floor(at / 2)
      const x = MARGIN_X + col * (colW + COL_GAP)
      const y = top + HEAD_H + row * ROW_H[section.kind] + (section.kind === 'ruler' ? 0 : ROW_H[section.kind] / 2)
      const label = `${at + 1}.`
      text(pen, label, x, section.kind === 'ruler' ? y + 20 : y, 22, ACCENT, 'left', 800)
      const ix = x + 44
      if (section.kind === 'convert') drawConvert(pen, item as ConvertQuestion, ix, y, colW - 44)
      else if (section.kind === 'compare') drawCompare(pen, item as CompareQuestion, ix, y, colW - 44)
      else if (section.kind === 'unit') drawUnit(pen, item as UnitQuestion, ix, y, colW - 44)
      else drawRuler(pen, item as RulerItem, ix, y, colW - 44)
    })
  })
}

// ---- 答案 ----

function answerOf(section: SheetSection, at: number) {
  if (section.kind === 'convert') return section.items[at].answer.map((part) => String(part.value)).join(section.items[at].answer.length > 1 ? '，' : '')
  if (section.kind === 'compare') return section.items[at].answer
  if (section.kind === 'unit') return unitName(section.items[at].fact.unit, false)
  const { mm, ask } = section.items[at]
  const cm = Math.floor(mm / 10)
  const rest = mm % 10
  if (ask === 'cm') return `${cm} ${SHEET_TEXT.cm}`
  if (ask === 'cmmm') return `${cm} ${SHEET_TEXT.cm} ${rest} ${SHEET_TEXT.mm}`
  return `${cm}，${rest}，${mm}`
}

const ANSWER_ROW = 46
const ANSWER_COLS = 4

export function answerPages(pages: QuestionPage[]): AnswerPage[] {
  const lines: AnswerLine[] = []
  pages.forEach((page, pageIndex) => {
    if (pages.length > 1) lines.push({ kind: 'head', text: SHEET_TEXT.page(pageIndex + 1) })
    page.sections.forEach((section, index) => {
      const cells = section.items.map((_, at) => `${at + 1}. ${answerOf(section, at)}`)
      const cols = section.kind === 'ruler' ? 2 : ANSWER_COLS
      lines.push({ kind: 'head', text: `${SECTION_NUMBERS[index]}、${SHEET_SECTIONS[section.kind]}` })
      for (let start = 0; start < cells.length; start += cols) lines.push({ kind: 'row', cells: cells.slice(start, start + cols), cols })
    })
  })
  const perPage = Math.floor(sheetBodyHeight() / ANSWER_ROW)
  const out: AnswerPage[] = []
  for (let start = 0; start < lines.length; start += perPage) out.push({ kind: 'answers', lines: lines.slice(start, start + perPage) })
  return out
}

function drawAnswers(pen: SheetPen, page: AnswerPage) {
  page.lines.forEach((item, index) => {
    const y = sheetBodyTop() + index * ANSWER_ROW + ANSWER_ROW / 2
    if (item.kind === 'head') {
      text(pen, item.text, MARGIN_X, y, 22, MUTED, 'left', 750)
      return
    }
    const colW = contentWidth() / item.cols
    item.cells.forEach((cell, at) => text(pen, cell, MARGIN_X + 20 + at * colW, y, 22, INK))
  })
}

export function drawUnitsPage(pen: SheetPen, page: UnitsPage, index: number, count: number) {
  drawSheetPage(pen, page.kind === 'answers' ? UNITS_ANSWER_TITLE : UNITS_SHEET_TITLE, index, count, () => {
    if (page.kind === 'answers') drawAnswers(pen, page)
    else drawQuestions(pen, page)
  })
}
