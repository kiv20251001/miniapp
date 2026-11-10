/** 冷启动还没拿到课表时的占位，避免先画成「今天没有课」。 */
export const SCHEDULE_LOADING = '正在同步课表…'
/** 云端这次没回来、本机也没有上次课表。 */
export const SCHEDULE_OFFLINE = '课表还没同步过来，过一会儿再看。'

/** 某天没有课程计划时，空状态下方随机展示的一句话。 */
export const EMPTY_DAY_LINES = [
  '计划有变化也没关系，好好享受空闲时间。',
  '今天不赶场，陪孩子慢慢吃一顿饭吧。',
  '留白也是计划的一部分，去公园走走吧。',
  '没有课的日子，适合一起读一本喜欢的书。',
  '休息好了，下一节课会学得更起劲。',
  '把今天交给玩耍，成长也藏在自由里。',
  '难得清闲，和孩子聊聊这周的新发现。',
  '不着急的一天，早点睡也是好计划。',
  '空出来的时间，留给拥抱和笑声。',
  '今天就当个小假期，充好电再出发。',
] as const

/** 家人（只读）视角的空状态文案。 */
export const EMPTY_DAY_LINES_VIEWER = [
  '今天没有需要接送的计划，安心忙自己的事吧。',
  '今天不用接送，抽空给孩子打个电话吧。',
  '没有课程计划，今天可以早点回家。',
] as const

/** 同一天的文案保持不变，避免页面刷新时来回跳；不同日期换一句。 */
export function pickDailyLine(lines: readonly string[], key: string) {
  let hash = 0
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return lines[hash % lines.length]
}
