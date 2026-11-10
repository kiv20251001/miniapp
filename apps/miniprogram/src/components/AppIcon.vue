<script setup lang="ts">
withDefaults(defineProps<{
  name: string
  tone?: 'white' | 'muted' | 'accent' | 'ink' | 'violet'
  size?: number
}>(), {
  tone: 'muted',
  size: 21,
})
</script>

<template>
  <image
    class="app-icon"
    :src="`/static/icons/${name}-${tone}.png`"
    mode="aspectFit"
    :style="{ width: size + 'px', height: size + 'px' }"
  />
</template>

<style scoped>
.app-icon {
  display: block;
  flex: 0 0 auto;
}
</style>
