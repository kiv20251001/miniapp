// 工具箱图标：白色玻璃底上的彩色图案，每个工具一种颜色。
// 字帖的「米」取自 hanzi-writer-data 的楷体笔画，页面只引用生成的 PNG。
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

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

const icons = { copybook, maths, soon }

await mkdir(outDir, { recursive: true })
for (const [name, draw] of Object.entries(icons)) {
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" fill="none">${draw()}</svg>`
  const png = new Resvg(markup, { fitTo: { mode: 'width', value: SIZE } }).render().asPng()
  await writeFile(path.join(outDir, `${name}.png`), png)
}
console.log(`rendered ${Object.keys(icons).length} tool icons`)
