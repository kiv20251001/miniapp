<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { onLoad, onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import { appShare, momentsShare } from '@/utils/share'
import { billNetAmount, billsInDueRange, groupByCategory, money, refundedAmountOf } from '@server-domain/billing'
import { CATEGORY_LABEL } from '@server-domain/constants'
import { showCloudError } from '@/cloud/call'
import { denyViewerBills } from '@/subpages/shared/useFamilyRole'
import { useFamilyPage } from '@/composables/useFamilyPage'
import { ensureSession } from '@/stores/family'
import { usePageBackground, useThemePage, useThemeStore } from '@/utils/wx-theme'
import { weekDates, weekLabel } from '@/utils/view'
import AppIcon from '@/components/AppIcon.vue'
import EmptyHint from '@/components/EmptyHint.vue'
import TabBar from '@/components/TabBar.vue'
import { currentMixBase, mix, tileBackground } from '@/utils/color'
import AppHeader from '@/components/AppHeader.vue'
import PageHeader from '@/components/PageHeader.vue'

const store = useFamilyPage()
const themeClass = useThemePage()
onShareAppMessage(appShare)
onShareTimeline(momentsShare)
const pageBg = usePageBackground()
const theme = useThemeStore()
const anchor = ref(dayjs().format('YYYY-MM-DD'))
const fromToday = ref(false)

onLoad((query) => {
  fromToday.value = query?.from === 'today'
})

onShow(() => {
  void refreshBills()
})

async function refreshBills() {
  if (!store.ready) await ensureSession()
  if (!store.ready) return
  if (denyViewerBills()) return
  const period = anchor.value.slice(0, 7)
  store.generateBills(period).catch((error) => showCloudError(error))
}

const range = computed(() => weekDates(anchor.value))
const bills = computed(() =>
  billsInDueRange(store.overviewExpenses, range.value[0], range.value[6])
    .slice()
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
)
const weekTotal = computed(() => bills.value.reduce((sum, item) => sum + billNetAmount(item, store.overviewPayments), 0))
const paidAmount = computed(() => bills.value.filter((item) => item.status === 'paid').reduce((sum, item) => sum + billNetAmount(item, store.overviewPayments), 0))
const openAmount = computed(() =>
  bills.value.filter((item) => item.status !== 'paid').reduce((sum, item) => sum + billNetAmount(item, store.overviewPayments), 0),
)
const chartColors = ['#FF7A45', '#FF5F79', '#FFB347', '#39C6A4', '#5D9CFF', '#B46AF4']
const slices = computed(() =>
  groupByCategory(bills.value, store.overviewPayments).map((item, index) => ({
    ...item,
    color: chartColors[index % chartColors.length],
  })),
)
const donutBackground = computed(() => {
  const paper = currentMixBase()
  if (!weekTotal.value || !slices.value.length) return theme.isDark ? '#2a3142' : '#e6e8f0'
  let cursor = 0
  const parts = slices.value.flatMap((item) => {
    const start = cursor
    cursor += (item.amount / weekTotal.value) * 100
    return [`${mix(item.color, paper, 0.2)} ${start}%`, `${item.color} ${cursor}%`]
  })
  return `conic-gradient(from -90deg, ${parts.join(',')})`
})

function courseOf(courseId?: string) {
  if (!courseId) return undefined
  return store.snapshot.courses.find((item) => item.id === courseId)
}

function shift(delta: number) {
  anchor.value = dayjs(anchor.value).add(delta, 'week').format('YYYY-MM-DD')
  store.generateBills(anchor.value.slice(0, 7)).catch((error) => showCloudError(error))
}
</script>

<template>
  <page-meta :page-style="pageBg.style" :background-color="pageBg.bg" :background-color-top="pageBg.bg" :background-color-bottom="pageBg.bg" :root-background-color="pageBg.bg" :background-text-style="pageBg.text" />
  <view class="theme-root" :class="themeClass">
    <AppHeader />
    <view class="page">
      <PageHeader show-back compact eyebrow="全家账单" :title="weekLabel(anchor)">
        <template #actions>
          <view class="nav">
            <button hover-class="press-on" hover-stay-time="80" @click="shift(-1)">‹</button>
            <button hover-class="press-on" hover-stay-time="80" class="add" @click="uni.navigateTo({ url: '/subpages/expense-edit/index' })">
              <AppIcon name="plus" tone="white" :size="14" />
              <text>记一笔</text>
            </button>
            <button hover-class="press-on" hover-stay-time="80" @click="shift(1)">›</button>
          </view>
        </template>
      </PageHeader>
      <view class="card stats">
        <view class="mini"><text class="muted">本周总金额</text><text class="strong">{{ money(weekTotal) }}</text></view>
        <view class="mini"><text class="muted">已支付</text><text class="strong pay-paid">{{ money(paidAmount) }}</text></view>
        <view class="mini"><text class="muted">待支付</text><text class="strong pay-unpaid">{{ money(openAmount) }}</text></view>
      </view>
      <view class="card cats">
        <text class="section">按类型</text>
        <view v-if="slices.length" class="fee-content">
          <view class="donut">
            <view class="donut-ring" :style="{ background: donutBackground }" />
            <view class="donut-hole">
              <text class="muted">本周</text>
              <text class="donut-total">{{ money(weekTotal) }}</text>
            </view>
          </view>
          <view class="legend">
            <view v-for="item in slices" :key="item.category" class="legend-row">
              <view class="swatch" :style="{ background: item.color }" />
              <text>{{ CATEGORY_LABEL[item.category] }}</text>
              <text class="legend-amount">{{ money(item.amount) }}</text>
            </view>
          </view>
        </view>
        <EmptyHint v-else icon="bill" label="还没有账单" />
      </view>
      <view class="list-title">
        <text class="muted">账单明细</text>
        <text class="h2">{{ bills.length }} 笔记录</text>
      </view>
      <view v-if="!bills.length" class="card">
        <EmptyHint icon="bill" label="还没有账单" />
      </view>
      <view
        v-for="bill in bills"
        :key="bill.id"
        class="card bill press"
        hover-class="press-on"
        hover-stay-time="80"
        @click="uni.navigateTo({ url: `/subpages/expense-edit/index?id=${bill.id}` })"
      >
        <view
          class="bill-icon"
          :style="{ background: courseOf(bill.courseId) ? tileBackground(courseOf(bill.courseId)!.color) : tileBackground('#ff6b8a') }"
        >
          <AppIcon v-if="courseOf(bill.courseId)" :name="courseOf(bill.courseId)!.icon || 'generic'" tone="white" :size="22" />
          <text v-else>¥</text>
        </view>
        <view class="bill-copy">
          <text class="muted">{{ CATEGORY_LABEL[bill.category] }} · {{ bill.dueDate }}</text>
          <text class="title">{{ bill.title }}</text>
          <text class="muted">{{ bill.status === 'paid' ? '已支付' : '未支付' }}</text>
          <text v-if="refundedAmountOf(bill.id, store.overviewPayments)" class="refund-note">
            已退 {{ money(refundedAmountOf(bill.id, store.overviewPayments)) }}
          </text>
        </view>
        <view class="bill-side">
          <text class="amount">{{ money(billNetAmount(bill, store.overviewPayments)) }}</text>
          <text class="pill" :class="bill.status === 'paid' ? 'paid' : 'unpaid'">
            {{ bill.status === 'paid' ? '已支付' : '未支付' }}
          </text>
        </view>
        <text class="arrow">›</text>
      </view>
    </view>
    <TabBar :active="fromToday ? 'today' : 'stats'" />
  </view>
</template>

<style scoped>
.nav { display: flex; align-items: center; gap: 2px; }
.nav button { display: flex; width: 28px; height: 32px; align-items: center; justify-content: center; color: var(--muted); font-size: 18px; line-height: 32px; }
.nav .add {
  width: auto;
  gap: 4px;
  padding: 0 12px;
  color: #fff;
  border-radius: 13px;
  background: #ff7a45;
  font-size: 11px;
  font-weight: 750;
}
.stats { display: flex; }
.mini { flex: 1; padding: 2px 8px; text-align: center; border-left: 1px solid var(--line); }
.mini:first-child { padding-left: 0; border-left: 0; }
.mini .muted, .strong { display: block; }
.strong { margin-top: 5px; color: var(--ink); font-size: 15px; font-weight: 800; }
.section { display: block; margin-bottom: 8px; color: var(--ink); font-size: 16px; font-weight: 800; }
.fee-content { display: flex; gap: 12px; align-items: center; }
.donut { position: relative; width: 112px; height: 112px; flex: 0 0 auto; }
.donut-ring { position: absolute; inset: 0; border-radius: 50%; }
.donut-hole {
  position: absolute;
  inset: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--paper);
}
.donut-total { margin-top: 3px; color: var(--ink); font-size: 13px; font-weight: 800; }
.legend { flex: 1; min-width: 0; }
.legend-row { display: flex; align-items: center; gap: 7px; margin-bottom: 8px; color: var(--muted); font-size: 11px; }
.swatch { width: 7px; height: 7px; border-radius: 50%; }
.legend-row text:nth-child(2) { flex: 1; }
.legend-amount { color: var(--ink); font-weight: 700; }
.list-title { margin: 4px 0 11px; }
.h2 { display: block; margin-top: 2px; font-size: 18px; font-weight: 800; }
.bill { display: flex; align-items: center; gap: 11px; }
.bill-icon {
  display: flex;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  color: #fff;
  border-radius: 13px;
  font-size: 15px;
  font-weight: 800;
}
.bill-copy { flex: 1; min-width: 0; }
.title { display: block; margin: 2px 0; font-weight: 700; }
.refund-note { display: block; color: var(--unpaid); font-size: 10px; }
.bill-side { text-align: right; }
.amount { display: block; font-weight: 750; }
.pill { display: inline-block; margin-top: 6px; padding: 3px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
.pill.paid { color: var(--paid); background: var(--paid-soft); }
.pill.unpaid { color: var(--unpaid); background: var(--unpaid-soft); }
.arrow { color: #c5cad6; font-size: 18px; }
</style>
