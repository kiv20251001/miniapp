<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { groupByCategory, money } from '@server-domain/billing'
import { CATEGORY_LABEL } from '@server-domain/constants'
import { calculateLearningStatistics } from '@server-domain/statistics'
import { useFamilyStore } from '@/stores/family'
import { useThemeStore } from '@/utils/wx-theme'
import { currentMixBase, deepTone, mix, tileBackground } from '@/utils/color'
import { windowWidth } from '@/utils/system'
import AppIcon from '@/components/AppIcon.vue'
import { SCHEDULE_LOADING, SCHEDULE_OFFLINE } from '@/domain/copy'
import EmptyHint from '@/components/EmptyHint.vue'
import PageHeader from '@/components/PageHeader.vue'
import TrendChart from '@/components/TrendChart.vue'

defineProps<{ active: boolean }>()
const store = useFamilyStore()
const theme = useThemeStore()
/** 与 web 一致：卡片接近整行，右侧露出下一张方便左右滑。 */
const reportCardWidth = Math.max(280, windowWidth() - 88)

const granularity = ref<'month' | 'year'>('month')
const anchor = ref(dayjs())
const chartColors = ['#FF7A45', '#FF5F79', '#FFB347', '#39C6A4', '#5D9CFF', '#B46AF4']

const stats = computed(() => calculateLearningStatistics(
  store.overviewCourses,
  store.overviewExpenses,
  store.overviewScheduleExceptions,
  anchor.value,
  granularity.value,
  store.overviewCharges,
  store.snapshot.occurrenceRecords ?? [],
  store.overviewPayments,
))

const scopeLabel = computed(() =>
  granularity.value === 'year' ? `${anchor.value.year()} 年` : anchor.value.format('YYYY 年 M 月'),
)
const periodTotalLabel = computed(() => granularity.value === 'year' ? '本年总金额' : '本月总金额')
const periodDonutLabel = computed(() => granularity.value === 'year' ? '本年' : '本月')
const courseTrend = computed(() => stats.value.trend.map((item) => ({ label: item.label, value: item.courseHours })))
const expenseTrend = computed(() => stats.value.trend.map((item) => ({ label: item.label, value: item.expense })))
const periodBills = computed(() => {
  const start = (granularity.value === 'year' ? anchor.value.startOf('year') : anchor.value.startOf('month')).format('YYYY-MM-DD')
  const end = (granularity.value === 'year' ? anchor.value.endOf('year') : anchor.value.endOf('month')).format('YYYY-MM-DD')
  return store.overviewExpenses.filter((item) => item.status !== 'void' && item.dueDate >= start && item.dueDate <= end)
})
const feeBreakdown = computed(() =>
  groupByCategory(periodBills.value, store.overviewPayments).map((item, index) => ({
    category: item.category,
    amount: item.amount,
    color: chartColors[index % chartColors.length],
  })),
)
const donutBackground = computed(() => {
  const paper = currentMixBase()
  const empty = theme.isDark ? '#2a3142' : '#e6e8f0'
  if (!stats.value.periodTotal || !feeBreakdown.value.length) return empty
  let cursor = 0
  const slices = feeBreakdown.value.flatMap((item) => {
    const start = cursor
    cursor += (item.amount / stats.value.periodTotal) * 100
    return [`${mix(item.color, paper, 0.2)} ${start}%`, `${item.color} ${cursor}%`]
  })
  return `conic-gradient(from -90deg, ${slices.join(',')})`
})

function shift(direction: number) {
  anchor.value = granularity.value === 'year' ? anchor.value.add(direction, 'year') : anchor.value.add(direction, 'month')
}

