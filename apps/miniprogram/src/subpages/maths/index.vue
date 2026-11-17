<script setup lang="ts">
import { onMounted, reactive } from 'vue'
import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { appShare, momentsShare } from '@/utils/share'
import { useFamilyPage } from '@/composables/useFamilyPage'
import { usePageBackground, useThemePage } from '@/utils/wx-theme'
import PageHeader from '@/components/PageHeader.vue'
import { t } from '@/i18n'
import { MATH_KINDS, type MathKind } from './problems'
import { kindPreview } from './preview'

useFamilyPage()
const themeClass = useThemePage()
onShareAppMessage(appShare)
onShareTimeline(momentsShare)
const pageBg = usePageBackground()

const previews = reactive<Partial<Record<MathKind, string>>>({})

onMounted(async () => {
  for (const item of MATH_KINDS) {
    try {
      previews[item.kind] = await kindPreview(item.kind)
    } catch {
      // 低版本微信画不了离屏画布，卡片只显示文字。
    }
  }
})

function open(kind: MathKind) {
  uni.navigateTo({ url: `/subpages/maths/sheet?kind=${kind}` })
}
</script>

<template>
  <page-meta :page-style="pageBg.style" :background-color="pageBg.bg" :background-color-top="pageBg.bg" :background-color-bottom="pageBg.bg" :root-background-color="pageBg.bg" :background-text-style="pageBg.text" />
  <view class="theme-root page sub maths" :class="themeClass">
    <PageHeader safe show-back :title="t('计算题生成')" :caption="t('选一种题型，按 A4 排版打印')" />
    <view class="kind-grid">
      <view
        v-for="item in MATH_KINDS"
        :key="item.kind"
        class="kind-card press"
        hover-class="press-on"
        hover-stay-time="80"
        @click="open(item.kind)"
      >
        <view class="kind-thumb">
          <image v-if="previews[item.kind]" class="thumb-img" :src="previews[item.kind]" mode="widthFix" />
          <text v-else class="thumb-wait">{{ t('效果图生成中…') }}</text>
        </view>
        <view class="kind-body">
          <text class="kind-name">{{ t(item.title) }}</text>
          <text class="kind-summary">{{ t(item.summary) }}</text>
        </view>
      </view>
      <view class="kind-card soon">
        <view class="kind-thumb">
          <view class="soon-mark">
            <text class="soon-plus">＋</text>
            <text class="soon-tag">{{ t('持续更新中') }}</text>
          </view>
        </view>
        <view class="kind-body">
          <text class="kind-name">{{ t('更多算法题') }}</text>
          <text class="kind-summary">{{ t('敬请期待') }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.kind-grid { display: flex; flex-wrap: wrap; justify-content: space-between; padding-top: 4px; }
.kind-card {
  width: calc(50% - 6px);
  margin-bottom: 12px;
  overflow: hidden;
  border-radius: 18px;
  background: var(--surface);
  box-shadow: var(--elev-md);
}
.kind-thumb {
  position: relative;
  height: 0;
  padding-bottom: 92%;
  overflow: hidden;
  background: var(--surface-2);
}
.thumb-img { position: absolute; top: 0; left: 0; width: 100%; }
.thumb-wait {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  color: var(--muted);
  font-size: 12px;
  text-align: center;
  transform: translateY(-50%);
}
.soon-mark {
  position: absolute;
  top: 12px;
  right: 12px;
  bottom: 12px;
  left: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1.5px dashed var(--line);
  border-radius: 14px;
}
.soon-plus { color: var(--muted); font-size: 30px; line-height: 1; }
.soon-tag { color: var(--muted); font-size: 12px; }
.kind-card.soon .kind-name { color: var(--muted); }
.kind-body { padding: 12px 12px 14px; }
.kind-name { display: block; color: var(--ink); font-size: 15px; font-weight: 800; }
.kind-summary {
  display: -webkit-box;
  margin-top: 6px;
  overflow: hidden;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
</style>
