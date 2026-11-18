import { useUiStore } from '@/stores/ui'

export type TabKey = 'today' | 'calendar' | 'courses' | 'tools'

/**
 * 四个 tab 视图都放在同一个页面里，由 ui.tab 决定显示哪一个。
 * 切换只是同一份 WebView 里换一块内容，不再新建页面，也就没有新页面首帧的底色闪烁。
 */
export const HOME_PATH = '/pages/home/index'

export function isTabKey(value: unknown): value is TabKey {
  return value === 'today' || value === 'calendar' || value === 'courses' || value === 'tools'
}

function homeIndex() {
  return getCurrentPages().findIndex((page) => `/${page.route}` === HOME_PATH)
}

/** 重建主页面。上一次跳转还没结束时 reLaunch 会失败，稍等再试一次。 */
function relaunchHome(tab: TabKey, retry = true) {
  uni.reLaunch({
    url: `${HOME_PATH}?tab=${tab}`,
    fail: () => {
      if (retry) setTimeout(() => relaunchHome(tab, false), 350)
    },
  })
}

/** 切到某个 tab。已经在主页面就只换视图；在子页面就退回主页面；栈里没有主页面才重建。 */
export function openTab(tab: TabKey = 'today') {
  const ui = useUiStore()
  ui.tab = tab
  const pages = getCurrentPages()
  const index = homeIndex()
  if (index < 0) {
    relaunchHome(tab)
    return
  }
  const delta = pages.length - 1 - index
  if (delta > 0) uni.navigateBack({ delta, fail: () => relaunchHome(tab) })
}

/** 从转发卡片直接打开工具页时没有上一页，返回要回到工具箱。 */
const TOOL_ROUTE = /^(subpages\/(toolbox|copybook|maths|clock|pizza)|subsolar)\//

let backAt = 0

/** 返回上一页；没有上一页、或者返回失败时回主页面，保证不会停在原页面出不去。 */
export function goBack() {
  // 连点时第二下会在页面切换中途触发，容易失败或多退一层
  const now = Date.now()
  if (now - backAt < 500) return
  backAt = now
  const pages = getCurrentPages()
  const fallback: TabKey = TOOL_ROUTE.test(pages[pages.length - 1]?.route ?? '') ? 'tools' : 'today'
  if (pages.length <= 1) {
    openTab(fallback)
    return
  }
  uni.navigateBack({ fail: () => openTab(fallback) })
}
