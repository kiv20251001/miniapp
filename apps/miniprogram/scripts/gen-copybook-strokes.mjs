// 从 hanzi-writer-data 抽出写字表用到的笔顺中线，压成小程序能放下的表。
// 页面只引用生成结果，不要在源码里 import hanzi-writer-data。
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = dirname(fileURLToPath(import.meta.url))
const dataDir = dirname(require.resolve('hanzi-writer-data/package.json'))
const gradesSrc = readFileSync(join(root, '../src/subpages/copybook/grades.ts'), 'utf8')
const chars = [...new Set([...gradesSrc.matchAll(/'([^']*)'/g)].flatMap((match) => [...match[1]]))]
  .filter((char) => /[\u3400-\u9fff]/.test(char))

function simplify(points, epsilon) {
  if (points.length < 3) return points.slice()
  const [x1, y1] = points[0]
  const [x2, y2] = points[points.length - 1]
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.hypot(dx, dy) || 1
  let max = 0
  let index = 0
  for (let i = 1; i < points.length - 1; i += 1) {
    const [x, y] = points[i]
    const dist = Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / length
    if (dist > max) {
      max = dist
      index = i
    }
  }
  if (max <= epsilon) return [points[0], points[points.length - 1]]
  const left = simplify(points.slice(0, index + 1), epsilon)
  const right = simplify(points.slice(index), epsilon)
  return left.slice(0, -1).concat(right)
}

function scale(value) {
  return Math.max(0, Math.min(255, Math.round((value / 1024) * 255)))
}

const entries = []
const missing = []
for (const char of chars) {
  const file = join(dataDir, `${char}.json`)
  if (!existsSync(file)) {
    missing.push(char)
    continue
  }
  const data = JSON.parse(readFileSync(file, 'utf8'))
  const bytes = []
  for (const stroke of data.medians || []) {
    const points = simplify(stroke, 18).map(([x, y]) => [scale(x), scale(y)])
    if (!points.length) continue
    if (points.length === 1) points.push([Math.min(255, points[0][0] + 1), points[0][1]])
    bytes.push(Math.min(255, points.length))
    for (const [x, y] of points.slice(0, 255)) bytes.push(x, y)
  }
  if (!bytes.length) {
    missing.push(char)
    continue
  }
  entries.push([char, Buffer.from(bytes).toString('base64')])
}

entries.sort((a, b) => a[0].localeCompare(b[0], 'zh'))
const raw = Object.fromEntries(entries)
const source = `/** 写字表笔顺中线。由 scripts/gen-copybook-strokes.mjs 生成，不要手改。
 * 数据来自 hanzi-writer-data 的笔画中线（Make Me a Hanzi），只保留本字帖用到的字。
 */
const RAW: Record<string, string> = ${JSON.stringify(raw)}

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const cache = new Map<string, number[][][]>()

function bytesOf(value: string) {
  const out: number[] = []
  let buf = 0
  let bits = 0
  for (const char of value) {
    if (char === '=') break
    const index = ALPHA.indexOf(char)
    if (index < 0) continue
    buf = (buf << 6) | index
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out.push((buf >> bits) & 255)
    }
  }
  return out
}

export function strokesOf(char: string) {
  const hit = cache.get(char)
  if (hit) return hit
  const encoded = RAW[char]
  const strokes: number[][][] = []
  if (encoded) {
    const bytes = bytesOf(encoded)
    let index = 0
    while (index < bytes.length) {
      const count = bytes[index]
      index += 1
      const points: number[][] = []
      for (let point = 0; point < count && index + 1 < bytes.length; point += 1) {
        points.push([bytes[index], bytes[index + 1]])
        index += 2
      }
      if (points.length) strokes.push(points)
    }
  }
  cache.set(char, strokes)
  return strokes
}
`
const target = join(root, '../src/subpages/copybook/strokes.ts')
writeFileSync(target, source)
console.log(`strokes ${entries.length}/${chars.length}, missing ${missing.length}, ${source.length} bytes`)
if (missing.length) console.log(missing.join(''))
