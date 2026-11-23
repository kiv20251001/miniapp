import { cloudFile } from '@/config'

/**
 * 手机上没有楷体，字帖要从云存储下载字体（scripts/build-copybook-font.mjs 生成，放在 cloud-storage/fonts），
 * 第一次下载后存在本地，之后直接读。没配置或加载失败时退回系统字体，原因记在 kaiFontIssue。
 *
 * 字帖画在离屏画布上。wx.loadFontFace 只注册给页面，离屏画布不认这个名字，
 * 要在每一张画布上调用 canvas.loadFont(本地文件)，用它返回的字体名来写。
 */
export const KAI_FAMILY = 'UdayKai'

type Fail = (err: { errMsg?: string; status?: string }) => void

type Pen = {
  font: string
  fillStyle: string
  textBaseline: string
  clearRect: (x: number, y: number, w: number, h: number) => void
  fillText: (text: string, x: number, y: number) => void
  getImageData: (x: number, y: number, w: number, h: number) => { data: ArrayLike<number> }
}

type FontCanvas = {
  width: number
  height: number
  loadFont?: (path: string) => string
  getContext: (kind: '2d') => Pen
}

type FontApi = {
  getFileSystemManager: () => {
    access: (options: { path: string; success?: () => void; fail?: Fail }) => void
    copyFile: (options: { srcPath: string; destPath: string; success?: () => void; fail?: Fail }) => void
  }
  env: { USER_DATA_PATH: string }
  cloud?: { downloadFile: (options: { fileID: string; success?: (res: { tempFilePath: string }) => void; fail?: Fail }) => void }
  createOffscreenCanvas?: (options: { type: '2d'; width: number; height: number }) => FontCanvas
  getAppBaseInfo?: () => { SDKVersion?: string }
}

const SOURCE = cloudFile('fonts/copybook-kai.woff')

let loading: Promise<boolean> | null = null
let ready = false
let fontFile = ''
/** canvas.loadFont 返回的字体名，写 ctx.font 时用它，不能用自己起的别名 */
let face = ''
/** 最近一次没用上楷体的原因，开发版、体验版生成时弹出来方便排查。 */
export let kaiFontIssue = SOURCE ? '' : '没有配置云存储：.env 的 VITE_CLOUD_STORAGE_DEV / VITE_CLOUD_STORAGE_PROD 是空的，填好后要重新打包'

function api() {
  return wx as unknown as FontApi
}

function sdkVersion() {
  try {
    return api().getAppBaseInfo?.().SDKVersion || '?'
  } catch {
    return '?'
  }
}

function hash(value: string) {
  let h = 0
  for (let index = 0; index < value.length; index += 1) h = (h * 31 + value.charCodeAt(index)) | 0
  return (h >>> 0).toString(36)
}

function exists(path: string) {
  return new Promise<boolean>((resolve) => {
    api().getFileSystemManager().access({ path, success: () => resolve(true), fail: () => resolve(false) })
  })
}

function download() {
  return new Promise<string>((resolve, reject) => {
    const cloud = api().cloud
    if (!cloud) return reject(new Error('wx.cloud 不可用'))
    cloud.downloadFile({
      fileID: SOURCE,
      success: (res) => resolve(res.tempFilePath),
      fail: (err) => reject(new Error(`下载 ${SOURCE} 失败：${err?.errMsg || ''}`)),
    })
  })
}

async function localFile() {
  const cached = `${api().env.USER_DATA_PATH}/copybook-kai-${hash(SOURCE)}.woff`
  if (await exists(cached)) return cached
  const temp = await download()
  return new Promise<string>((resolve) => {
    api().getFileSystemManager().copyFile({ srcPath: temp, destPath: cached, success: () => resolve(cached), fail: () => resolve(temp) })
  })
}

/** 有空格的字体名必须加引号，否则画布只认第一个词。 */
function cssFamily(family: string) {
  const name = family.replace(/"/g, '')
  return /[\s,]/.test(name) ? `"${name}"` : name
}

/** 供排版写 ctx.font。楷体还没挂到画布上时返回空字符串。 */
export function kaiFontFace() {
  return face ? cssFamily(face) : ''
}

/**
 * 把已下载的字体挂到这一张离屏画布上。每张画布都要挂一次，改画布宽高会把字体清掉，所以要在设完宽高之后调用。
 */
export function mountKaiFont(canvas: { loadFont?: (path: string) => string }) {
  if (!fontFile || !canvas.loadFont) return
  try {
    const family = canvas.loadFont(fontFile)
    if (family) face = family
  } catch (error) {
    console.warn('[copybook] canvas.loadFont failed', error)
  }
}

/** 同一个字分别用楷体和系统字体画一遍，像素不同才说明这张画布真的用上了楷体。 */
function canvasUsesKai(canvas: FontCanvas, family: string) {
  const pen = canvas.getContext('2d')
  const draw = (css: string) => {
    pen.clearRect(0, 0, canvas.width, canvas.height)
    pen.font = `48px ${css}`
    pen.fillStyle = '#000'
    pen.textBaseline = 'top'
    pen.fillText('\u6c38', 2, 2)
    return Array.from(pen.getImageData(0, 0, canvas.width, canvas.height).data)
  }
  const kai = draw(cssFamily(family))
  const plain = draw('sans-serif')
  const ink = (data: number[]) => data.reduce((count, value, index) => count + (index % 4 === 3 && value > 48 ? 1 : 0), 0)
  // 开发者工具有时读不回文字像素，两边都是空白时无法比较，不据此判失败
  if (ink(kai) < 10 && ink(plain) < 10) return true
  let diff = 0
  for (let index = 3; index < kai.length; index += 4) if (Math.abs(kai[index] - plain[index]) > 48) diff += 1
  return diff > 30
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function load() {
  try {
    fontFile = await localFile()
    const canvas = api().createOffscreenCanvas?.({ type: '2d', width: 64, height: 64 })
    if (!canvas?.loadFont) throw new Error(`当前基础库 ${sdkVersion()} 的画布不能加载字体文件`)
    canvas.width = 64
    canvas.height = 64
    const family = canvas.loadFont(fontFile)
    if (!family) throw new Error(`画布没有用上字体文件（基础库 ${sdkVersion()}）`)
    face = family
    // 字体挂上之后要等一帧，马上画读到的还是系统字体
    await wait(150)
    if (!canvasUsesKai(canvas, family)) {
      await wait(400)
      if (!canvasUsesKai(canvas, family)) throw new Error(`字体已下载，但画布没有用上（基础库 ${sdkVersion()}）`)
    }
    ready = true
    kaiFontIssue = ''
    return true
  } catch (error) {
    kaiFontIssue = error instanceof Error ? error.message : String(error)
    console.warn('[copybook] kai font unavailable, using system font', error)
    loading = null
    return false
  }
}

/** 楷体已经能在画布上用。 */
export function kaiFontReady() {
  return ready
}

/** 页面打开时先调一次预下载；生成前再等它，最多等 timeout 毫秒。 */
export function loadKaiFont(timeout = 15000) {
  if (!SOURCE) return Promise.resolve(false)
  if (!loading) loading = load()
  let settled = false
  return Promise.race([
    loading.then((ok) => {
      settled = true
      return ok
    }),
    new Promise<boolean>((resolve) =>
      setTimeout(() => {
        if (!settled) kaiFontIssue = `下载楷体超过 ${timeout / 1000} 秒，网络较慢，这次先用系统字体`
        resolve(ready)
      }, timeout),
    ),
  ])
}
