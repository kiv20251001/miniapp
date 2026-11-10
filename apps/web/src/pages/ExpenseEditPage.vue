<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { useAppStore } from '@/stores/app'
import type { ExpenseCategory } from '@/domain/types'
import { CATEGORY_LABEL } from '@/domain/constants'
import { billNetAmount, money } from '@/services/billing'
import AppDatePicker from '@/components/AppDatePicker.vue'
import AppPaySwitch from '@/components/AppPaySwitch.vue'
import PageHeader from '@/components/PageHeader.vue'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const id = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const existing = computed(() => store.findExpense(id.value))
const isEdit = computed(() => Boolean(id.value))
const confirmRemove = ref(false)
const feedback = ref('')

const categoryOptions: Array<{ value: ExpenseCategory; label: string }> = [
  { value: 'interest', label: '兴趣课' },
  { value: 'sport', label: '运动课' },
  { value: 'culture', label: '文化课' },
  { value: 'school', label: '学校课' },
  { value: 'temporary', label: '临时课程' },
  { value: 'material', label: '学习用品' },
  { value: 'other', label: '其它' },
]

const createForm = reactive({
  title: '',
  category: 'interest' as ExpenseCategory,
  amount: 0,
  date: dayjs().format('YYYY-MM-DD'),
})

function billsListLocation() {
  const returnTo = typeof route.query.returnTo === 'string' ? route.query.returnTo : ''
  if (returnTo.startsWith('/')) return returnTo
  return route.query.from === 'today'
    ? { path: '/bills', query: { from: 'today' } }
    : { path: '/bills' }
}

watch(existing, (expense) => {
  if (id.value && !expense) router.replace(billsListLocation())
}, { immediate: true })

const paymentHistory = computed(() =>
  store.payments
    .filter((item) => item.expenseId === id.value)
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt)),
)
const originalPayment = computed(() => paymentHistory.value.find((item) => item.kind === 'payment'))
const refundedTotal = computed(() =>
  paymentHistory.value
    .filter((item) => item.kind === 'refund')
    .reduce((sum, item) => sum + item.amount, 0),
)
const refundableAmount = computed(() => {
  const paid = originalPayment.value?.amount ?? 0
  return Math.max(0, Math.round((paid - refundedTotal.value) * 100) / 100)
})
const netPaid = computed(() => existing.value ? billNetAmount(existing.value, store.payments) : 0)
const isPaid = computed(() => existing.value?.status === 'paid')
const paying = ref(false)
const refundForm = reactive({
  amount: 0,
  note: '',
})

function goBack() {
  router.replace(billsListLocation())
}

async function keep() {
  if (isEdit.value) {
    goBack()
    return
  }
  if (!createForm.title.trim()) {
    feedback.value = '先填写这笔费用的名称。'
    return
  }
  if (!createForm.date) {
    feedback.value = '先选择账单日期。'
    return
  }
  await store.upsertExpense({
    title: createForm.title.trim(),
    category: createForm.category,
    billingMode: 'session',
    amount: Number(createForm.amount) || 0,
    period: createForm.date.slice(0, 7),
    dueDate: createForm.date,
    status: 'paid',
    paidAt: createForm.date,
  })
  goBack()
}

function requestRemove() {
  if (!id.value) {
    goBack()
    return
  }
  if (isPaid.value) {
    feedback.value = '已支付账单不能删除；如需退回资金，请记录退款。'
    return
  }
  confirmRemove.value = true
}

async function confirmDelete() {
  if (!id.value) return
  const result = await store.removeExpense(id.value)
  confirmRemove.value = false
  if (result === 'paid-immutable') {
    feedback.value = '已支付账单不能删除；如需退回资金，请记录退款。'
    return
  }
  goBack()
}

async function togglePaid() {
  if (!id.value || isPaid.value || paying.value) return
  paying.value = true
  try {
    await store.setExpenseStatus(id.value, 'paid')
  } finally {
    paying.value = false
  }
}

async function refund() {
  if (!id.value) return
  const result = await store.refundExpense(id.value, refundForm.amount, refundForm.note)
  if (!result.ok) {
    feedback.value = result.reason === 'invalid-amount'
      ? `退款金额应大于 0，且不超过 ${money(result.remaining)}。`
      : '当前账单无法退款。'
    return
  }
  refundForm.amount = 0
  refundForm.note = ''
  feedback.value = `退款已记录，剩余可退 ${money(result.remaining)}。`
}
</script>

