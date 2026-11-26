// 生成「拼音听写」的音节声音：node scripts/build-pinyin-audio.mjs
//
// 输出 cloud-storage/pinyin/pinyin-v2.bin（上传到云存储同名路径）和 src/subpinyin/syllables.ts（合法音节表）。
// 声音用 audio-cmn 的真人音节录音（Chen Wang，CC BY-SA），不是语音合成。
// 录音在不入库的 .cache/pinyin-src/64k/syllabs（cmn-ma1.mp3 这种文件名）。
// 还没有这份录音时：
//   cd apps/miniprogram/.cache
//   git clone --depth 1 --filter=blob:none --sparse https://github.com/hugolpz/audio-cmn.git pinyin-src
//   cd pinyin-src && git sparse-checkout set 64k/syllabs
// 换了声音要换文件名（pinyin-v3.bin），同时改 src/subpinyin/voice.ts 里的 FILE。
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pinyin } from 'pinyin-pro'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const audioDir = join(root, '.cache/pinyin-src/64k/syllabs')
const output = join(root, 'cloud-storage/pinyin/pinyin-v2.bin')
const tableFile = join(root, 'src/subpinyin/syllables.ts')

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
syllables.add('ong')

const list = [...syllables].sort()
writeFileSync(
  tableFile,
  `/** 普通话里能读出来的音节（不带声调，ü 写成 v）。由 scripts/build-pinyin-audio.mjs 生成，不要手改。 */
export const SYLLABLES = new Set(${JSON.stringify(list.join(' '))}.split(' '))
`,
)

if (!existsSync(audioDir)) {
  console.error(`缺少录音目录 ${audioDir}`)
  console.error('按文件开头的说明克隆 hugolpz/audio-cmn 的 64k/syllabs')
  process.exit(1)
}

/** 去掉 ID3，只留 MP3 帧，拼在一起时播放器才不会在音节中间停住。 */
function frames(file) {
  const buf = readFileSync(file)
  let start = 0
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f)
    start = 10 + size
  }
  while (start < buf.length - 1 && !(buf[start] === 0xff && (buf[start + 1] & 0xe0) === 0xe0)) start += 1
  let end = buf.length
  if (end - start > 128 && buf[end - 128] === 0x54 && buf[end - 127] === 0x41 && buf[end - 126] === 0x47) end -= 128
  return buf.subarray(start, end)
}

const files = new Map()
for (const name of readdirSync(audioDir)) {
  const match = /^cmn-([a-z]+)([1-5])\.mp3$/.exec(name)
  if (match) files.set(match[1] + match[2], join(audioDir, name))
}

const ALIAS = { ju4: 'jv4' }
const items = {}
const parts = []
const missing = []
let offset = 0
for (const base of list) {
  for (const tone of [1, 2, 3, 4, 5]) {
    const key = `${base}${tone}`
    const file = files.get(key) || (ALIAS[key] ? files.get(ALIAS[key]) : undefined)
    if (!file) {
      if (tone < 5) missing.push(key)
      continue
    }
    const data = frames(file)
    if (data.length < 8) {
      missing.push(key)
      continue
    }
    items[key] = [offset, data.length]
    parts.push(data)
    offset += data.length
  }
}

const header = Buffer.from(JSON.stringify({
  credit: 'Syllable recordings by Chen Wang, CC BY-SA 3.0. Source: https://github.com/hugolpz/audio-cmn 64k/syllabs. Packed by Uday, ID3 tags removed.',
  items,
}))
const body = Buffer.concat(parts)
const out = Buffer.alloc(8 + header.length + body.length)
out.write('UPY1', 0, 'ascii')
out.writeUInt32LE(header.length, 4)
header.copy(out, 8)
body.copy(out, 8 + header.length)
mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, out)
const tone5 = Object.keys(items).filter((key) => key.endsWith('5')).length
console.log(`写好 ${output}，${Object.keys(items).length} 个读音（其中轻声 ${tone5} 个），${(out.length / 1024 / 1024).toFixed(1)} MB`)
if (missing.length) console.warn(`录音里没有这 ${missing.length} 个：${missing.join(' ')}`)
