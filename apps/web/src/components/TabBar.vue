<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { gsap } from 'gsap'
import { useHomeDate } from '@/composables/useHomeDate'
import { useQuickAdd } from '@/composables/useQuickAdd'

const route = useRoute()
const router = useRouter()
const { isViewingToday, goToToday } = useHomeDate()
const { isOpen: quickAddOpen, toggle: toggleQuickAdd, close: closeQuickAdd, requestPresetPicker } = useQuickAdd()
const navRef = ref<HTMLElement>()
const indicatorRef = ref<HTMLElement>()
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
let resizeObserver: ResizeObserver | undefined

const tabs = [
  { to: '/', key: 'today', label: '今日', icon: 'clock' },
  { to: '/calendar', key: 'calendar', label: '日历', icon: 'calendar' },
  { to: '/courses', key: 'courses', label: '课程', icon: 'course' },
  { to: '/stats', key: 'stats', label: '统计', icon: 'stats' },
]

const activeKey = computed(() => {
  if (route.path === '/bills' && route.query.from === 'today') return 'today'
  if (route.path.endsWith('/bills') && route.query.returnTo === '/stats') return 'stats'
  if (route.path === '/' && isViewingToday.value) return 'today'
  return String(route.meta.tab ?? '')
})

function isActive(key: string) {
  return activeKey.value === key
}

async function moveIndicator(animate = true) {
  await nextTick()
  const nav = navRef.value
  const indicator = indicatorRef.value
  const target = nav?.querySelector<HTMLElement>('a.active')
  if (!nav || !indicator || !target) return

  gsap.killTweensOf(indicator)
  const properties = {
    x: target.offsetLeft,
    y: target.offsetTop,
    width: target.offsetWidth,
    height: target.offsetHeight,
  }
  if (!animate || reduceMotion) {
    gsap.set(indicator, { ...properties, scaleX: 1, scaleY: 1 })
    return
  }

  gsap.to(indicator, { ...properties, duration: 0.48, ease: 'power3.out' })

  // 液体质感：移动时沿行进方向被拉长，落位时弹回
  const travel = Math.abs(target.offsetLeft - Number(gsap.getProperty(indicator, 'x')))
  if (travel > 4) {
    gsap.to(indicator, {
      keyframes: [
        { scaleX: 1 + Math.min(travel / 900, 0.1), scaleY: 0.9, duration: 0.2, ease: 'power2.out' },
        { scaleX: 1, scaleY: 1, duration: 0.46, ease: 'elastic.out(1, 0.5)' },
      ],
    })
  }
}

function onTabClick(event: MouseEvent, key: string, to: string) {
  event.preventDefault()
  closeQuickAdd()
  if (key === 'today') goToToday()
  if (route.path !== to) router.push(to)
}

function openPresetFlow() {
  if (route.path !== '/') router.push('/')
  requestPresetPicker()
}

watch(activeKey, () => moveIndicator(true), { flush: 'post' })
watch(() => route.fullPath, () => closeQuickAdd())

onMounted(() => {
  moveIndicator(false)
  if (navRef.value) {
    resizeObserver = new ResizeObserver(() => moveIndicator(false))
    resizeObserver.observe(navRef.value)
  }
})

onBeforeUnmount(() => {
  closeQuickAdd()
  resizeObserver?.disconnect()
  if (indicatorRef.value) gsap.killTweensOf(indicatorRef.value)
})
</script>

<template>
  <nav ref="navRef" class="tabbar">
    <i ref="indicatorRef" class="tabbar-indicator" aria-hidden="true" />
    <template v-for="(tab, index) in tabs" :key="tab.key">
      <a
        :href="tab.to"
        :class="{ active: isActive(tab.key) }"
        @click="onTabClick($event, tab.key, tab.to)"
      >
        <svg v-if="tab.icon === 'clock'" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8.4" />
          <path d="M12 7.4V12l3.3 2" />
        </svg>
        <svg v-else-if="tab.icon === 'calendar'" viewBox="0 0 24 24"><path d="M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Zm2-2v4m10-4v4M4 10h16M8 14h2m4 0h2m-8 3h2m4 0h2" /></svg>
        <svg v-else-if="tab.icon === 'course'" viewBox="0 0 24 24"><path d="M4 5.5c3-.8 5.7-.2 8 1.8v12c-2.3-2-5-2.6-8-1.8v-12Zm16 0c-3-.8-5.7-.2-8 1.8v12c2.3-2 5-2.6 8-1.8v-12Z" /></svg>
        <svg v-else viewBox="0 0 24 24"><path d="M5 20V10h3v10H5Zm6 0V4h3v16h-3Zm6 0v-7h3v7h-3Z" /></svg>
        <span>{{ tab.label }}</span>
      </a>
      <div v-if="index === 1" class="tabbar-center">
        <button
          class="tabbar-fab"
          :class="{ open: quickAddOpen }"
          type="button"
          :aria-label="quickAddOpen ? '收起新增菜单' : '展开新增菜单'"
          :aria-expanded="quickAddOpen"
          @click="toggleQuickAdd()"
        >
          <span>＋</span>
        </button>
      </div>
    </template>
  </nav>

  <Transition name="quick-fade">
    <div v-if="quickAddOpen" class="quick-backdrop" @click="closeQuickAdd()" />
  </Transition>

  <Transition name="quick-menu">
    <div v-if="quickAddOpen" class="quick-menu">
      <button type="button" @click="openPresetFlow">
        <span class="accent">＋</span>
        <div><strong>快速新增安排</strong><small>选择日期、已有课程或临时安排</small></div>
      </button>
      <router-link :to="{ path: '/courses/edit', query: { returnTo: route.fullPath } }" @click="closeQuickAdd()">
        <span class="amber">✦</span>
        <div><strong>新增课程</strong><small>建立新的课程预设</small></div>
      </router-link>
      <router-link :to="{ path: '/bills/edit', query: { returnTo: route.fullPath } }" @click="closeQuickAdd()">
        <span class="teal">¥</span>
        <div><strong>记一笔账单</strong><small>登记一次课程费用</small></div>
      </router-link>
    </div>
  </Transition>
</template>
