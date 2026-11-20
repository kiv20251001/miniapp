// 工具箱图标：白色玻璃底上的彩色图案，每个工具一种颜色。
// 字帖的「米」取自 hanzi-writer-data 的楷体笔画，页面只引用生成的 PNG。
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import { OPEN_SANS, openFontOptions } from './open-fonts.mjs'

const require = createRequire(import.meta.url)
const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/static/tools')
const SIZE = 180

function glyph(char) {
  return require(`hanzi-writer-data/${char}.json`).strokes
}

function copybook() {
  const strokes = glyph('米')
    .map((d) => `<path d="${d}"/>`)
    .join('')
  return `
    <rect x="18" y="18" width="84" height="84" fill="#ffffff" stroke="#7d8798" stroke-width="2.6"/>
    <path d="M60 20v80M20 60h80" stroke="#b7c0ce" stroke-width="1.5" stroke-dasharray="3.5 3.5"/>
    <g fill="#17824a" fill-opacity="0.62">
      <g transform="translate(23 23) scale(0.0723) translate(0 900) scale(1 -1)">${strokes}</g>
    </g>`
}

function maths() {
  return `
    <defs>
      <linearGradient id="plus" gradientUnits="userSpaceOnUse" x1="22" y1="23" x2="58" y2="59"><stop offset="0" stop-color="#ffb45c"/><stop offset="1" stop-color="#f15a36"/></linearGradient>
      <linearGradient id="minus" gradientUnits="userSpaceOnUse" x1="62" y1="23" x2="98" y2="59"><stop offset="0" stop-color="#7cc4ff"/><stop offset="1" stop-color="#3b82f6"/></linearGradient>
      <linearGradient id="times" gradientUnits="userSpaceOnUse" x1="22" y1="61" x2="58" y2="97"><stop offset="0" stop-color="#b9a4ff"/><stop offset="1" stop-color="#7c5cf0"/></linearGradient>
      <linearGradient id="divide" gradientUnits="userSpaceOnUse" x1="62" y1="61" x2="98" y2="97"><stop offset="0" stop-color="#6fe0b4"/><stop offset="1" stop-color="#1fae7e"/></linearGradient>
    </defs>
    <g stroke-width="9" stroke-linecap="round">
      <path d="M26 41h28M40 27v28" stroke="url(#plus)"/>
      <path d="M66 41h28" stroke="url(#minus)"/>
      <path d="M29 68l22 22M51 68 29 90" stroke="url(#times)"/>
      <path d="M66 79h28" stroke="url(#divide)"/>
    </g>
    <circle cx="80" cy="67" r="5" fill="url(#divide)"/>
    <circle cx="80" cy="91" r="5" fill="url(#divide)"/>`
}

function clock() {
  const ticks = Array.from({ length: 60 }, (_, index) => {
    const major = index % 5 === 0
    const angle = (index * 6 * Math.PI) / 180
    const outer = 46
    const inner = major ? 40.5 : 43.5
    const p = (r) => [60 + r * Math.sin(angle), 60 - r * Math.cos(angle)].map((value) => value.toFixed(2)).join(' ')
    return `<path d="M${p(outer)}L${p(inner)}" stroke="${major ? '#2b3340' : '#9aa1b2'}" stroke-width="${major ? 2.4 : 1}" stroke-linecap="round"/>`
  }).join('')
  const numbers = [
    ['12', 60, 31.5],
    ['3', 89, 60],
    ['6', 60, 88.5],
    ['9', 31, 60],
  ]
    .map(([label, x, y]) => `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="${OPEN_SANS}" font-size="12" font-weight="700" fill="#2b3340">${label}</text>`)
    .join('')
  const hand = (deg, length, width, color) => {
    const angle = (deg * Math.PI) / 180
    return `<path d="M60 60L${(60 + length * Math.sin(angle)).toFixed(2)} ${(60 - length * Math.cos(angle)).toFixed(2)}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`
  }
  return `
    <defs>
      <radialGradient id="face" cx="0.5" cy="0.42" r="0.6">
        <stop offset="0.7" stop-color="#ffffff"/>
        <stop offset="1" stop-color="#eef0f5"/>
      </radialGradient>
      <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff"/>
        <stop offset="1" stop-color="#dfe3ec"/>
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="52" fill="url(#rim)"/>
    <circle cx="60" cy="60" r="48.5" fill="url(#face)" stroke="#e3e7ef" stroke-width="1"/>
    ${ticks}${numbers}
    ${hand(-60, 22, 5, '#2b3340')}
    ${hand(60, 33, 3.6, '#2b3340')}
    ${hand(200, 38, 1.4, '#f15a36')}
    <circle cx="60" cy="60" r="4" fill="#2b3340"/>
    <circle cx="60" cy="60" r="1.8" fill="#f15a36"/>`
}

function solar() {
  return `
    <defs>
      <radialGradient id="sun" cx="0.4" cy="0.36" r="0.7"><stop offset="0" stop-color="#ffe08a"/><stop offset="0.55" stop-color="#ffb340"/><stop offset="1" stop-color="#f15a36"/></radialGradient>
      <linearGradient id="earth" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7cc4ff"/><stop offset="1" stop-color="#3b82f6"/></linearGradient>
      <linearGradient id="ringed" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b9a4ff"/><stop offset="1" stop-color="#7c5cf0"/></linearGradient>
    </defs>
    <ellipse cx="60" cy="64" rx="48" ry="21" transform="rotate(-20 60 64)" stroke="#c4cad8" stroke-width="2.2"/>
    <circle cx="60" cy="64" r="20" fill="url(#sun)"/>
    <circle cx="17" cy="76" r="8" fill="url(#earth)"/>
    <g transform="translate(88 27) rotate(-20)">
      <path d="M-19 0a19 5.5 0 0 1 38 0" stroke="#7c5cf0" stroke-width="2.6" stroke-opacity="0.45"/>
      <circle r="10.5" fill="url(#ringed)"/>
      <path d="M-19 0a19 5.5 0 0 0 38 0" stroke="#7c5cf0" stroke-width="2.6"/>
    </g>`
}

