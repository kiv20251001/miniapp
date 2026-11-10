<script setup lang="ts">
import type { HomeworkDayStatus } from '@/domain/homework'
import AppIcon from '@/components/AppIcon.vue'

withDefaults(defineProps<{
  status: HomeworkDayStatus
  /** 落在高亮色块上时改用白色图标。 */
  inverse?: boolean
  size?: number
}>(), {
  inverse: false,
  size: 11,
})
</script>

<template>
  <view v-if="status !== 'none'" class="hw-badge">
    <AppIcon name="homework" :tone="inverse ? 'white' : 'violet'" :size="size" />
    <view v-if="status === 'done'" class="hw-mark done"><text>✓</text></view>
    <view v-else-if="status === 'missed'" class="hw-mark missed"><text>×</text></view>
  </view>
</template>

<style scoped>
.hw-badge {
  position: absolute;
  z-index: 1;
  top: 4px;
  right: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
}
.hw-mark {
  display: flex;
  width: 9px;
  height: 9px;
  margin-top: -2px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  box-shadow: 0 0 0 1px var(--paper);
}
.hw-mark text { color: #fff; font-size: 7px; font-weight: 900; line-height: 1; }
.hw-mark.done { background: #2fb57c; }
.hw-mark.missed { background: #e5484d; }
</style>
