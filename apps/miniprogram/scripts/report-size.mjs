// 打包后统计主包 / 分包体积。微信限制：主包 ≤ 2MB，单个分包 ≤ 2MB，整个小程序 ≤ 20MB。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'dist/build/mp-weixin')
const LIMIT = 2 * 1024 * 1024
const BIG_FILE = 200 * 1024

if (!fs.existsSync(outDir)) {
  console.warn('[size] 没有找到 dist/build/mp-weixin')
  process.exit(0)
}

const app = JSON.parse(fs.readFileSync(path.join(outDir, 'app.json'), 'utf8'))
const subRoots = (app.subPackages || app.subpackages || []).map((item) => item.root.replace(/\/$/, ''))

function walk(dir, list = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, list)
    else list.push({ file: path.relative(outDir, full).split(path.sep).join('/'), size: fs.statSync(full).size })
  }
  return list
}

const files = walk(outDir).filter((item) => item.file !== 'project.config.json' && item.file !== 'project.private.config.json')
const buckets = new Map([['主包', 0], ...subRoots.map((name) => [`分包 ${name}`, 0])])
for (const item of files) {
  const sub = subRoots.find((name) => item.file.startsWith(`${name}/`))
  const key = sub ? `分包 ${sub}` : '主包'
  buckets.set(key, buckets.get(key) + item.size)
}

const kb = (size) => `${(size / 1024).toFixed(1)} KB`
let over = false
for (const [name, size] of buckets) {
  const flag = size > LIMIT ? '  ← 超过 2MB' : ''
  if (flag) over = true
  console.log(`[size] ${name}: ${kb(size)}${flag}`)
}
console.log(`[size] 合计: ${kb(files.reduce((sum, item) => sum + item.size, 0))}`)
for (const item of files.filter((entry) => entry.size > BIG_FILE)) {
  console.warn(`[size] 大文件 ${item.file}: ${kb(item.size)}，图片建议压缩或放到云存储`)
}
if (files.some((item) => item.file.startsWith('cloudfunctions/'))) {
  console.warn('[size] 包里混进了 cloudfunctions/，云函数不应打进小程序包')
}
if (over) process.exitCode = 1
