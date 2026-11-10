<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import dayjs from 'dayjs'
import { useAppStore } from '@/stores/app'
import { useHomeDate } from '@/composables/useHomeDate'
import ExpenseCard from '@/components/ExpenseCard.vue'
import { CATEGORY_LABEL } from '@/domain/constants'
import { billNetAmount, money, groupByCategory } from '@/services/billing'
import PageHeader from '@/components/PageHeader.vue'
import { useViewRefresh } from '@/composables/useViewRefresh'

const store = useAppStore()
const route = useRoute()
const { view } = useHomeDate()
const chartColors = ['#FF7A45', '#FF5F79', '#FFB347', '#39C6A4', '#5D9CFF', '#B46AF4']
const fromToday = computed(() => route.query.from === 'today')

const weekStart = computed(() => {
  const anchor = dayjs().add(view.weekOffset, 'week')
  return anchor.subtract((anchor.day() + 6) % 7, 'day')
})
const weekEnd = computed(() => weekStart.value.add(6, 'day'))

useViewRefresh(() => ({
  from: weekStart.value.format('YYYY-MM-DD'),
  to: weekEnd.value.format('YYYY-MM-DD'),
}))

const weekBills = computed(() => {
  const start = weekStart.value.format('YYYY-MM-DD')
  const end = weekEnd.value.format('YYYY-MM-DD')
  return store.overviewExpenses
    .filter((item) => item.status !== 'void' && item.dueDate >= start && item.dueDate <= end)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
})

const weekTotal = computed(() => weekBills.value.reduce((sum, item) => sum + billNetAmount(item, store.overviewPayments), 0))
const paid = computed(() =>
  weekBills.value.filter((item) => item.status === 'paid').reduce((sum, item) => sum + billNetAmount(item, store.overviewPayments), 0),
)
const unpaid = computed(() =>
  weekBills.value.filter((item) => item.status !== 'paid').reduce((sum, item) => sum + billNetAmount(item, store.overviewPayments), 0),
)
const cats = computed(() => groupByCategory(weekBills.value, store.overviewPayments))
const categorySlices = computed(() =>
  cats.value.map((item, index) => ({
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
  if (!weekTotal.value || !categorySlices.value.length) return 'var(--line)'
  let cursor = 0
  const slices = categorySlices.value.flatMap((item) => {
    const start = cursor
    cursor += (item.amount / weekTotal.value) * 100
    return [
      `${mixWithWhite(item.color)} ${start}%`,
      `${item.color} ${cursor}%`,
    ]
  })
  return `conic-gradient(from -90deg, ${slices.join(',')})`
})

function billLink(id: string) {
  return {
    path: `/bills/edit/${id}`,
    query: fromToday.value ? { from: 'today' } : {},
  }
}

function addLink() {
  return {
    path: '/bills/edit',
    query: fromToday.value ? { from: 'today' } : {},
  }
}
</script>

<template>
  <main class="page bills-page">
    <PageHeader show-back title="本周课程账单">
      <template #actions>
        <router-link class="add-expense" :to="addLink()">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          记一笔
        </router-link>
      </template>
    </PageHeader>

    <section class="stats card">
      <div class="mini">
        <p class="muted">本周总金额</p>
        <strong>{{ money(weekTotal) }}</strong>
      </div>
      <div class="mini">
        <p class="muted">已支付</p>
        <strong class="status-paid">{{ money(paid) }}</strong>
      </div>
      <div class="mini">
        <p class="muted">待支付</p>
        <strong class="status-unpaid">{{ money(unpaid) }}</strong>
      </div>
    </section>

    <section class="card cats">
      <h2>按类型</h2>
      <div v-if="categorySlices.length" class="fee-content">
        <div class="donut" :key="`${weekStart.format('YYYY-MM-DD')}-${weekTotal}`">
          <i class="donut-ring" :style="{ background: donutBackground }" />
          <div>
            <small>本周</small>
            <strong>{{ money(weekTotal) }}</strong>
          </div>
        </div>
        <div class="fee-legend">
          <div v-for="item in categorySlices" :key="item.category">
            <i :style="{ background: item.color, color: item.color }" />
            <span>{{ CATEGORY_LABEL[item.category] }}</span>
            <strong>{{ money(item.amount) }}</strong>
          </div>
        </div>
      </div>
      <p v-else class="empty-cats">本周还没有支出记录。</p>
    </section>

    <section class="bill-list-section">
      <div class="list-title"><div><small>账单明细</small><h2>{{ weekBills.length }} 笔记录</h2></div></div>
      <div class="list">
      <router-link
        v-for="bill in weekBills"
        :key="bill.id"
        :to="billLink(bill.id)"
        class="link-wrap"
      >
        <ExpenseCard :expense="bill" />
      </router-link>
      </div>
      <p v-if="!weekBills.length" class="empty-bills">本周暂无账单。</p>
    </section>
  </main>
</template>

<style scoped>
.bills-page { padding-top: 24px; }

.add-expense {
  display: flex;
  min-height: 40px;
  align-items: center;
  gap: 5px;
  padding: 0 12px;
  color: #fff;
  border-radius: 13px;
  background: var(--accent);
  box-shadow: 0 12px 22px -10px rgba(255,122,69,.7);
  font-size: 11px;
  font-weight: 750;
}
.add-expense svg { width: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; }

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
  font-size: 16px;
  margin-bottom: 8px;
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
.donut strong { display: block; }
.donut small { color: var(--muted); font-size: 8px; }
.donut strong { margin-top: 3px; font-size: 14px; }
.fee-legend { display: grid; gap: 9px; }
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
.fee-legend strong { font-size: 10px; }
.empty-cats {
  margin: 0;
  padding: 24px 12px;
  color: var(--muted);
  text-align: center;
  font-size: 12px;
}

.list-title { margin-bottom: 11px; }
.list-title small { color: var(--muted); font-size: 10px; }
.list-title h2 { margin-top: 2px; font-size: 18px; }
.bill-list-section { margin-bottom: 18px; }
.empty-bills { padding: 28px; color: var(--muted); text-align: center; border: 1px dashed var(--line); border-radius: 20px; font-size: 12px; }
.link-wrap + .link-wrap { margin-top: 10px; }
.link-wrap :deep(.item) { box-shadow: var(--elev-sm), var(--glow-top); }

@media (max-width: 360px) {
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
