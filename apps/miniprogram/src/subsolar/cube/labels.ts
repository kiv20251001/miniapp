/** 画进练习题图片的文字。只出现在 A4 图片里，不走界面翻译。 */
export const CUBE_SHEET_TITLE = '正方体和长方体练习'
export const CUBE_ANSWER_TITLE = '参考答案'

export const SHEET_TEXT = {
  net: '能折成正方体的画 ✓，不能的画 ✗。',
  opposite: '折成正方体后，和 ★ 相对的是哪个面？',
  oppositeAnswer: '答：和 ★ 相对的是',
  count: '数一数，一共有几个小正方体？',
  countAnswer: '答：一共有',
  countUnit: '个',
  views: '画出从正面、上面、左面看到的图形。',
  front: '正面',
  top: '上面',
  left: '左面',
  calcCube: (a: number) => `正方体的棱长是 ${a} cm，求它的棱长总和、表面积和体积。`,
  calcCuboid: '求这个长方体的棱长总和、表面积和体积。',
  edge: '棱长总和',
  area: '表面积',
  volume: '体积',
  paint: (n: number) => `棱长 ${n} cm 的正方体表面涂成红色，切成棱长 1 cm 的小正方体。`,
  paint3: '三面涂色',
  paint2: '两面涂色',
  paint1: '一面涂色',
  paint0: '没有涂色',
  leftNet: '左',
  rightNet: '右',
  yes: '✓',
  no: '✗',
  piece: '块',
} as const
