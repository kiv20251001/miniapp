<script setup lang="ts">
import type { ChildAvatarKey } from '@/domain/types'
import { childAvatarOption } from '@/domain/constants'

withDefaults(defineProps<{
  avatarKey?: ChildAvatarKey
  size?: number
  label?: string
}>(), {
  size: 42,
})
</script>

<template>
  <i
    class="child-face"
    :class="`is-${childAvatarOption(avatarKey).key}`"
    :style="{ width: `${size}px`, height: `${size}px`, '--avatar-color': childAvatarOption(avatarKey).color }"
    :aria-hidden="label ? undefined : 'true'"
    :aria-label="label"
  />
</template>

<style scoped>
.child-face {
  display: block;
  flex: 0 0 auto;
  overflow: hidden;
  border-radius: 50%;
  background-color: color-mix(in srgb, var(--avatar-color, #5b8def) 16%, #fff);
  background-image: url('@/assets/user_icon.png');
  background-repeat: no-repeat;
  /* 四宫格雪碧图：略放大，把脸部收入圆形裁切 */
  background-size: 228% 242%;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--avatar-color, #5b8def) 22%, transparent);
  font-style: normal;
}

.child-face.is-boy-blue { background-position: 6% 2%; }
.child-face.is-boy-cap { background-position: 94% 2%; }
.child-face.is-girl-flower { background-position: 6% 94%; }
.child-face.is-girl-bow { background-position: 94% 94%; }
</style>
