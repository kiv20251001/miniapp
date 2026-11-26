// 生成字帖用的楷体字体子集 cloud-storage/fonts/copybook-kai.ttf，再上传到云存储（见 docs/miniprogram-backend-settings.md）。
// 字体用霞鹜文楷 GB（SIL OFL 1.1，可免费商用、可随软件分发），只保留 GB2312 6763 字 + 写字表 + 标点。
// 手机画布不吃 WOFF，所以输出 TTF。OFL 把霞鹜、LXGW 列为保留名称，子集是派生字体，家族名改成 UdayKai。
// 依赖 Python 的 fonttools：pip3 install fonttools。用法：node scripts/build-copybook-font.mjs
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'fonts')
const source = path.join(outDir, 'LXGWWenKaiGB-Regular.ttf')
const output = path.join(root, 'cloud-storage/fonts/copybook-kai.ttf')
const SOURCE_URL = 'https://github.com/lxgw/LxgwWenkaiGB/releases/latest/download/LXGWWenKaiGB-Regular.ttf'

mkdirSync(outDir, { recursive: true })
if (!existsSync(source)) {
  console.log(`下载 ${SOURCE_URL}`)
  const response = await fetch(SOURCE_URL)
  if (!response.ok) throw new Error(`下载字体失败：HTTP ${response.status}`)
  writeFileSync(source, Buffer.from(await response.arrayBuffer()))
}

const gb2312 = new TextDecoder('gb18030')
const chars = new Set()
for (let hi = 0xb0; hi <= 0xf7; hi += 1) {
  for (let lo = 0xa1; lo <= 0xfe; lo += 1) {
    const char = gb2312.decode(new Uint8Array([hi, lo]))
    if (/\p{Script=Han}/u.test(char)) chars.add(char)
  }
}
const grades = readFileSync(path.join(root, 'src/subpages/copybook/grades.ts'), 'utf8')
for (const char of grades.match(/\p{Script=Han}/gu) ?? []) chars.add(char)
const extra = '，。、；：？！“”‘’（）《》〈〉【】·—…～ '
for (let code = 0x21; code <= 0x7e; code += 1) chars.add(String.fromCharCode(code))
for (const char of extra) chars.add(char)

const textFile = path.join(outDir, 'chars.txt')
writeFileSync(textFile, [...chars].join(''))
const pyftsubset = process.env.PYFTSUBSET || 'pyftsubset'
try {
  execFileSync(pyftsubset, [
    source,
    `--text-file=${textFile}`,
    `--output-file=${output}`,
    '--no-hinting',
    '--desubroutinize',
    // 保留字体里的版权和 OFL 许可声明，OFL 要求随字体一起分发
    '--name-IDs=*',
    '--name-languages=*',
    "--layout-features=''",
    '--drop-tables+=GSUB,GPOS,vhea,vmtx',
  ], { stdio: 'inherit' })
} catch (error) {
  console.error('需要 fonttools：pip3 install fonttools（或用 PYFTSUBSET=路径 指定 pyftsubset）')
  throw error
}
execFileSync('python3', ['-c', `
from fontTools.ttLib import TTFont
font = TTFont(${JSON.stringify(output)})
name = font['name']
for lang in (0x409, 0x804):
    for name_id, text in ((1, 'UdayKai'), (2, 'Regular'), (4, 'UdayKai'), (6, 'UdayKai-Regular'), (16, 'UdayKai'), (17, 'Regular')):
        name.setName(text, name_id, 3, 1, lang)
font.save(${JSON.stringify(output)})
`], { stdio: 'inherit' })
console.log(`已生成 ${path.relative(root, output)}，共 ${chars.size} 个字符。把 cloud-storage/ 原样上传到两个云环境的存储。`)
