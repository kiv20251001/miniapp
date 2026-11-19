import { cloudFile } from '@/config'

/**
 * 手机上没有楷体，字帖要从云存储下载字体（scripts/build-copybook-font.mjs 生成，放在 cloud-storage/fonts），
 * 第一次下载后存在本地，之后直接读。没配置或加载失败时退回系统字体，原因记在 kaiFontIssue。
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

type FontApi = {
  loadFontFace: (options: { family: string; source: string; global?: boolean; scopes?: string[]; success?: () => void; fail?: Fail }) => void
  getFileSystemManager: () => {
    access: (options: { path: string; success?: () => void; fail?: Fail }) => void
    copyFile: (options: { srcPath: string; destPath: string; success?: () => void; fail?: Fail }) => void
    readFile: (options: { filePath: string; encoding: 'base64'; success?: (res: { data: string }) => void; fail?: Fail }) => void
  }
  env: { USER_DATA_PATH: string }
  cloud?: { downloadFile: (options: { fileID: string; success?: (res: { tempFilePath: string }) => void; fail?: Fail }) => void }
  createOffscreenCanvas?: (options: { type: '2d'; width: number; height: number }) => { getContext: (kind: '2d') => Pen }
  getAppBaseInfo?: () => { SDKVersion?: string }
}

const SOURCE = cloudFile('fonts/copybook-kai.woff')

let loading: Promise<boolean> | null = null
let ready = false
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

function readBase64(filePath: string) {
  return new Promise<string>((resolve, reject) => {
    api().getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success: (res) => resolve(res.data),
      fail: (err) => reject(new Error(`读取字体文件失败：${err?.errMsg || ''}`)),
    })
  })
}

function register(base64: string) {
  return new Promise<void>((resolve, reject) => {
    api().loadFontFace({
      family: KAI_FAMILY,
      source: `url("data:font/woff;base64,${base64}")`,
      global: true,
      scopes: ['webview', 'native'],
      success: () => resolve(),
      fail: (err) => reject(new Error(`注册字体失败（基础库 ${sdkVersion()}，需要 3.7.9 以上）：${err?.status || err?.errMsg || ''}`)),
    })
  })
}

/** 同一个字分别用楷体和系统字体画一遍，像素不同才说明画布真的用上了楷体。 */
function canvasUsesKai() {
  const canvas = api().createOffscreenCanvas?.({ type: '2d', width: 48, height: 48 })
  if (!canvas) return true
  const pen = canvas.getContext('2d')
  const draw = (family: string) => {
    pen.clearRect(0, 0, 48, 48)
    pen.font = `40px ${family}`
    pen.fillStyle = '#000'
    pen.textBaseline = 'top'
    pen.fillText('\u6c38', 4, 4)
    return Array.from(pen.getImageData(0, 0, 48, 48).data)
  }
  const kai = draw(`"${KAI_FAMILY}"`)
  const plain = draw('sans-serif')
  let diff = 0
  for (let index = 3; index < kai.length; index += 4) if (Math.abs(kai[index] - plain[index]) > 64) diff += 1
  return diff > 20
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function load() {
  try {
    await register(await readBase64(await localFile()))
    if (!canvasUsesKai()) {
      await wait(300)
      if (!canvasUsesKai()) throw new Error(`字体已下载并注册，但画布没有用上（基础库 ${sdkVersion()}）`)
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
