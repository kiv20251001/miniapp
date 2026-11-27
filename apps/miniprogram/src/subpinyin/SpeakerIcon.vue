<template>
  <view class="horn" :class="[size, { live }]">
    <view class="bars">
      <view class="bar b1" />
      <view class="bar b2" />
      <view class="bar b3" />
    </view>
  </view>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ size?: 'sm' | 'md' | 'lg'; live?: boolean }>(), { size: 'md', live: false })
</script>

<style scoped>
.horn { display: flex; align-items: center; color: inherit; }
.bars { display: flex; flex: none; align-items: center; justify-content: center; }
.bar { flex: none; border-radius: 99px; background: currentColor; transform-origin: center; }

.horn.sm .bars { height: 11px; }
.horn.sm .bar { width: 2px; height: 11px; margin: 0 1px; }

.horn.md .bars { height: 16px; }
.horn.md .bar { width: 3px; height: 16px; margin: 0 1.5px; }

.horn.lg .bars { height: 36px; }
.horn.lg .bar { width: 5px; height: 36px; margin: 0 2px; }

.horn:not(.live) .b1 { transform: scaleY(0.42); }
.horn:not(.live) .b2 { transform: scaleY(0.72); }
.horn:not(.live) .b3 { transform: scaleY(0.5); opacity: 0.75; }

.horn.live .b1 { animation: eq-a 0.62s ease-in-out infinite; }
.horn.live .b2 { animation: eq-b 0.48s ease-in-out infinite; }
.horn.live .b3 { animation: eq-c 0.78s ease-in-out infinite; }

@keyframes eq-a {
  0%, 100% { transform: scaleY(0.28); }
  28% { transform: scaleY(1); }
  52% { transform: scaleY(0.4); }
  74% { transform: scaleY(0.82); }
}
@keyframes eq-b {
  0%, 100% { transform: scaleY(0.9); }
  36% { transform: scaleY(0.22); }
  68% { transform: scaleY(1); }
}
@keyframes eq-c {
  0%, 100% { transform: scaleY(0.48); }
  22% { transform: scaleY(0.3); }
  50% { transform: scaleY(1); }
  78% { transform: scaleY(0.55); }
}
</style>