function pizza() {
  const cx = 60
  const cy = 62
  const r = 40
  const slice = (index, count, color) => {
    const a0 = -Math.PI / 2 + (index * 2 * Math.PI) / count
    const a1 = a0 + (2 * Math.PI) / count
    const arc = (angle, radius) => `${(cx + Math.cos(angle) * radius).toFixed(1)} ${(cy + Math.sin(angle) * radius).toFixed(1)}`
    return `<path d="M${cx} ${cy} L${arc(a0, r)} A${r} ${r} 0 0 1 ${arc(a1, r)} Z" fill="${color}"/>`
  }
  const pepperoni = (index) => {
    const angle = -Math.PI / 2 + ((index + 0.5) * 2 * Math.PI) / 6
    return `<circle cx="${(cx + Math.cos(angle) * r * 0.55).toFixed(1)}" cy="${(cy + Math.sin(angle) * r * 0.55).toFixed(1)}" r="4" fill="#e23b2f"/>`
  }
  return `
    <circle cx="${cx}" cy="${cy}" r="${r + 7}" fill="#e39a4e"/>
    ${Array.from({ length: 6 }, (_, index) => slice(index, 6, index < 2 ? '#f6f1e8' : '#f7c873')).join('')}
    ${[2, 4].map(pepperoni).join('')}
    <circle cx="86" cy="86" r="3" fill="#3fbf7f"/>`
}

/** 3D 几何体：后面一个四棱锥，前面一个等轴测正方体和一个正八面体。 */
function cube() {
  const p = (pt) => `${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`
  const poly = (points, fill) => `<path d="M${points.map(p).join('L')}Z" fill="${fill}"/>`
  // 正方体
  const s = 30
  const c = s * Math.cos(Math.PI / 6)
  const T = [44, 52]
  const L = [T[0] - c, T[1] + s / 2]
  const R = [T[0] + c, T[1] + s / 2]
  const M = [T[0], T[1] + s]
  const LB = [L[0], L[1] + s]
  const RB = [R[0], R[1] + s]
  const B = [T[0], M[1] + s]
  // 四棱锥：底面是等轴测的正方形，只画前面两个三角形
  const apex = [82, 20]
  const baseL = [58, 58]
  const baseF = [82, 70]
  const baseR = [106, 58]
  // 正八面体
  const top = [90, 70]
  const bottom = [90, 114]
  const left = [73, 93]
  const right = [107, 93]
  const front = [86, 97]
  return `
    <defs>
      <linearGradient id="cubeTop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#ffb84d"/></linearGradient>
      <linearGradient id="cubeLeft" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9a5c"/><stop offset="1" stop-color="#f15a36"/></linearGradient>
      <linearGradient id="cubeRight" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb26b"/><stop offset="1" stop-color="#ff7a45"/></linearGradient>
      <linearGradient id="pyrLeft" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a8d8ff"/><stop offset="1" stop-color="#5aa9ff"/></linearGradient>
      <linearGradient id="pyrRight" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6fb6ff"/><stop offset="1" stop-color="#3b82f6"/></linearGradient>
      <linearGradient id="octTop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9af0c8"/><stop offset="1" stop-color="#3fcf8e"/></linearGradient>
      <linearGradient id="octBottom" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3fcf8e"/><stop offset="1" stop-color="#14a86b"/></linearGradient>
    </defs>
    <g stroke="#ffffff" stroke-width="2.2" stroke-linejoin="round">
      ${poly([apex, baseL, baseF], 'url(#pyrLeft)')}
      ${poly([apex, baseF, baseR], 'url(#pyrRight)')}
      ${poly([T, R, M, L], 'url(#cubeTop)')}
      ${poly([L, M, B, LB], 'url(#cubeLeft)')}
      ${poly([M, R, RB, B], 'url(#cubeRight)')}
      ${poly([top, left, front], 'url(#octTop)')}
      ${poly([top, front, right], 'url(#octTop)')}
      ${poly([left, bottom, front], 'url(#octBottom)')}
      ${poly([front, bottom, right], 'url(#octBottom)')}
    </g>`
}

function soon() {
  return `
    <defs>
      <linearGradient id="mark" gradientUnits="userSpaceOnUse" x1="36" y1="22" x2="84" y2="98">
        <stop offset="0" stop-color="#c3c9d6"/>
        <stop offset="1" stop-color="#8f97a8"/>
      </linearGradient>
    </defs>
    <path d="M42 44c0-11 8.5-18 18-18s18 6.8 18 16.5c0 7.5-4.6 11.6-10 15.2-4.8 3.2-8 5.6-8 11.3v3" stroke="url(#mark)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="60" cy="91" r="6.5" fill="url(#mark)"/>`
}

const icons = { copybook, maths, clock, pizza, solar, cube, soon }

await mkdir(outDir, { recursive: true })
const font = await openFontOptions()
for (const [name, draw] of Object.entries(icons)) {
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" fill="none">${draw()}</svg>`
  const png = new Resvg(markup, { fitTo: { mode: 'width', value: SIZE }, font }).render().asPng()
  await writeFile(path.join(outDir, `${name}.png`), png)
}
console.log(`rendered ${Object.keys(icons).length} tool icons`)
