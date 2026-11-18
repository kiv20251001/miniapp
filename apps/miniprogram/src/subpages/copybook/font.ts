import { APP_ENV } from '@/config'

/**
 * 手机上没有楷体，字帖要从云存储下载字体（scripts/build-copybook-font.mjs 生成），
 * 第一次下载后存在本地，之后直接读。没配置或加载失败时退回系统字体。
 */
export const KAI_FAMILY = 'UdayKai'

type Fail = (err: { errMsg?: string; status?: string }) => void

type FontApi = {
  loadFontFace: (options: { family: string; source: string; global?: boolean; scopes?: string[]; success?: () => void; fail?: Fail }) => void
  downloadFile: (options: { url: string; success?: (res: { statusCode: number; tempFilePath: string }) => void; fail?: Fail }) => void
  getFileSystemManager: () => {
    access: (options: { path: string; success?: () => void; fail?: Fail }) => void
    copyFile: (options: { srcPath: string; destPath: string; success?: () => void; fail?: Fail }) => void
    readFile: (options: { filePath: string; encoding: 'base64'; success?: (res: { data: string }) => void; fail?: Fail }) => void
  }
  env: { USER_DATA_PATH: string }
  cloud?: { downloadFile: (options: { fileID: string; success?: (res: { tempFilePath: string }) => void; fail?: Fail }) => void }
}

const SOURCE = (APP_ENV === 'prod' ? import.meta.env.VITE_COPYBOOK_FONT_PROD : import.meta.env.VITE_COPYBOOK_FONT_DEV) || ''

let loading: Promise<boolean> | null = null

function api() {
  return wx as unknown as FontApi
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
    const fail: Fail = (err) => reject(new Error(err?.errMsg || 'font download failed'))
    if (SOURCE.startsWith('cloud://')) {
      const cloud = api().cloud
      if (!cloud) return reject(new Error('wx.cloud unavailable'))
      cloud.downloadFile({ fileID: SOURCE, success: (res) => resolve(res.tempFilePath), fail })
      return
    }
    api().downloadFile({
      url: SOURCE,
      success: (res) => (res.statusCode === 200 ? resolve(res.tempFilePath) : reject(new Error(`HTTP ${res.statusCode}`))),
      fail,
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
      fail: (err) => reject(new Error(err?.errMsg || 'font read failed')),
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
      fail: (err) => reject(new Error(err?.status || err?.errMsg || 'loadFontFace failed')),
    })
  })
}

async function load() {
  try {
    await register(await readBase64(await localFile()))
    return true
  } catch (error) {
    console.warn('[copybook] kai font unavailable, using system font', error)
    loading = null
    return false
  }
}

/** 页面打开时先调一次预下载；生成前再等它，最多等 timeout 毫秒。 */
export function loadKaiFont(timeout = 15000) {
  if (!SOURCE) return Promise.resolve(false)
  if (!loading) loading = load()
  return Promise.race([loading, new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeout))])
}
