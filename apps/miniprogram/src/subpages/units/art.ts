/**
 * 卷尺、天平、量杯旁边的小图，全部用代码画的 SVG（64×64），当作 background-image 用。
 * 不带文字，换语言不用重画。
 */
export type ArtId =
  | 'ant' | 'clip' | 'eraser' | 'pencil' | 'chopsticks' | 'book' | 'desk' | 'kid' | 'door' | 'track' | 'school' | 'bridge'
  | 'egg' | 'apple' | 'salt' | 'flour' | 'melon' | 'bear' | 'cow' | 'car' | 'elephant'
  | 'cup' | 'milk' | 'bottle'

const INK = '#2c3654'

const DRAW: Record<ArtId, string> = {
  ant: `<g stroke="${INK}" stroke-width="2" stroke-linecap="round"><path d="M22 36l-6 8M30 37l-2 9M38 37l4 9M44 35l8 7M24 28l-6-8M32 27l-1-9M40 28l5-8"/><path d="M50 24c4-4 8-4 10-2M50 26c5-1 8 1 9 3" fill="none"/></g><ellipse cx="18" cy="32" rx="9" ry="7" fill="#5a3b2a"/><ellipse cx="33" cy="32" rx="7" ry="5.5" fill="#6b4632"/><circle cx="47" cy="29" r="6.5" fill="#5a3b2a"/><circle cx="49" cy="27" r="1.6" fill="#fff"/>`,
  clip: `<path d="M18 24H50a8 8 0 0 1 0 16H12a6 6 0 0 1 0-12H46a4 4 0 0 1 0 8H20" fill="none" stroke="#7d8aa3" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  eraser: `<rect x="6" y="20" width="52" height="24" rx="5" fill="#ff9fb4"/><rect x="30" y="20" width="28" height="24" rx="5" fill="#4fa3ff"/><rect x="30" y="20" width="6" height="24" fill="#2f86f6"/><rect x="8" y="22" width="20" height="5" rx="2.5" fill="#fff" fill-opacity="0.45"/>`,
  pencil: `<path d="M8 26h40v12H8z" fill="#ffcf4d"/><path d="M8 30h40" stroke="#f2b636" stroke-width="2"/><path d="M48 26l12 6-12 6z" fill="#f6d2a2"/><path d="M56 30l4 2-4 2z" fill="${INK}"/><rect x="2" y="26" width="7" height="12" rx="2" fill="#ff8fa3"/><rect x="8" y="26" width="3" height="12" fill="#b9c2d3"/>`,
  chopsticks: `<path d="M4 25l56 4M4 37l56-4" stroke="#b5733c" stroke-width="4" stroke-linecap="round"/><path d="M4 25l14 1M4 37l14-1" stroke="#e23b2f" stroke-width="4.4" stroke-linecap="round"/>`,
  book: `<rect x="10" y="10" width="44" height="44" rx="4" fill="#4fa3ff"/><rect x="10" y="10" width="8" height="44" rx="3" fill="#2f86f6"/><rect x="24" y="18" width="24" height="10" rx="2" fill="#fff"/><path d="M28 23h16" stroke="#4fa3ff" stroke-width="2.4" stroke-linecap="round"/><path d="M24 40h16M24 46h10" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-opacity="0.7"/>`,
  desk: `<rect x="6" y="20" width="52" height="7" rx="2" fill="#d48a4a"/><rect x="10" y="27" width="44" height="9" fill="#e7a362"/><path d="M12 36v20M52 36v20" stroke="#9aa3b5" stroke-width="4" stroke-linecap="round"/>`,
  kid: `<circle cx="32" cy="15" r="9" fill="#ffd0a8"/><path d="M23 13c2-7 16-8 18 0-5-2-12-2-18 0z" fill="#3b2a23"/><path d="M22 30a10 10 0 0 1 20 0v14H22z" fill="#ff7a45"/><path d="M26 44h5v14h-5zM33 44h5v14h-5z" fill="#3b6fd1"/><path d="M22 32l-6 10M42 32l6 10" stroke="#ffd0a8" stroke-width="4" stroke-linecap="round"/>`,
  door: `<rect x="16" y="4" width="32" height="56" rx="3" fill="#c97d43"/><rect x="21" y="9" width="22" height="20" rx="2" fill="#dd9459"/><rect x="21" y="33" width="22" height="22" rx="2" fill="#dd9459"/><circle cx="42" cy="34" r="2.6" fill="#ffcf4d"/>`,
  track: `<rect x="4" y="14" width="56" height="36" rx="18" fill="#f2694a"/><rect x="11" y="21" width="42" height="22" rx="11" fill="#3fbf7f"/><rect x="7.5" y="17.5" width="49" height="29" rx="14.5" fill="none" stroke="#fff" stroke-width="1.2" stroke-dasharray="3 3"/>`,
  school: `<path d="M8 30L32 14l24 16z" fill="#f2694a"/><rect x="12" y="30" width="40" height="26" fill="#ffe2b8"/><rect x="27" y="40" width="10" height="16" fill="#c97d43"/><rect x="16" y="35" width="7" height="7" fill="#7cc4ff"/><rect x="41" y="35" width="7" height="7" fill="#7cc4ff"/><path d="M32 14V4" stroke="${INK}" stroke-width="1.6"/><path d="M32 4h9l-2 3 2 3h-9z" fill="#e23b2f"/>`,
  bridge: `<rect x="2" y="44" width="60" height="12" rx="2" fill="#7cc4ff"/><path d="M2 30h60v5H2z" fill="#8a95ab"/><path d="M8 35v12M56 35v12" stroke="#8a95ab" stroke-width="4"/><path d="M14 35a18 14 0 0 1 36 0" fill="none" stroke="#ff7a45" stroke-width="3"/><path d="M20 30V18M32 30V12M44 30V18" stroke="#ff7a45" stroke-width="2.4"/><path d="M8 30l12-12 12-6 12 6 12 12" fill="none" stroke="#ff7a45" stroke-width="2.4"/>`,
  egg: `<path d="M32 8c11 0 18 18 18 29a18 18 0 0 1-36 0C14 26 21 8 32 8z" fill="#fff3dc"/><path d="M32 8c11 0 18 18 18 29a18 18 0 0 1-36 0C14 26 21 8 32 8z" fill="none" stroke="#e8c98f" stroke-width="2"/><ellipse cx="25" cy="27" rx="3.5" ry="6" fill="#fff" fill-opacity="0.9"/>`,
  apple: `<path d="M32 18c-6-4-20-3-20 14 0 14 9 24 15 24 3 0 3-2 5-2s2 2 5 2c6 0 15-10 15-24 0-17-14-18-20-14z" fill="#f2453a"/><path d="M32 18c1-6 3-9 6-11" stroke="#7a4a2a" stroke-width="2.6" stroke-linecap="round" fill="none"/><path d="M35 12c5-5 12-4 13-2-4 5-9 5-13 2z" fill="#3fbf7f"/><ellipse cx="22" cy="30" rx="3.5" ry="6" fill="#fff" fill-opacity="0.35"/>`,
  salt: `<path d="M14 12h36l-2 6 2 6v30a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V24l2-6z" fill="#f5f7fb"/><path d="M14 12h36l-2 6 2 6H14l2-6z" fill="#4fa3ff"/><rect x="20" y="32" width="24" height="14" rx="3" fill="#2f86f6"/><circle cx="26" cy="39" r="2" fill="#fff"/><circle cx="32" cy="37" r="2" fill="#fff"/><circle cx="38" cy="40" r="2" fill="#fff"/>`,
  flour: `<path d="M12 18c0-6 40-6 40 0v34a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6z" fill="#f3e2c3"/><path d="M12 18c0-6 40-6 40 0-8 3-32 3-40 0z" fill="#e2c899"/><path d="M32 50V28" stroke="#d29a3a" stroke-width="2" stroke-linecap="round"/><g fill="#e8b04a"><ellipse cx="28" cy="32" rx="3" ry="5" transform="rotate(-30 28 32)"/><ellipse cx="36" cy="32" rx="3" ry="5" transform="rotate(30 36 32)"/><ellipse cx="28" cy="40" rx="3" ry="5" transform="rotate(-30 28 40)"/><ellipse cx="36" cy="40" rx="3" ry="5" transform="rotate(30 36 40)"/></g>`,
  melon: `<ellipse cx="32" cy="34" rx="27" ry="22" fill="#3fa65a"/><g fill="none" stroke="#1f6e36" stroke-width="3.4" stroke-linecap="round"><path d="M16 18c-4 10-4 22 2 32"/><path d="M27 13c-3 12-3 30 0 42"/><path d="M38 13c3 12 3 30 0 42"/><path d="M48 18c4 10 4 22-2 32"/></g><ellipse cx="22" cy="24" rx="5" ry="3" fill="#fff" fill-opacity="0.25"/>`,
  bear: `<circle cx="16" cy="16" r="8" fill="#8a5a3b"/><circle cx="48" cy="16" r="8" fill="#8a5a3b"/><circle cx="16" cy="16" r="4" fill="#c99470"/><circle cx="48" cy="16" r="4" fill="#c99470"/><circle cx="32" cy="34" r="22" fill="#9b6643"/><ellipse cx="32" cy="42" rx="10" ry="8" fill="#d8ad88"/><circle cx="24" cy="30" r="2.6" fill="${INK}"/><circle cx="40" cy="30" r="2.6" fill="${INK}"/><ellipse cx="32" cy="39" rx="4" ry="3" fill="${INK}"/>`,
  cow: `<rect x="8" y="22" width="38" height="22" rx="10" fill="#fff"/><path d="M14 26c4-2 8 0 8 5s-5 6-9 4zM30 36c3-3 9-2 10 2-2 4-8 4-10-2z" fill="${INK}"/><path d="M14 42v12M22 42v12M34 42v12M42 42v12" stroke="#f5f7fb" stroke-width="5" stroke-linecap="round"/><path d="M14 42v12M22 42v12M34 42v12M42 42v12" stroke="#c3c9d4" stroke-width="5" stroke-linecap="round" stroke-dasharray="0 9 3 0"/><ellipse cx="50" cy="26" rx="9" ry="8" fill="#fff"/><ellipse cx="54" cy="31" rx="6" ry="4" fill="#ffb3c1"/><path d="M45 18l-3-5M53 18l3-5" stroke="#d6b27a" stroke-width="2.6" stroke-linecap="round"/><circle cx="48" cy="24" r="1.6" fill="${INK}"/><rect x="8" y="22" width="38" height="22" rx="10" fill="none" stroke="#c3c9d4" stroke-width="1.5"/>`,
  car: `<path d="M6 40v-7c0-3 2-5 5-5h8l7-8h14c3 0 5 1 7 3l6 5h4c3 0 5 2 5 5v7z" fill="#f2453a"/><path d="M27 22h12c2 0 3 1 4 2l4 4H22z" fill="#bfe3ff"/><rect x="6" y="38" width="52" height="5" rx="2" fill="#c7322a"/><circle cx="19" cy="44" r="7" fill="${INK}"/><circle cx="47" cy="44" r="7" fill="${INK}"/><circle cx="19" cy="44" r="3" fill="#c3c9d4"/><circle cx="47" cy="44" r="3" fill="#c3c9d4"/>`,
  elephant: `<path d="M10 30c0-10 9-16 22-16 10 0 16 4 18 10l4 6c3 4 3 10 0 16-1 3-4 3-4 0 0-3 1-6-1-8-1 2-3 3-5 3v13h-7V45h-9v9h-7V44c-6-2-11-7-11-14z" fill="#9aa3b5"/><path d="M36 20c6-1 11 4 10 11-1 5-7 7-12 4z" fill="#b4bccb"/><circle cx="44" cy="25" r="1.8" fill="${INK}"/><path d="M48 32l5-2" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`,
  cup: `<path d="M16 12h32l-4 44a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4z" fill="#eef6ff" stroke="#b8cbe4" stroke-width="2"/><path d="M18.5 28h27l-2.7 28a3 3 0 0 1-3 2.6H24.2a3 3 0 0 1-3-2.6z" fill="#7cc4ff"/><path d="M22 18l2 30" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`,
  milk: `<path d="M18 22l6-12h16l6 12v34a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4z" fill="#f5f7fb"/><path d="M18 22l6-12h16l6 12z" fill="#4fa3ff"/><rect x="18" y="32" width="28" height="16" fill="#4fa3ff"/><path d="M24 44c3-5 6-5 8-1 2-5 6-5 8 1" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><path d="M40 10l4-6 4 2" fill="none" stroke="#ff7a45" stroke-width="2.4" stroke-linecap="round"/>`,
  bottle: `<rect x="26" y="4" width="12" height="7" rx="2" fill="#2f86f6"/><path d="M27 11h10v5c6 3 8 7 8 12v28a4 4 0 0 1-4 4H23a4 4 0 0 1-4-4V28c0-5 2-9 8-12z" fill="#d7ecff"/><path d="M19.5 30h25v26a3.5 3.5 0 0 1-3.5 3.5H23a3.5 3.5 0 0 1-3.5-3.5z" fill="#7cc4ff"/><rect x="19" y="34" width="26" height="9" fill="#3fbf7f"/><path d="M24 22v30" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-opacity="0.8"/>`,
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

const cache = new Map<string, string>()

export function svgUrl(svg: string) {
  const hit = cache.get(svg)
  if (hit) return hit
  const value = `url("data:image/svg+xml;base64,${base64(svg)}")`
  cache.set(svg, value)
  return value
}

/** 返回 background-image 的值 */
export function artImage(id: ArtId) {
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${DRAW[id]}</svg>`)
}

