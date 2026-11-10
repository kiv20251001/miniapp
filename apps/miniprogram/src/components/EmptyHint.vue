<script setup lang="ts">
import AppIcon from './AppIcon.vue'

/** 空数据用同一尺寸的图标块，短句说明。各页空状态对齐这一套。 */
withDefaults(defineProps<{
  icon?: string
  label: string
}>(), {
  icon: 'clipboard',
})
</script>

<template>
  <view class="empty-hint">
    <slot name="mark">
      <view class="empty-mark">
        <AppIcon :name="icon" tone="muted" :size="22" />
      </view>
    </slot>
    <text class="empty-label">{{ label }}</text>
  </view>
</template>

<style scoped>
.empty-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  box-sizing: border-box;
  min-height: 132px;
  padding: 28px 16px;
}
.empty-mark {
  display: flex;
  width: 52px;
  height: 52px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  background: var(--surface-2);
}
.empty-label {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.4;
  text-align: center;
}
</style>
