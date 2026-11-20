/** 画进练习题图片的文字。只出现在 A4 图片里，不走界面翻译。 */
export const UNITS_SHEET_TITLE = '单位换算练习'
export const UNITS_ANSWER_TITLE = '参考答案'

export const SHEET_SECTIONS = {
  convert: '换算填空',
  compare: '在 ○ 里填上 >、< 或 =',
  unit: '填上合适的单位',
  ruler: '量一量，填一填',
} as const

export const SECTION_NUMBERS = ['一', '二', '三', '四']

export const SHEET_TEXT = {
  page: (n: number) => `第 ${n} 页`,
  cm: '厘米',
  mm: '毫米',
} as const
