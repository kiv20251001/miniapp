import type { PinyinSheetKind } from './worksheet'

/** 画进练习题图片的标题，孩子打印出来看到的名字。 */
export const PINYIN_SHEET_TITLES: Record<PinyinSheetKind, string> = {
  mixed: '拼音综合练习',
  write: '看拼音写词语',
  note: '给汉字注音',
  tone: '给音节标声调',
  nasal: '前鼻音还是后鼻音？圈一圈',
}
export const ANSWER_SUFFIX = '（答案）'

/** 打印页上的题型示意，用一个真实的词。 */
export const SHEET_SAMPLE = { chars: ['多', '米'], marked: ['duō', 'mǐ'], bare: ['duo', 'mi'] }
export const NASAL_SAMPLE = { char: '星', options: ['xīn', 'xīng'], answer: 1 }
