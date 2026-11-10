<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useThemeStore } from '@/utils/wx-theme'

const theme = useThemeStore()
const { isDark } = storeToRefs(theme)
</script>

<template>
  <button hover-class="press-on" hover-stay-time="80" class="theme-toggle" :class="{ dark: isDark }" @click="theme.toggle()">
    <view class="glyph">
      <view v-for="n in 8" :key="n" class="ray" :style="{ transform: `rotate(${(n - 1) * 45}deg)` }" />
      <view class="orb" />
      <view class="cut" />
    </view>
  </button>
</template>

<style scoped>
.theme-toggle {
  display: flex;
  width: 38px;
  height: 38px;
  align-items: center;
  justify-content: center;
  color: var(--ink);
}

.glyph {
  position: relative;
  width: 22px;
  height: 22px;
}

.orb {
  position: absolute;
  top: 5px;
  left: 5px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: currentColor;
  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
}

.cut {
  position: absolute;
  top: 3px;
  left: 9px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--bg);
  opacity: 0;
  transform: translate(6px, -6px) scale(0.2);
  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease;
}

/* 光线绕图标中心转，八个方向都贴着圆。 */
.ray {
  position: absolute;
  top: 0;
  left: 10px;
  width: 2px;
  height: 3.5px;
  border-radius: 999px;
  background: currentColor;
  transform-origin: 1px 11px;
  transition: opacity 0.2s ease;
}

.theme-toggle.dark .ray {
  opacity: 0;
}

.theme-toggle.dark .orb {
  transform: scale(0.92);
}

.theme-toggle.dark .cut {
  opacity: 1;
  transform: translate(2px, -1px) scale(1);
}
</style>
