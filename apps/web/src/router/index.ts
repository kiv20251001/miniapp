import { createRouter, createWebHistory } from 'vue-router'
import { getToken } from '@/services/api'
import { useAppStore } from '@/stores/app'
import dayjs from 'dayjs'

function currentWeekRange() {
  const today = dayjs()
  const from = today.subtract((today.day() + 6) % 7, 'day')
  return {
    from: from.format('YYYY-MM-DD'),
    to: from.add(6, 'day').format('YYYY-MM-DD'),
  }
}

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    return { left: 0, top: 0, behavior: 'smooth' }
  },
  routes: [
    { path: '/login', name: 'login', component: () => import('@/pages/LoginPage.vue'), meta: { public: true } },
    { path: '/register', name: 'register', component: () => import('@/pages/RegisterPage.vue'), meta: { public: true } },
    { path: '/', name: 'today', component: () => import('@/pages/TodayPage.vue'), meta: { tab: 'today' } },
    { path: '/calendar', name: 'calendar', component: () => import('@/pages/CalendarPage.vue'), meta: { tab: 'calendar' } },
    { path: '/bills', name: 'bills', component: () => import('@/pages/BillsPage.vue'), meta: { tab: 'stats' } },
    { path: '/stats', name: 'stats', component: () => import('@/pages/StatsPage.vue'), meta: { tab: 'stats' } },
    { path: '/courses', name: 'courses', component: () => import('@/pages/CoursesPage.vue'), meta: { tab: 'courses' } },
    { path: '/courses/:id/bills', name: 'course-bills', component: () => import('@/pages/CourseBillsPage.vue'), meta: { tab: 'courses' } },
    { path: '/courses/edit/:id?', name: 'course-edit', component: () => import('@/pages/CourseEditPage.vue') },
    { path: '/bills/edit/:id?', name: 'expense-edit', component: () => import('@/pages/ExpenseEditPage.vue') },
  ],
})

router.beforeEach(async (to) => {
  const token = getToken()
  if (to.meta.public) {
    if (token && (to.name === 'login' || to.name === 'register')) return { path: '/' }
    return true
  }
  if (!token) return { path: '/login', query: { redirect: to.fullPath } }

  const store = useAppStore()
  if (!store.ready) {
    try {
      await store.hydrate(currentWeekRange())
    } catch {
      store.logout()
      return { path: '/login', query: { redirect: to.fullPath } }
    }
  }
  return true
})

export default router
