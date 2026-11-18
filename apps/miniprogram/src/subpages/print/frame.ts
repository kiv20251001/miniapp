import { SHEET_DATE_LABEL, SHEET_NAME_LABEL, SHEET_TIME_LABEL } from './labels'
import { contentWidth, drawBrand, MARGIN_BOTTOM, MARGIN_TOP, MARGIN_X, PAGE_H, PAGE_W, textWidth, type SheetPen } from './sheet'

/** 题目标题和「姓名 / 日期 / 用时」一行占的高度，正文从它下面开始。 */
const TITLE_H = 112

export function sheetBodyTop() {
  return MARGIN_TOP + TITLE_H
}

export function sheetBodyHeight() {
  return PAGE_H - MARGIN_BOTTOM - sheetBodyTop()
}

export function drawSheetTitle(pen: SheetPen, title: string) {
  pen.font = '700 34px sans-serif'
  pen.fillStyle = '#1c2430'
  pen.textAlign = 'center'
  pen.textBaseline = 'middle'
  pen.fillText(title, PAGE_W / 2, MARGIN_TOP + 18)
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

/** 练习题统一的一页：白底、标题和姓名栏、正文、品牌页眉和页脚。 */
export function drawSheetPage(pen: SheetPen, title: string, pageIndex: number, pageCount: number, body: () => void) {
  pen.fillStyle = '#ffffff'
  pen.fillRect(0, 0, PAGE_W, PAGE_H)
  drawSheetTitle(pen, title)
  body()
  drawBrand(pen, pageIndex, pageCount)
}
