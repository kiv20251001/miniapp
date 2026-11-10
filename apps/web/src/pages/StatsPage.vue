<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { useAppStore } from '@/stores/app'
import { groupByCategory, money } from '@/services/billing'
import { CATEGORY_LABEL } from '@/domain/constants'
import {
  calculateLearningStatistics,
  type StatisticsGranularity,
} from '@/services/statistics'
import CourseIcon from '@/components/CourseIcon.vue'
import TrendChart from '@/components/TrendChart.vue'
import PageHeader from '@/components/PageHeader.vue'
import { useViewRefresh } from '@/composables/useViewRefresh'

const store = useAppStore()
const router = useRouter()
const granularity = ref<StatisticsGranularity>('month')
const anchor = ref(dayjs())
const chartColors = ['#FF7A45', '#FF5F79', '#FFB347', '#39C6A4', '#5D9CFF', '#B46AF4']
const reportList = ref<HTMLElement | null>(null)
const dragging = ref(false)
let dragStartX = 0
let dragScrollLeft = 0
let dragMoved = false

useViewRefresh(() => {
  const start = granularity.value === 'year' ? anchor.value.startOf('year') : anchor.value.startOf('month')
  const end = granularity.value === 'year' ? anchor.value.endOf('year') : anchor.value.endOf('month')
  return {
    from: start.format('YYYY-MM-DD'),
    to: end.format('YYYY-MM-DD'),
  }
})

const stats = computed(() =>
  calculateLearningStatistics(
    store.overviewCourses,
    store.overviewExpenses,
    store.overviewScheduleExceptions,
    anchor.value,
    granularity.value,
    store.overviewCharges,
    store.snapshot.occurrenceRecords ?? [],
    store.overviewPayments,
  ),
)

const scopeLabel = computed(() =>
  granularity.value === 'year' ? `${anchor.value.year()} 年` : anchor.value.format('YYYY 年 M 月'),
)
const periodTotalLabel = computed(() => granularity.value === 'year' ? '本年总金额' : '本月总金额')
const periodDonutLabel = computed(() => granularity.value === 'year' ? '本年' : '本月')
const courseTrend = computed(() =>
  stats.value.trend.map((item) => ({ label: item.label, value: item.courseHours })),
)
const expenseTrend = computed(() =>
  stats.value.trend.map((item) => ({ label: item.label, value: item.expense })),
)
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

function mixWithWhite(hex: string, ratio = .2) {
  const value = hex.replace('#', '')
  if (!/^[\da-f]{6}$/i.test(value)) return hex
  const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16))
  return `rgb(${channels.map((channel) => Math.round(channel + (255 - channel) * ratio)).join(', ')})`
}

const donutBackground = computed(() => {
  if (!stats.value.periodTotal || !feeBreakdown.value.length) return 'var(--line)'
  let cursor = 0
  const slices = feeBreakdown.value.flatMap((item) => {
    const start = cursor
    cursor += (item.amount / stats.value.periodTotal) * 100
    return [
      `${mixWithWhite(item.color)} ${start}%`,
      `${item.color} ${cursor}%`,
    ]
  })
  return `conic-gradient(from -90deg, ${slices.join(',')})`
})

function shiftScope(direction: number) {
  anchor.value = granularity.value === 'year'
    ? anchor.value.add(direction, 'year')
    : anchor.value.add(direction, 'month')
}

function setGranularity(value: StatisticsGranularity) {
  granularity.value = value
  anchor.value = dayjs()
}

