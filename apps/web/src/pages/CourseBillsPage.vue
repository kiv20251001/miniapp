<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { useAppStore } from '@/stores/app'
import { COURSE_TYPE_LABEL } from '@/domain/constants'
import { money } from '@/services/billing'
import { buildCourseBillLedger } from '@/services/courseBills'
import { effectiveCourseSlots } from '@/services/courseSchedule'
import CourseIcon from '@/components/CourseIcon.vue'
import PageHeader from '@/components/PageHeader.vue'

const store = useAppStore()
const route = useRoute()
const router = useRouter()

const courseId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const course = computed(() => store.snapshot.courses.find((item) => item.id === courseId.value))

watch(courseId, async (id) => {
  if (!id) return
  const item = store.snapshot.courses.find((course) => course.id === id)
  if (!item) {
    router.replace('/courses')
    return
  }
  const dates = effectiveCourseSlots(item, store.snapshot.scheduleExceptions).map((slot) => slot.date)
  dates.push(dayjs().format('YYYY-MM-DD'))
  dates.sort()
  await store.refreshRange(dates[0], dates[dates.length - 1])
  if (!store.snapshot.courses.some((course) => course.id === id)) router.replace('/courses')
}, { immediate: true })

const ledger = computed(() => {
  if (!course.value) return { total: 0, paid: 0, unpaid: 0, days: [] }
  return buildCourseBillLedger(
    course.value,
    store.snapshot.expenses,
    store.snapshot.scheduleExceptions,
    store.snapshot.charges ?? [],
    store.snapshot.payments ?? [],
  )
})

function billLink(expenseId: string) {
  return {
    path: `/bills/edit/${expenseId}`,
    query: { returnTo: route.fullPath },
  }
}
</script>

<template>
  <main v-if="course" class="page course-bills-page" :style="{ '--course-color': course.color }">
    <PageHeader show-back back-to="/courses" title="课程账单">
      <template #caption>
        <small>{{ COURSE_TYPE_LABEL[course.type] }} · {{ course.title }}</small>
      </template>
    </PageHeader>

    <section class="hero">
      <span class="hero-icon">
        <CourseIcon :name="course.icon ?? 'generic'" />
      </span>
      <div class="hero-copy">
        <p>{{ COURSE_TYPE_LABEL[course.type] }}</p>
        <h2>{{ course.title }}</h2>
      </div>
    </section>

    <section class="stats card">
      <div class="mini">
        <p class="muted">总金额</p>
        <strong>{{ money(ledger.total) }}</strong>
      </div>
      <div class="mini">
        <p class="muted">已支付</p>
        <strong class="status-paid">{{ money(ledger.paid) }}</strong>
      </div>
      <div class="mini">
        <p class="muted">未支付</p>
        <strong class="status-unpaid">{{ money(ledger.unpaid) }}</strong>
      </div>
    </section>

    <section class="day-list-section">
      <div class="list-title">
        <div>
          <small>按上课日</small>
          <h2>{{ ledger.days.length }} 次记录</h2>
        </div>
      </div>
      <div class="list">
        <template v-for="row in ledger.days" :key="row.key">
          <router-link v-if="row.expenseId" class="day-row" :to="billLink(row.expenseId)">
            <div class="day-copy">
              <span class="day-title">{{ dayjs(row.date).format('M月D日') }}<i>{{ row.weekdayLabel }}</i></span>
              <span class="day-sub">{{ row.startTime && row.endTime ? `${row.startTime}–${row.endTime}` : (row.kind === 'period' ? '结算账单' : '一次性账单') }}</span>
            </div>
            <div class="day-fee">
              <span class="day-amount">{{ row.amountLabel }}</span>
              <span class="pay-status" :class="row.payState">{{ row.payLabel }}</span>
            </div>
            <svg class="day-chevron" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </router-link>
          <article v-else class="day-row">
            <div class="day-copy">
              <span class="day-title">{{ dayjs(row.date).format('M月D日') }}<i>{{ row.weekdayLabel }}</i></span>
              <span class="day-sub">{{ row.startTime && row.endTime ? `${row.startTime}–${row.endTime}` : (row.kind === 'period' ? '结算账单' : '一次性账单') }}</span>
            </div>
            <div class="day-fee">
              <span class="day-amount">{{ row.amountLabel }}</span>
              <span class="pay-status" :class="row.payState">{{ row.payLabel }}</span>
            </div>
          </article>
        </template>
      </div>
      <p v-if="!ledger.days.length" class="empty">这门课还没有上课日期或账单。</p>
    </section>
  </main>
