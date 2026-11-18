// 生成分享图、工具图标时用的字体。只用开源字体，不读本机系统字体：
// 苹方、冬青黑、微软雅黑、Helvetica 这类系统字体只授权给系统显示用，把字画进图片随小程序发布有版权风险。
// 思源黑体 Noto Sans SC 是 SIL OFL 1.1，可免费商用。字体文件下载到 fonts/（不入库）。
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fontDir = path.join(root, 'fonts')
const BASE = 'https://github.com/notofonts/noto-cjk/raw/main/Sans/SubsetOTF/SC'
const FILES = ['NotoSansSC-Regular.otf', 'NotoSansSC-Bold.otf']

/** SVG 里 font-family 写这个。 */
export const OPEN_SANS = "'Noto Sans SC'"

/** 传给 new Resvg(svg, { font: await openFontOptions() })。 */
export async function openFontOptions() {
  mkdirSync(fontDir, { recursive: true })
  const fontFiles = []
  for (const name of FILES) {
    const file = path.join(fontDir, name)
    if (!existsSync(file)) {
      console.log(`下载 ${BASE}/${name}`)
      const response = await fetch(`${BASE}/${name}`)
      if (!response.ok) throw new Error(`下载字体失败：HTTP ${response.status}`)
      writeFileSync(file, Buffer.from(await response.arrayBuffer()))
    }
    fontFiles.push(file)
  }
  return { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Noto Sans SC', sansSerifFamily: 'Noto Sans SC' }
}
