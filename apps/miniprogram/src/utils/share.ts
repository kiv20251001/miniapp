import { watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { t } from '@/i18n'

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
    title: t('Uday 家庭课表计划：今天上什么课，家人一起看'),
    path: '/pages/home/index',
    imageUrl: SHARE_IMAGE,
  }
}

/** onShareTimeline 同样必须写在页面文件里。query 置空，避免把当前页的邀请码带到朋友圈。 */
export function momentsShare() {
  return {
    title: t(MOMENTS_TITLE),
    query: '',
    imageUrl: SHARE_IMAGE,
  }
}

/** 工具箱和各个工具转发时的标题，写清楚能用它做什么。 */
export const TOOL_SHARE_TITLES = {
  toolbox: '字帖、计算题、认识时钟、3D 太阳系、认识分数、3D 几何体，孩子练习的小工具都在这',
  copybook: '输入汉字或英文单词，一键生成田字格字帖，A4 直接打印',
  maths: '凑十法、破十法、加减混合，一键生成计算练习题',
  make10: '凑十法练习题一键生成，A4 打印直接练',
  break10: '破十法练习题一键生成，A4 打印直接练',
  mixed: '加减混合运算题一键生成，填空位置随心选',
  clock: '拨一拨时针分针，跟着天空变化认识时间',
  clockQuiz: '认识时钟小测验：拨时间、看时间，你能答对几题？',
  clockPrint: '看时间画指针、看指针填时间，时钟练习题 A4 打印',
  solar: '3D 太阳系：八大行星有多大、怎么转，月相和四季一看就懂',
  pizza: '认识分数：切开披萨，看看分子和分母',
  pizzaQuiz: '分数小测验：拉开几份，或看披萨写出分子分母',
  pizzaPrint: '分数练习题：看图写分子分母、看分数画线段，A4 打印',
  cube: '3D 几何体：正方体、棱柱、棱锥，转一转、数一数、展开看看',
  cubeQuiz: '正方体小测验：展开图、找对面、数方块、三视图，你能答对几题？',
  cubePrint: '正方体和长方体练习题：展开图、三视图、表面积体积，A4 打印',
} as const

export type ToolShareKey = keyof typeof TOOL_SHARE_TITLES

/**
 * 好友卡片是 5:4 横图，竖屏页面截图放进去看不全，所以每个工具一张专门画的图，
 * 由 scripts/render-share-covers.mjs 生成。工具里的测验、打印、题型页共用工具那一张，标题各自不同。
 * 分享卡片读不到分包里的图片，所以都放主包，张数越少越省主包体积。
 */
const TOOL_SHARE_IMAGES: Record<ToolShareKey, string> = {
  toolbox: 'toolbox',
  copybook: 'copybook',
  maths: 'maths',
  make10: 'maths',
  break10: 'maths',
  mixed: 'maths',
  clock: 'clock',
  clockQuiz: 'clock',
  clockPrint: 'clock',
  solar: 'solar',
  pizza: 'pizza',
  pizzaQuiz: 'pizza',
  pizzaPrint: 'pizza',
  cube: 'cube',
  cubeQuiz: 'cube',
  cubePrint: 'cube',
}

export function toolShare(key: ToolShareKey, path: string): ShareContent {
  return { title: t(TOOL_SHARE_TITLES[key]), path, imageUrl: `/static/share/${TOOL_SHARE_IMAGES[key]}.jpg` }
}

/** 朋友圈缩略图会裁成正方形，横图左边的标题会被裁掉，所以仍用居中排版的推广图，只换成工具自己的标题。 */
export function toolMoments(key: ToolShareKey, query = '') {
  return { title: t(TOOL_SHARE_TITLES[key]), query, imageUrl: SHARE_IMAGE }
}

/**
 * 全局是自定义导航，系统标题栏不显示。
 * 这里仍写入页面标题，供搜一搜理解这一页，界面不变。
 */
export function useSearchTitle(title: () => string) {
  function apply() {
    uni.setNavigationBarTitle({ title: title() })
  }
  onShow(apply)
  watch(title, apply)
}

export function inviteShare(code: string): ShareContent {
  return {
    title: t('邀请你一起看 Uday 家庭课表'),
    path: code ? `/pages/login/index?invite=${code}` : '/pages/login/index',
    imageUrl: SHARE_IMAGE,
  }
}
