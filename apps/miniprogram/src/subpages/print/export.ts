import { PAGE_H, PAGE_W, type SheetPen } from './sheet'
import { buildPdf } from './pdf'

type Offscreen = {
  width: number
  height: number
  getContext: (kind: '2d') => SheetPen
}

type WxFile = {
  readFile: (options: { filePath: string; success?: (res: { data: ArrayBuffer }) => void; fail?: (err: { errMsg?: string }) => void }) => void
  writeFile: (options: { filePath: string; data: ArrayBuffer; success?: () => void; fail?: (err: { errMsg?: string }) => void }) => void
  copyFile: (options: { srcPath: string; destPath: string; success?: () => void; fail?: (err: { errMsg?: string }) => void }) => void
}

type WxApi = {
  createOffscreenCanvas?: (options: { type: '2d'; width: number; height: number }) => Offscreen
  canvasToTempFilePath: (options: {
    canvas: Offscreen
    fileType: 'jpg'
    quality: number
    destWidth: number
    destHeight: number
    success?: (res: { tempFilePath: string }) => void
    fail?: (err: { errMsg?: string }) => void
  }) => void
  getFileSystemManager: () => WxFile
  env: { USER_DATA_PATH: string }
  openDocument: (options: { filePath: string; fileType: 'pdf'; showMenu: boolean; success?: () => void; fail?: (err: { errMsg?: string }) => void }) => void
}

function wxApi() {
  return wx as unknown as WxApi
}

function createCanvas() {
  const api = wxApi()
  const canvas = api.createOffscreenCanvas?.({ type: '2d', width: PAGE_W, height: PAGE_H })
  if (!canvas) throw new Error('当前微信版本不支持生成字帖，请升级微信后再试')
  canvas.width = PAGE_W
  canvas.height = PAGE_H
  return canvas
}

function exportJpeg(canvas: Offscreen, quality: number) {
  return new Promise<string>((resolve, reject) => {
    wxApi().canvasToTempFilePath({
      canvas,
      fileType: 'jpg',
      quality,
      destWidth: PAGE_W,
      destHeight: PAGE_H,
      success: (res) => resolve(res.tempFilePath),
      fail: (err) => reject(new Error(err?.errMsg || '生成图片失败')),
    })
  })
}

/** 逐页画到离屏画布，返回可预览的临时图片。 */
export async function renderPages(count: number, draw: (pen: SheetPen, index: number) => void, quality = 0.92) {
  const files: string[] = []
  for (let index = 0; index < count; index += 1) {
    const canvas = createCanvas()
    draw(canvas.getContext('2d'), index)
    files.push(await exportJpeg(canvas, quality))
  }
  return files
}

/** 相册接口认稳定路径。离屏画布的临时文件有时会在保存前失效。 */
export function persistSheetImage(filePath: string, index: number) {
  return new Promise<string>((resolve) => {
    const dest = `${wxApi().env.USER_DATA_PATH}/uday-sheet-${Date.now()}-${index}.jpg`
    wxApi().getFileSystemManager().copyFile({
      srcPath: filePath,
      destPath: dest,
      success: () => resolve(dest),
      fail: () => resolve(filePath),
    })
  })
}

function readFile(path: string) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    wxApi().getFileSystemManager().readFile({
      filePath: path,
      success: (res) => resolve(res.data),
      fail: (err) => reject(new Error(err?.errMsg || '读取图片失败')),
    })
  })
}

/** 把已经生成的页面收成一份 A4 PDF，并交给微信打开，方便转发和打印。 */
export async function openSheetPdf(files: string[], name = 'uday-copybook') {
  const images = []
  for (const file of files) {
    const data = new Uint8Array(await readFile(file))
    images.push({ data, width: PAGE_W, height: PAGE_H })
  }
  const bytes = buildPdf(images)
  const api = wxApi()
  const path = `${api.env.USER_DATA_PATH}/${name}.pdf`
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  await new Promise<void>((resolve, reject) => {
    api.getFileSystemManager().writeFile({
      filePath: path,
      data: buffer,
      success: () => resolve(),
      fail: (err) => reject(new Error(err?.errMsg || 'PDF 保存失败')),
    })
  })
  await new Promise<void>((resolve, reject) => {
    api.openDocument({
      filePath: path,
      fileType: 'pdf',
      showMenu: true,
      success: () => resolve(),
      fail: (err) => reject(new Error(err?.errMsg || '打开 PDF 失败')),
    })
  })
}
