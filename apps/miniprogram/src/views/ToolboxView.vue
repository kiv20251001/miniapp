<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import { t } from '@/i18n'
import { TOOLS } from '@/data/tools'

defineProps<{ back?: boolean }>()

function openTool(url: string) {
  uni.navigateTo({ url })
}
</script>

<template>
  <view class="page toolbox" :class="{ 'is-page': back }">
    <PageHeader :safe="back" :show-back="back" :title="t('工具箱')" :caption="t('常用小工具，点图标进入')" />
    <view class="tool-grid">
      <view
        v-for="tool in TOOLS"
        :key="tool.key"
        class="tool press"
        hover-class="press-on"
        hover-stay-time="80"
        @click="openTool(tool.url)"
      >
        <view class="tool-icon" :style="{ background: `linear-gradient(145deg, ${tool.colors[0]}, ${tool.colors[1]})` }">
          <AppIcon :name="tool.icon" tone="white" :size="30" />
        </view>
        <text class="tool-name">{{ t(tool.name) }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.toolbox { padding-bottom: calc(142px + var(--safe-bottom)); }
.toolbox.is-page { padding-bottom: 36px; }
.tool-grid { display: flex; flex-wrap: wrap; padding-top: 8px; }
.tool {
  display: flex;
  width: 25%;
  box-sizing: border-box;
  flex-direction: column;
  align-items: center;
  margin-bottom: 22px;
}
.tool-icon {
  display: flex;
  width: 62px;
  height: 62px;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  box-shadow: 0 12px 20px -12px rgba(25, 31, 58, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
.tool-name {
  width: 76px;
  margin-top: 8px;
  color: var(--ink);
  font-size: 12px;
  font-weight: 650;
  line-height: 1.3;
  text-align: center;
}
</style>
