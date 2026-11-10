import { createPinia } from 'pinia'
import { createSSRApp } from 'vue'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import App from './App.vue'

dayjs.locale('zh-cn')

export function createApp() {
  const app = createSSRApp(App)
  app.use(createPinia())
  return { app }
}
