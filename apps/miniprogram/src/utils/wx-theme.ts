import { computed } from 'vue'
import { hasThemeStore, useThemeStore as themeStoreNamed } from '@/stores/theme'
import themeStoreDefault from '@/stores/theme'
import { hasThemePage, useThemePage as themePageNamed } from '@/composables/useThemePage'
import themePageDefault from '@/composables/useThemePage'
import { pickFn } from '@/utils/wx-export'

export function useThemeStore() {
  hasThemeStore()
  return pickFn<typeof themeStoreNamed>(themeStoreNamed, themeStoreDefault, 'useThemeStore')()
}

export function useThemePage() {
  hasThemePage()
  return pickFn<typeof themePageNamed>(themePageNamed, themePageDefault, 'useThemePage')()
}

/** 给页面首个节点 page-meta 用：首帧就按当前主题铺底色，深色下切页不再先闪浅色。 */
export function usePageBackground() {
  const theme = useThemeStore()
  return computed(() => {
    const bg = theme.colors.bg
    return { bg, style: `background-color:${bg};`, text: theme.isDark ? 'light' : 'dark' }
  })
}
