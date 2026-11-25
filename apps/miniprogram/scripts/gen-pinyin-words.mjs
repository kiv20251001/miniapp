// 生成「拼音听写」用的词语读音表：node scripts/gen-pinyin-words.mjs
// 小程序打包会把 node_modules 抽进主包，所以不直接引用 pinyin-pro（MIT），只把它词典里
// 「整词读音和单字默认读音不一样」的词（多音字、轻声）抽出来，放进分包。单字默认读音沿用字帖的 readings.ts。
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pinyin } from 'pinyin-pro'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const bundle = readFileSync(require.resolve('pinyin-pro'), 'utf8')

function all(char) {
  const list = pinyin(char, { toneType: 'symbol', multiple: true, type: 'array' })
  return (Array.isArray(list) ? list : [list]).map((item) => item.trim()).filter((item) => item && item !== char)
}
const first = (char) => all(char)[0] ?? ''

const WORD = /"([\u4e00-\u9fff]{2,})":"([a-zāáǎàēéěèīíǐìōóǒòūúǔùüǖǘǚǜ ]+)"/g
const words = new Map()
for (const match of bundle.matchAll(WORD)) {
  const word = match[1]
  const reading = match[2].trim().split(/\s+/)
  if (reading.length !== word.length) continue
  if ([...word].map(first).join(' ') === reading.join(' ')) continue
  words.set(word, reading.join(' '))
}

// 多音字的其他读音：只列写字表里的字和上面词语里出现的字，够家长在答案里改读音
const grades = readFileSync(join(root, 'src/subpages/copybook/grades.ts'), 'utf8')
const chars = new Set([...grades.matchAll(/'([\u4e00-\u9fff]+)'/g)].flatMap((match) => [...match[1]]))
for (const word of words.keys()) for (const char of word) chars.add(char)
const poly = []
for (const char of [...chars].sort()) {
  const list = [...new Set(all(char))]
  if (list.length > 1) poly.push(char + list.join(','))
}

const target = join(root, 'src/subpinyin/words.ts')
const source = `/**
 * 词语里读音和单字默认读音不一样的词（多音字、轻声），以及常用多音字的全部读音。
 * 由 scripts/gen-pinyin-words.mjs 从 pinyin-pro（MIT）的词典生成，不要手改。
 */
export const WORD_RAW = ${JSON.stringify([...words].map(([word, reading]) => word + reading).join('\n'))}

export const POLY_RAW = ${JSON.stringify(poly.join('\n'))}
`
writeFileSync(target, source)
console.log(`words ${words.size}, poly ${poly.length}, ${(source.length / 1024).toFixed(0)} KB`)
