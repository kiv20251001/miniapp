import { createPinia } from 'pinia'
import { createSSRApp } from 'vue'
import App from './App.vue'
import { installUniI18n } from './i18n'
import { keepPrintInMainPackage } from './print/keep'

installUniI18n()
// 挂到全局，打包器才会留下对 print/frame、save、scroll 的 require，代码质量扫描才认这三份主包文件被用到。
;(globalThis as typeof globalThis & { __udayPrint?: unknown }).__udayPrint = keepPrintInMainPackage()

export function createApp() {
  const app = createSSRApp(App)
  app.use(createPinia())
  return { app }
}
