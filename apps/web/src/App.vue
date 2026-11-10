<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import TabBar from '@/components/TabBar.vue'
import AppHeader from '@/components/AppHeader.vue'
import { useAppStore } from '@/stores/app'

const route = useRoute()
const store = useAppStore()
const isPublic = computed(() => Boolean(route.meta.public))
const showTab = computed(() => Boolean(route.meta.tab) && store.ready)
const showChrome = computed(() => !isPublic.value)
</script>

<template>
  <div v-if="!isPublic && !store.ready" class="boot">正在同步家庭数据…</div>
  <div v-else class="shell">
    <AppHeader v-if="showChrome" />
    <router-view v-slot="{ Component }">
      <transition name="page-fade" mode="out-in" appear>
        <component :is="Component" :key="route.path" />
      </transition>
    </router-view>
    <TabBar v-if="showTab" />
  </div>
</template>

<style scoped>
.boot {
  min-height: 100vh;
  display: grid;
  place-items: center;
  color: var(--muted);
  font-size: 15px;
}

.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity .26s ease, transform .32s cubic-bezier(.22,.8,.24,1);
}

.page-fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

@media (prefers-reduced-motion: reduce) {
  .page-fade-enter-active,
  .page-fade-leave-active {
    transition: none;
  }
}

</style>
