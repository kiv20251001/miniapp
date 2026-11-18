import { SHEET_FOLLOW_NAME, SHEET_FOLLOW_PREFIX, SHEET_FOLLOW_SUFFIX } from './labels'

/** A4 比例的画布。1240×1754 约等于 150dpi，打印清晰，内存也扛得住。 */
export const PAGE_W = 1240
export const PAGE_H = 1754
export const MARGIN_X = 48
/** 页眉横线、页脚横线，以及正文离这两条线的相同间距。 */
export const HEADER_RULE = 112
export const FOOTER_GAP = 56
export const CONTENT_GAP = 64
export const MARGIN_TOP = HEADER_RULE + CONTENT_GAP
export const MARGIN_BOTTOM = FOOTER_GAP + CONTENT_GAP

export type PenGradient = { addColorStop: (offset: number, color: string) => void }

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
  bezierCurveTo: (cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) => void
  fill: (rule?: CanvasFillRule) => void
  stroke: () => void
  fillText: (text: string, x: number, y: number) => void
  createLinearGradient: (x0: number, y0: number, x1: number, y1: number) => PenGradient
}

export function contentWidth() {
  return PAGE_W - MARGIN_X * 2
}

export function isHanzi(char: string) {
  return /[\u3400-\u9fff]/.test(char)
}

/** 画布没有 measureText 时的估算：汉字和全角符号占满一个字号，其余按 0.56。 */
export function textWidth(text: string, fontSize: number) {
  let width = 0
  for (const char of Array.from(text)) {
    const wide = isHanzi(char) || /[\u3000-\u303f\uff00-\uffef]/.test(char)
    width += wide ? fontSize : fontSize * 0.56
  }
  return width
}

export function roundRect(pen: SheetPen, x: number, y: number, w: number, h: number, r: number) {
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

/** 和登录页同一份白色 U 标，画在橙色圆角底上。 */
const LOGO_PATH = 'M23.8 87.4l5.4 3 4.1 1.7 5.5 1.6 7.2 1.1 8 0 7-1.1 5.2-1.5 6.4-2.7 3.4-2.1zM10.5 75.4l3.2 3.9 3.3 3.1 65.8 0 3.2-2.9 3.3-3.9zM3.5 63.6l2.4 5.2 1.1 1.6 85.8 0 .9-1.3 2.6-5.3 0-.4zM49.9 15.3l-.2 2.3-1.5 6.6-.9 2.4-2 3-1.5 1.3-2.8 1.6-3.5 1.3-3.7 1 3.7 .7 3.5 1.3 2.8 1.6 2 2.1 1 1.3 1.4 3.5 1.5 6.5 .2 2.2 2-9.1 2.3-4.2 2.2-2.3 2.7-1.6 3.6-1.3 3.7-.7-6.9-2.1-2.9-1.6-2.3-2.1-1.6-2.6-.8-2zM80.8 0l-1.9 .9-.9 1.1-.4 1.1 0 40.5-.3 2.4-1 3.2-1.6 3.5-2.4 3.3-2.8 2.6 28.1 0 1.8-7 .6-5 0-43.6-.6-1.3-1.1-1.1-1.3-.6zM2.4 .2l-1.7 1.3-.7 1.6 0 43.7 .7 5.9 1.5 5.7 28.3 .2-3.1-3.1-2.1-3-1.5-3.1-1.1-4.1-.3-42.9-1.3-1.7-1.7-.7z'

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

/** 字帖和计算题共用的页眉、页脚。 */
export function drawBrand(pen: SheetPen, pageIndex: number, pageCount: number) {
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
  pen.fillText('Plan Your Day. Grow Your Way.', x, y + size + 16)
  pen.strokeStyle = '#eceff3'
  pen.lineWidth = 1
  pen.lineCap = 'butt'
  pen.setLineDash([])
  pen.beginPath()
  pen.moveTo(MARGIN_X, HEADER_RULE)
  pen.lineTo(PAGE_W - MARGIN_X, HEADER_RULE)
  pen.moveTo(MARGIN_X, PAGE_H - FOOTER_GAP)
  pen.lineTo(PAGE_W - MARGIN_X, PAGE_H - FOOTER_GAP)
  pen.stroke()
  pen.font = '500 16px sans-serif'
  pen.fillStyle = '#98a2b3'
  pen.textAlign = 'right'
  pen.fillText(`${pageIndex + 1} / ${pageCount}`, PAGE_W - MARGIN_X, PAGE_H - 28)

  const fontSize = 16
  const parts: Array<[string, string, number]> = [
    [SHEET_FOLLOW_PREFIX, '#98a2b3', 500],
    [SHEET_FOLLOW_NAME, '#ff7a45', 700],
    [SHEET_FOLLOW_SUFFIX, '#98a2b3', 500],
  ]
  const total = parts.reduce((sum, [text]) => sum + textWidth(text, fontSize), 0)
  let cursor = PAGE_W / 2 - total / 2
  pen.textAlign = 'left'
  for (const [text, color, weight] of parts) {
    pen.font = `${weight} ${fontSize}px sans-serif`
    pen.fillStyle = color
    pen.fillText(text, cursor, PAGE_H - 28)
    cursor += textWidth(text, fontSize)
  }
}
