// 把 docs/prd/UI/logo.svg 压成单路径白色 U，输出 src/static/logo-u.svg。
// 用法：node scripts/optimize-logo.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = fs.readFileSync(path.join(root, '../../docs/prd/UI/logo.svg'), 'utf8')
const polygons = [...source.matchAll(/d="([^"]+)"/g)].map((match) =>
  [...match[1].matchAll(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/g)].map((pair) => [Number(pair[1]), Number(pair[2])]),
)

const points = polygons.flat()
const minX = Math.min(...points.map((p) => p[0]))
const minY = Math.min(...points.map((p) => p[1]))
const maxX = Math.max(...points.map((p) => p[0]))
const maxY = Math.max(...points.map((p) => p[1]))
const scale = 100 / Math.max(maxX - minX, maxY - minY)
const fmt = (value) => String(Math.round(value * 10) / 10).replace(/^(-?)0\./, '$1.')

// 相对坐标 + 省略重复命令，体积最小。
const pair = (x, y) => {
  const a = fmt(x)
  const b = fmt(y)
  return `${a}${b.startsWith('-') ? '' : ' '}${b}`
}
let d = ''
for (const polygon of polygons) {
  const scaled = polygon.map(([x, y]) => [Math.round((x - minX) * scale * 10) / 10, Math.round((y - minY) * scale * 10) / 10])
  let [px, py] = scaled[0]
  d += `M${pair(px, py)}l`
  d += scaled.slice(1).map(([x, y]) => {
    const step = pair(x - px, y - py)
    px = x
    py = y
    return step
  }).join(' ').replace(/ -/g, '-')
  d += 'z'
}

const width = fmt((maxX - minX) * scale)
const height = fmt((maxY - minY) * scale)
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><path fill="#fff" d="${d}"/></svg>`
const out = path.join(root, 'src/static/logo-u.svg')
fs.writeFileSync(out, svg)
console.log(`logo-u.svg ${svg.length} bytes (source ${source.length} bytes)`)
