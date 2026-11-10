/** 右上角转发、朋友圈和邀请家人共用同一张推广图。好友卡片是 5:4，朋友圈缩略图会裁成正方形。 */
export const SHARE_IMAGE = '/static/share-cover.jpg'

/** 朋友圈标题用海报上的 slogan，不提邀请，避免被理解成加入家庭。 */
export const MOMENTS_TITLE = '今天上什么课，Uday 家庭课表，家人一起看'

export type ShareContent = { title: string; path: string; imageUrl: string }

/** 从朋友圈打开是单页模式（场景值 1154），这时不能调云函数，也不能跳转页面。 */
export function isMomentsPreview() {
  try {
    return uni.getEnterOptionsSync().scene === 1154
  } catch {
    return false
  }
}

/** onShareAppMessage 必须写在页面文件里，uni 编译时才会给页面开启转发菜单。 */
export function appShare(): ShareContent {
  return {
    title: 'Uday 家庭课表计划：今天上什么课，家人一起看',
    path: '/pages/home/index',
    imageUrl: SHARE_IMAGE,
  }
}

/** onShareTimeline 同样必须写在页面文件里。query 置空，避免把当前页的邀请码带到朋友圈。 */
export function momentsShare() {
  return {
    title: MOMENTS_TITLE,
    query: '',
    imageUrl: SHARE_IMAGE,
  }
}

export function inviteShare(code: string): ShareContent {
  return {
    title: '邀请你一起看 Uday 家庭课表',
    path: code ? `/pages/login/index?invite=${code}` : '/pages/login/index',
    imageUrl: SHARE_IMAGE,
  }
}
