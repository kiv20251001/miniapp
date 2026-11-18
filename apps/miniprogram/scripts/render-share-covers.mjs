// 工具页右上角转发用的 5:4 卡片图。好友卡片按 5:4 显示，页面截图是竖的会被压扁，所以每页单独画一张。
// 左边是标题和卖点，右边是这个工具的示意图；时钟、田字格、YIMU 字和小程序里画法一致。
// 图都放主包 static/share：分享卡片读不到分包里的图片。
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import Jimp from 'jimp'
import { OPEN_SANS, openFontOptions } from './open-fonts.mjs'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src')
const W = 500
const H = 400
const SCALE = 1.2
const SANS = OPEN_SANS
const NUM = OPEN_SANS
const INK = '#1c2430'
const DIAL = '#2b3340'

const sheetSource = await readFile(path.join(root, 'subpages/print/sheet.ts'), 'utf8')
const U_PATH = sheetSource.match(/const LOGO_PATH = '([^']+)'/)[1]
const YIMU_PATH = (await readFile(path.join(root, 'static/brand/yimu-logo.svg'), 'utf8')).match(/ d="([^"]+)"/)[1]

async function dataUri(file) {
  return `data:image/png;base64,${(await readFile(path.join(root, file))).toString('base64')}`
}

function glyph(char) {
  return require(`hanzi-writer-data/${char}.json`).strokes.map((d) => `<path d="${d}"/>`).join('')
}

function textWidth(text, size) {
  return Array.from(text).reduce((sum, char) => sum + (/[\u3000-\u9fff\uff00-\uffef]/.test(char) ? size : size * 0.58), 0)
}

function brand() {
  return `
    <defs>
      <linearGradient id="u" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffb45c"/><stop offset="0.48" stop-color="#ff7a45"/><stop offset="1" stop-color="#f15a36"/>
      </linearGradient>
    </defs>
    <rect x="32" y="30" width="34" height="34" rx="11" fill="url(#u)"/>
    <path d="${U_PATH}" fill="#fff" transform="translate(40.1 39.2) scale(0.178)"/>
    <text x="75" y="53" font-family="${NUM}" font-size="21" font-weight="800" fill="${INK}">Uday</text>
    <text x="138" y="53" font-family="${SANS}" font-size="13" font-weight="600" fill="#98a2b3">工具箱</text>`
}

function chips(list) {
  let x = 32
  return list
    .map(([label, color, bg]) => {
      const w = textWidth(label, 13) + 24
      const markup = `<rect x="${x}" y="196" width="${w}" height="28" rx="14" fill="${bg}"/>
        <text x="${x + w / 2}" y="214.5" text-anchor="middle" font-family="${SANS}" font-size="13" font-weight="700" fill="${color}">${label}</text>`
      x += w + 8
      return markup
    })
    .join('')
}

