export type WxEnvVersion = 'develop' | 'trial' | 'release'

function readEnvVersion(): WxEnvVersion {
  try {
    const version = wx.getAccountInfoSync?.().miniProgram.envVersion
    if (version === 'develop' || version === 'trial') return version
  } catch {
    // 拿不到版本信息时按正式版处理：正式用户不能连到测试库。
  }
  return 'release'
}

/** 微信返回的当前版本：开发版（工具 / 预览 / 真机调试）、体验版、正式版。 */
export const WX_ENV_VERSION = readEnvVersion()

/** 当前环境：正式版是 prod，开发版和体验版是 dev。 */
export const APP_ENV = WX_ENV_VERSION === 'release' ? 'prod' : 'dev'

/**
 * 微信云开发环境 ID。同一个包里同时带测试和正式两个 ID，按 WX_ENV_VERSION 选：
 * 开发版、体验版连 VITE_CLOUD_ENV_DEV，正式版连 VITE_CLOUD_ENV_PROD。
 * VITE_CLOUD_ENV 只用于临时强制所有版本连同一个环境，请写在不进 git 的 .env.*.local 里。
 */
export const CLOUD_ENV =
  import.meta.env.VITE_CLOUD_ENV ||
  (APP_ENV === 'prod' ? import.meta.env.VITE_CLOUD_ENV_PROD : import.meta.env.VITE_CLOUD_ENV_DEV) ||
  ''

/**
 * 云存储根目录 cloud://环境.桶。.env 里可以直接粘贴该环境任意一个文件的 File ID，只取开头这一段。
 * 仓库里 cloud-storage/ 的目录结构要原样上传到这里，见 docs/miniprogram-backend-settings.md。
 * 现在只放字帖楷体；以后图片多了，大图也放这里，用 cloudFile 取。
 */
const CLOUD_STORAGE =
  ((APP_ENV === 'prod' ? import.meta.env.VITE_CLOUD_STORAGE_PROD : import.meta.env.VITE_CLOUD_STORAGE_DEV) || '').match(/^cloud:\/\/[^/]+/)?.[0] ?? ''

/** 云存储里文件的 File ID，例如 cloudFile('fonts/copybook-kai.woff')。没配置云存储时返回空字符串。 */
export function cloudFile(path: string) {
  return CLOUD_STORAGE ? `${CLOUD_STORAGE}/${path}` : ''
}
