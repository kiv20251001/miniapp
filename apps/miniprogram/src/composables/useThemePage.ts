import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useThemeStore as themeStoreNamed } from '@/stores/theme'
import themeStoreDefault from '@/stores/theme'
import { pickFn } from '@/utils/wx-export'

export function hasThemePage() {
  const app = getApp({ allowDefault: true }) as { globalData?: { hasThemePage?: boolean } }
  app.globalData = app.globalData || {}
  app.globalData.hasThemePage = true
  return true
}

/** 每个页面根节点挂上 theme-dark，缓存页回来时也同步一次窗口底色和底栏。 */
export function useThemePage() {
  const useThemeStore = pickFn<typeof themeStoreNamed>(
    themeStoreNamed,
    themeStoreDefault,
    'useThemeStore',
  )
  const theme = useThemeStore()
  onShow(() => {
    theme.apply()
  })
  return computed(() => (theme.isDark ? 'theme-dark' : ''))
}

export default useThemePage