function frame({ accent, accent2, title, sub, tags, art }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fffaf6"/><stop offset="1" stop-color="#f2f4fb"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#28345a" flood-opacity="0.16"/>
      </filter>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <circle cx="468" cy="22" r="128" fill="${accent}" fill-opacity="0.13"/>
    <circle cx="18" cy="392" r="112" fill="${accent2}" fill-opacity="0.12"/>
    ${brand()}
    <text x="32" y="140" font-family="${SANS}" font-size="${title.length > 6 ? 30 : title.length > 5 ? 34 : 38}" font-weight="800" fill="${INK}">${title}</text>
    <text x="32" y="174" font-family="${SANS}" font-size="15" font-weight="500" fill="#6b7385">${sub}</text>
    ${chips(tags)}
    <text x="32" y="364" font-family="${SANS}" font-size="12" font-weight="500" fill="#98a2b3">微信小程序 · Uday家庭课表计划</text>
    <g transform="translate(262 58)">${art}</g>
  </svg>`
}

function card(inner, h = 284) {
  return `<rect x="0" y="0" width="216" height="${h}" rx="24" fill="#ffffff" stroke="#edf0f5" filter="url(#shadow)"/>${inner}`
}

/** 和 ClockFace 同样的比例：外圈、60 个刻度、数字、YIMU、指针、中心轴。 */
function clockFace(cx, cy, r, time) {
  const dial = r * 2 * (1 - (26 / 560) * 2)
  const inner = dial / 2
  const ticks = Array.from({ length: 60 }, (_, index) => {
    const major = index % 5 === 0
    const angle = (index * 6 * Math.PI) / 180
    const start = inner - dial * 0.03
    const end = start - dial * (major ? 0.047 : 0.024)
    const p = (radius) => `${(cx + radius * Math.sin(angle)).toFixed(2)} ${(cy - radius * Math.cos(angle)).toFixed(2)}`
    return `<path d="M${p(start)}L${p(end)}" stroke="${major ? DIAL : '#9aa1b2'}" stroke-width="${(dial * (major ? 0.012 : 0.006)).toFixed(2)}" stroke-linecap="round"/>`
  }).join('')
  const numbers = Array.from({ length: 12 }, (_, index) => {
    const value = index + 1
    const angle = (value * 30 * Math.PI) / 180
    return `<text x="${(cx + Math.sin(angle) * dial * 0.365).toFixed(2)}" y="${(cy - Math.cos(angle) * dial * 0.365).toFixed(2)}" text-anchor="middle" dominant-baseline="central" font-family="${NUM}" font-size="${(dial * 0.079).toFixed(1)}" font-weight="700" fill="${DIAL}">${value}</text>`
  }).join('')
  const hand = (deg, length, width, color) => {
    const angle = (deg * Math.PI) / 180
    return `<path d="M${cx} ${cy}L${(cx + length * Math.sin(angle)).toFixed(2)} ${(cy - length * Math.cos(angle)).toFixed(2)}" stroke="${color}" stroke-width="${width.toFixed(2)}" stroke-linecap="round"/>`
  }
  const logoW = dial * 0.21
  const logoScale = logoW / 872
  let hands = ''
  if (time) {
    const { h, m, s } = time
    hands += hand((h % 12) * 30 + m * 0.5, dial * 0.25, dial * 0.031, DIAL)
    hands += hand(m * 6, dial * 0.37, dial * 0.02, DIAL)
    if (s !== undefined) hands += hand(s * 6, dial * 0.41, Math.max(1, dial * 0.008), '#f15a36')
  }
  return `
    <defs>
      <linearGradient id="rim${cx}${cy}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e6e9f1"/></linearGradient>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#rim${cx}${cy})" stroke="#e1e5ec" stroke-width="1"/>
    <circle cx="${cx}" cy="${cy}" r="${inner}" fill="#ffffff" stroke="#dde1e9" stroke-width="1"/>
    ${ticks}${numbers}
    <path d="${YIMU_PATH}" fill="${DIAL}" fill-opacity="0.78" fill-rule="evenodd" transform="translate(${cx - logoW / 2} ${cy - dial * 0.23 - (243 * logoScale) / 2}) scale(${logoScale})"/>
    ${hands}
    <circle cx="${cx}" cy="${cy}" r="${dial * 0.032}" fill="${DIAL}"/>
    <circle cx="${cx}" cy="${cy}" r="${dial * 0.012}" fill="#f15a36"/>`
}

function tianCell(x, y, size, char, color, opacity) {
  const scale = (size * 0.84) / 1024
  const offset = size * 0.08
  const strokes = char
    ? `<g fill="${color}" fill-opacity="${opacity}" transform="translate(${x + offset} ${y + offset}) scale(${scale}) translate(0 900) scale(1 -1)">${glyph(char)}</g>`
    : ''
  return `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="#fff" stroke="#7d8798" stroke-width="1.6"/>
    <path d="M${x + size / 2} ${y}v${size}M${x} ${y + size / 2}h${size}" stroke="#b7c0ce" stroke-width="1" stroke-dasharray="3 3"/>${strokes}`
}

function copybookArt() {
  const size = 54
  const rows = [['大', 22], ['人', 104]]
  const cells = rows
    .map(([char, y]) =>
      [0, 1, 2].map((col) => tianCell(22 + col * (size + 7), y, size, col === 2 ? '' : char, col === 0 ? INK : '#17824a', col === 0 ? 1 : 0.42)).join(''),
    )
    .join('')
  const staffY = 192
  const lines = [0, 1, 2, 3]
    .map((index) => `<path d="M22 ${staffY + index * 16}h172" stroke="${index === 2 ? '#c96a6a' : '#b7c0ce'}" stroke-width="${index === 2 ? 1.2 : 1}"/>`)
    .join('')
  return card(`${cells}
    <path d="M22 ${staffY}h172" stroke="#b7c0ce"/>${lines}
    <text x="30" y="${staffY + 32}" font-family="${NUM}" font-size="30" font-weight="500" fill="${INK}">good</text>
    <text x="116" y="${staffY + 32}" font-family="${NUM}" font-size="30" font-weight="500" fill="#17824a" fill-opacity="0.42">good</text>`)
}

function equation(x, y, tokens, size = 20) {
  let cursor = x
  return tokens
    .map((token) => {
      if (token === null) {
        const markup = `<rect x="${cursor}" y="${y - size * 0.62}" width="${size * 1.3}" height="${size * 1.12}" fill="#fff" stroke="#5b6474" stroke-width="1.5"/>`
        cursor += size * 1.3 + 6
        return markup
      }
      const [text, color] = Array.isArray(token) ? token : [token, '#2b3340']
      const markup = `<text x="${cursor}" y="${y}" dominant-baseline="central" font-family="${NUM}" font-size="${size}" font-weight="600" fill="${color}">${text}</text>`
      cursor += textWidth(text, size) + 6
      return markup
    })
    .join('')
}

function mathsArt() {
  const rows = [
    ['凑十法', '#ff7a45', '#fff1e8', ['8', ['+', '#ff7a45'], '5', '=', null]],
    ['破十法', '#3b82f6', '#eaf2ff', ['13', ['−', '#3b82f6'], '9', '=', null]],
    ['加减混合', '#1fae7e', '#e6f7f0', ['15', ['−', '#1fae7e'], '7', ['+', '#1fae7e'], null, '=', '12']],
  ]
  return card(
    rows
      .map(([label, color, bg, tokens], index) => {
        const y = 22 + index * 86
        const w = textWidth(label, 12) + 18
        return `<rect x="20" y="${y}" width="${w}" height="22" rx="11" fill="${bg}"/>
          <text x="${20 + w / 2}" y="${y + 15}" text-anchor="middle" font-family="${SANS}" font-size="12" font-weight="700" fill="${color}">${label}</text>
          ${equation(22, y + 50, tokens, 22)}
          ${index < 2 ? `<path d="M20 ${y + 76}h176" stroke="#eef1f5"/>` : ''}`
      })
      .join(''),
  )
}

/** 和计算题 A4 上一样的拆数图，答案用绿色写好，10 用半透明红色提示。 */
function tenArt(kind) {
  const [a, b, op] = kind === 'make10' ? [8, 5, '+'] : [13, 9, '−']
  const s = kind === 'make10' ? 0.86 : 0.82
  const ox = kind === 'make10' ? -6 : 10
  const oy = 104
  const X = (value) => ox + value * s
  const Y = (value) => oy + value * s
  const box = 38 * s
  const answer = 46 * s
  const splitFirst = kind === 'break10'
  const splitX = X(splitFirst ? 40 : 130)
  const otherX = X(splitFirst ? 130 : 40)
  const leftX = splitX - 24 * s
  const rightX = splitX + 24 * s
  const partnerX = splitFirst ? rightX : leftX
  const restX = splitFirst ? leftX : rightX
  const boxTop = Y(52)
  const boxBottom = boxTop + box
  const joinY = Y(114)
  const midX = (otherX + partnerX) / 2
  const resultTop = Y(128)
  const resultY = resultTop + box / 2
  const edgeX = restX < midX ? midX - box / 2 : midX + box / 2
  const values = kind === 'make10' ? { partner: 2, rest: 3, mid: 10, answer: 13 } : { partner: 10, rest: 3, mid: 1, answer: 4 }
  const hint = 'rgba(226, 74, 74, 0.6)'
  const green = '#17824a'
  const line = (points) => `<path d="${points.map(([px, py], index) => `${index ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join('')}" stroke="#5b6474" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
  const square = (cx, top, size, value, color, stroke = '#5b6474') =>
    `<rect x="${(cx - size / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${size.toFixed(1)}" height="${size.toFixed(1)}" fill="#fff" stroke="${stroke}" stroke-width="1.6"/>
     <text x="${cx.toFixed(1)}" y="${(top + size / 2).toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-family="${NUM}" font-size="${(size * 0.56).toFixed(1)}" font-weight="600" fill="${color}">${value}</text>`
  const sign = (text, x, y) => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-family="${NUM}" font-size="17" font-weight="700" fill="#2b3340">${text}</text>`
  const big = (text, x) => `<text x="${x.toFixed(1)}" y="${(oy + 1).toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-family="${NUM}" font-size="31" font-weight="500" fill="#2b3340">${text}</text>`
  const partnerHint = kind === 'break10'
  return card(`
    <text x="108" y="38" text-anchor="middle" font-family="${SANS}" font-size="13" font-weight="700" fill="#98a2b3">${kind === 'make10' ? '看大数，拆小数，凑成十' : '拆被减数，10 减几再相加'}</text>
    ${big(a, X(40))}${big(op, X(86))}${big(b, X(130))}${big('=', X(176))}
    <rect x="${X(196).toFixed(1)}" y="${(oy - answer / 2).toFixed(1)}" width="${answer.toFixed(1)}" height="${answer.toFixed(1)}" fill="#fff" stroke="#5b6474" stroke-width="1.6"/>
    <text x="${(X(196) + answer / 2).toFixed(1)}" y="${(oy + 1).toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-family="${NUM}" font-size="24" font-weight="600" fill="${green}">${values.answer}</text>
    ${line([[leftX, boxTop], [splitX, Y(22)], [rightX, boxTop]])}
    ${square(partnerX, boxTop, box, values.partner, partnerHint ? hint : green, partnerHint ? hint : '#5b6474')}
    ${square(restX, boxTop, box, values.rest, green)}
    ${line([[otherX, Y(22)], [otherX, joinY], [partnerX, joinY], [partnerX, boxBottom]])}
    ${line([[midX, joinY], [midX, resultTop]])}
    ${sign(kind === 'make10' ? '+' : '−', midX, joinY - 12)}
    ${square(midX, resultTop, box, values.mid, kind === 'make10' ? hint : green, kind === 'make10' ? hint : '#5b6474')}
    ${line([[restX, boxBottom], [restX, resultY], [edgeX, resultY]])}
    ${sign('+', (restX + edgeX) / 2, resultY - 12)}
  `)
}

