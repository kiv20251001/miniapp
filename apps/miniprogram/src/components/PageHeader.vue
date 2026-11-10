<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onMounted, ref, watch } from 'vue'
import { goBack } from '@/utils/nav'
import { brandHeaderHeight, capsuleInset, statusBarHeight } from '@/utils/system'

const props = defineProps<{
  eyebrow?: string
  title: string
  caption?: string
  showBack?: boolean
  safe?: boolean
  /** 标题是日期区间这类较长内容时缩小字号，保证整行显示。 */
  compact?: boolean
}>()

const statusBar = statusBarHeight()
const capsuleRight = capsuleInset() + 6
/** 带返回的二级页钉在顶部。账单页上面还有品牌栏，要接在它下面。 */
const pinned = computed(() => Boolean(props.showBack))
const belowBrand = computed(() => pinned.value && !props.safe)

function estimateHeight() {
  let body = 62
  if (props.eyebrow) body += 18
  if (props.caption) body += 22
  return body + (props.safe ? statusBar : 0)
}

const barHeight = ref(estimateHeight())
const instance = getCurrentInstance()

const barStyle = computed(() => {
  if (!pinned.value) return {}
  const style: Record<string, string> = {
    paddingLeft: '18px',
    paddingRight: `${props.safe ? capsuleRight : 18}px`,
  }
  if (props.safe) style.paddingTop = `${statusBar}px`
  if (belowBrand.value) style.top = `${brandHeaderHeight()}px`
  return style
})

/** 头部被移出文档流后，用占位把内容顶到它下面。页面本身已有 18px 上内边距。 */
const holdStyle = computed(() => ({
  height: `${Math.max(barHeight.value - 18, 0)}px`,
}))

function measure() {
  const proxy = instance?.proxy
  if (!proxy || !pinned.value) return
  uni.createSelectorQuery().in(proxy).select('.page-header-bar').boundingClientRect((rect) => {
    const height = rect && !Array.isArray(rect) ? rect.height : 0
    if (height) barHeight.value = height
  }).exec()
}

function remeasure() {
  barHeight.value = estimateHeight()
  nextTick(measure)
}

onMounted(remeasure)
watch(() => [props.title, props.caption, props.eyebrow, props.safe, props.showBack], remeasure)

function back() {
  goBack()
}
</script>

<template>
  <view class="page-header-bar" :class="{ 'is-fixed': pinned }" :style="barStyle">
    <view class="page-header">
      <button hover-class="press-on" hover-stay-time="80" v-if="showBack" class="page-back" @click="back">‹</button>
      <view class="page-header-copy">
        <text v-if="eyebrow" class="eyebrow">{{ eyebrow }}</text>
        <view class="h1" :class="{ 'h1-compact': compact }">{{ title }}</view>
        <text v-if="caption" class="caption">{{ caption }}</text>
      </view>
      <view v-if="$slots.actions" class="page-header-actions">
        <slot name="actions" />
      </view>
    </view>
  </view>
  <view v-if="pinned" class="page-header-hold" :style="holdStyle" />
</template>
