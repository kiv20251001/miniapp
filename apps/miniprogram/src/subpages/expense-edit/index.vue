<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import dayjs from 'dayjs'
import { onLoad, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { appShare, momentsShare } from '@/utils/share'
import { billNetAmount, money, refundedAmountOf } from '@server-domain/billing'
import { CATEGORY_LABEL } from '@server-domain/constants'
import type { ExpenseCategory } from '@server-domain/types'
import { storeToRefs } from 'pinia'
import { showCloudError } from '@/cloud/call'
import { needFamily } from '@/utils/login-gate'
import { denyViewerBills } from '@/subpages/shared/useFamilyRole'
import { useFamilyPage } from '@/composables/useFamilyPage'
import { TEXT_LIMIT } from '@/domain/limits'
import { amountError, cleanText, formTip } from '@/utils/form'
import { cardBackground, mix, tileBackground } from '@/utils/color'
import { useThemeStore, usePageBackground, useThemePage } from '@/utils/wx-theme'
import AppIcon from '@/components/AppIcon.vue'
import DateField from '@/components/DateField.vue'
import SelectField from '@/components/SelectField.vue'
import PageHeader from '@/components/PageHeader.vue'

const store = useFamilyPage()
const themeClass = useThemePage()
onShareAppMessage(appShare)
onShareTimeline(momentsShare)
const pageBg = usePageBackground()
const expenseId = ref('')
const saving = ref(false)
const refundAmount = ref('')
const refundNote = ref('')
const form = reactive({
  title: '',
  category: 'other' as ExpenseCategory,
  amount: '',
  date: dayjs().format('YYYY-MM-DD'),
})

const categoryOptions = (Object.keys(CATEGORY_LABEL) as ExpenseCategory[]).map((value) => ({
  value,
  label: CATEGORY_LABEL[value],
}))

onLoad((query) => {
  if (denyViewerBills()) return
  expenseId.value = typeof query?.id === 'string' ? query.id : ''
})

const existing = computed(() => store.snapshot.expenses.find((item) => item.id === expenseId.value))
const paid = computed(() => existing.value?.status === 'paid')
const payments = computed(() =>
  (store.snapshot.payments ?? [])
    .filter((item) => item.expenseId === expenseId.value)
    .slice()
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt) || b.id.localeCompare(a.id)),
)
const refundedTotal = computed(() => refundedAmountOf(expenseId.value, store.snapshot.payments ?? []))
const netPaid = computed(() => existing.value ? billNetAmount(existing.value, store.snapshot.payments ?? []) : 0)
const refundable = computed(() => {
  const received = payments.value.filter((item) => item.kind === 'payment').reduce((sum, item) => sum + item.amount, 0)
  return Math.max(0, Math.round((received - refundedTotal.value) * 100) / 100)
})

const { isDark } = storeToRefs(useThemeStore())
const course = computed(() => store.snapshot.courses.find((item) => item.id === existing.value?.courseId))
/** 课程账单标题形如「钢琴 · 一次性课程费」，拆成主标题和副标题排版。 */
const titleParts = computed(() => {
  const [name, ...rest] = (existing.value?.title || '').split(/\s*·\s*/)
  return {
    name: name || '账单',
    sub: rest.join(' · ') || (existing.value ? CATEGORY_LABEL[existing.value.category] : ''),
  }
})
const statusLabel = computed(() => {
  if (!existing.value) return ''
  if (!paid.value) return '未支付'
  return refundedTotal.value >= existing.value.amount ? '已退完' : '已支付'
})
const heroStyle = computed(() => {
  const tint = course.value?.color || '#FF7A45'
  return {
    background: cardBackground(tint),
    boxShadow: `0 2px 5px rgba(25,31,58,.04), 0 18px 34px -18px ${mix(tint, '#191f3a', isDark.value ? 0.4 : 0.58)}, var(--glow-top)`,
  }
})
const tileStyle = computed(() => {
  const tint = course.value?.color || '#FF7A45'
  return { background: tileBackground(tint), boxShadow: `0 10px 20px -10px ${mix(tint, '#191f3a', 0.3)}` }
})

