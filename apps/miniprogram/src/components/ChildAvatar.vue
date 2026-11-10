<script setup lang="ts">
import { computed } from 'vue'
import type { ChildAvatarKey } from '@server-domain/types'
import { childAvatarOption } from '@server-domain/constants'
import { storeToRefs } from 'pinia'
import { useThemeStore } from '@/utils/wx-theme'
import { currentMixBase, mix } from '@/utils/color'

const props = withDefaults(defineProps<{
  avatarKey?: ChildAvatarKey
  size?: number
}>(), {
  size: 42,
})

const theme = useThemeStore()
const { isDark } = storeToRefs(theme)
const option = computed(() => childAvatarOption(props.avatarKey))
const faceStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  backgroundColor: mix(option.value.color, currentMixBase(), isDark.value ? 0.72 : 0.84),
}))
</script>

<template>
  <view class="child-face" :class="`is-${option.key}`" :style="faceStyle">
    <image class="sprite" src="/static/user_icon.jpg" mode="scaleToFill" />
  </view>
</template>

<style scoped>
.child-face {
  position: relative;
  display: block;
  flex: 0 0 auto;
  overflow: hidden;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgba(91, 141, 239, 0.18);
}

.sprite {
  position: absolute;
  width: 228%;
  height: 242%;
}

/* 与网页雪碧图 background-position 对齐：偏移 = (1 - 缩放) × 百分比 */
.child-face.is-boy-blue .sprite { left: -7.68%; top: -2.84%; }
.child-face.is-boy-cap .sprite { left: -120.32%; top: -2.84%; }
.child-face.is-girl-flower .sprite { left: -7.68%; top: -133.48%; }
.child-face.is-girl-bow .sprite { left: -120.32%; top: -133.48%; }
</style>
