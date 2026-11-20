<script setup lang="ts">
import { computed } from 'vue'
import type { ViewGrid } from './geometry'

const props = withDefaults(defineProps<{ grid: ViewGrid; unit?: number }>(), { unit: 18 })

const rows = computed(() => props.grid.map((row, y) => ({ key: y, cells: row.map((on, x) => ({ key: x, on })) })))
const cellStyle = computed(() => `width:${props.unit}px;height:${props.unit}px;`)
</script>

<template>
  <view class="view-grid">
    <view v-for="row in rows" :key="row.key" class="view-row">
      <view v-for="cell in row.cells" :key="cell.key" class="view-cell" :class="{ on: cell.on }" :style="cellStyle" />
    </view>
  </view>
</template>

<style scoped>
.view-grid { display: flex; flex-direction: column; }
.view-row { display: flex; }
.view-cell { box-sizing: border-box; }
.view-cell.on { border: 1px solid #3d4a66; background: #a9d3ff; }
</style>