<template>
  <main class="page expense-editor">
    <PageHeader show-back :title="isEdit ? '编辑支出' : '记一笔支出'" />

    <template v-if="isEdit">
      <template v-if="existing">
      <section class="summary-card">
        <p class="eyebrow">课程消费</p>
        <h2>{{ existing.title }}</h2>
        <dl class="facts">
          <div>
            <dt>类型</dt>
            <dd>{{ CATEGORY_LABEL[existing.category] }}</dd>
          </div>
          <div>
            <dt>账单金额</dt>
            <dd>{{ money(existing.amount) }}</dd>
          </div>
          <div v-if="isPaid">
            <dt>实际支付</dt>
            <dd class="status-paid">{{ money(netPaid) }}</dd>
          </div>
          <div v-if="refundedTotal">
            <dt>已退金额</dt>
            <dd class="refund-amount">−{{ money(refundedTotal) }}</dd>
          </div>
          <div class="pay-fact">
            <dt>是否已支付</dt>
            <dd>
              <AppPaySwitch
                :model-value="isPaid"
                :disabled="isPaid || paying"
                @update:model-value="togglePaid"
              />
            </dd>
          </div>
        </dl>
      </section>

      <section v-if="isPaid" class="form-card">
        <div class="section-head">
          <h2>支付与退款</h2>
          <p>记下这笔课是否付过、有没有退回。</p>
        </div>
        <div v-if="paymentHistory.length" class="payment-history">
          <div v-for="item in paymentHistory" :key="item.id">
            <span>{{ item.kind === 'payment' ? '支付' : '退款' }} · {{ item.paidAt }}</span>
            <strong :class="{ refund: item.kind === 'refund' }">
              {{ item.kind === 'refund' ? '−' : '+' }}{{ money(item.amount) }}
            </strong>
          </div>
        </div>
        <template v-if="refundableAmount > 0">
          <div class="field">
            <label class="refundable-label">退款金额（剩余可退 {{ money(refundableAmount) }}）</label>
            <div class="money-input">
              <span>¥</span>
              <input v-model.number="refundForm.amount" type="number" min="0.01" step="0.01" :max="refundableAmount" />
            </div>
          </div>
          <div class="field">
            <label>退款说明</label>
            <input v-model="refundForm.note" placeholder="例如：取消已支付课次" />
          </div>
          <button class="refund-expense" type="button" @click="refund">记录退款</button>
        </template>
        <p v-else class="field-tip">该账单已全部退款。</p>
      </section>
      </template>
    </template>

    <form v-else class="create-form" @submit.prevent="keep">
      <section class="form-card">
        <div class="section-head">
          <h2>记一笔消费</h2>
        </div>
        <div class="field">
          <label>名称</label>
          <input v-model="createForm.title" placeholder="例如 钢琴课本月学费" />
        </div>
        <div class="field">
          <label>类型</label>
          <div class="type-chips">
            <button
              v-for="option in categoryOptions"
              :key="option.value"
              type="button"
              :class="{ on: createForm.category === option.value }"
              @click="createForm.category = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
        <div class="field">
          <label>金额</label>
          <div class="money-input">
            <span>¥</span>
            <input v-model.number="createForm.amount" type="number" min="0" />
          </div>
        </div>
        <div class="field">
          <label>日期</label>
          <AppDatePicker v-model="createForm.date" aria-label="选择账单日期" />
        </div>
      </section>
    </form>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>

    <div class="action-row">
      <button class="btn keep" type="button" @click="isEdit ? goBack() : keep()">确认</button>
      <button class="btn cancel" type="button" @click="goBack">取消</button>
    </div>

    <Transition name="fade">
      <div v-if="confirmRemove" class="overlay" @click.self="confirmRemove = false">
        <section class="confirm-dialog">
          <div class="confirm-icon">!</div>
          <h2>删除这笔账单？</h2>
          <p>“{{ existing?.title }}”会从费用记录里移除，未支付的待结算明细会回到待汇总。</p>
          <div>
            <button type="button" @click="confirmRemove = false">再想想</button>
            <button class="danger" type="button" @click="confirmDelete">确认删除</button>
          </div>
        </section>
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.expense-editor { padding-top: 12px; }
.summary-card,
.form-card {
  padding: 20px 18px 18px;
  border-radius: 23px;
  background: var(--paper);
  box-shadow: var(--elev-md), var(--glow-top);
}
.summary-card { margin-bottom: 14px; }
.eyebrow {
  color: var(--muted);
  font-size: 11px;
  letter-spacing: .08em;
}
.summary-card h2 {
  margin: 8px 0 18px;
  font-size: 24px;
  line-height: 1.25;
}
.facts {
  display: grid;
  gap: 12px;
  margin: 0;
}
.facts > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
}
.facts > div:last-of-type { padding-bottom: 0; border-bottom: 0; }
.facts dt { color: var(--muted); font-size: 13px; }
.facts dd { margin: 0; font-size: 15px; font-weight: 700; }
.facts .pay-fact dd {
  display: flex;
  justify-content: flex-end;
}
.section-head { margin-bottom: 16px; }
.section-head h2 { font-size: 16px; }
.section-head p { margin-top: 4px; color: var(--muted); font-size: 12px; }
.money-input {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  border-radius: 14px;
  background: var(--paper);
  box-shadow: inset 0 0 0 1px var(--line);
}
.money-input span { padding-left: 13px; color: var(--accent-text); font-weight: 800; }
.money-input input { border: 0; background: transparent; box-shadow: none; }
.field-tip { color: var(--muted); font-size: 12px; }
.payment-history { display: grid; gap: 8px; margin-bottom: 15px; }
.payment-history div {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
  font-size: 13px;
}
.payment-history strong { color: #2f9d70; }
.payment-history strong.refund { color: #d35f6f; }
.refund-amount { color: #d35f6f; }
.refundable-label { color: var(--accent-text); }
.refund-expense {
  width: 100%;
  min-height: 44px;
  color: #a44637;
  border: 1px solid color-mix(in srgb, #a44637 28%, var(--line));
  border-radius: 14px;
  background: color-mix(in srgb, #a44637 7%, var(--paper));
  font-weight: 700;
}
.type-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.type-chips button {
  padding: 8px 12px;
  color: var(--ink);
  border: 0;
  border-radius: 999px;
  background: var(--surface-2);
  font-size: 12px;
  font-weight: 650;
}
.type-chips button.on {
  color: var(--accent-text);
  background: var(--accent-soft);
}
.feedback {
  margin: 12px 0 0;
  color: var(--accent-text);
  font-size: 12px;
  text-align: center;
}
.action-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 16px;
}
.btn {
  min-height: 48px;
  padding: 0 12px;
  border: 0;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 700;
}
.btn.keep {
  color: #fff;
  background: var(--accent);
}
.btn.cancel {
  color: var(--ink);
  background: var(--bg);
}
.overlay {
  position: fixed;
  z-index: 1100;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: rgba(30, 24, 45, .34);
  backdrop-filter: blur(7px);
}
.confirm-dialog {
  width: min(100%, 330px);
  padding: 25px 20px 18px;
  text-align: center;
  border-radius: 27px;
  background: var(--paper);
  box-shadow: var(--elev-lg);
}
.confirm-icon {
  display: grid;
  width: 50px;
  height: 50px;
  margin: 0 auto 14px;
  place-items: center;
  color: #ed5d6e;
  border-radius: 18px;
  background: color-mix(in srgb, #ed5d6e 14%, var(--paper));
  font-size: 24px;
  font-weight: 800;
}
.confirm-dialog h2 { font-size: 20px; }
.confirm-dialog p {
  margin: 10px 0 20px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}
.confirm-dialog > div:last-child {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}
.confirm-dialog button {
  padding: 12px 8px;
  color: var(--ink);
  border: 0;
  border-radius: 14px;
  background: var(--surface-2);
  font-weight: 650;
}
.confirm-dialog button.danger {
  color: #fff;
  background: #ed5d6e;
}
.fade-enter-active,
.fade-leave-active { transition: opacity .25s ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }
</style>
