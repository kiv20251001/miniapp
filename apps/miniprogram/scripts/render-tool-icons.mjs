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

const icons = { copybook, maths, clock, solar, soon }

await mkdir(outDir, { recursive: true })
const font = await openFontOptions()
for (const [name, draw] of Object.entries(icons)) {
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" fill="none">${draw()}</svg>`
  const png = new Resvg(markup, { fitTo: { mode: 'width', value: SIZE }, font }).render().asPng()
  await writeFile(path.join(outDir, `${name}.png`), png)
}
console.log(`rendered ${Object.keys(icons).length} tool icons`)
