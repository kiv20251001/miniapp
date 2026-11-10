let cached: { statusBar: number; windowWidth: number } | undefined

function readInfo() {
  if (!cached) {
    const info = typeof uni.getWindowInfo === 'function' ? uni.getWindowInfo() : uni.getSystemInfoSync()
    cached = {
      statusBar: info.statusBarHeight || 20,
      windowWidth: info.windowWidth || 375,
    }
  }
  return cached
}

/** 状态栏高度在一次运行中不会变，读一次就够了。 */
export function statusBarHeight() {
  return readInfo().statusBar
}

/** 品牌栏内容区高度，不含状态栏。和 .app-brand-inner 的 min-height 一致。 */
export const BRAND_BAR_HEIGHT = 72

/** 首页和账单页顶部 logo 栏占掉的高度，含状态栏。 */
export function brandHeaderHeight() {
  return statusBarHeight() + BRAND_BAR_HEIGHT
}

export function windowWidth() {
  return readInfo().windowWidth
}

let capsule: { inset: number; top: number; height: number } | undefined

function readCapsule() {
  if (!capsule) {
    const fallback = { inset: 96, top: readInfo().statusBar + 4, height: 32 }
    try {
      const rect = uni.getMenuButtonBoundingClientRect()
      capsule = rect && rect.left > 0
        ? { inset: readInfo().windowWidth - rect.left, top: rect.top, height: rect.height }
        : fallback
    } catch {
      capsule = fallback
    }
  }
  return capsule
}

/** 右上角胶囊（···/关闭）左边缘到屏幕右侧的距离，顶栏右侧控件要让开它。 */
export function capsuleInset() {
  return readCapsule().inset
}

export function capsuleBox() {
  return readCapsule()
}
