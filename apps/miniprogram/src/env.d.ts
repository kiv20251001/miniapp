/// <reference types="@dcloudio/types" />

interface ImportMetaEnv {
  /** 开发版、体验版连接的云环境 ID */
  readonly VITE_CLOUD_ENV_DEV?: string
  /** 正式版连接的云环境 ID */
  readonly VITE_CLOUD_ENV_PROD?: string
  /** 临时强制所有版本连接同一个云环境，只写在 .env.*.local */
  readonly VITE_CLOUD_ENV?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface WxCloudCall {
  name: string
  data?: Record<string, unknown>
  success?: (res: { result: unknown }) => void
  fail?: (err: { errMsg?: string }) => void
}

interface WxCloudUpload {
  cloudPath: string
  filePath: string
  success?: (res: { fileID: string }) => void
  fail?: (err: { errMsg?: string }) => void
}

interface WxCloud {
  init(options?: { env?: string; traceUser?: boolean }): void
  callFunction(options: WxCloudCall): void
  uploadFile(options: WxCloudUpload): void
}

declare const wx: {
  cloud?: WxCloud
  getAccountInfoSync?: () => { miniProgram: { appId: string; envVersion: string; version?: string } }
  requestSubscribeMessage?: (options: {
    tmplIds: string[]
    success?: (res: Record<string, unknown>) => void
    fail?: (err: { errMsg?: string }) => void
  }) => void
}
