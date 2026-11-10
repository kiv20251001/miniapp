<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { onLoad, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { appShare, momentsShare } from '@/utils/share'
import { COURSE_TYPE_LABEL } from '@server-domain/constants'
import { buildCourseBillLedger } from '@server-domain/courseBills'
import { money } from '@server-domain/billing'
import { denyViewerBills } from '@/subpages/shared/useFamilyRole'
import { useFamilyPage } from '@/composables/useFamilyPage'
import { usePageBackground, useThemePage } from '@/utils/wx-theme'
import { cardBackground, tileBackground } from '@/utils/color'
import AppIcon from '@/components/AppIcon.vue'
import EmptyHint from '@/components/EmptyHint.vue'
import PageHeader from '@/components/PageHeader.vue'

const store = useFamilyPage()
const themeClass = useThemePage()
onShareAppMessage(appShare)
onShareTimeline(momentsShare)
const pageBg = usePageBackground()
const courseId = ref('')

onLoad((query) => {
  if (denyViewerBills()) return
  courseId.value = typeof query?.id === 'string' ? query.id : ''
})

const course = computed(() => store.snapshot.courses.find((item) => item.id === courseId.value))
const ledger = computed(() => {
  if (!course.value) return null
  return buildCourseBillLedger(
    course.value,
    store.overviewExpenses,
    store.overviewScheduleExceptions,
    store.overviewCharges,
    store.overviewPayments,
  )
})

function openBill(expenseId?: string) {
  if (!expenseId) return
  uni.navigateTo({ url: `/subpages/expense-edit/index?id=${expenseId}` })
}

function subOf(day: { startTime?: string; endTime?: string; kind?: string }) {
  if (day.startTime && day.endTime) return `${day.startTime}–${day.endTime}`
  return day.kind === 'period' ? '结算账单' : '一次性账单'
}
</script>

<template>
  <page-meta :page-style="pageBg.style" :background-color="pageBg.bg" :background-color-top="pageBg.bg" :background-color-bottom="pageBg.bg" :root-background-color="pageBg.bg" :background-text-style="pageBg.text" />
  <view class="theme-root page edit sub" :class="themeClass">
    <PageHeader safe show-back title="课程账单" :caption="course ? COURSE_TYPE_LABEL[course.type] + ' · ' + course.title : ''" />
    <view v-if="!course" class="empty">课程不存在</view>
    <template v-else-if="ledger">
      <view class="hero" :style="{ background: cardBackground(course.color) }">
        <view class="hero-icon" :style="{ background: tileBackground(course.color) }">
          <AppIcon :name="course.icon || 'generic'" tone="white" :size="22" />
        </view>
        <view>
          <text class="muted">{{ COURSE_TYPE_LABEL[course.type] }}</text>
          <text class="hero-title">{{ course.title }}</text>
        </view>
      </view>
      <view class="card stats">
        <view class="mini"><text class="muted">总金额</text><text class="strong">{{ money(ledger.total) }}</text></view>
        <view class="mini"><text class="muted">已支付</text><text class="strong pay-paid">{{ money(ledger.paid) }}</text></view>
        <view class="mini"><text class="muted">未支付</text><text class="strong pay-unpaid">{{ money(ledger.unpaid) }}</text></view>
      </view>
      <view class="list-title">
        <text class="muted">按上课日</text>
        <text class="h2">{{ ledger.days.length }} 次记录</text>
      </view>
      <view v-if="!ledger.days.length" class="card">
        <EmptyHint icon="calendar" label="还没有记录" />
      </view>
      <view v-for="day in ledger.days" :key="day.key" class="day-row press" hover-class="press-on" hover-stay-time="80" @click="openBill(day.expenseId)">
        <view class="day-copy">
          <text class="day-title">{{ dayjs(day.date).format('M月D日') }} {{ day.weekdayLabel }}</text>
          <text class="muted">{{ subOf(day) }}</text>
        </view>
        <view class="day-fee">
          <text class="day-amount">{{ day.amountLabel }}</text>
          <text :class="day.payState === 'paid' ? 'pay-paid' : 'pay-unpaid'">{{ day.payLabel }}</text>
        </view>
        <text v-if="day.expenseId" class="arrow">›</text>
      </view>
    </template>
  </view>
</template>

<style scoped>
.edit { padding-bottom: 48px; }
.hero { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; padding: 14px 16px; border-radius: 22px; box-shadow: var(--elev-sm); }
.hero-icon { display: flex; width: 46px; height: 46px; align-items: center; justify-content: center; border-radius: 15px; }
.hero-title { display: block; margin-top: 2px; color: var(--ink); font-size: 18px; font-weight: 800; }
.stats { display: flex; }
.mini { flex: 1; padding: 2px 8px; text-align: center; border-left: 1px solid var(--line); }
.mini:first-child { border-left: 0; }
.mini .muted, .strong { display: block; }
.strong { margin-top: 5px; color: var(--ink); font-size: 15px; font-weight: 800; }
.list-title { margin: 6px 0 11px; }
.h2 { display: block; margin-top: 2px; color: var(--ink); font-size: 18px; font-weight: 800; }
.day-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; padding: 14px; border-radius: 18px; background: var(--paper); box-shadow: var(--elev-sm); }
.day-copy { flex: 1; min-width: 0; }
.day-title { display: block; color: var(--ink); font-weight: 750; }
.day-fee { text-align: right; }
.day-amount { display: block; color: var(--ink); font-weight: 750; }
.arrow { color: var(--faint); font-size: 18px; }
.empty { display: block; padding: 24px 8px; color: var(--muted); text-align: center; }
</style>
