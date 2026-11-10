import { openTab } from '@/utils/nav'

let asking = false
let leftNoticeShown = false

/** 被移出或在别的设备上退出了家庭：提示一次，回到今日页的未登录浏览状态。store 已先清掉会话。 */
export function noticeNotMember() {
  if (leftNoticeShown) return
  leftNoticeShown = true
  uni.showModal({
    title: '已不在这个家庭',
    content: '你已被移出或已退出这个家庭，可以重新创建或加入家庭。',
    showCancel: false,
    confirmText: '知道了',
    complete: () => {
      leftNoticeShown = false
    },
  })
  openTab('today')
}

/** 询问是否去创建家庭。不依赖 store，store 自己也能调用。 */
export function promptLogin() {
  if (asking) return Promise.resolve(false)
  asking = true
  return new Promise<boolean>((resolve) => {
    uni.showModal({
      title: '创建后继续',
      content: '创建家庭即可开启课程计划管理，是否前往？',
      confirmText: '去创建',
      cancelText: '先看看',
      confirmColor: '#ff7a45',
      success: (result) => {
        if (result.confirm) uni.navigateTo({ url: '/pages/login/index' })
        resolve(Boolean(result.confirm))
      },
      fail: () => resolve(false),
      complete: () => {
        asking = false
      },
    })
  })
}
