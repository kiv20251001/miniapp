// 生成「3D 太阳系」地球用的海陆遮罩 src/subsolar/earth-mask.ts。
// 数据用 Natural Earth 1:110m 陆地（公有领域，https://www.naturalearthdata.com/about/terms-of-use/），
// 栅格化成等距圆柱投影的 1 bit 位图，再做行程编码。用法：node scripts/gen-earth-mask.mjs
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const output = path.join(root, 'src/subsolar/earth-mask.ts')
const SOURCE_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson'
const W = 512
const H = 256

const response = await fetch(SOURCE_URL)
if (!response.ok) throw new Error(`下载失败：HTTP ${response.status}`)
const geo = await response.json()

const rings = []
for (const feature of geo.features) {
  const { type, coordinates } = feature.geometry
  const polygons = type === 'Polygon' ? [coordinates] : coordinates
  for (const polygon of polygons) {
    for (const ring of polygon) {
      const xs = ring.map((p) => p[0])
      const ys = ring.map((p) => p[1])
      rings.push({ ring, minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) })
    }
  }
}

function inside(lon, lat) {
  let count = 0
  for (const { ring, minX, maxX, minY, maxY } of rings) {
    if (lon < minX || lon > maxX || lat < minY || lat > maxY) continue
    let hit = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const [xi, yi] = ring[i]
      const [xj, yj] = ring[j]
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit
    }
    if (hit) count += 1
  }
  return count % 2 === 1
}

// 行程编码：从海洋开始，海陆交替记录长度，每个长度用 base64 变长整数。
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
let encoded = ''
let current = false
let run = 0
function push(value) {
  do {
    let digit = value & 31
    value >>= 5
    if (value > 0) digit |= 32
    encoded += ALPHA[digit]
  } while (value > 0)
}
let land = 0
for (let y = 0; y < H; y += 1) {
  const lat = 90 - ((y + 0.5) / H) * 180
  for (let x = 0; x < W; x += 1) {
    const lon = ((x + 0.5) / W) * 360 - 180
    const value = lat < -85 || inside(lon, lat)
    if (value) land += 1
    if (value === current) run += 1
    else {
      push(run)
      current = value
      run = 1
    }
  }
}
push(run)

writeFileSync(
  output,
  `/** 地球海陆遮罩，${W}×${H} 等距圆柱投影。由 scripts/gen-earth-mask.mjs 从 Natural Earth（公有领域）生成，不要手改。 */
export const EARTH_MASK_WIDTH = ${W}
export const EARTH_MASK_HEIGHT = ${H}
export const EARTH_MASK = '${encoded}'
`,
)
console.log(`已生成 ${path.relative(root, output)}，${(encoded.length / 1024).toFixed(1)} KB，陆地占 ${((land / (W * H)) * 100).toFixed(1)}%`)
