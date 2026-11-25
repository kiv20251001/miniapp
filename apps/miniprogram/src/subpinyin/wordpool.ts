import { GRADE_CHOICES, GRADE_CHARS, type GradeId } from './grades'
import { GRADE_WORDS, TOPIC_WORDS } from './grade-words'

/** 年级下拉：和字帖一样的全部年级加十二册，后面再加两个按拼音难点挑的专项。 */
export type WordChoice = { id: GradeId | 'all' | 'nasal' | 'curl'; label: string }
export const WORD_CHOICES: WordChoice[] = [
  ...GRADE_CHOICES,
  { id: 'nasal', label: '专项：前后鼻音' },
  { id: 'curl', label: '专项：平舌翘舌' },
]

const ALL_WORDS = Object.values(GRADE_WORDS).flatMap((list) => list.split(' '))

function poolOf(id: WordChoice['id']): string[] {
  if (id === 'all') return ALL_WORDS
  if (id === 'nasal' || id === 'curl') return TOPIC_WORDS[id].split(' ')
  return (GRADE_WORDS[id as keyof typeof GRADE_WORDS] || '').split(' ')
}

/** 随机挑 count 个词，用空格隔开。 */
export function randomWords(id: WordChoice['id'], count: number) {
  const pool = poolOf(id).slice()
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1))
    ;[pool[index], pool[other]] = [pool[other], pool[index]]
  }
  return pool.slice(0, Math.max(1, Math.min(count, pool.length))).join(' ')
}

export const MAX_RANDOM = 30
export const GRADE_IDS = Object.keys(GRADE_CHARS)
