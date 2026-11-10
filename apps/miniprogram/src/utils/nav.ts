import { useUiStore } from '@/stores/ui'

export type TabKey = 'today' | 'calendar' | 'courses' | 'stats'

/**
 * 四个 tab 视图都放在同一个页面里，由 ui.tab 决定显示哪一个。
 * 切换只是同一份 WebView 里换一块内容，不再新建页面，也就没有新页面首帧的底色闪烁。
 */
export const HOME_PATH = '/pages/home/index'

export function isTabKey(value: unknown): value is TabKey {
  return value === 'today' || value === 'calendar' || value === 'courses' || value === 'stats'
}

function homeIndex() {
  return getCurrentPages().findIndex((page) => `/${page.route}` === HOME_PATH)
}

/** 切到某个 tab。已经在主页面就只换视图；在子页面就退回主页面；栈里没有主页面才重建。 */
export function openTab(tab: TabKey = 'today') {
  const ui = useUiStore()
  ui.tab = tab
  const pages = getCurrentPages()
  const index = homeIndex()
  if (index < 0) {
    uni.reLaunch({ url: `${HOME_PATH}?tab=${tab}` })
    return
  }
  const delta = pages.length - 1 - index
  if (delta > 0) uni.navigateBack({ delta })
}

/** 返回上一页；没有上一页时回主页面。 */
export function goBack() {
  if (getCurrentPages().length <= 1) {
    openTab('today')
    return
  }
  uni.navigateBack()
}
