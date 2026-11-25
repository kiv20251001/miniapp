import { cloudFile } from '@/config'

/**
 * 手机上没有楷体，字帖要从云存储下载字体（scripts/build-copybook-font.mjs 生成，放在 cloud-storage/fonts），
 * 第一次下载后存在本地，之后直接读。没配置或加载失败时退回系统字体，原因记在 kaiFontIssue。
 *
 * 字帖画在离屏画布上。基础库 3.17 的离屏画布已经没有 loadFont，
 * 要用 wx.loadFontFace，并且 scopes 带上 native，画布才会用这套楷体。
 * loadFontFace 只接受 https 和 Data URL。把本地 wxfile 路径传进去时，成功和失败回调经常都不来，
 * 外层 15 秒就会误报成「下载超时」。所以用已经下好的文件读成 Data URL，临时链接只作备用。
 * 有 loadFont 的旧基础库仍优先用它，每张画布各挂一次。
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
    readFile: (options: { filePath: string; encoding?: 'base64'; success?: (res: { data: string }) => void; fail?: Fail }) => void
  }
  env: { USER_DATA_PATH: string }
  cloud?: {
    downloadFile: (options: { fileID: string; success?: (res: { tempFilePath: string }) => void; fail?: Fail }) => void
    getTempFileURL?: (options: { fileList: string[]; success?: (res: { fileList?: Array<{ tempFileURL?: string; errMsg?: string }> }) => void; fail?: Fail }) => void
  }
  loadFontFace?: (options: { family: string; source: string; global?: boolean; scopes?: string[]; success?: () => void; fail?: Fail }) => void
  createOffscreenCanvas?: (options: { type: '2d'; width: number; height: number }) => FontCanvas
  getAppBaseInfo?: () => { SDKVersion?: string }
}

const SOURCE = cloudFile('fonts/copybook-kai.woff')

let loading: Promise<boolean> | null = null
let loadId = 0
let ready = false
let fontFile = ''
/** 写 ctx.font 时用的字体名。loadFont 会返回系统起的名字，loadFontFace 用 KAI_FAMILY。 */
let face = ''
/** 只有旧基础库的 canvas.loadFont 生效时，每张画布才要再挂一次。 */
let useCanvasLoadFont = false
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

/** 自定义字体名一律加引号，避免画布把它拆成多个字体。 */
function cssFamily(family: string) {
  return `"${family.replace(/"/g, '')}"`
}

/** 供排版写 ctx.font。楷体还没挂到画布上时返回空字符串。 */
export function kaiFontFace() {
  return face ? cssFamily(face) : ''
}

/**
 * 旧基础库用 canvas.loadFont 时，每张画布都要在设完宽高后再挂一次。
 * 3.17 走 wx.loadFontFace，字体是全局的，这里不用再挂。
 */
export function mountKaiFont(canvas: { loadFont?: (path: string) => string }) {
  if (!useCanvasLoadFont || !fontFile || !canvas.loadFont) return
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

function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function readBase64(path: string) {
  return new Promise<string>((resolve, reject) => {
    api().getFileSystemManager().readFile({
      filePath: path,
      encoding: 'base64',
      success: (res) => resolve(res.data),
      fail: (err) => reject(new Error(err?.errMsg || 'read font')),
    })
  })
}

function tempUrl() {
  return new Promise<string>((resolve, reject) => {
    const cloud = api().cloud
    if (!cloud?.getTempFileURL) return reject(new Error('no temp url'))
    cloud.getTempFileURL({
      fileList: [SOURCE],
      success: (res) => {
        const url = res.fileList?.[0]?.tempFileURL
        if (url) resolve(url)
        else reject(new Error(res.fileList?.[0]?.errMsg || 'no temp url'))
      },
      fail: (err) => reject(new Error(err?.errMsg || 'no temp url')),
    })
  })
}

/**
 * 本地文件先读成 Data URL，不走网络。
 * 不用 url("wxfile://...")：这个地址不在 loadFontFace 支持范围内，真机上回调经常一直不来。
 */
function fontSources(file: string) {
  return [
    {
      family: KAI_FAMILY,
      source: async () => {
        const data = await withTimeout(readBase64(file), 8000, '读取本地楷体超时')
        return `url("data:font/woff;base64,${data}")`
      },
    },
    {
      family: `${KAI_FAMILY}2`,
      source: async () => {
        const url = await withTimeout(tempUrl(), 8000, '获取楷体链接超时')
        return `url("${url}")`
      },
    },
  ]
}

function registerFace(family: string, source: string) {
  const pending = new Promise<void>((resolve, reject) => {
    const loadFontFace = api().loadFontFace
    if (!loadFontFace) return reject(new Error(`当前基础库 ${sdkVersion()} 不能加载字体`))
    loadFontFace({
      family,
      source,
      global: true,
      scopes: ['webview', 'native'],
      success: () => resolve(),
      fail: (err) => reject(new Error(err?.errMsg || err?.status || `加载字体失败（基础库 ${sdkVersion()}）`)),
    })
  })
  return withTimeout(pending, 8000, `注册楷体超时（基础库 ${sdkVersion()}）`)
}

/** 字体挂上之后要等一帧，马上画读到的还是系统字体。读不回像素时不据此判失败。 */
async function faceApplied(canvas: FontCanvas, family: string) {
  try {
    await wait(150)
    if (canvasUsesKai(canvas, family)) return true
    await wait(400)
    return canvasUsesKai(canvas, family)
  } catch (error) {
    console.warn('[copybook] font pixel check skipped', error)
    return true
  }
}

async function resolveFamily(canvas: FontCanvas, file: string) {
  if (canvas.loadFont) {
    try {
      const family = canvas.loadFont(file)
      if (family && await faceApplied(canvas, family)) {
        useCanvasLoadFont = true
        return family
      }
    } catch (error) {
      console.warn('[copybook] canvas.loadFont failed', error)
    }
  }
  const errors: string[] = []
  for (const item of fontSources(file)) {
    try {
      await registerFace(item.family, await item.source())
      if (await faceApplied(canvas, item.family)) return item.family
      errors.push(`已注册但画布没用上（基础库 ${sdkVersion()}）`)
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }
  throw new Error(`当前基础库 ${sdkVersion()} 没能把楷体画进画布：${errors.join('；')}`)
}

async function load(id: number) {
  try {
    useCanvasLoadFont = false
    fontFile = await localFile()
    if (id !== loadId) return false
    const canvas = api().createOffscreenCanvas?.({ type: '2d', width: 64, height: 64 })
    if (!canvas) throw new Error(`当前基础库 ${sdkVersion()} 不能创建离屏画布`)
    canvas.width = 64
    canvas.height = 64
    const family = await resolveFamily(canvas, fontFile)
    if (id !== loadId) return false
    face = family
    ready = true
    kaiFontIssue = ''
    return true
  } catch (error) {
    if (id !== loadId) return false
    face = ''
    ready = false
    useCanvasLoadFont = false
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
  if (!loading) {
    const id = ++loadId
    loading = load(id)
  }
  const id = loadId
  let settled = false
  return Promise.race([
    loading.then((ok) => {
      settled = true
      return ok
    }),
    new Promise<boolean>((resolve) =>
      setTimeout(() => {
        if (!settled && id === loadId) {
          loadId += 1
          loading = null
          kaiFontIssue = fontFile
            ? `楷体已经在手机上，但基础库 ${sdkVersion()} 还没注册完成，这次先用系统字体`
            : `下载楷体超过 ${timeout / 1000} 秒，网络较慢，这次先用系统字体`
        }
        resolve(ready)
      }, timeout),
    ),
  ])
}