function mixedArt() {
  const rows = [
    ['15', '−', '7', '+', '4', '=', null],
    ['6', '+', null, '−', '3', '=', '9'],
    [null, '−', '5', '+', '8', '=', '12'],
    ['9', '+', '6', '−', null, '=', '11'],
  ]
  return card(rows.map((tokens, index) => equation(18, 40 + index * 66, tokens, 19)).join(''))
}

function clockArt() {
  const bar = 'url(#day)'
  return `
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe6ff"/><stop offset="1" stop-color="#f6faff"/></linearGradient>
      <linearGradient id="day" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#2a3160"/><stop offset="0.28" stop-color="#f7b28a"/><stop offset="0.5" stop-color="#a9d0f5"/><stop offset="0.76" stop-color="#ee8a6e"/><stop offset="1" stop-color="#2a3160"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="216" height="284" rx="24" fill="url(#sky)" stroke="#e6eef8" filter="url(#shadow)"/>
    <circle cx="176" cy="36" r="15" fill="#ffd36b"/>
    <circle cx="176" cy="36" r="22" fill="#ffd36b" fill-opacity="0.25"/>
    ${clockFace(108, 128, 84, { h: 10, m: 10, s: 32 })}
    <rect x="22" y="244" width="172" height="10" rx="5" fill="${bar}"/>
    <circle cx="${22 + 172 * (10.17 / 24)}" cy="249" r="10" fill="#fff" stroke="#e1e5ec"/>
    <circle cx="${22 + 172 * (10.17 / 24)}" cy="249" r="5" fill="#ffb84d"/>`
}

