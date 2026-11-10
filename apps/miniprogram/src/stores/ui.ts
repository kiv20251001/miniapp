import { defineStore } from 'pinia'
import dayjs from 'dayjs'

export const useUiStore = defineStore('ui', {
  state: () => ({
    selectedDate: dayjs().format('YYYY-MM-DD'),
    /** 页面常驻内存，可能跨过零点；每次页面显示时校准一次。 */
    today: dayjs().format('YYYY-MM-DD'),
    tab: 'today' as 'today' | 'calendar' | 'courses' | 'stats',
    /** 主页面每次 onShow 加一，tab 视图靠它知道“页面又回到前台了”。 */
    homeShown: 0,
    pendingAdd: false,
  }),
  actions: {
    touchToday() {
      const today = dayjs().format('YYYY-MM-DD')
      if (today !== this.today) this.today = today
    },
  },
})