async function create() {
  if (saving.value || needFamily()) return
  const title = cleanText(form.title, TEXT_LIMIT.expenseTitle)
  if (!title) {
    formTip('请填写名称')
    return
  }
  const amountProblem = amountError(form.amount, '金额', { required: true })
  if (amountProblem) {
    formTip(amountProblem)
    return
  }
  saving.value = true
  try {
    await store.upsertExpense({
      title,
      category: form.category,
      billingMode: 'session',
      amount: Number(form.amount) || 0,
      period: form.date.slice(0, 7),
      dueDate: form.date,
      status: 'paid',
      paidAt: form.date,
      note: '',
    })
    uni.navigateBack()
  } catch (error) {
    showCloudError(error)
  } finally {
    saving.value = false
  }
}

async function markPaid() {
  if (!expenseId.value) return
  try {
    await store.setExpenseStatus(expenseId.value, 'paid')
  } catch (error) {
    showCloudError(error)
  }
}

async function refund() {
  if (!expenseId.value) return
  const amountProblem = amountError(refundAmount.value, '退款金额', { required: true })
  if (amountProblem) {
    formTip(amountProblem)
    return
  }
  const value = Number(refundAmount.value) || 0
  if (value > refundable.value) {
    formTip(`退款金额不能超过 ${money(refundable.value)}`)
    return
  }
  try {
    await store.refund(expenseId.value, value, cleanText(refundNote.value, TEXT_LIMIT.refundNote))
    refundAmount.value = ''
    refundNote.value = ''
    uni.showToast({ icon: 'none', title: '退款已记录' })
  } catch (error) {
    showCloudError(error)
  }
}

function remove() {
  if (!expenseId.value) return
  uni.showModal({
    title: '删除账单',
    content: '已支付账单不能删除。',
    success: async (res) => {
      if (!res.confirm) return
      try {
        await store.removeExpense(expenseId.value)
        uni.navigateBack()
      } catch (error) {
        showCloudError(error)
      }
    },
  })
}
</script>

<template>
  <page-meta :page-style="pageBg.style" :background-color="pageBg.bg" :background-color-top="pageBg.bg" :background-color-bottom="pageBg.bg" :root-background-color="pageBg.bg" :background-text-style="pageBg.text" />
  <view class="theme-root page edit sub" :class="themeClass">
    <PageHeader safe show-back :title="expenseId ? '账单详情' : '记一笔支出'" />
    <template v-if="!expenseId">
      <text class="muted">记到当前孩子 {{ store.child?.name || '' }}，并直接记为已支付。</text>
      <view class="field">
        <text class="field-label">名称<text class="req">*</text></text>
        <input v-model="form.title" :maxlength="TEXT_LIMIT.expenseTitle" placeholder="例如：买书" placeholder-class="ph" />
      </view>
      <view class="field">
        <text class="field-label">类型</text>
        <SelectField v-model="form.category" :options="categoryOptions" />
      </view>
      <view class="field">
        <text class="field-label">金额<text class="req">*</text></text>
        <input v-model="form.amount" type="digit" :maxlength="TEXT_LIMIT.amount" placeholder="0" placeholder-class="ph" />
      </view>
      <view class="field">
        <text class="field-label">日期<text class="req">*</text></text>
        <DateField v-model="form.date" />
      </view>
      <button hover-class="press-on" hover-stay-time="80" class="btn block" :disabled="saving" @click="create">保存</button>
    </template>

    <template v-else-if="existing">
      <view class="bill-hero" :style="heroStyle">
        <view class="hero-top">
          <view class="hero-icon" :style="tileStyle">
            <AppIcon :name="course?.icon || 'bill'" tone="white" :size="22" />
          </view>
          <view class="hero-copy">
            <text class="hero-name">{{ titleParts.name }}</text>
            <text class="hero-sub">{{ titleParts.sub }}</text>
          </view>
          <text class="status-pill" :class="paid ? 'paid' : 'unpaid'">{{ statusLabel }}</text>
        </view>
        <text class="hero-label">{{ paid ? '实际支付' : '待支付' }}</text>
        <text class="hero-amount">{{ money(paid ? netPaid : existing.amount) }}</text>
      </view>
      <view class="card detail-card">
        <view class="detail-row"><text class="detail-key">账单金额</text><text class="detail-val">{{ money(existing.amount) }}</text></view>
        <view v-if="refundedTotal" class="detail-row">
          <text class="detail-key">已退金额</text>
          <text class="detail-val refund-amount">−{{ money(refundedTotal) }}</text>
        </view>
        <view class="detail-row"><text class="detail-key">账单日期</text><text class="detail-val">{{ existing.dueDate }}</text></view>
        <view class="detail-row"><text class="detail-key">类型</text><text class="detail-val">{{ CATEGORY_LABEL[existing.category] }}</text></view>
        <view v-if="course" class="detail-row"><text class="detail-key">所属课程</text><text class="detail-val">{{ course.title }}</text></view>
      </view>
      <button hover-class="press-on" hover-stay-time="80" v-if="!paid" class="btn block" @click="markPaid">标记已支付</button>
      <view v-else class="card refund-card">
        <text class="section">支付与退款</text>
        <view v-if="payments.length" class="history">
          <view v-for="item in payments" :key="item.id" class="history-row">
            <view class="history-copy">
              <text>{{ item.kind === 'payment' ? '支付' : '退款' }}</text>
              <text class="muted">{{ item.paidAt }}{{ item.note && item.kind === 'refund' ? ' · ' + item.note : '' }}</text>
            </view>
            <text :class="item.kind === 'refund' ? 'refund-amount' : 'pay-paid'">
              {{ item.kind === 'refund' ? '−' : '+' }}{{ money(item.amount) }}
            </text>
          </view>
        </view>
        <view class="row remain">
          <text>剩余可退</text>
          <text class="refundable">{{ money(refundable) }}</text>
        </view>
        <template v-if="refundable > 0">
          <view class="field">
            <text class="field-label">退款金额<text class="req">*</text></text>
            <view class="money">
              <text>¥</text>
              <input v-model="refundAmount" type="digit" :maxlength="TEXT_LIMIT.amount" placeholder="0" placeholder-class="ph" />
            </view>
          </view>
          <view class="field">
            <text class="field-label">备注</text>
            <input v-model="refundNote" :maxlength="TEXT_LIMIT.refundNote" placeholder="选填" placeholder-class="ph" />
          </view>
          <button hover-class="press-on" hover-stay-time="80" class="btn ghost block refund-btn" @click="refund">记录退款</button>
        </template>
        <text v-else class="muted tip">该账单已全部退款，实际消费已扣减。</text>
      </view>
      <button hover-class="press-on" hover-stay-time="80" v-if="!paid" class="btn danger block" style="margin-top: 16rpx" @click="remove">删除未付账单</button>
    </template>
    <view v-else class="empty">账单不存在</view>
  </view>
