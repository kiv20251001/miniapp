import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/static/icons')

const course = {
  school: '<path d="m3 10 9-5 9 5-9 5-9-5Zm4 2.2V18c3.2 1.5 6.8 1.5 10 0v-5.8M21 10v6"/>',
  sport: '<circle cx="12" cy="12" r="8"/><path d="M6.2 7.2c3 1.3 5.1 3.2 6.2 5.8m5.4 3.8c-3-1.3-5.1-3.2-6.2-5.8M7 18c2.1-2.7 5.2-4.5 9.6-5.2M17 6c-2.1 2.7-5.2 4.5-9.6 5.2"/>',
  math: '<path d="M5 7h6m-3-3v6m6-3h5M5 16l5 5m0-5-5 5m10-4h4m-4 4h4"/>',
  reading: '<path d="M4 5.5c3-.8 5.7-.2 8 1.8v12c-2.3-2-5-2.6-8-1.8v-12Zm16 0c-3-.8-5.7-.2-8 1.8v12c2.3-2 5-2.6 8-1.8v-12Z"/>',
  music: '<path d="M9 18V6l10-2v12M9 10l10-2"/><circle cx="6.5" cy="18.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>',
  swimming: '<circle cx="17" cy="5" r="2"/><path d="m5 13 4-4 4 3 3-2 3 3M3 16c2 0 2 1.5 4 1.5S9 16 11 16s2 1.5 4 1.5S17 16 19 16s2 1.5 2 1.5M3 20c2 0 2 1.5 4 1.5S9 20 11 20s2 1.5 4 1.5S17 20 19 20s2 1.5 2 1.5"/>',
  english: '<path d="M5 19 10 5l5 14M7 14h6m3-5h4m-2-2v8m-2 4 4-4"/>',
  calligraphy: '<path d="m16 3 5 5L10 19l-6 2 2-6L16 3Zm-8.5 11.5 5 5M14 5l5 5"/>',
  homework: '<path d="M12.5 21H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h7l4 4v4.5M14 3v4h4M9 11h5M9 15h3"/><path d="m15.5 20.5 5-5a1.4 1.4 0 0 0-2-2l-5 5-.5 2.5 2.5-.5Z"/>',
  generic: '<path d="M10 4.6a2 2 0 0 1 4 0V5"/><path d="M6 11a6 6 0 0 1 12 0v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-8Z"/><path d="M6 13.5H4.6v4.5H6M18 13.5h1.4v4.5H18"/><path d="M10 10.6v2.6a2 2 0 0 0 4 0v-2.6M8.8 17.8h6.4"/>',
}

