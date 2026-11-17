<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'

/** 本周账单已并进统计页的周维度，旧入口直接过去。 */
onLoad((query) => {
  const date = typeof query?.date === 'string' ? query.date : ''
  uni.redirectTo({ url: `/subpages/stats/index${date ? `?date=${date}` : ''}` })
})
</script>

<template>
  <view />
</template>
