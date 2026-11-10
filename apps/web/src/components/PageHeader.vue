<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'

const props = defineProps<{
  eyebrow?: string
  title: string
  avatarLabel?: string
  avatarColor?: string
  showBack?: boolean
  backTo?: string
}>()

const emit = defineEmits<{
  back: []
}>()

const route = useRoute()
const router = useRouter()

function goBack() {
  emit('back')
  const returnTo = typeof route.query.returnTo === 'string' ? route.query.returnTo : ''
  const target = (returnTo.startsWith('/') ? returnTo : '') || props.backTo
  if (target) {
    router.replace(target)
    return
  }
  if (window.history.length > 1) {
    router.back()
    return
  }
  router.push('/')
}
</script>

<template>
  <header class="page-header" :class="{ nav: showBack }">
    <button
      v-if="showBack"
      class="page-back"
      type="button"
      aria-label="返回"
      @click="goBack"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
    </button>
    <div class="page-header-copy">
      <p v-if="eyebrow && !showBack">{{ eyebrow }}</p>
      <h1>
        <i
          v-if="avatarLabel"
          :style="{ '--avatar-color': avatarColor }"
          aria-hidden="true"
        >{{ avatarLabel }}</i>
        {{ title }}
      </h1>
      <slot name="caption" />
    </div>
    <div v-if="$slots.actions" class="page-header-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  min-height: 58px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
  animation: page-header-in .42s ease both;
}

.page-header-copy {
  min-width: 0;
}

.page-header p {
  margin: 0 0 3px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 650;
  letter-spacing: .04em;
}

.page-header h1 {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: var(--ink);
  font-size: 29px;
  font-weight: 800;
  letter-spacing: -.045em;
  line-height: 1.15;
}

.page-header h1 i {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  color: #fff;
  border-radius: 12px;
  background: linear-gradient(140deg, color-mix(in srgb, var(--avatar-color, #7b61ff) 88%, #fff) 0%, color-mix(in srgb, var(--avatar-color, #7b61ff) 72%, #2a2350) 100%);
  box-shadow: 0 10px 20px -10px color-mix(in srgb, var(--avatar-color, #7b61ff) 75%, transparent), inset 0 1px 0 rgba(255,255,255,.4);
  font-size: 10px;
  font-style: normal;
  letter-spacing: 0;
}

.page-header-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

.page-header.nav {
  min-height: 42px;
  margin-bottom: 16px;
  justify-content: flex-start;
  gap: 8px;
}

.page-header.nav .page-header-copy {
  flex: 1;
}

.page-header.nav h1 {
  font-size: 18px;
  font-weight: 750;
  letter-spacing: -.03em;
}

.page-header.nav .page-header-actions {
  margin-left: auto;
}

.page-back {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  padding: 0;
  place-items: center;
  color: var(--ink);
  border: 0;
  border-radius: 50%;
  background: var(--paper);
  box-shadow: var(--elev-sm), var(--glow-top);
}

.page-back:active {
  background: var(--accent-soft);
  transform: scale(.92);
}

.page-back svg {
  width: 21px;
  height: 21px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

@keyframes page-header-in {
  from { opacity: 0; transform: translateY(-7px); }
  to { opacity: 1; transform: none; }
}

@media (max-width: 360px) {
  .page-header { gap: 10px; }
  .page-header h1 { font-size: 25px; }
}
</style>
