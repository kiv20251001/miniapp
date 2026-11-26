import { cloudFile } from '@/config'

/**
 * 手机上没有楷体，字帖要从云存储下载字体（scripts/build-copybook-font.mjs 生成，放在 cloud-storage/fonts），
 * 第一次下载后存在本地，之后直接读。没配置或加载失败时退回系统字体。
 *
 * 电脑开发者工具是 Chromium，WOFF 和带引号的字体名都能画进离屏画布。
 * 手机基础库 3.17 的离屏画布不吃 WOFF：loadFontFace 会回调成功，像素却还是系统字体。
 * 所以字体改成 TTF，家族名改成不含空格的 UdayKai（OFL 也不许派生字体继续叫霞鹜 / LXGW）。
 * 注册成功后用新画布再画一次才算数；离屏画布仍然不用时，改画到页面上那张隐藏的 canvas。
 * loadFontFace 不接受 wxfile 路径，本地文件读成 Data URL，临时 https 链接只作备用。
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

const SOURCE = cloudFile('fonts/copybook-kai.ttf')

let loading: Promise<boolean> | null = null
let loadId = 0
let ready = false
let fontFile = ''
/** 写进 ctx.font 的那一段，带不带引号以真机实际画出来的为准。 */
let faceCss = ''
/** loadFont 只对调用它的那张画布生效，每一页都要再挂一次。 */
let perCanvas = false
/** offscreen：每页新建离屏画布。screen：手机离屏画布不用自定义字体，改画页面里的隐藏画布。 */
let drawTarget: 'offscreen' | 'screen' = 'offscreen'
let pageCanvas: (() => Promise<FontCanvas | null>) | null = null
/** 最近一次没用上楷体的原因，只打在控制台，页面上给用户看的是另外一句。 */
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
  const cached = `${api().env.USER_DATA_PATH}/copybook-kai-${hash(SOURCE)}.ttf`
  if (await exists(cached)) return cached
  const temp = await download()
  return new Promise<string>((resolve) => {
    api().getFileSystemManager().copyFile({ srcPath: temp, destPath: cached, success: () => resolve(cached), fail: () => resolve(temp) })
  })
}

/** 页面准备好隐藏画布后调用。手机离屏画布不用楷体时，字帖画在这张画布上。 */
export function bindKaiCanvas(getter: () => Promise<FontCanvas | null>) {
  pageCanvas = getter
}

export function kaiUsesScreen() {
  return drawTarget === 'screen'
}

export function takeKaiCanvas() {
  if (!pageCanvas) return Promise.reject(new Error('字帖画布还没准备好'))
  return pageCanvas().then((canvas) => {
    if (!canvas) throw new Error('字帖画布还没准备好')
    return canvas
  })
}

/** 供排版写 ctx.font。楷体还没挂到画布上时返回空字符串。 */
export function kaiFontFace() {
  return faceCss
}

/**
 * 旧基础库用 canvas.loadFont 时，每张画布都要在设完宽高后再挂一次。
 * loadFontFace 注册的字体是全局的，这里不用再挂。
 */
export function mountKaiFont(canvas: { loadFont?: (path: string) => string }) {
  if (!perCanvas || !fontFile || !canvas.loadFont) return
  try {
    const family = canvas.loadFont(fontFile)
    if (family) faceCss = faceCss.startsWith('"') ? `"${family.replace(/"/g, '')}"` : family
  } catch (error) {
    console.warn('[copybook] canvas.loadFont failed', error)
  }
}

function snapshot(canvas: FontCanvas, css: string) {
  const pen = canvas.getContext('2d')
  pen.clearRect(0, 0, canvas.width, canvas.height)
  pen.font = `48px ${css}`
  pen.fillStyle = '#000'
  pen.textBaseline = 'top'
  pen.fillText('\u6c38', 2, 2)
  return Array.from(pen.getImageData(0, 0, canvas.width, canvas.height).data)
}

function ink(data: number[]) {
  return data.reduce((count, value, index) => count + (index % 4 === 3 && value > 48 ? 1 : 0), 0)
}

/**
 * 同一个字分别用楷体和系统字体画一遍。
 * 带引号和不带引号各试一次：电脑认引号，部分手机的原生画布只认不带引号的名字。
 * 开发者工具有时读不回文字像素，两边都是空白时无法比较，不据此判失败。
 */
