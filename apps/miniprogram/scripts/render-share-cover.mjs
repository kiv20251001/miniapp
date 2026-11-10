// 微信分享卡片用的推广海报，比例 5:4。聊天里会缩得很小，所以字少、对比高。
// 用法：node scripts/render-share-cover.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const logo = fs.readFileSync(path.join(root, 'src/static/logo-u.svg'), 'utf8')
const glyph = logo.match(/d="([^"]+)"/)?.[1] || ''
const font = 'Microsoft YaHei, PingFang SC, sans-serif'

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="750" height="600" viewBox="0 0 750 600">
  <defs>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffb45c"/>
      <stop offset="0.48" stop-color="#ff7a45"/>
      <stop offset="1" stop-color="#f15a36"/>
    </linearGradient>
    <linearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFF4EC"/>
      <stop offset="0.55" stop-color="#F6F4FB"/>
      <stop offset="1" stop-color="#EEF3FB"/>
    </linearGradient>
  </defs>
  <rect width="750" height="600" fill="url(#wash)"/>
  <circle cx="640" cy="-20" r="210" fill="#FFB45C" opacity="0.22"/>
  <circle cx="40" cy="560" r="180" fill="#45CDB5" opacity="0.16"/>
  <circle cx="700" cy="520" r="90" fill="#8B64EE" opacity="0.08"/>

  <rect x="327" y="52" width="96" height="96" rx="30" fill="url(#brand)"/>
  <g transform="translate(349 70) scale(0.52)">
    <path fill="#fff" d="${glyph}"/>
  </g>

  <text x="375" y="196" text-anchor="middle" fill="#1B2030" font-family="${font}" font-size="40" font-weight="700">Uday</text>
  <text x="375" y="232" text-anchor="middle" fill="#E85B2A" font-family="${font}" font-size="18" font-weight="700">家庭课表计划</text>

  <text x="375" y="312" text-anchor="middle" fill="#1B2030" font-family="${font}" font-size="40" font-weight="700">今天上什么课</text>
  <text x="375" y="364" text-anchor="middle" fill="#1B2030" font-family="${font}" font-size="40" font-weight="700">家人一起看</text>

  <rect x="78" y="412" width="180" height="56" rx="28" fill="#FFF0E8"/>
  <text x="168" y="448" text-anchor="middle" fill="#E85B2A" font-family="${font}" font-size="20" font-weight="700">上课时间</text>
  <rect x="285" y="412" width="180" height="56" rx="28" fill="#EAF2FF"/>
  <text x="375" y="448" text-anchor="middle" fill="#3C6FE0" font-family="${font}" font-size="20" font-weight="700">课程支出</text>
  <rect x="492" y="412" width="180" height="56" rx="28" fill="#E7F8F4"/>
  <text x="582" y="448" text-anchor="middle" fill="#1FA98C" font-family="${font}" font-size="20" font-weight="700">邀请家人</text>

  <text x="375" y="530" text-anchor="middle" fill="#8B93A5" font-family="${font}" font-size="18">Plan Your Day. Grow Your Way.</text>
</svg>`

const png = new Resvg(svg, { fitTo: { mode: 'width', value: 500 } }).render().asPng()
const Jimp = (await import('jimp')).default
const image = await Jimp.read(png)
const jpeg = await image.quality(72).getBufferAsync(Jimp.MIME_JPEG)
const out = path.join(root, 'src/static/share-cover.jpg')
fs.writeFileSync(out, jpeg)
fs.rmSync(path.join(root, 'src/static/share-cover.png'), { force: true })
console.log(`share-cover.jpg ${(jpeg.length / 1024).toFixed(1)} KB`)