/**
 * 搭方块：棱长 10 的大正方体，已经搭了 layers 层（0~10），斜二测画法。
 * 搭好的部分画成带网格的彩色方块，没搭的部分只画虚线轮廓。
 */
export function cubeImage(layers: number) {
  const n = 10
  const u = 14
  const k = 0.5 * Math.SQRT1_2
  const dx = n * u * k
  const W = n * u + dx + 8
  const H = n * u + dx + 8
  const x0 = 4
  const y0 = H - 4
  const P = (x: number, y: number, z: number) => [x0 + x * u + z * u * k, y0 - y * u - z * u * k] as const
  const pt = (p: readonly [number, number]) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`
  const quad = (a: readonly [number, number], b: readonly [number, number], c: readonly [number, number], d: readonly [number, number], fill: string, stroke = INK, width = 1.4, dash = '') =>
    `<path d="M${pt(a)}L${pt(b)}L${pt(c)}L${pt(d)}Z" fill="${fill}" stroke="${stroke}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linejoin="round"/>`
  const line = (a: readonly [number, number], b: readonly [number, number], color: string, width = 0.8) => `<path d="M${pt(a)}L${pt(b)}" stroke="${color}" stroke-width="${width}"/>`
  let out = ''
  // 整个大正方体的虚线外框
  out += quad(P(0, 0, 0), P(n, 0, 0), P(n, n, 0), P(0, n, 0), 'none', '#9aa3b5', 1.2, '4 4')
  out += quad(P(0, n, 0), P(n, n, 0), P(n, n, n), P(0, n, n), 'none', '#9aa3b5', 1.2, '4 4')
  out += quad(P(n, 0, 0), P(n, 0, n), P(n, n, n), P(n, n, 0), 'none', '#9aa3b5', 1.2, '4 4')
  const h = layers
  if (h > 0) {
    out += quad(P(0, 0, 0), P(n, 0, 0), P(n, h, 0), P(0, h, 0), '#ffb26b')
    out += quad(P(n, 0, 0), P(n, 0, n), P(n, h, n), P(n, h, 0), '#ff8f5a')
    out += quad(P(0, h, 0), P(n, h, 0), P(n, h, n), P(0, h, n), '#ffcf4d')
    for (let i = 1; i < n; i += 1) {
      out += line(P(i, 0, 0), P(i, h, 0), '#e0782f')
      out += line(P(n, 0, i), P(n, h, i), '#d9622d')
      out += line(P(0, h, i), P(n, h, i), '#e5a92a')
      out += line(P(i, h, 0), P(i, h, n), '#e5a92a')
    }
    for (let j = 1; j < h; j += 1) {
      out += line(P(0, j, 0), P(n, j, 0), '#e0782f')
      out += line(P(n, j, 0), P(n, j, n), '#d9622d')
    }
    out += quad(P(0, 0, 0), P(n, 0, 0), P(n, h, 0), P(0, h, 0), 'none', INK, 1.6)
    out += quad(P(n, 0, 0), P(n, 0, n), P(n, h, n), P(n, h, 0), 'none', INK, 1.6)
    out += quad(P(0, h, 0), P(n, h, 0), P(n, h, n), P(0, h, n), 'none', INK, 1.6)
  }
  // 左下角的一个小正方体单独描出来，表示「1 个小单位」
  out += quad(P(0, 0, 0), P(1, 0, 0), P(1, 1, 0), P(0, 1, 0), h ? 'none' : '#4fa3ff', '#2f86f6', 2)
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}">${out}</svg>`)
}
