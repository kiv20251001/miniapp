<script setup lang="ts">
import { computed } from 'vue'
import { netBounds, rollFaces, type Cell } from './geometry'

const props = withDefaults(defineProps<{
  cells: Cell[]
  /** 每格边长，px */
  unit?: number
  /** 相对的面同色 */
  pairs?: boolean
  active?: boolean
}>(), { unit: 12, pairs: false, active: false })

const PAIRS = ['#ffc39e', '#a9d3ff', '#b5ecd1']

const box = computed(() => {
  const { minX, minY, cols, rows } = netBounds(props.cells)
  const faces = props.pairs ? rollFaces(props.cells) : null
  return {
    style: `width:${cols * props.unit}px;height:${rows * props.unit}px;`,
    cells: props.cells.map(([x, y], index) => ({
      key: `${x}-${y}`,
      style: `left:${(x - minX) * props.unit}px;top:${(y - minY) * props.unit}px;width:${props.unit}px;height:${props.unit}px;${faces ? `background:${PAIRS[faces[index] >> 1]};` : ''}`,
    })),
  }
})
</script>

<template>
  <view class="net-thumb" :class="{ active }" :style="box.style">
    <view v-for="cell in box.cells" :key="cell.key" class="net-cell" :style="cell.style" />
  </view>
</template>

<style scoped>
.net-thumb { position: relative; flex: none; }
.net-cell { position: absolute; box-sizing: border-box; border: 1px solid #8b93a5; background: #ffe0b8; }
.net-thumb.active .net-cell { border-color: #e85b2a; }
</style>
