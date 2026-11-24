<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import { t } from '@/i18n'
import { TOOLS } from '@/data/tools'

defineProps<{ back?: boolean }>()
</script>

<template>
  <view class="page toolbox" :class="{ 'is-page': back }">
    <PageHeader :safe="back" :show-back="back" :title="t('工具箱')" :caption="t('工欲善其事，必先利其器')" />
    <view class="tool-grid">
      <navigator
        v-for="tool in TOOLS"
        :key="tool.key"
        class="tool press"
        hover-class="press-on"
        hover-stay-time="80"
        :url="tool.url"
      >
        <view class="tool-icon">
          <image class="tool-glyph" :src="tool.image" mode="aspectFit" />
        </view>
        <text class="tool-name">{{ t(tool.name) }}</text>
      </navigator>
      <view class="tool soon">
        <view class="tool-icon">
          <image class="tool-glyph" src="/static/tools/soon.png" mode="aspectFit" />
        </view>
        <text class="tool-name">{{ t('敬请期待') }}</text>
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
  color: inherit;
  text-decoration: none;
  box-sizing: border-box;
  flex-direction: column;
  align-items: center;
  margin-bottom: 22px;
}
.tool-icon {
  position: relative;
  display: flex;
  width: 64px;
  height: 64px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.9);
  border-radius: 19px;
  box-sizing: border-box;
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.92) 0%, rgba(246, 247, 253, 0.78) 55%, rgba(233, 236, 250, 0.72) 100%);
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 1),
    inset 0 -1px 2px rgba(120, 128, 170, 0.12),
    0 14px 26px -14px rgba(76, 86, 140, 0.38),
    0 2px 6px -2px rgba(76, 86, 140, 0.12);
  backdrop-filter: blur(18px) saturate(170%);
  -webkit-backdrop-filter: blur(18px) saturate(170%);
}
.tool-icon::before {
  content: '';
  position: absolute;
  top: -40%;
  left: -25%;
  width: 90%;
  height: 80%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0) 70%);
  pointer-events: none;
}
.tool-glyph {
  position: relative;
  z-index: 1;
  width: 44px;
  height: 44px;
  filter: drop-shadow(0 3px 4px rgba(60, 70, 130, 0.18));
}
.theme-dark .tool-icon {
  border-color: rgba(255, 255, 255, 0.12);
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.07) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22), 0 14px 26px -14px rgba(0, 0, 0, 0.6);
}
.theme-dark .tool-icon::before { opacity: 0.18; }
.tool.soon .tool-name { color: var(--muted); }
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