watch(
  [granularity, anchor],
  () => {
    const start = granularity.value === 'year' ? anchor.value.startOf('year') : anchor.value.startOf('month')
    const end = granularity.value === 'year' ? anchor.value.endOf('year') : anchor.value.endOf('month')
    void store.refreshRange(start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'))
  },
  { immediate: true },
)

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}min`
  const hours = minutes / 60
  return `${Number(hours.toFixed(hours >= 10 ? 0 : 1))}h`
}

function formatTrendHours(hours: number) {
  return `${Number(hours.toFixed(hours >= 10 ? 0 : 1))}h`
}

function startReportDrag(event: PointerEvent) {
  dragMoved = false
  if (event.pointerType === 'touch' || !reportList.value) return
  dragging.value = true
  dragStartX = event.clientX
  dragScrollLeft = reportList.value.scrollLeft
  reportList.value.setPointerCapture(event.pointerId)
}

function moveReportDrag(event: PointerEvent) {
  if (!dragging.value || !reportList.value) return
  if (Math.abs(event.clientX - dragStartX) > 8) dragMoved = true
  reportList.value.scrollLeft = dragScrollLeft - (event.clientX - dragStartX)
}

function stopReportDrag() {
  dragging.value = false
}

function openCourseBills(courseId: string) {
  if (dragMoved) return
  router.push({ path: `/courses/${courseId}/bills`, query: { returnTo: '/stats' } })
}
</script>

<template>
  <main class="page stats-page">
    <PageHeader eyebrow="账单数据" title="课程统计">
      <template #actions>
      <div class="scope-switch" aria-label="统计维度">
        <button
          type="button"
          :class="{ active: granularity === 'month' }"
          @click="setGranularity('month')"
        >月度</button>
        <button
          type="button"
          :class="{ active: granularity === 'year' }"
          @click="setGranularity('year')"
        >年度</button>
      </div>
      </template>
    </PageHeader>

    <div class="scope-nav">
      <button type="button" aria-label="上一周期" @click="shiftScope(-1)">‹</button>
      <strong>{{ scopeLabel }}</strong>
      <button type="button" aria-label="下一周期" @click="shiftScope(1)">›</button>
    </div>

    <section class="stats card">
      <div class="mini">
        <p class="muted">{{ periodTotalLabel }}</p>
        <strong>{{ money(stats.periodTotal) }}</strong>
      </div>
      <div class="mini">
        <p class="muted">已支付</p>
        <strong class="status-paid">{{ money(stats.periodPaid) }}</strong>
      </div>
      <div class="mini">
        <p class="muted">未支付</p>
        <strong class="status-unpaid">{{ money(stats.periodUnpaid) }}</strong>
      </div>
    </section>

    <section class="card cats">
      <h2>按类型</h2>
      <div v-if="feeBreakdown.length" class="fee-content">
        <div class="donut" :key="`${granularity}-${scopeLabel}`">
          <i class="donut-ring" :style="{ background: donutBackground }" />
          <div>
            <small>{{ periodDonutLabel }}</small>
            <strong>{{ money(stats.periodTotal) }}</strong>
          </div>
        </div>
        <div class="fee-legend">
          <div v-for="item in feeBreakdown" :key="item.category">
            <i :style="{ background: item.color, color: item.color }" />
            <span>{{ CATEGORY_LABEL[item.category] }}</span>
            <strong>{{ money(item.amount) }}</strong>
          </div>
        </div>
      </div>
      <p v-else class="empty-report">当前周期还没有账单。</p>
    </section>

    <section class="quick-metrics">
      <article>
        <span class="metric-icon purple">
          <svg viewBox="0 0 24 24"><path d="M8 3h8v4H8zM6 7h12v14H6zM9 11h6m-6 4h4"/></svg>
        </span>
        <div><small>课程安排</small><strong>{{ stats.scheduledCount }}<i>次</i></strong></div>
      </article>
      <article>
        <span class="metric-icon blue">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>
        </span>
        <div><small>总课时</small><strong>{{ formatMinutes(stats.scheduledMinutes) }}</strong></div>
      </article>
    </section>

    <section class="report-section">
      <div class="section-head">
        <div><p>课程明细</p><h2>每门课程表现</h2></div>
        <span>{{ store.isParentSession ? '全家' : store.child?.name }} · {{ scopeLabel }}</span>
      </div>
      <div
        v-if="stats.courseStats.length"
        ref="reportList"
        class="course-report-list"
        :class="{ dragging }"
        @pointerdown="startReportDrag"
        @pointermove="moveReportDrag"
        @pointerup="stopReportDrag"
        @pointercancel="stopReportDrag"
      >
        <article
          v-for="item in stats.courseStats"
          :key="item.course.id"
          class="course-report"
          :style="{
            '--course-color': item.course.color,
            '--course-progress': `${item.completion}%`,
          }"
          role="link"
          :aria-label="`查看${item.course.title}课程账单`"
          @click="openCourseBills(item.course.id)"
        >
          <header>
            <span class="course-report-icon"><CourseIcon :name="item.course.icon" /></span>
            <div>
              <h3>{{ item.course.title }}</h3>
              <p>{{ item.completedCount }}/{{ item.scheduledCount }} 次已完成</p>
            </div>
            <div class="progress-ring"><b>{{ item.completion }}%</b></div>
          </header>
          <div class="course-values">
            <div><small>总费用</small><strong>{{ money(item.totalFee) }}</strong></div>
            <div><small>已支付</small><strong class="status-paid">{{ money(item.paidFee) }}</strong></div>
            <div><small>未支付</small><strong class="status-unpaid">{{ money(item.unpaidFee) }}</strong></div>
          </div>
          <p v-if="item.packageLabel" class="package-line">{{ item.packageLabel }}</p>
        </article>
      </div>
      <p v-else class="empty-report">当前周期暂无课程安排。</p>
    </section>

    <section class="trend-grid">
      <TrendChart
        title="课时趋势"
        :caption="granularity === 'year' ? '各月安排课时' : '每日安排课时'"
        :points="courseTrend"
        color="#FF7A45"
        :value-formatter="formatTrendHours"
      />
      <TrendChart
        title="支付趋势"
        :caption="granularity === 'year' ? '按实际支付月份统计' : '按实际支付日期统计'"
        :points="expenseTrend"
        color="#FF5F79"
        :value-formatter="money"
      />
    </section>

  </main>
</template>

<style scoped>
.stats-page {
  padding-top: 24px;
}

.stats-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.stats-header h1 {
  font-size: 29px;
}

.scope-switch {
  display: flex;
  padding: 4px;
  border: 0;
  border-radius: 14px;
  background: var(--paper);
  box-shadow: var(--elev-sm), var(--glow-top);
}

.scope-switch button {
  min-width: 48px;
  padding: 7px 10px;
  color: var(--muted);
  border: 0;
  border-radius: 10px;
  background: transparent;
  font-size: 11px;
}

.scope-switch button.active {
  color: var(--accent-text);
  background: var(--accent-soft);
  font-weight: 700;
}

.scope-nav {
  display: grid;
  grid-template-columns: 36px 1fr 36px;
  align-items: center;
  margin-bottom: 12px;
  text-align: center;
}

.scope-nav button {
  display: grid;
  width: 34px;
  height: 34px;
  padding: 0;
  place-items: center;
  color: var(--muted);
  border: 0;
  border-radius: 50%;
  background: var(--paper);
  box-shadow: var(--elev-sm), var(--glow-top);
  font-size: 22px;
}

.scope-nav button:last-child {
  justify-self: end;
}

.scope-nav strong {
  font-size: 13px;
}

.stats {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  margin-bottom: 14px;
}

.mini { min-width: 0; padding: 2px 8px; text-align: center; border-left: 1px solid var(--line); }
.mini:first-child { padding-left: 0; border-left: 0; }
.mini:last-child { padding-right: 0; }
.mini p { margin-bottom: 5px; font-size: 10px; }
.mini strong {
  display: block;
  overflow: hidden;
  font-size: 15px;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cats {
  margin-bottom: 14px;
}

.cats h2 {
  margin-bottom: 8px;
  font-size: 16px;
}

.total-card {
  position: relative;
  margin-bottom: 12px;
  padding: 20px;
  overflow: hidden;
  color: #fff;
  border-radius: 26px;
  background: linear-gradient(140deg, #ffb45c 0%, #ff7a45 48%, #ef5734 100%);
  box-shadow:
    0 22px 44px -18px rgba(255, 122, 69, .72),
    inset 0 1px 0 rgba(255,255,255,.26);
}

.total-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.total-head span {
  color: rgba(255,255,255,.72);
  font-size: 11px;
}

.total-head strong {
  display: block;
  margin-top: 8px;
  font-size: 32px;
  letter-spacing: -.045em;
}

.total-orbit {
  position: relative;
  width: 58px;
  height: 45px;
  opacity: .55;
}

.total-orbit i {
  position: absolute;
  border: 2px solid rgba(255,255,255,.58);
  border-radius: 50%;
}

.total-orbit i:nth-child(1) { top: 0; right: 4px; width: 32px; height: 32px; }
.total-orbit i:nth-child(2) { right: 27px; bottom: 0; width: 23px; height: 23px; }
.total-orbit i:nth-child(3) { right: 0; bottom: 0; width: 17px; height: 17px; background: rgba(255,255,255,.28); }

.total-metrics {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-top: 20px;
}

.total-metrics div {
  padding: 10px;
  border-radius: 14px;
  background: rgba(255,255,255,.11);
}

.total-metrics span,
.total-metrics b {
  display: block;
}

.total-metrics span {
  margin-bottom: 5px;
  color: rgba(255,255,255,.65);
  font-size: 9px;
}

.total-metrics b {
  font-size: 12px;
}

.bill-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}

.bill-actions a {
  padding: 8px 12px;
  color: #fff;
  border: 1px solid rgba(255,255,255,.18);
  border-radius: 12px;
  background: rgba(255,255,255,.1);
  font-size: 10px;
  font-weight: 650;
}

.quick-metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 28px;
}

.quick-metrics article {
  display: flex;
  gap: 11px;
  align-items: center;
  padding: 14px;
  border: 0;
  border-radius: 20px;
  background: var(--paper);
  box-shadow: var(--elev-md), var(--glow-top);
}

.metric-icon {
  display: grid;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 13px;
}

.metric-icon.purple {
  color: #fff;
  background: linear-gradient(140deg, #ffb45c 0%, #ff6f43 100%);
  box-shadow: 0 10px 20px -10px rgba(255,122,69,.85), inset 0 1px 0 rgba(255,255,255,.4);
}

.metric-icon.blue {
  color: #fff;
  background: linear-gradient(140deg, #56b0ff 0%, #2f7fe0 100%);
  box-shadow: 0 10px 20px -10px rgba(62,155,255,.85), inset 0 1px 0 rgba(255,255,255,.4);
}

.metric-icon svg {
  width: 20px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.quick-metrics small,
.quick-metrics strong {
  display: block;
}

.quick-metrics small {
  margin-bottom: 3px;
  color: var(--muted);
  font-size: 9px;
}

.quick-metrics strong {
  font-size: 18px;
}

.quick-metrics strong i {
  margin-left: 2px;
  color: var(--muted);
  font-size: 9px;
  font-style: normal;
}

.report-section,
.trend-grid,
.fee-card {
  margin-bottom: 28px;
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.section-head p {
  margin: 0 0 3px;
  color: var(--accent-text);
  font-size: 10px;
  font-weight: 700;
}

.section-head h2 {
  font-size: 19px;
}

.section-head > span {
  color: var(--muted);
  font-size: 10px;
}

.course-report-list {
  display: flex;
  width: auto;
  min-width: 0;
  gap: 11px;
  /* 负边距 + 内边距：给卡片投影留出空间，避免被滚动容器裁掉 */
  margin: -10px -18px -26px;
  padding: 10px 18px 26px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scroll-padding-inline: 18px;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  touch-action: pan-x;
  cursor: grab;
  -webkit-overflow-scrolling: touch;
}

.course-report-list.dragging {
  scroll-snap-type: none;
  cursor: grabbing;
  user-select: none;
}

.course-report-list::-webkit-scrollbar {
  display: none;
}

.course-report {
  cursor: pointer;
  --course-deep: color-mix(in srgb, var(--course-color) 76%, #2a2350);
  flex: 0 0 calc(100% - 52px);
  min-width: 0;
  padding: 16px;
  border: 0;
  border-radius: 23px;
  background:
    radial-gradient(120% 90% at 0% 0%, color-mix(in srgb, var(--course-color) 16%, var(--mix-base)) 0%, color-mix(in srgb, var(--course-color) 6%, var(--mix-base)) 46%, var(--mix-base) 78%),
    var(--paper);
  box-shadow:
    0 2px 5px rgba(25,31,58,.04),
    0 16px 30px -18px color-mix(in srgb, var(--course-color) 34%, rgba(25,31,58,.45)),
    inset 0 1px 0 rgba(255,255,255,.9);
  scroll-snap-align: start;
}

.course-report header {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 50px;
  gap: 10px;
  align-items: center;
}

.course-report-icon {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  color: #fff;
  border-radius: 14px;
  background: linear-gradient(140deg, color-mix(in srgb, var(--course-color) 88%, #fff) 0%, var(--course-deep) 100%);
  box-shadow:
    0 8px 18px -8px color-mix(in srgb, var(--course-color) 72%, transparent),
    inset 0 1px 0 rgba(255,255,255,.45);
}

.course-report-icon svg {
  width: 22px;
  height: 22px;
}

.course-report h3 {
  overflow: hidden;
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.course-report header p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 9px;
}

.progress-ring {
  position: relative;
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 50%;
  background: conic-gradient(
    from 210deg,
    var(--course-deep) 0deg,
    var(--course-color) var(--course-progress),
    color-mix(in srgb, var(--course-color) 16%, var(--track)) var(--course-progress)
  );
  box-shadow: 0 6px 14px -8px color-mix(in srgb, var(--course-color) 72%, transparent);
}

.progress-ring::after {
  position: absolute;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--mix-base);
  box-shadow: inset 0 1px 3px color-mix(in srgb, var(--ink) 8%, transparent);
  content: "";
}

.progress-ring b {
  position: relative;
  z-index: 1;
  color: var(--course-deep);
  font-size: 9px;
  font-weight: 800;
}

.course-values {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  margin-top: 17px;
  padding-top: 13px;
  border-top: 1px solid color-mix(in srgb, var(--course-color) 14%, var(--line));
}

.course-values > div {
  min-width: 0;
  padding: 0 10px;
  text-align: center;
  border-left: 1px solid color-mix(in srgb, var(--course-color) 12%, var(--line));
}

.course-values > div:first-child {
  padding-left: 0;
  border-left: 0;
}

.course-values > div:last-child {
  padding-right: 0;
}

.course-values small,
.course-values strong {
  display: block;
}

.course-values small {
  margin-bottom: 5px;
  color: var(--muted);
  font-size: 8px;
}

.course-values strong {
  overflow: hidden;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.package-line {
  margin: 10px 0 0;
  color: color-mix(in srgb, var(--course-color) 55%, var(--ink));
  font-size: 10px;
  font-weight: 650;
  line-height: 1.45;
}

.trend-grid {
  display: grid;
  gap: 12px;
}

.fee-card {
  padding: 18px;
  border: 0;
  border-radius: 24px;
  background: var(--paper);
  box-shadow: var(--elev-md), var(--glow-top);
}

.fee-content {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  gap: 18px;
  align-items: center;
}

.donut {
  position: relative;
  display: grid;
  width: 132px;
  height: 132px;
  padding: 17px;
  place-items: center;
  border-radius: 50%;
}

.donut-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  box-shadow:
    0 16px 28px -16px rgba(255, 122, 69, .42),
    inset 0 1px 0 rgba(255,255,255,.35);
}

.donut > div {
  position: relative;
  z-index: 1;
  display: grid;
  width: 100%;
  height: 100%;
  place-content: center;
  text-align: center;
  border-radius: 50%;
  background: var(--paper);
  box-shadow: inset 0 2px 8px color-mix(in srgb, var(--ink) 8%, transparent);
}

.donut small,
.donut strong {
  display: block;
}

.donut small {
  color: var(--muted);
  font-size: 8px;
}

.donut strong {
  margin-top: 3px;
  font-size: 14px;
}

.fee-legend {
  display: grid;
  gap: 9px;
}

.fee-legend > div {
  display: grid;
  grid-template-columns: 7px minmax(0, 1fr) auto;
  gap: 7px;
  align-items: center;
  font-size: 10px;
}

.fee-legend i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  box-shadow: 0 3px 8px -3px currentColor;
}

.fee-legend span {
  overflow: hidden;
  color: var(--muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fee-legend strong {
  font-size: 10px;
}

.empty-report {
  margin: 0;
  padding: 30px 18px;
  color: var(--muted);
  text-align: center;
  border: 1px dashed var(--line);
  border-radius: 20px;
  font-size: 11px;
}

@media (max-width: 360px) {
  .stats-header {
    align-items: flex-start;
  }

  .stats-header h1 {
    font-size: 25px;
  }

  .scope-switch button {
    min-width: 42px;
    padding-inline: 8px;
  }

  .fee-content {
    grid-template-columns: 112px minmax(0, 1fr);
    gap: 12px;
  }

  .donut {
    width: 112px;
    height: 112px;
  }
}
</style>
