import type { ComponentPublicInstance } from 'vue'
import { statusBarHeight } from '@/utils/system'

/** 生成后把第一页滚到固定页头下面。页头在子组件里，量不到时按 PageHeader 的估算高度。 */
export function scrollToFirstSheet(proxy: ComponentPublicInstance | null | undefined) {
  if (!proxy) return
  const query = uni.createSelectorQuery().in(proxy)
  query.select('#sheet-0').boundingClientRect()
  query.select('.page-header-bar').boundingClientRect()
  query.selectViewport().scrollOffset()
  query.exec((result) => {
    const sheet = result?.[0]
    const header = result?.[1]
    const scroll = result?.[2]
    if (!sheet || Array.isArray(sheet) || !scroll || Array.isArray(scroll)) return
    const measured = header && !Array.isArray(header) ? header.height : 0
    const headerH = measured || statusBarHeight() + 84
    uni.pageScrollTo({ scrollTop: Math.max(0, scroll.scrollTop + sheet.top - headerH - 8), duration: 280 })
  })
}
