import { renderPages } from '../print/export'
import { drawPizzaSheet, layoutPizzas, type PizzaSheetOptions } from './render'

export function renderPizzaFiles(options: PizzaSheetOptions) {
  const pages = layoutPizzas(options)
  return renderPages(pages.length, (pen, index) => drawPizzaSheet(pen, pages[index], index, pages.length))
}
