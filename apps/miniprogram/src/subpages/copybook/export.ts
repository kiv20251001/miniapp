import { drawSheet, layoutSheet, type SheetOptions } from './render'
import { renderPages } from '../print/export'

export { openSheetPdf, persistSheetImage } from '../print/export'

/** 按当前设置排出每一页，返回可预览的临时图片。 */
export function renderSheetFiles(options: SheetOptions) {
  const pages = layoutSheet(options)
  return renderPages(pages.length, (pen, index) => drawSheet(pen, pages[index], index, pages.length, options))
}