const ui = {
  clock: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.4V12l3.3 2"/>',
  alarm: '<path d="M5 4.5 7.2 6.4M19 4.5 16.8 6.4"/><circle cx="12" cy="13" r="6.6"/><path d="M12 10v3.2l2.2 1.3M6.2 19.2 4.8 21M17.8 19.2 19.2 21"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Zm9.5-13.5 4 4"/>',
  undo: '<path d="M9 7 5 11l4 4"/><path d="M5 11h9a5 5 0 0 1 0 10h-2"/>',
  calendar: '<path d="M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Zm2-2v4m10-4v4M4 10h16M8 14h2m4 0h2m-8 3h2m4 0h2"/>',
  book: '<path d="M4 5.5c3-.8 5.7-.2 8 1.8v12c-2.3-2-5-2.6-8-1.8v-12Zm16 0c-3-.8-5.7-.2-8 1.8v12c2.3-2 5-2.6 8-1.8v-12Z"/>',
  bars: '<path d="M5 20V10h3v10H5Zm6 0V4h3v16h-3Zm6 0v-7h3v7h-3Z"/>',
  bill: '<path d="M7 4h10v16l-5-3-5 3V4Zm3 4h4m-4 4h4"/>',
  clipboard: '<path d="M8 3h8v4H8zM6 7h12v14H6zM9 11h6m-6 4h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  family: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19.5c.6-3.1 2.8-5.2 5.5-5.2s4.9 2.1 5.5 5.2"/><circle cx="16.8" cy="9.6" r="2.3"/><path d="M15.6 14.4c2.6-.4 4.5 1.4 4.9 4.4"/>',
  image: '<path d="M4.5 6.5A2 2 0 0 1 6.5 4.5h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-11Z"/><circle cx="9" cy="9.5" r="1.5"/><path d="m5 16.5 3.6-3.2a1.4 1.4 0 0 1 1.8 0L14 16.2l1.5-1.2a1.4 1.4 0 0 1 1.8 0L20 17"/>',
  share: '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1"/>',
  shuffle: '<path d="M4 7h11M15 7l-3-3M15 7l-3 3M20 17H9M9 17l3-3M9 17l3 3"/>',
  toolbox: '<g stroke-width="1.5"><rect x="2.65" y="8.85" width="18.7" height="11.65" rx="2.6"/><path d="M8 9.6V8.4c0-1.5 1.7-2.4 4-2.4s4 .9 4 2.4v1.2M2.65 14.1h7.25m4.2 0h7.25"/><rect x="9.9" y="12.2" width="4.2" height="3.6" rx="1"/></g>',
  eraser: '<path d="M4.2 13.2 12.8 4.6a2 2 0 0 1 2.8 0l3.8 3.8a2 2 0 0 1 0 2.8L11 19.6H6.6L4.2 17a2.2 2.2 0 0 1 0-3.8Z"/><path d="M7 19.6h13"/>',
  // 3D 几何体工具栏：透视、配色、长宽高、拆开、摆正
  xray: '<path d="M12 3.5 4.5 7.8v8.4l7.5 4.3 7.5-4.3V7.8L12 3.5Z"/><path d="M12 12v8.5M12 12l7.5-4.2M12 12 4.5 7.8" stroke-dasharray="2.2 2.2"/>',
  palette: '<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.3 0 1.9-1 1.4-2-.6-1.3.3-2.6 1.7-2.6h1.7a3.7 3.7 0 0 0 3.7-3.7c0-4.9-3.8-8.7-8.5-8.7Z"/><circle cx="7.7" cy="11.2" r="1.15"/><circle cx="10.6" cy="7.5" r="1.15"/><circle cx="15.2" cy="7.9" r="1.15"/>',
  axes: '<path d="M12 13V3.8M12 13l-7.6 4.4M12 13l7.6 4.4M9.8 6l2.2-2.2L14.2 6M4.2 14.3l.2 3.1 3 .7M16.6 18.1l3-.7.2-3.1"/>',
  split: '<path d="M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z"/>',
  recenter: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.8 4.2v4h-4"/><circle cx="12" cy="12" r="1.6"/>',
}

const tones = {
  white: '#ffffff',
  muted: '#8c93a3',
  accent: '#e85b2a',
  ink: '#81798d',
  violet: '#7048df',
}

function svg(body, color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
}

function dots(color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>`
}

await mkdir(outDir, { recursive: true })

// 传图标名只重画这几个：node scripts/render-icons.mjs generic share
const only = new Set(process.argv.slice(2))
const jobs = []
for (const [name, body] of Object.entries({ ...course, ...ui })) {
  if (only.size && !only.has(name)) continue
  for (const [tone, color] of Object.entries(tones)) {
    jobs.push([`${name}-${tone}`, svg(body, color)])
  }
}
for (const [tone, color] of Object.entries(tones)) {
  if (only.size && !only.has('dots')) continue
  jobs.push([`dots-${tone}`, dots(color)])
}

// 输出矢量 SVG：任何尺寸、任何屏幕都清晰，单个只有几百字节（代码包图片合计要在 200K 以内）。
for (const [name, markup] of jobs) {
  await writeFile(path.join(outDir, `${name}.svg`), markup)
}

console.log(`rendered ${jobs.length} icons`)