function appliedCss(canvas: FontCanvas, family: string) {
  const plain = snapshot(canvas, 'sans-serif')
  const quoted = `"${family.replace(/"/g, '')}"`
  const plainInk = ink(plain)
  for (const css of [quoted, family]) {
    const kai = snapshot(canvas, css)
    const kaiInk = ink(kai)
    if (kaiInk < 10 && plainInk < 10) return quoted
    let diff = 0
    for (let index = 3; index < kai.length; index += 4) if (Math.abs(kai[index] - plain[index]) > 48) diff += 1
    if (diff > 30) return css
  }
  return ''
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

function offscreen() {
  const canvas = api().createOffscreenCanvas?.({ type: '2d', width: 64, height: 64 })
  if (!canvas) return null
  canvas.width = 64
  canvas.height = 64
  return canvas
}

async function screen() {
  const canvas = await pageCanvas?.()
  if (!canvas) return null
  canvas.width = 64
  canvas.height = 64
  return canvas
}

/** 字体挂上之后要等一帧，马上画读到的还是系统字体。 */
async function faceApplied(canvas: FontCanvas, family: string) {
  try {
    await wait(200)
    const first = appliedCss(canvas, family)
    if (first) return first
    await wait(600)
    return appliedCss(canvas, family)
  } catch (error) {
    console.warn('[copybook] font pixel check skipped', error)
    return `"${family.replace(/"/g, '')}"`
  }
}

function registerFace(family: string, source: string, scopes: string[]) {
  const pending = new Promise<void>((resolve, reject) => {
    const loadFontFace = api().loadFontFace
    if (!loadFontFace) return reject(new Error(`当前基础库 ${sdkVersion()} 不能加载字体`))
    loadFontFace({
      family,
      source,
      global: true,
      scopes,
      success: () => resolve(),
      fail: (err) => reject(new Error(err?.errMsg || err?.status || `加载字体失败（基础库 ${sdkVersion()}）`)),
    })
  })
  return withTimeout(pending, 20000, `注册楷体超时（基础库 ${sdkVersion()}）`)
}

async function dataUrl(file: string) {
  const data = await withTimeout(readBase64(file), 15000, '读取本地楷体超时')
  return `url("data:font/ttf;base64,${data}")`
}

/** 先在新的离屏画布上试，不行再试页面里的隐藏画布。返回实际能画出来的写法。 */
async function prove(family: string) {
  const fresh = offscreen()
  const onFresh = fresh ? await faceApplied(fresh, family) : ''
  if (onFresh) return { css: onFresh, target: 'offscreen' as const }
  const page = await screen()
  const onPage = page ? await faceApplied(page, family) : ''
  if (onPage) return { css: onPage, target: 'screen' as const }
  return null
}

async function resolveFamily(file: string) {
  const errors: string[] = []
  const local = offscreen()
  if (local?.loadFont) {
    try {
      const family = local.loadFont(file)
      const css = family ? await faceApplied(local, family) : ''
      if (css) {
        perCanvas = true
        return { css, target: 'offscreen' as const }
      }
      if (family) errors.push(`loadFont 已返回名字，离屏画布没画上（基础库 ${sdkVersion()}）`)
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }

  let inline = ''
  const attempts: Array<{ family: string; scopes: string[]; source: () => Promise<string> }> = [
    {
      family: KAI_FAMILY,
      scopes: ['native'],
      source: async () => {
        if (!inline) inline = await dataUrl(file)
        return inline
      },
    },
    {
      family: `${KAI_FAMILY}2`,
      scopes: ['webview', 'native'],
      source: async () => {
        if (!inline) inline = await dataUrl(file)
        return inline
      },
    },
    {
      family: `${KAI_FAMILY}3`,
      scopes: ['native'],
      source: async () => `url("${await withTimeout(tempUrl(), 8000, '获取楷体链接超时')}")`,
    },
  ]
  for (const item of attempts) {
    try {
      await registerFace(item.family, await item.source(), item.scopes)
      const proved = await prove(item.family)
      if (proved) return proved
      errors.push(`已注册但画布没用上（基础库 ${sdkVersion()}）`)
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }
  throw new Error(`当前基础库 ${sdkVersion()} 没能把楷体画进画布：${errors.join('；')}`)
}

async function load(id: number) {
  try {
    perCanvas = false
    drawTarget = 'offscreen'
    fontFile = await localFile()
    if (id !== loadId) return false
    const proved = await resolveFamily(fontFile)
    if (id !== loadId) return false
    faceCss = proved.css
    drawTarget = proved.target
    ready = true
    kaiFontIssue = ''
    return true
  } catch (error) {
    if (id !== loadId) return false
    faceCss = ''
    ready = false
    perCanvas = false
    drawTarget = 'offscreen'
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
export function loadKaiFont(timeout = 45000) {
  if (!SOURCE) return Promise.resolve(false)
  if (ready) return Promise.resolve(true)
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
