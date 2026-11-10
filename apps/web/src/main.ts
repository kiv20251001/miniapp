import { createApp } from 'vue'
import { createPinia } from 'pinia'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import App from './App.vue'
import router from './router'
import './styles/global.css'

dayjs.locale('zh-cn')

createApp(App).use(createPinia()).use(router).mount('#app')
