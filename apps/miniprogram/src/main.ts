import { createPinia } from 'pinia'
import { createSSRApp } from 'vue'
import App from './App.vue'
import { installUniI18n } from './i18n'

installUniI18n()

export function createApp() {
  const app = createSSRApp(App)
  app.use(createPinia())
  return { app }
}
