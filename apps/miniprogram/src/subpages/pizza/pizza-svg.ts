import { TOPPINGS, crustWobble } from './pizza-art'

/**
 * 每一块披萨画成一张 SVG 背景图（整张 200×200，只画这一块）。
 * 配料按整张披萨排好再裁进各块，切开时香肠也会被一刀切成两半，像真的一样。
 */
const TAU = Math.PI * 2
const C = 100
const R = 96
const cache = new Map<string, string>()

const BUBBLES = [
  { a: -0.9, r: 0.45, s: 5 }, { a: 0.5, r: 0.5, s: 4 }, { a: 1.9, r: 0.42, s: 5 },
  { a: 3.4, r: 0.48, s: 4 }, { a: 4.6, r: 0.4, s: 5 }, { a: 5.6, r: 0.66, s: 4 },
]

function pt(angle: number, radius: number) {
  return `${(C + Math.cos(angle) * radius).toFixed(2)} ${(C + Math.sin(angle) * radius).toFixed(2)}`
}

function arcPoints(a0: number, a1: number, radius: number, wobble: boolean) {
  const steps = Math.max(12, Math.ceil((a1 - a0) * 22))
  const points: string[] = []
  for (let index = 0; index <= steps; index += 1) {
    const angle = a0 + ((a1 - a0) * index) / steps
    points.push(pt(angle, radius * (wobble ? crustWobble(angle) : 1)))
  }
  return points
}

function wedge(a0: number, a1: number, radius: number, apex: number, wobble: boolean, full: boolean) {
  const points = arcPoints(a0, a1, radius, wobble)
  if (full) return `M${points.join(' L')} Z`
  return `M${pt(a0, apex)} L${points.join(' L')} Z`
}

function toppings() {
  return TOPPINGS.map((topping) => {
    const x = C + Math.cos(topping.a) * R * topping.r
    const y = C + Math.sin(topping.a) * R * topping.r
    const size = R * topping.s
    if (topping.basil) {
      const deg = ((topping.a * 180) / Math.PI).toFixed(1)
      return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(size * 1.35).toFixed(1)}" ry="${(size * 0.62).toFixed(1)}" fill="#2f9a4a" transform="rotate(${deg} ${x.toFixed(1)} ${y.toFixed(1)})"/>`
    }
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${size.toFixed(1)}" fill="#8e1d16"/>`
      + `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(size * 0.86).toFixed(1)}" fill="url(#p)"/>`
      + `<circle cx="${(x - size * 0.3).toFixed(1)}" cy="${(y - size * 0.32).toFixed(1)}" r="${(size * 0.15).toFixed(1)}" fill="#ffe9d6" fill-opacity="0.7"/>`
  }).join('')
}

function bubbles() {
  return BUBBLES.map((bubble) => {
    const x = C + Math.cos(bubble.a) * R * bubble.r
    const y = C + Math.sin(bubble.a) * R * bubble.r
    return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${bubble.s * 1.6}" ry="${bubble.s}" fill="#fff7dc" fill-opacity="0.55"/>`
  }).join('')
}

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

/** count 份里的第 index 块（从 12 点方向顺时针数），返回 background-image 的值。 */
export function sliceImage(count: number, index: number) {
  const key = `${count}-${index}`
  const hit = cache.get(key)
  if (hit) return hit
  const full = count <= 1
  const span = TAU / Math.max(1, count)
  const a0 = -Math.PI / 2 + index * span
  const a1 = full ? a0 + TAU : a0 + span
  const inset = full ? 0 : Math.min(0.025, span * 0.04)
  const crust = wedge(a0, a1, R, 4, true, full)
  const sauce = wedge(a0 + inset, a1 - inset, R * 0.85, 7, true, full)
  const cheese = wedge(a0 + inset * 1.4, a1 - inset * 1.4, R * 0.8, 9, true, full)
  const rim = `M${arcPoints(a0, a1, R, true).join(' L')}`
  const edges = full
    ? ''
    : `<path d="M${pt(a0, 10)} L${pt(a0, R * 0.97)} M${pt(a1, 10)} L${pt(a1, R * 0.97)}" stroke="#7a3a14" stroke-opacity="0.35" stroke-width="1.6" stroke-linecap="round"/>`
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">'
    + '<defs>'
    + '<radialGradient id="k" gradientUnits="userSpaceOnUse" cx="100" cy="100" r="100"><stop offset="0.72" stop-color="#f6cb85"/><stop offset="0.88" stop-color="#e59d50"/><stop offset="1" stop-color="#c17733"/></radialGradient>'
    + '<radialGradient id="c" gradientUnits="userSpaceOnUse" cx="82" cy="76" r="98"><stop offset="0" stop-color="#fff5d6"/><stop offset="0.55" stop-color="#f9cf78"/><stop offset="1" stop-color="#eaa64b"/></radialGradient>'
    + '<radialGradient id="p" cx="0.38" cy="0.34" r="0.7"><stop offset="0" stop-color="#ff8f7a"/><stop offset="0.6" stop-color="#e23b2f"/><stop offset="1" stop-color="#b3241b"/></radialGradient>'
    + `<clipPath id="m"><path d="${cheese}"/></clipPath>`
    + '</defs>'
    + `<path d="${crust}" fill="url(#k)"/>`
    + `<path d="${rim}" fill="none" stroke="#b8732f" stroke-width="2.4" stroke-linecap="round"/>`
    + `<path d="${sauce}" fill="#c9482c"/>`
    + `<path d="${cheese}" fill="url(#c)"/>`
    + `<g clip-path="url(#m)">${bubbles()}${toppings()}</g>`
    + edges
    + '</svg>'
  const value = `url("data:image/svg+xml;base64,${base64(svg)}")`
  cache.set(key, value)
  return value
}