</template>

<style scoped>
.edit { padding-bottom: 48rpx; }
.bill-hero {
  margin-bottom: 12px;
  padding: 16px 16px 18px;
  border-radius: 24px;
}
.hero-top { display: flex; align-items: center; gap: 12px; }
.hero-icon {
  display: flex;
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
}
.hero-copy { flex: 1; min-width: 0; }
.hero-name {
  display: block;
  overflow: hidden;
  color: var(--ink);
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hero-sub { display: block; margin-top: 3px; color: var(--muted); font-size: 12px; }
.status-pill {
  flex: 0 0 auto;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 750;
}
.status-pill.paid { color: var(--paid); background: var(--paid-soft); }
.status-pill.unpaid { color: var(--unpaid); background: var(--unpaid-soft); }
.hero-label { display: block; margin-top: 18px; color: var(--muted); font-size: 11px; font-weight: 650; }
.hero-amount {
  display: block;
  margin-top: 2px;
  color: var(--ink);
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.04em;
}
.detail-card { padding-top: 6px; padding-bottom: 6px; }
.detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 0;
  border-bottom: 1px solid var(--line);
  font-size: 13px;
}
.detail-row:last-child { border-bottom: 0; }
.detail-key { flex: 0 0 auto; color: var(--muted); }
.detail-val { min-width: 0; overflow: hidden; color: var(--ink); font-weight: 650; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
.section { display: block; margin-bottom: 12px; color: var(--ink); font-size: 16px; font-weight: 800; }
.history { margin-bottom: 12px; }
.history-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}
.history-copy { flex: 1; min-width: 0; }
.history-copy text { display: block; }
.history-copy .muted { margin-top: 3px; font-size: 11px; }
.remain { margin-bottom: 12px; }
.refundable { color: var(--accent-text); font-weight: 800; }
.refund-amount { color: var(--unpaid); font-weight: 800; }
.refund-btn { color: var(--unpaid); }
.tip { display: block; margin-top: 4px; }
.empty { padding: 28px 8px; color: var(--muted); text-align: center; }
</style>
