import { renderPages } from '../print/export'
import { placeBlanks, randomChains } from './mixed'
import { randomProblems, type MathKind } from './problems'
import { drawMathSheet, layoutMath, perPage } from './render'
import { drawMixedSheet, layoutMixed, mixedPerPage, type MixedOptions } from './render-mixed'

const cache: Partial<Record<MathKind, string>> = {}

/** 题型卡片上的效果图：随机一页，默认设置。同一次打开小程序只画一次。 */
export async function kindPreview(kind: MathKind) {
  const hit = cache[kind]
  if (hit) return hit
  let file: string
  if (kind === 'mixed') {
    const [page] = layoutMixed({ items: placeBlanks(randomChains('random', mixedPerPage()), 'random') })
    ;[file] = await renderPages(1, (pen) => drawMixedSheet(pen, page, 0, 1), 0.8)
  } else {
    const options = { kind, problems: randomProblems(kind, perPage()), hint: true }
    const [page] = layoutMath(options)
    ;[file] = await renderPages(1, (pen) => drawMathSheet(pen, page, 0, 1, options), 0.8)
  }
  cache[kind] = file
  return file
}

export function renderMathFiles(options: Parameters<typeof layoutMath>[0]) {
  const pages = layoutMath(options)
  return renderPages(pages.length, (pen, index) => drawMathSheet(pen, pages[index], index, pages.length, options))
}

export function renderMixedFiles(options: MixedOptions) {
  const pages = layoutMixed(options)
  return renderPages(pages.length, (pen, index) => drawMixedSheet(pen, pages[index], index, pages.length))
}
