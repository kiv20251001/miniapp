import { noticeNotMember } from '@/utils/login-prompt'

/** 还没有家庭时写操作被拦下，已经弹过创建引导，不再提示错误。 */
export const NEED_FAMILY = 'NEED_FAMILY'
/** 云函数找不到这个人的成员记录：被移出或自己在别的设备上退出了。 */
export const NOT_MEMBER = 'NOT_MEMBER'

export class CloudError extends Error {
  code: string

  constructor(message: string, code = 'CLOUD_ERROR') {
    super(message)
    this.code = code
  }
}

type CloudBody<T> = { ok: true; data: T } | { ok: false; code?: string; message?: string }

export function callCloud<T>(action: string, payload?: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    // #ifdef MP-WEIXIN
    if (!wx.cloud) {
      reject(new CloudError('请使用支持云开发的微信基础库', 'CLOUD_MISSING'))
      return
    }
    wx.cloud.callFunction({
      name: 'api',
      data: { action, payload: payload ?? {} },
      success(res) {
        const body = res.result as CloudBody<T> | undefined
        if (!body || body.ok !== true) {
          reject(new CloudError(
            body && 'message' in body ? body.message || '请求失败' : '请求失败',
            body && 'code' in body ? body.code || 'CLOUD_ERROR' : 'CLOUD_ERROR',
          ))
          return
        }
        resolve(body.data)
      },
      fail(err) {
        reject(new CloudError(err?.errMsg || '云函数调用失败', 'CALL_FAILED'))
      },
    })
    // #endif
    // #ifndef MP-WEIXIN
    reject(new CloudError('当前平台还没有接入云开发，请先使用微信小程序。', 'PLATFORM_UNSUPPORTED'))
    // #endif
  })
}

/** 把选好的微信头像传到云存储，返回 cloud:// 文件 ID，家里其他人也能用它显示头像。 */
export function uploadAvatar(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // #ifdef MP-WEIXIN
    if (!wx.cloud) {
      reject(new CloudError('请使用支持云开发的微信基础库', 'CLOUD_MISSING'))
      return
    }
    const ext = /\.(png|jpe?g|webp)$/i.exec(filePath)?.[1] || 'jpg'
    wx.cloud.uploadFile({
      cloudPath: `avatars/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`,
      filePath,
      success: (res) => resolve(res.fileID),
      fail: (err) => reject(new CloudError(err?.errMsg || '头像上传失败', 'UPLOAD_FAILED')),
    })
    // #endif
    // #ifndef MP-WEIXIN
    reject(new CloudError('当前平台还没有接入云开发，请先使用微信小程序。', 'PLATFORM_UNSUPPORTED'))
    // #endif
  })
}

export function showCloudError(error: unknown) {
  if (error instanceof CloudError && error.code === NEED_FAMILY) return
  if (error instanceof CloudError && error.code === NOT_MEMBER) {
    noticeNotMember()
    return
  }
  const message = error instanceof Error ? error.message : '操作失败'
  if (message.length > 18) {
    uni.showModal({ title: '提示', content: message, showCancel: false })
    return
  }
  uni.showToast({ icon: 'none', title: message })
}