</template>

<style scoped>
.course-bills-page { padding-top: 12px; }

.course-bills-page :deep(.page-header-copy > small) {
  display: block;
  margin-top: 4px;
  color: var(--muted);
  font-size: 11px;
}

.hero {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  padding: 14px 16px;
  border-radius: 22px;
  background:
    linear-gradient(150deg, color-mix(in srgb, var(--course-color) 16%, var(--mix-base)) 0%, var(--mix-base) 62%),
    var(--paper);
  box-shadow: var(--elev-sm), var(--glow-top);
}

.hero-icon {
  display: grid;
  width: 46px;
  height: 46px;
  place-items: center;
  color: #fff;
  border-radius: 15px;
  background: linear-gradient(140deg, color-mix(in srgb, var(--course-color) 88%, #fff) 0%, color-mix(in srgb, var(--course-color) 72%, #2a2350) 100%);
  box-shadow: 0 10px 18px -10px color-mix(in srgb, var(--course-color) 70%, transparent);
}

.hero-icon :deep(svg) {
  width: 22px;
  height: 22px;
}

.hero-copy p {
  margin: 0 0 4px;
  color: color-mix(in srgb, var(--course-color) 55%, var(--ink));
  font-size: 10px;
  font-weight: 700;
}

.hero-copy h2 {
  margin: 0;
  font-size: 18px;
  letter-spacing: -.03em;
}

.stats {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  margin-bottom: 16px;
}

.mini {
  min-width: 0;
  padding: 2px 8px;
  text-align: center;
  border-left: 1px solid var(--line);
}

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

.list-title { margin-bottom: 8px; padding: 0 4px; }
.list-title small {
  color: var(--muted);
  font-size: 12px;
  font-weight: 510;
  letter-spacing: .01em;
}
.list-title h2 {
  margin-top: 2px;
  color: var(--ink);
  font-size: 13px;
  font-weight: 590;
  letter-spacing: -.01em;
}

.list {
  overflow: hidden;
  border-radius: 14px;
  background: var(--paper);
  box-shadow: 0 1px 0 rgba(255,255,255,.7) inset, 0 8px 24px -18px rgba(25,31,58,.28);
}

.day-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 10px;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  padding: 10px 14px;
  color: inherit;
  background: transparent;
}

.day-row:not(:last-child) {
  box-shadow: inset 0 -0.5px 0 var(--line);
}

a.day-row:active {
  background: color-mix(in srgb, var(--muted) 10%, var(--paper));
}

article.day-row {
  grid-template-columns: minmax(0, 1fr) auto;
}

.day-copy {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.day-title {
  overflow: hidden;
  color: var(--ink);
  font-size: 15px;
  font-weight: 510;
  letter-spacing: -.02em;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.day-title i {
  margin-left: 6px;
  color: var(--muted);
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
}

.day-sub {
  color: var(--muted);
  font-size: 12px;
  font-weight: 400;
  letter-spacing: -.01em;
  line-height: 1.3;
}

.day-fee {
  display: grid;
  justify-items: end;
  gap: 1px;
  flex: 0 0 auto;
}

.day-amount {
  color: color-mix(in srgb, var(--ink) 72%, var(--muted));
  font-size: 13px;
  font-weight: 510;
  font-variant-numeric: tabular-nums;
  letter-spacing: -.02em;
}

.pay-status {
  font-size: 11px;
  font-weight: 400;
  letter-spacing: .01em;
}

.pay-status.paid { color: var(--paid); }
.pay-status.unpaid { color: var(--unpaid); }
.pay-status.free { color: var(--muted); }

.day-chevron {
  width: 10px;
  height: 16px;
  fill: none;
  stroke: color-mix(in srgb, var(--muted) 72%, transparent);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

.empty {
  padding: 28px;
  color: var(--muted);
  text-align: center;
  border: 1px dashed var(--line);
  border-radius: 20px;
  font-size: 12px;
}
</style>
