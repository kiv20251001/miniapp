declare module 'wx-server-sdk' {
  interface CloudDatabase {
    collection(name: string): any
    createCollection(name: string): Promise<unknown>
    serverDate(): Date
    runTransaction<T>(handler: (transaction: any) => Promise<T>): Promise<T>
  }

  interface Cloud {
    init(options?: { env?: string }): void
    DYNAMIC_CURRENT_ENV: string
    getWXContext(): { OPENID?: string; UNIONID?: string; APPID?: string }
    database(): CloudDatabase
  }

  const cloud: Cloud
  export default cloud
}