function quizArt() {
  return card(`
    <text x="108" y="34" text-anchor="middle" font-family="${SANS}" font-size="13" font-weight="700" fill="#6b7385">这个时钟显示几点？</text>
    ${clockFace(108, 116, 70, { h: 8, m: 30 })}
    <rect x="18" y="212" width="86" height="46" rx="14" fill="#e8f7ef" stroke="#34c77b"/>
    <text x="61" y="241" text-anchor="middle" font-family="${NUM}" font-size="20" font-weight="800" fill="#1f9d5c">8:30</text>
    <circle cx="96" cy="214" r="10" fill="#34c77b"/>
    <path d="M91.5 214l3 3 5.5-6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="112" y="212" width="86" height="46" rx="14" fill="#f4f5f9"/>
    <text x="155" y="241" text-anchor="middle" font-family="${NUM}" font-size="20" font-weight="800" fill="#6b7385">6:40</text>`)
}

function printArt() {
  const sheetW = 176
  const sheetH = sheetW * 1.414
  const clocks = [
    [{ h: 3, m: 0 }, 'read'],
    [{ h: 8, m: 30 }, 'draw'],
    [{ h: 10, m: 10 }, 'draw'],
    [{ h: 6, m: 45 }, 'read'],
  ]
    .map(([time, mode], index) => {
      const cx = 20 + 46 + (index % 2) * 72
      const cy = 86 + Math.floor(index / 2) * 90
      const answer =
        mode === 'draw'
          ? `<text x="${cx}" y="${cy + 46}" text-anchor="middle" font-family="${NUM}" font-size="13" font-weight="800" fill="${INK}">${time.h}:${String(time.m).padStart(2, '0')}</text>`
          : `<rect x="${cx - 23}" y="${cy + 35}" width="18" height="14" fill="#fff" stroke="#5b6474"/><rect x="${cx + 5}" y="${cy + 35}" width="18" height="14" fill="#fff" stroke="#5b6474"/>
             <circle cx="${cx}" cy="${cy + 39}" r="1.2" fill="${DIAL}"/><circle cx="${cx}" cy="${cy + 45}" r="1.2" fill="${DIAL}"/>`
      return `${clockFace(cx, cy, 30, mode === 'read' ? time : null)}${answer}`
    })
    .join('')
  return `
    <g transform="rotate(-4 108 142)">
      <rect x="20" y="0" width="${sheetW}" height="${sheetH}" rx="6" fill="#fff" stroke="#e8ebf1" filter="url(#shadow)"/>
      <rect x="32" y="14" width="12" height="12" rx="4" fill="url(#u)"/>
      <path d="M32 33h152" stroke="#eceff3"/>
      <text x="108" y="44" text-anchor="middle" font-family="${SANS}" font-size="10" font-weight="800" fill="${INK}">认识时钟练习</text>
      <g transform="translate(0 2)">${clocks}</g>
      <path d="M32 ${sheetH - 14}h152" stroke="#eceff3"/>
    </g>`
}

