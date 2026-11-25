/**
 * 拼音页的小图：单韵母口型、前后鼻音的舌位、声调的音高线。全部用代码画的 SVG，当作 background-image 用，不带文字。
 */
const INK = '#2c3654'
const LIP = '#ef6b6b'
const LIP_DARK = '#c94b55'
const MOUTH = '#5a2330'
const TEETH = '#ffffff'
const TONGUE = '#ff9aa2'

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** SVG 只有 ASCII 字符，小程序里没有 btoa，自己编码。 */
function base64(text: string) {
  let out = ''
  for (let index = 0; index < text.length; index += 3) {
    const a = text.charCodeAt(index)
    const b = text.charCodeAt(index + 1)
    const c = text.charCodeAt(index + 2)
    const triple = (a << 16) | ((b || 0) << 8) | (c || 0)
    out += BASE64[(triple >> 18) & 63] + BASE64[(triple >> 12) & 63]
    out += Number.isNaN(b) ? '=' : BASE64[(triple >> 6) & 63]
    out += Number.isNaN(c) ? '=' : BASE64[triple & 63]
  }
  return out
}

const cache = new Map<string, string>()
function svgUrl(svg: string) {
  const hit = cache.get(svg)
  if (hit) return hit
  const value = `url("data:image/svg+xml;base64,${base64(svg)}")`
  cache.set(svg, value)
  return value
}

/** 嘴唇开口的宽、高，以及要不要露牙、露舌头 */
const SHAPES: Record<string, { w: number; h: number; teeth?: boolean; tongue?: boolean; pout?: boolean }> = {
  a: { w: 30, h: 24, tongue: true },
  o: { w: 18, h: 18, pout: true },
  e: { w: 28, h: 9, teeth: true },
  i: { w: 32, h: 5, teeth: true },
  u: { w: 10, h: 10, pout: true },
  v: { w: 7, h: 7, pout: true },
}

/** 单韵母的口型：一张圆脸，嘴巴张开的大小不同 */
export function mouthArt(final: string) {
  const shape = SHAPES[final] ?? SHAPES.a
  const cx = 50
  const cy = 64
  const lip = shape.pout ? 7 : 5
  let inner = `<ellipse cx="${cx}" cy="${cy}" rx="${shape.w}" ry="${shape.h}" fill="${MOUTH}"/>`
  if (shape.tongue) inner += `<ellipse cx="${cx}" cy="${cy + shape.h * 0.55}" rx="${shape.w * 0.6}" ry="${shape.h * 0.4}" fill="${TONGUE}"/>`
  if (shape.teeth) inner += `<rect x="${cx - shape.w * 0.8}" y="${cy - shape.h}" width="${shape.w * 1.6}" height="${Math.max(2.5, shape.h * 0.6)}" rx="1.5" fill="${TEETH}"/>`
  const face = `<circle cx="50" cy="50" r="46" fill="#ffd9b3"/><circle cx="34" cy="38" r="4" fill="${INK}"/><circle cx="66" cy="38" r="4" fill="${INK}"/><circle cx="35.4" cy="36.6" r="1.3" fill="#fff"/><circle cx="67.4" cy="36.6" r="1.3" fill="#fff"/><ellipse cx="24" cy="54" rx="6" ry="3.5" fill="#ffb3a7" opacity="0.7"/><ellipse cx="76" cy="54" rx="6" ry="3.5" fill="#ffb3a7" opacity="0.7"/>`
  const lips = `<ellipse cx="${cx}" cy="${cy}" rx="${shape.w + lip}" ry="${shape.h + lip}" fill="${LIP}"/><ellipse cx="${cx}" cy="${cy - shape.h - lip * 0.4}" rx="${shape.w * 0.5 + 2}" ry="${lip * 0.35}" fill="${LIP_DARK}" opacity="0.35"/>`
  const whistle = final === 'v' ? `<g stroke="${INK}" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.55"><path d="M64 60c4-2 7-2 10 0M66 66c5-1 9 0 12 2"/></g>` : ''
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${face}${lips}${inner}${whistle}</svg>`)
}

/**
 * 侧面看口腔：前鼻音舌尖顶住上牙床，后鼻音舌根抬起来贴住软腭，气流从鼻子出去。
 */
export function nasalArt(kind: 'front' | 'back') {
  const head = `<path d="M20 12c22-8 52-6 64 10 6 8 8 18 6 26l-6 4 6 8-4 4 2 8c-2 8-10 10-18 10H58l-4 14H20z" fill="#ffe2c4" stroke="#e8b98d" stroke-width="2"/>`
  const nose = `<path d="M84 22c6 6 10 14 8 22l-8 2" fill="#ffd2a8" stroke="#e8b98d" stroke-width="2"/>`
  const cavity = `<path d="M26 44c14-6 34-8 52-4l6 8c-6 6-16 10-30 10-14 0-24-4-28-8z" fill="${MOUTH}"/>`
  const palate = `<path d="M26 44c14-6 34-8 52-4" fill="none" stroke="#f3b0a0" stroke-width="3" stroke-linecap="round"/>`
  const tongue = kind === 'front'
    ? `<path d="M30 58c8-6 22-8 34-6 6 1 12-4 16-10 2 6 0 12-6 16-10 6-30 8-44 6z" fill="${TONGUE}"/>`
    : `<path d="M28 50c4-8 12-10 18-6 8 4 20 10 30 10 4 0 6 2 4 4-6 4-20 6-34 4-10-2-16-6-18-12z" fill="${TONGUE}"/>`
  const touch = kind === 'front' ? `<circle cx="80" cy="44" r="5" fill="none" stroke="#ff7a45" stroke-width="2.4"/>` : `<circle cx="34" cy="44" r="5" fill="none" stroke="#ff7a45" stroke-width="2.4"/>`
  const air = `<g stroke="#4fa3ff" stroke-width="2.6" stroke-linecap="round" fill="none"><path d="M30 34c16-10 36-12 56-6"/><path d="M86 28l8-6M88 32l9-1"/></g>`
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${head}${nose}${cavity}${palate}${tongue}${touch}${air}</svg>`)
}

/** 声调的音高线，坐标和页面里小球的关键帧一致（0–100） */
export const TONE_POINTS: Array<Array<[number, number]>> = [
  [[4, 14], [96, 14]],
  [[4, 52], [96, 10]],
  [[4, 34], [46, 88], [96, 18]],
  [[4, 10], [96, 90]],
]

export function toneArt(tone: number, color = '#ff7a45') {
  const points = TONE_POINTS[tone - 1]
  // 三声用二次曲线，控制点取「让曲线正好经过中间那个点」的位置
  const path = points.length === 3
    ? `M${points[0][0]} ${points[0][1]}Q${2 * points[1][0] - (points[0][0] + points[2][0]) / 2} ${2 * points[1][1] - (points[0][1] + points[2][1]) / 2} ${points[2][0]} ${points[2][1]}`
    : `M${points[0][0]} ${points[0][1]}L${points[1][0]} ${points[1][1]}`
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${path}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`)
}
