import { onShow } from '@dcloudio/uni-app'
import { CloudError, NOT_MEMBER } from '@/cloud/call'
import { isMomentsPreview } from '@/utils/share'
import { ensureSession, useFamilyStore } from '@/stores/family'
import { noticeNotMember } from '@/utils/login-prompt'
import { useUiStore } from '@/stores/ui'

/**
 * 页面显示时（打开、返回、从后台切回）都问一次云端有没有别人改过数据，
 * 所有页面共用一份 store 快照，拿到新数据后各页自动跟着更新。
 * 还没有家庭时所有页面和表单都能照常打开浏览，提交写入时才由 store 引导去创建。
 */
export function useFamilyPage() {
  const store = useFamilyStore()
  const ui = useUiStore()

  onShow(() => {
    if (isMomentsPreview()) return
    if (store.ready) {
      ui.touchToday()
      void store.loadReminders()
      syncFamily()
      return
    }
    ensureSession().then(() => {
      if (!store.ready) return
      ui.touchToday()
      void store.loadReminders()
      // 先把只读快照画出来；账单校准放到首屏稳定后，避免云端事务拖长冷启动恢复。
      setTimeout(() => syncFamily(true), 600)
    })
  })

  return store
}

/**
 * 切页、返回、回到前台时调用。网络问题静默忽略，下次切页再试，不在切 tab 时弹错误。
 * 已被移出家庭时提示一次，回到今日页的未登录浏览状态。
 */
export function syncFamily(force = false) {
  const store = useFamilyStore()
  return store.sync(force).catch((error) => {
    if (error instanceof CloudError && error.code === NOT_MEMBER) noticeNotMember()
    return false
  })
}