/** 3D 太阳系：深色星空卡片，太阳、轨道、行星，底下一排月相。 */
function solarArt() {
  let seed = 7
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  const stars = Array.from({ length: 46 }, () =>
    `<circle cx="${(rand() * 216).toFixed(1)}" cy="${(rand() * 220).toFixed(1)}" r="${(0.5 + rand() * 1.1).toFixed(2)}" fill="#ffffff" fill-opacity="${(0.35 + rand() * 0.5).toFixed(2)}"/>`).join('')
  const cx = 108
  const cy = 128
  const orbit = (rx) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${rx * 0.42}" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="1"/>`
  const on = (rx, deg) => {
    const a = (deg * Math.PI) / 180
    return [cx + rx * Math.cos(a), cy + rx * 0.42 * Math.sin(a)].map((v) => v.toFixed(1))
  }
  const [mx, my] = on(40, 200)
  const [ex, ey] = on(64, 35)
  const [jx, jy] = on(92, 160)
  const phases = [0, 50, 90, 135, 180].map((E, i) => {
    const x = 40 + i * 34
    const y = 246
    const r = 11
    const cos = Math.cos((E * Math.PI) / 180)
    const lit = '#f4f1e6'
    const dark = '#2a3048'
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${dark}"/>
      <path d="M${x} ${y - r}A${r} ${r} 0 0 1 ${x} ${y + r}Z" fill="${lit}"/>
      <ellipse cx="${x}" cy="${y}" rx="${(Math.abs(cos) * r).toFixed(2)}" ry="${r}" fill="${E > 90 ? lit : dark}"/>`
  }).join('')
  return `
    <defs>
      <linearGradient id="space" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2446"/><stop offset="1" stop-color="#090c1a"/></linearGradient>
      <radialGradient id="glow"><stop offset="0" stop-color="#ffcc66" stop-opacity="0.7"/><stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/></radialGradient>
      <radialGradient id="sunCore" cx="0.42" cy="0.38" r="0.7"><stop offset="0" stop-color="#ffe9a8"/><stop offset="0.55" stop-color="#ffb340"/><stop offset="1" stop-color="#f1652f"/></radialGradient>
      <linearGradient id="earthFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7cc4ff"/><stop offset="1" stop-color="#2f6fe0"/></linearGradient>
      <linearGradient id="jupiterFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f1e2c8"/><stop offset="0.3" stop-color="#d9a877"/><stop offset="0.5" stop-color="#f3e6cf"/><stop offset="0.72" stop-color="#c98f5e"/><stop offset="1" stop-color="#ead6b6"/>
      </linearGradient>
      <linearGradient id="saturnFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e7bf"/><stop offset="1" stop-color="#d7b878"/></linearGradient>
    </defs>
    <rect x="0" y="0" width="216" height="284" rx="24" fill="url(#space)" filter="url(#shadow)"/>
    ${stars}
    ${orbit(40)}${orbit(64)}${orbit(92)}
    <circle cx="${cx}" cy="${cy}" r="46" fill="url(#glow)"/>
    <circle cx="${cx}" cy="${cy}" r="20" fill="url(#sunCore)"/>
    <circle cx="${mx}" cy="${my}" r="3.5" fill="#b5aca3"/>
    <circle cx="${ex}" cy="${ey}" r="7" fill="url(#earthFill)"/>
    <circle cx="${Number(ex) + 11}" cy="${Number(ey) - 6}" r="2.4" fill="#d6d3cc"/>
    <circle cx="${jx}" cy="${jy}" r="12" fill="url(#jupiterFill)"/>
    <g transform="translate(168 52) rotate(-18)">
      <path d="M-24 0a24 7 0 0 1 48 0" fill="none" stroke="#e6cf94" stroke-opacity="0.55" stroke-width="3.2"/>
      <circle r="12" fill="url(#saturnFill)"/>
      <path d="M-24 0a24 7 0 0 0 48 0" fill="none" stroke="#e6cf94" stroke-width="3.2"/>
    </g>
    <rect x="16" y="222" width="184" height="48" rx="16" fill="#ffffff" fill-opacity="0.07"/>
    ${phases}`
}

async function toolboxArt() {
  const tiles = [
    ['static/tools/copybook.png', '字帖生成'],
    ['static/tools/maths.png', '计算题'],
    ['static/tools/clock.png', '认识时钟'],
    ['static/tools/solar.png', '3D 太阳系'],
  ]
  const parts = []
  for (const [index, [file, label]] of tiles.entries()) {
    const x = 14 + (index % 2) * 104
    const y = 6 + Math.floor(index / 2) * 132
    parts.push(`
      <rect x="${x}" y="${y}" width="84" height="84" rx="24" fill="url(#glass)" stroke="#ffffff" stroke-width="1.5" filter="url(#shadow)"/>
      <image href="${await dataUri(file)}" x="${x + 15}" y="${y + 15}" width="54" height="54"/>
      <text x="${x + 42}" y="${y + 108}" text-anchor="middle" font-family="${SANS}" font-size="13" font-weight="700" fill="${INK}">${label}</text>`)
  }
  return `
    <defs>
      <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff"/><stop offset="0.55" stop-color="#f6f7fd"/><stop offset="1" stop-color="#e9ecfa"/>
      </linearGradient>
    </defs>
    ${parts.join('')}`
}

const ORANGE = ['#ff7a45', '#fff1e8']
const GREEN = ['#17824a', '#e6f5ec']
const BLUE = ['#3b82f6', '#eaf2ff']
const PURPLE = ['#7c5cf0', '#f0ecff']

const covers = [
  {
    file: 'static/share/toolbox.jpg',
    accent: '#ffb45c', accent2: '#7c5cf0',
    title: '孩子练习工具箱', sub: '字帖 · 计算题 · 时钟 · 太阳系',
    tags: [['一键生成', ...ORANGE], ['A4 打印', ...BLUE], ['持续更新', ...PURPLE]],
    art: await toolboxArt(),
  },
  {
    file: 'static/share/copybook.jpg',
    accent: '#3fbf7f', accent2: '#ffb45c',
    title: '字帖生成', sub: '汉字、英文单词都能练',
    tags: [['田字格', ...GREEN], ['拼音', ...ORANGE], ['笔顺', ...BLUE]],
    art: copybookArt(),
  },
  {
    file: 'static/share/maths.jpg',
    accent: '#ffb45c', accent2: '#3b82f6',
    title: '计算题生成', sub: '凑十法 · 破十法 · 加减混合',
    tags: [['随机出题', ...ORANGE], ['自定义', ...BLUE], ['A4 打印', ...GREEN]],
    art: mathsArt(),
  },
  {
    file: 'static/share/make10.jpg',
    accent: '#ffb45c', accent2: '#f15a36',
    title: '凑十法练习', sub: '20 以内进位加法，一看就会',
    tags: [['提示 10', ...ORANGE], ['随机出题', ...BLUE], ['A4 打印', ...GREEN]],
    art: tenArt('make10'),
  },
  {
    file: 'static/share/break10.jpg',
    accent: '#7cc4ff', accent2: '#ffb45c',
    title: '破十法练习', sub: '20 以内退位减法，一步一步拆',
    tags: [['提示 10', ...BLUE], ['随机出题', ...ORANGE], ['A4 打印', ...GREEN]],
    art: tenArt('break10'),
  },
  {
    file: 'static/share/mixed.jpg',
    accent: '#6fe0b4', accent2: '#7c5cf0',
    title: '加减混合运算', sub: '填空位置随心选，越练越灵活',
    tags: [['加减随机', ...GREEN], ['填空位置', ...PURPLE], ['A4 打印', ...ORANGE]],
    art: mixedArt(),
  },
  {
    file: 'static/share/clock.jpg',
    accent: '#7cc4ff', accent2: '#ffb45c',
    title: '认识时钟', sub: '拨一拨指针，天空跟着变',
    tags: [['拖动指针', ...BLUE], ['白天黑夜', ...ORANGE], ['小测验', ...GREEN]],
    art: clockArt(),
  },
  {
    file: 'static/share/clock-quiz.jpg',
    accent: '#6fe0b4', accent2: '#7cc4ff',
    title: '时钟小测验', sub: '拨时间、看时间，你能答对几题？',
    tags: [['拨时间', ...GREEN], ['看时间', ...BLUE], ['三档难度', ...ORANGE]],
    art: quizArt(),
  },
  {
    file: 'static/share/clock-print.jpg',
    accent: '#b9a4ff', accent2: '#ffb45c',
    title: '时钟练习题', sub: '看时间画指针，看指针填时间',
    tags: [['随机出题', ...PURPLE], ['可含秒针', ...ORANGE], ['A4 打印', ...BLUE]],
    art: printArt(),
  },
  {
    file: 'static/share/solar.jpg',
    accent: '#7cc4ff', accent2: '#ffb340',
    title: '3D 太阳系', sub: '行星大小、公转、月相和四季',
    tags: [['动手玩', ...BLUE], ['月相', ...PURPLE], ['四季', ...ORANGE]],
    art: solarArt(),
  },
]

const font = await openFontOptions()
for (const { file, ...cover } of covers) {
  const markup = frame(cover)
  const png = new Resvg(markup, { fitTo: { mode: 'width', value: W * SCALE }, font }).render().asPng()
  const out = path.join(root, file)
  await mkdir(path.dirname(out), { recursive: true })
  const image = await Jimp.read(png)
  await writeFile(out, await image.quality(80).getBufferAsync(Jimp.MIME_JPEG))
}
console.log(`rendered ${covers.length} share covers`)
