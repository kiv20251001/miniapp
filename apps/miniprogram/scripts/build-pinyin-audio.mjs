// 生成「拼音听写」的音节声音：node scripts/build-pinyin-audio.mjs
//
// 输出 cloud-storage/pinyin/pinyin-v1.bin（上传到云存储同名路径）和 src/subpinyin/syllables.ts（合法音节表）。
// 声音用 Kokoro-82M v1.1-zh（Apache-2.0）在本机离线合成，不调用任何在线服务。
//
// 准备（只要一次，都放在不入库的 .cache/tts）：
//   python3 -m venv .cache/tts/venv
//   .cache/tts/venv/bin/pip install onnxruntime numpy lameenc librosa   # librosa 只有 --probe 用
//   curl -L -o .cache/tts/kokoro.tar.bz2 https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-int8-multi-lang-v1_1.tar.bz2
//   tar xjf .cache/tts/kokoro.tar.bz2 -C .cache/tts
//
// 单个音节直接合成时声调不准，所以每个音节连读两句（mā。má。mà。mā ma。和 mā。mǎ。，三声放句尾才念得完整），
// 再按模型给出的每个音素时长切开。改了声音要换文件名（pinyin-v2.bin），手机上的缓存按文件名区分。
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pinyin } from 'pinyin-pro'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const cache = join(root, '.cache/tts')
const model = join(cache, 'kokoro-int8-multi-lang-v1_1')
const python = join(cache, 'venv/bin/python')
const output = join(root, 'cloud-storage/pinyin/pinyin-v1.bin')
const tableFile = join(root, 'src/subpinyin/syllables.ts')

if (!existsSync(model) || !existsSync(python)) {
  console.error('缺少 .cache/tts 里的模型或 Python 环境，按文件开头的说明准备')
  process.exit(1)
}

/** pinyin-pro 的数字调：ü 写成 v，轻声是 0 */
function readings(char) {
  const list = pinyin(char, { toneType: 'num', multiple: true, type: 'array', v: true })
  return (Array.isArray(list) ? list : [list]).map((item) => item.trim()).filter((item) => /^[a-z]+[0-4]$/.test(item))
}

/** 叹词里只有辅音的 m、n、ng、hm、hng 不教，也不进表 */
const SYLLABLE = /^(?:[bpmfdtnlgkhjqxrzcsyw]|zh|ch|sh)?[aoeiuv][a-z]*$/

const syllables = new Set()
for (let code = 0x4e00; code <= 0x9fff; code += 1) {
  for (const item of readings(String.fromCharCode(code))) {
    const base = item.slice(0, -1)
    if (SYLLABLE.test(base)) syllables.add(base)
  }
}
// 只在课本里单独读的音：韵母 ong 没有对应的字
syllables.add('ong')

// Kokoro 的中文词典写成「字 注音符号… 声调」。用 pinyin-pro 的读音对上声调，反推每个音节的注音写法。
const votes = new Map()
for (const line of readFileSync(join(model, 'lexicon-zh.txt'), 'utf8').split('\n')) {
  const parts = line.trim().split(/\s+/)
  if (parts.length < 3 || [...parts[0]].length !== 1) continue
  const tone = Number(parts[parts.length - 1])
  const phones = parts.slice(1, -1).join(' ')
  for (const item of readings(parts[0])) {
    const itemTone = Number(item.slice(-1)) || 5
    if (itemTone !== tone) continue
    const base = item.slice(0, -1)
    const counts = votes.get(base) ?? new Map()
    counts.set(phones, (counts.get(phones) ?? 0) + 1)
    votes.set(base, counts)
  }
}
// 词典里异读把这几个带偏了，或者没有对应的字，手写注音
const FIXED = { ong: '中', ei: 'ㄟ', dei: 'ㄉ ㄟ', zhei: 'ㄓ ㄟ', kei: 'ㄎ ㄟ', tei: 'ㄊ ㄟ', lo: 'ㄌ ㄛ', yo: 'ㄧ ㄛ' }
for (const [base, phones] of Object.entries(FIXED)) {
  syllables.add(base)
  votes.set(base, new Map([[phones, 1]]))
}

const plan = []
const missing = []
for (const base of [...syllables].sort()) {
  const counts = votes.get(base)
  if (!counts) {
    missing.push(base)
    continue
  }
  const [phones] = [...counts].sort((a, b) => b[1] - a[1])[0]
  plan.push({ syllable: base, phones: phones.split(' ') })
}
if (missing.length) console.warn(`没有注音写法，跳过：${missing.join(' ')}`)
console.log(`音节 ${plan.length} 个`)

mkdirSync(dirname(output), { recursive: true })
const planFile = join(cache, 'plan.json')
writeFileSync(planFile, JSON.stringify(plan))
// --plan 只列音节，不合成；--probe 3,10,20 比较几个音色的声调准不准
const extra = process.argv.slice(2)
if (extra.includes('--plan')) {
  console.log(plan.map((item) => `${item.syllable}:${item.phones.join('')}`).join(' '))
  process.exit(0)
}
execFileSync(python, [join(root, 'scripts/pinyin-tts.py'), planFile, extra.includes('--probe') ? '-' : output, model, ...extra], { stdio: 'inherit' })
if (extra.includes('--probe')) process.exit(0)

const list = plan.map((item) => item.syllable).join(' ')
writeFileSync(
  tableFile,
  `/** 普通话里能读出来的音节（不带声调，ü 写成 v）。由 scripts/build-pinyin-audio.mjs 生成，不要手改。 */
export const SYLLABLES = new Set(${JSON.stringify(list)}.split(' '))
`,
)
console.log(`写好 ${output} 和 ${tableFile}`)
