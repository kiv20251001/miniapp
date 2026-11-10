<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import { useAppStore } from '@/stores/app'

const { isDark, toggleTheme } = useTheme()
const store = useAppStore()
const router = useRouter()

async function logout() {
  store.logout()
  await router.replace('/login')
}
</script>

<template>
  <header class="app-brand-header">
    <div class="app-brand-inner">
      <router-link class="brand" to="/" aria-label="Uday 首页">
        <i aria-hidden="true">U</i>
        <span>
          <strong>Uday</strong>
          <small>Plan Your Day. Grow Your Way.</small>
        </span>
      </router-link>

      <div class="app-actions">
        <button v-if="store.ready" class="logout" type="button" @click="logout">退出</button>
        <button
          class="theme-toggle"
          type="button"
          :class="{ 'is-dark': isDark }"
          :aria-label="isDark ? '切换到白天模式' : '切换到夜间模式'"
          :aria-pressed="isDark"
          @click="toggleTheme"
        >
          <svg class="theme-glyph" viewBox="0 0 24 24" aria-hidden="true">
            <defs>
              <mask id="theme-moon-mask" maskUnits="userSpaceOnUse">
                <rect width="24" height="24" fill="#fff" />
                <circle class="moon-cut" cx="12" cy="12" r="5.4" fill="#000" />
              </mask>
            </defs>
            <g class="rays">
              <path d="M12 1.8v2.5" />
              <path d="M12 19.7v2.5" />
              <path d="M1.8 12h2.5" />
              <path d="M19.7 12h2.5" />
              <path d="M4.7 4.7l1.8 1.8" />
              <path d="M17.5 17.5l1.8 1.8" />
              <path d="M19.3 4.7l-1.8 1.8" />
              <path d="M6.5 17.5l-1.8 1.8" />
            </g>
            <circle class="orb" cx="12" cy="12" r="5.15" mask="url(#theme-moon-mask)" />
            <g class="stars">
              <path class="spark a" d="M5.6 7.1 6.1 8.4 7.5 8.8 6.1 9.2 5.6 10.5 5.1 9.2 3.7 8.8 5.1 8.4Z" />
              <path class="spark b" d="M18.8 15.8 19.15 16.7 20.1 17 19.15 17.3 18.8 18.2 18.45 17.3 17.5 17 18.45 16.7Z" />
              <circle class="spark c" cx="18.8" cy="7.4" r=".7" />
            </g>
          </svg>
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-brand-header {
  position: sticky;
  z-index: 90;
  top: 0;
  padding-top: env(safe-area-inset-top, 0);
  border: 0;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  box-shadow: var(--header-edge);
}

.app-brand-header::after {
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 1px;
  background: var(--header-hairline);
  content: "";
}

.app-brand-inner {
  display: flex;
  width: min(100%, 480px);
  min-height: 72px;
  margin: 0 auto;
  padding: 10px 18px;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.brand {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.brand > i {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  place-items: center;
  color: #fff;
  border-radius: 14px;
  background: var(--accent-gradient);
  box-shadow: 0 12px 22px -10px rgba(255,122,69,.75), inset 0 1px 0 rgba(255,255,255,.4);
  font-size: 22px;
  font-style: normal;
  font-weight: 850;
  letter-spacing: -.06em;
}

.brand > span {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.brand strong {
  color: var(--ink);
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -.035em;
}

.brand small {
  overflow: hidden;
  color: var(--muted);
  font-size: 8px;
  letter-spacing: .025em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

.logout {
  padding: 0 4px;
  color: var(--muted);
  border: 0;
  background: transparent;
  font-size: 13px;
}

.theme-toggle {
  display: grid;
  width: 38px;
  height: 38px;
  padding: 0;
  place-items: center;
  color: var(--ink);
  border: 0;
  border-radius: 50%;
  background: transparent;
  box-shadow: none;
  transition:
    color .45s ease,
    transform .22s cubic-bezier(.2,.8,.2,1);
}

.theme-toggle.is-dark {
  color: var(--ink);
}

.theme-toggle:active {
  transform: scale(.9) rotate(-14deg);
}

.theme-glyph {
  width: 20px;
  height: 20px;
  overflow: visible;
}

.orb {
  fill: currentColor;
  transform-origin: 12px 12px;
  transition: transform .55s cubic-bezier(.2,.8,.2,1);
}

.moon-cut {
  transform-origin: 12px 12px;
  transition: transform .55s cubic-bezier(.2,.8,.2,1);
  transform: translate(9px, -10px);
}

.theme-toggle.is-dark .orb {
  transform: rotate(-20deg) scale(1.08);
}

.theme-toggle.is-dark .moon-cut {
  transform: translate(4.2px, -3.2px);
}

.rays {
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 1.7;
  transform-origin: 12px 12px;
  transform: scale(1) rotate(0deg);
  opacity: 1;
  transition:
    opacity .32s ease,
    transform .55s cubic-bezier(.2,.8,.2,1);
}

.theme-toggle.is-dark .rays {
  opacity: 0;
  transform: scale(.18) rotate(90deg);
}

.stars {
  fill: currentColor;
  opacity: 0;
  transform-origin: 12px 12px;
  transform: scale(.35) rotate(-20deg);
  transition:
    opacity .35s .08s ease,
    transform .55s cubic-bezier(.2,.8,.2,1);
}

.theme-toggle.is-dark .stars {
  opacity: 1;
  transform: scale(1) rotate(0);
}

.spark.a,
.spark.b,
.spark.c {
  transform-origin: center;
  transform-box: fill-box;
}

.theme-toggle.is-dark .spark.a {
  animation: spark-twinkle 1.8s .15s ease-in-out infinite;
}

.theme-toggle.is-dark .spark.b {
  animation: spark-twinkle 2.1s .4s ease-in-out infinite;
}

.theme-toggle.is-dark .spark.c {
  animation: spark-twinkle 1.6s .7s ease-in-out infinite;
}

@keyframes spark-twinkle {
  0%, 100% { opacity: .55; transform: scale(.88); }
  50% { opacity: 1; transform: scale(1.12); }
}

@media (prefers-reduced-motion: reduce) {
  .theme-toggle,
  .orb,
  .moon-cut,
  .rays,
  .stars {
    transition: none;
  }

  .theme-toggle.is-dark .spark.a,
  .theme-toggle.is-dark .spark.b,
  .theme-toggle.is-dark .spark.c {
    animation: none;
  }
}

@media (max-width: 360px) {
  .brand small { max-width: 138px; }
}
</style>
