import { renderPages } from '@/print/export'
import { drawClockSheet, layoutClocks, type ClockSheetOptions } from './render'

export function renderClockFiles(options: ClockSheetOptions) {
  const pages = layoutClocks(options)
  return renderPages(pages.length, (pen, index) => drawClockSheet(pen, pages[index], index, pages.length, options))
}
