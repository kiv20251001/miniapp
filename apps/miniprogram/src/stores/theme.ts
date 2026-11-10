import { defineStore } from 'pinia'
import { setMixBase } from '@/utils/color'

export type ThemeMode = 'light' | 'dark'

export const THEME_KEY = 'myhome.mp.theme'

export function hasThemeStore() {
  const app = getApp({ allowDefault: true }) as { globalData?: { hasThemeStore?: boolean } }
  app.globalData = app.globalData || {}
  app.globalData.hasThemeStore = true
  return true
}

const LIGHT = {
  bg: '#f3f4fb',
  paper: '#ffffff',
}

const DARK = {
  bg: '#10131b',
  paper: '#1c2230',
}

function readMode(): ThemeMode {
  const saved = uni.getStorageSync(THEME_KEY)
  return saved === 'dark' ? 'dark' : 'light'
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    mode: readMode() as ThemeMode,
  }),
  getters: {
    isDark: (state) => state.mode === 'dark',
    colors(): { bg: string; paper: string } {
      return this.isDark ? DARK : LIGHT
    },
  },
  actions: {
    /** 四个 tab 视图同在一个页面里，换肤直接作用到全部视图；这里只同步窗口底色和下拉区。 */
    apply() {
      setMixBase(this.colors.paper, this.isDark)
      const { bg } = this.colors
      uni.setBackgroundColor({
        backgroundColor: bg,
        backgroundColorTop: bg,
        backgroundColorBottom: bg,
      })
      uni.setBackgroundTextStyle({
        textStyle: this.isDark ? 'light' : 'dark',
      })
    },
    toggle() {
      this.mode = this.isDark ? 'light' : 'dark'
      uni.setStorageSync(THEME_KEY, this.mode)
      this.apply()
    },
  },
})

export default useThemeStore