function setGranularity(value: 'month' | 'year') {
  granularity.value = value
  anchor.value = dayjs()
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}min`
  const hours = minutes / 60
  return `${Number(hours.toFixed(hours >= 10 ? 0 : 1))}h`
}

function formatTrendHours(hours: number) {
  return `${Number(hours.toFixed(hours >= 10 ? 0 : 1))}h`
}
</script>

<template>
    <view class="page stats-page">
      <PageHeader :eyebrow="store.canViewBills ? '账单数据' : '课程数据'" title="课程统计">
        <template #actions>
          <view class="nav">
            <button hover-class="press-on" hover-stay-time="80" :class="{ on: granularity === 'month' }" @click="setGranularity('month')">月度</button>
            <button hover-class="press-on" hover-stay-time="80" :class="{ on: granularity === 'year' }" @click="setGranularity('year')">年度</button>
          </view>
        </template>
      </PageHeader>

      <view class="scope-nav">
        <button hover-class="press-on" hover-stay-time="80" @click="shift(-1)">‹</button>
        <text>{{ scopeLabel }}</text>
        <button hover-class="press-on" hover-stay-time="80" @click="shift(1)">›</button>
      </view>

      <view v-if="store.canViewBills" class="card stats">
        <view class="mini">
          <text class="muted">{{ periodTotalLabel }}</text>
          <text class="strong">{{ money(stats.periodTotal) }}</text>
        </view>
        <view class="mini">
          <text class="muted">已支付</text>
          <text class="strong pay-paid">{{ money(stats.periodPaid) }}</text>
        </view>
        <view class="mini">
          <text class="muted">未支付</text>
          <text class="strong pay-unpaid">{{ money(stats.periodUnpaid) }}</text>
        </view>
      </view>

      <view v-if="store.canViewBills" class="card cats">
        <text class="section">按类型</text>
        <view v-if="feeBreakdown.length" class="fee-content">
          <view class="donut">
            <view class="donut-ring" :style="{ background: donutBackground }" />
            <view class="donut-hole">
              <text class="muted">{{ periodDonutLabel }}</text>
              <text class="donut-total">{{ money(stats.periodTotal) }}</text>
            </view>
          </view>
          <view class="legend">
            <view v-for="item in feeBreakdown" :key="item.category" class="legend-row">
              <view class="swatch" :style="{ background: item.color }" />
              <text>{{ CATEGORY_LABEL[item.category] }}</text>
              <text class="legend-amount">{{ money(item.amount) }}</text>
            </view>
          </view>
        </view>
        <EmptyHint v-else-if="store.booting" icon="bill" :label="SCHEDULE_LOADING" />
        <EmptyHint v-else-if="store.offline" icon="bill" :label="SCHEDULE_OFFLINE" />
        <EmptyHint v-else icon="bill" label="还没有账单" />
      </view>

      <view class="quick-metrics">
        <view class="metric">
          <view class="metric-icon purple"><AppIcon name="clipboard" tone="white" :size="18" /></view>
          <view>
            <text class="muted">课程计划</text>
            <text class="metric-value">{{ stats.scheduledCount }}<text class="unit">次</text></text>
          </view>
        </view>
        <view class="metric">
          <view class="metric-icon blue"><AppIcon name="clock" tone="white" :size="18" /></view>
          <view>
            <text class="muted">总课时</text>
            <text class="metric-value">{{ formatMinutes(stats.scheduledMinutes) }}</text>
          </view>
        </view>
      </view>

      <view class="section-head">
        <view>
          <text class="eyebrow">课程明细</text>
          <text class="h2">每门课程表现</text>
        </view>
        <text class="muted">全家 · {{ scopeLabel }}</text>
      </view>
      <scroll-view v-if="stats.courseStats.length" scroll-x class="report-scroll" :show-scrollbar="false">
        <view class="report-row">
          <view
            v-for="item in stats.courseStats"
            :key="item.course.id"
            class="course-report press"
            :style="{ width: reportCardWidth + 'px', background: `radial-gradient(120% 90% at 0% 0%, ${mix(item.course.color, currentMixBase(), 0.84)} 0%, ${currentMixBase()} 78%)` }"
            hover-class="press-on"
            hover-stay-time="80"
            @click="store.canViewBills && uni.navigateTo({ url: `/subpages/course-bills/index?id=${item.course.id}&returnTo=stats` })"
          >
            <view class="report-head">
              <view class="report-icon" :style="{ background: tileBackground(item.course.color) }">
                <AppIcon :name="item.course.icon || 'generic'" tone="white" :size="22" />
              </view>
              <view class="report-copy">
                <text class="report-title">{{ item.course.title }}</text>
                <text class="muted">{{ item.completedCount }}/{{ item.scheduledCount }} 次已完成</text>
              </view>
              <view
                class="progress-ring"
                :style="{ background: `conic-gradient(from 210deg, ${deepTone(item.course.color)} 0deg, ${item.course.color} ${item.completion}%, ${mix(item.course.color, currentMixBase(), 0.84)} ${item.completion}%)`, color: deepTone(item.course.color) }"
              >
                <text>{{ item.completion }}%</text>
              </view>
            </view>
            <view v-if="store.canViewBills" class="course-values">
              <view><text>总费用</text><text class="val">{{ money(item.totalFee) }}</text></view>
              <view><text>已支付</text><text class="val pay-paid">{{ money(item.paidFee) }}</text></view>
              <view><text>未支付</text><text class="val pay-unpaid">{{ money(item.unpaidFee) }}</text></view>
            </view>
            <text v-if="item.packageLabel" class="package">{{ item.packageLabel }}</text>
          </view>
        </view>
      </scroll-view>
      <view v-else class="card">
        <EmptyHint icon="calendar" :label="store.booting ? SCHEDULE_LOADING : store.offline ? SCHEDULE_OFFLINE : '还没有课程'" />
      </view>

      <TrendChart
        title="课时趋势"
        :caption="granularity === 'year' ? '各月计划课时' : '每日计划课时'"
        :points="courseTrend"
        color="#FF7A45"
        :value-formatter="formatTrendHours"
        :visible="active"
      />
      <TrendChart
        v-if="store.canViewBills"
        title="支付趋势"
        :caption="granularity === 'year' ? '按实际支付月份统计' : '按实际支付日期统计'"
        :points="expenseTrend"
        color="#FF5F79"
        :value-formatter="money"
        :visible="active"
      />

    </view>
</template>

<style scoped>
.stats-page { padding-top: 8px; }
.nav { display: flex; align-items: center; padding: 3px; border-radius: 14px; background: var(--paper); box-shadow: var(--elev-sm); }
.nav button {
  display: flex;
  min-width: 48px;
  height: 30px;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  border-radius: 11px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  line-height: 30px;
}
.nav button.on { color: var(--accent-text); background: var(--accent-soft); }
.scope-nav { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 14px; }
.scope-nav button {
  display: flex;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  font-size: 20px;
  line-height: 1;
}
.scope-nav text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  font-weight: 750;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stats { display: flex; margin-bottom: 14px; }
.mini { flex: 1; padding: 2px 8px; text-align: center; border-left: 1px solid var(--line); }
.mini:first-child { padding-left: 0; border-left: 0; }
.mini .muted, .strong { display: block; }
.strong { margin-top: 5px; color: var(--ink); font-size: 15px; font-weight: 800; }
.section { display: block; margin-bottom: 8px; color: var(--ink); font-size: 16px; font-weight: 800; }
.fee-content { display: flex; gap: 14px; align-items: center; }
.donut { position: relative; width: 120px; height: 120px; flex: 0 0 auto; }
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
.legend-row text:nth-child(2) { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.legend-amount { color: var(--ink); font-weight: 700; }
.quick-metrics { display: flex; gap: 10px; margin-bottom: 18px; }
.metric { display: flex; flex: 1; align-items: center; gap: 10px; padding: 14px; border-radius: 20px; background: var(--paper); box-shadow: var(--elev-sm); }
.metric-icon { display: flex; width: 36px; height: 36px; align-items: center; justify-content: center; border-radius: 12px; }
.metric-icon.purple { background: linear-gradient(140deg, #b388ff, #7b61ff); }
.metric-icon.blue { background: linear-gradient(140deg, #8eb6ff, #5b8def); }
.metric-value { display: block; margin-top: 2px; color: var(--ink); font-size: 18px; font-weight: 800; }
.unit { margin-left: 2px; font-size: 12px; font-weight: 650; }
.section-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
.section-head .muted {
  max-width: 48%;
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.h2 { display: block; color: var(--ink); font-size: 16px; font-weight: 800; }
.report-scroll { width: 100%; margin-bottom: 16px; white-space: nowrap; }
.report-row { display: flex; gap: 12px; padding-bottom: 4px; }
.course-report {
  display: inline-block;
  box-sizing: border-box;
  flex: 0 0 auto;
  padding: 16px;
  border-radius: 23px;
  background: var(--paper);
  box-shadow: var(--elev-md);
  white-space: normal;
  vertical-align: top;
}
.report-head { display: flex; align-items: center; gap: 10px; }
.report-icon { display: flex; width: 42px; height: 42px; align-items: center; justify-content: center; border-radius: 14px; }
.report-copy { flex: 1; min-width: 0; }
.report-copy .muted { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.report-title { display: block; overflow: hidden; color: var(--ink); font-size: 15px; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
.progress-ring {
  display: flex;
  width: 48px;
  height: 48px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 9px;
  font-weight: 800;
}
.progress-ring text {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--paper);
  text-align: center;
  line-height: 36px;
}
.course-values { display: flex; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line); }
.course-values view { flex: 1; text-align: center; border-left: 1px solid var(--line); }
.course-values view:first-child { border-left: 0; }
.course-values text { display: block; color: var(--muted); font-size: 10px; white-space: nowrap; }
.val { margin-top: 4px; color: var(--ink); font-size: 13px; font-weight: 800; white-space: nowrap; }
.package { display: block; margin-top: 10px; color: var(--muted); font-size: 11px; }
</style>
