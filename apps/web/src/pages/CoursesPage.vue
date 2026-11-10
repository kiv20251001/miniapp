<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { useAppStore } from '@/stores/app'
import { COURSE_TYPE_LABEL } from '@/domain/constants'
import type { Course } from '@/domain/types'
import { courseScheduleProgress } from '@/services/courseSchedule'
import {
  getCourseAmountLabel,
  getCourseBillingSummary,
  getCourseLifecycle,
  getCoursePricingLabel,
} from '@/services/courseOverview'
import CourseIcon from '@/components/CourseIcon.vue'
import PageHeader from '@/components/PageHeader.vue'
import ChildProfilePicker from '@/components/ChildProfilePicker.vue'

const store = useAppStore()
const openMenuId = ref('')
const deleting = ref<Course | null>(null)
const activeChildIds = computed({
  get: () => store.child ? [store.child.id] : [],
  set: (ids: string[]) => {
    if (ids[0]) void store.selectChild(ids[0])
  },
})

const courseCards = computed(() => {
  const today = dayjs().format('YYYY-MM-DD')
  const period = dayjs().format('YYYY-MM')
  const stateOrder = { active: 0, upcoming: 1, unscheduled: 2, ended: 3, completed: 4 }
  return store.allCourses
    .filter((course) => course.source !== 'temporary')
    .map((course) => ({
      course,
      lifecycle: getCourseLifecycle(course, store.scheduleExceptions, today),
      progress: courseScheduleProgress(course, today, store.scheduleExceptions),
      billing: getCourseBillingSummary(
        course,
        store.expenses,
        period,
        store.charges,
        store.snapshot.occurrenceRecords ?? [],
        store.scheduleExceptions,
        store.payments,
      ),
    }))
    .sort((a, b) => stateOrder[a.lifecycle.key] - stateOrder[b.lifecycle.key])
})

function toggleMenu(courseId: string) {
  openMenuId.value = openMenuId.value === courseId ? '' : courseId
}

async function toggleCompletion(course: Course) {
  if (course.archived) await store.restoreCourse(course.id)
  else await store.archiveCourse(course.id)
  openMenuId.value = ''
}

function requestDelete(course: Course) {
  deleting.value = course
  openMenuId.value = ''
}

async function confirmDelete() {
  if (!deleting.value) return
  await store.removeCourse(deleting.value.id)
  deleting.value = null
}

const deletingSharedNames = computed(() => {
  const course = deleting.value
  if (!course) return []
  const ids = course.childIds?.length ? course.childIds : [course.childId]
  return store.snapshot.children
    .filter((child) => ids.includes(child.id) && child.id !== store.child?.id)
    .map((child) => child.name)
})

</script>

<template>
  <main class="page courses-page">
    <PageHeader title="课程安排">
      <template #caption><small>管理 {{ store.child?.name || '孩子' }} 的排课、进度与费用</small></template>
      <template #actions>
        <ChildProfilePicker v-model="activeChildIds" mode="switch" />
      </template>
    </PageHeader>

    <section class="course-grid">
      <article
        v-for="card in courseCards"
        :key="card.course.id"
        class="course"
        :class="{ 'course-inactive': card.lifecycle.inactive }"
        :style="{ '--course-color': card.course.color }"
      >
        <span v-if="card.lifecycle.inactive" class="course-watermark">{{ card.lifecycle.label }}</span>
        <div class="course-top">
          <span class="course-icon">
            <CourseIcon :name="card.course.icon ?? 'generic'" />
          </span>
          <div class="course-top-actions">
            <span class="lifecycle-badge" :class="`is-${card.lifecycle.key}`">{{ card.lifecycle.label }}</span>
            <div class="course-menu-wrap" @click.stop>
              <button
                class="edit-course"
                type="button"
                :aria-label="`${card.course.title}更多操作`"
                :aria-expanded="openMenuId === card.course.id"
                @click="toggleMenu(card.course.id)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="5" r="1.25" />
                  <circle cx="12" cy="12" r="1.25" />
                  <circle cx="12" cy="19" r="1.25" />
                </svg>
              </button>
              <div v-if="openMenuId === card.course.id" class="course-menu">
                <router-link :to="{ path: `/courses/edit/${card.course.id}`, query: { returnTo: '/courses' } }">编辑课程</router-link>
                <router-link :to="`/courses/${card.course.id}/bills`">{{ card.billing.key === 'open' ? '去支付' : '查看账单' }}</router-link>
                <button type="button" @click="toggleCompletion(card.course)">
                  {{ card.course.archived ? '恢复课程' : '标记已结课' }}
                </button>
                <button class="danger" type="button" @click="requestDelete(card.course)">删除课程</button>
              </div>
            </div>
          </div>
        </div>
        <div class="course-body">
          <p class="course-type">{{ COURSE_TYPE_LABEL[card.course.type] }}</p>
          <h2 :title="card.course.title">{{ card.course.title }}</h2>
        </div>
        <div class="course-progress">
          <span><i :style="{ width: `${card.progress.percent}%` }" /></span>
          <small>{{ card.progress.completed }}/{{ card.progress.total }} 课时 · {{ card.progress.percent }}%</small>
        </div>
        <div class="course-foot">
          <div class="foot-copy">
            <span>{{ getCoursePricingLabel(card.course) }}</span>
            <small
              v-if="card.billing.key !== 'free'"
              class="billing-state"
              :class="`is-${card.billing.key}`"
            >{{ card.billing.label }}</small>
          </div>
          <div class="foot-amount">
            <strong>{{ getCourseAmountLabel(card.course) }}</strong>
            <router-link v-if="card.billing.key === 'open'" class="foot-pay" :to="`/courses/${card.course.id}/bills`">
              去支付
            </router-link>
          </div>
        </div>
      </article>
      <router-link
        class="course add-course-card"
        aria-label="新增课程"
        :to="{ path: '/courses/edit', query: { returnTo: '/courses' } }"
      >
        <i>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </i>
        <strong>新增课程</strong>
        <span>创建新的课程与排课计划</span>
      </router-link>
    </section>

    <p v-if="!store.allCourses.length" class="empty">还没有课程，先把学校上课时间和兴趣班加上。</p>

    <Transition name="fade">
      <div v-if="deleting" class="overlay" @click.self="deleting = null">
        <section class="confirm-dialog">
          <div class="confirm-icon">!</div>
          <h2>删除这门课程？</h2>
          <p>
            “{{ deleting.title }}”会从课程档案、今日和日历中移除。
            已支付账单会保留为历史支出，未支付账单和待结算费用会一起删除。
            <template v-if="deletingSharedNames.length">
              这门课还关联了{{ deletingSharedNames.join('、') }}，删除后他们也看不到。
            </template>
          </p>
          <div>
            <button type="button" @click="deleting = null">再想想</button>
            <button class="danger" type="button" @click="confirmDelete">确认删除</button>
          </div>
        </section>
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.courses-page {
  padding-top: 24px;
}

.courses-hero {
  align-items: center;
  margin-bottom: 28px;
}

.courses-hero h1 {
  font-size: 30px;
}

.courses-page :deep(.page-header-copy > small) {
  display: block;
  margin-top: 6px;
  color: var(--muted);
  font-size: 11px;
}

.course-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.course {
  --course-accent: var(--course-color);
  --course-deep: color-mix(in srgb, var(--course-color) 76%, #2a2350);
  position: relative;
  display: flex;
  min-height: 168px;
  flex-direction: column;
  margin-top: 10px;
  padding: 14px 15px;
  color: var(--ink);
  border: 0;
  border-radius: 6px 22px 22px 22px;
  background:
    linear-gradient(150deg, color-mix(in srgb, var(--course-color) 16%, var(--mix-base)) 0%, var(--mix-base) 58%),
    var(--paper);
  box-shadow:
    0 2px 5px rgba(25,31,58,.04),
    0 18px 34px -16px color-mix(in srgb, var(--course-color) 42%, rgba(25,31,58,.5)),
    inset 0 1px 0 rgba(255,255,255,.9);
  transition: transform .22s ease, box-shadow .22s ease;
}

.course > * {
  position: relative;
  z-index: 1;
}

.course-inactive {
  --course-accent: #7d8391;
  --course-deep: #6c7280;
  color: var(--muted);
  background: linear-gradient(150deg, var(--surface-2) 0%, var(--paper) 62%);
  box-shadow: 0 2px 5px rgba(25,31,58,.03), 0 14px 28px -18px rgba(25,31,58,.45), inset 0 1px 0 rgba(255,255,255,.85);
}

.course-inactive::before {
  background: var(--track);
}

.course-inactive .course-icon,
.course-inactive .course-type {
  color: var(--muted);
  background: var(--track);
  box-shadow: none;
}

.course-inactive .course-progress > span {
  background: var(--track);
}

.course-inactive .course-progress > span i {
  background: #aeb4c0;
}

.course-watermark {
  position: absolute;
  z-index: 0;
  right: 9px;
  bottom: 42px;
  color: rgba(91,96,110,.075);
  font-size: 34px;
  font-weight: 900;
  letter-spacing: -.08em;
  pointer-events: none;
  transform: rotate(-16deg);
}

.course::before {
  position: absolute;
  z-index: -1;
  top: -10px;
  left: 0;
  width: 66px;
  height: 18px;
  border: 0;
  border-radius: 13px 13px 0 0;
  background: linear-gradient(135deg, color-mix(in srgb, var(--course-color) 62%, #fff) 0%, color-mix(in srgb, var(--course-color) 26%, #fff) 100%);
  content: "";
}

.course:hover {
  transform: translateY(-2px);
  box-shadow:
    0 4px 10px rgba(25,31,58,.05),
    0 26px 44px -18px color-mix(in srgb, var(--course-color) 52%, rgba(25,31,58,.5)),
    inset 0 1px 0 rgba(255,255,255,.9);
}

.course-top {
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.course-top-actions {
  display: flex;
  align-items: center;
  gap: 3px;
}

.lifecycle-badge {
  padding: 4px 7px;
  color: #1c8a5f;
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(38,194,129,.2) 0%, rgba(38,194,129,.1) 100%);
  font-size: 8px;
  font-weight: 800;
  white-space: nowrap;
}

.lifecycle-badge.is-upcoming,
.lifecycle-badge.is-unscheduled {
  color: #a06a12;
  background: linear-gradient(135deg, rgba(240,169,43,.24) 0%, rgba(240,169,43,.12) 100%);
}

.lifecycle-badge.is-ended,
.lifecycle-badge.is-completed {
  color: #6e7482;
  background: linear-gradient(135deg, rgba(124,138,165,.2) 0%, rgba(124,138,165,.1) 100%);
}

.course-icon {
  display: grid;
  width: 45px;
  height: 45px;
  flex: 0 0 auto;
  place-items: center;
  color: #fff;
  border-radius: 15px;
  background: linear-gradient(140deg, color-mix(in srgb, var(--course-color) 88%, #fff) 0%, var(--course-deep) 100%);
  box-shadow:
    0 8px 18px -8px color-mix(in srgb, var(--course-color) 72%, transparent),
    inset 0 1px 0 rgba(255,255,255,.45);
}

.course-icon svg {
  width: 23px;
  height: 23px;
}

.edit-course {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  color: color-mix(in srgb, var(--course-accent) 62%, var(--muted));
  border: 0;
  border-radius: 50%;
  background: transparent;
  transition: color .2s ease, background .2s ease;
}

.edit-course:hover {
  color: var(--course-accent);
  background: color-mix(in srgb, var(--course-color) 14%, var(--mix-base));
}

.edit-course svg {
  width: 18px;
  fill: currentColor;
}

.course-menu-wrap {
  position: relative;
}

.course-menu {
  position: absolute;
  z-index: 10;
  top: 36px;
  right: 0;
  display: grid;
  width: 116px;
  overflow: hidden;
  padding: 5px;
  border: 0;
  border-radius: 13px;
  background: var(--paper);
  box-shadow: var(--elev-lg), var(--glow-top);
}

.course-menu a,
.course-menu button {
  padding: 8px 9px;
  color: var(--ink);
  border: 0;
  border-radius: 9px;
  background: transparent;
  font: inherit;
  font-size: 10px;
  text-align: left;
  white-space: nowrap;
}

.course-menu a:hover,
.course-menu button:hover {
  background: var(--accent-soft);
}

.course-menu button.danger {
  color: #ed5d6e;
}

.course-menu button.danger:hover {
  background: #fff1f3;
}

.course-body {
  display: grid;
  flex: 1 1 auto;
  align-content: start;
  gap: 5px;
  margin: 14px 0 10px;
}

.course-type {
  justify-self: start;
  margin: 0;
  padding: 3px 8px;
  color: var(--course-deep);
  border-radius: 7px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--course-color) 22%, var(--mix-base)) 0%, color-mix(in srgb, var(--course-color) 12%, var(--mix-base)) 100%);
  font-size: 9px;
  font-weight: 700;
}

.course h2 {
  margin: 0;
  overflow: hidden;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -.03em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.course-progress {
  display: grid;
  gap: 5px;
  margin-bottom: 10px;
}

.course-progress > span {
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--course-color) 14%, var(--track));
  box-shadow: inset 0 1px 2px rgba(25,31,58,.06);
}

.course-progress > span i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, color-mix(in srgb, var(--course-color) 72%, #fff) 0%, var(--course-deep) 100%);
  box-shadow: 0 0 10px -2px color-mix(in srgb, var(--course-color) 72%, transparent);
}

.course-progress small {
  color: var(--muted);
  font-size: 8px;
}

.course-foot {
  display: flex;
  padding-top: 10px;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  border-top: 1px solid color-mix(in srgb, var(--course-color) 14%, var(--line));
  font-size: 9px;
}

.foot-copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.foot-copy > span {
  color: var(--muted);
}

.billing-state {
  color: var(--muted);
  font-size: 9px;
  font-weight: 750;
  line-height: 1.35;
  white-space: normal;
}

.billing-state.is-open { color: var(--unpaid); }
.billing-state.is-settled { color: var(--paid); }

.foot-amount {
  display: grid;
  flex: 0 0 auto;
  justify-items: end;
  gap: 4px;
}

.foot-pay {
  padding: 5px 9px;
  color: #fff;
  border-radius: 999px;
  background: var(--accent-gradient);
  box-shadow: 0 8px 16px -8px rgba(255,122,69,.7), inset 0 1px 0 rgba(255,255,255,.3);
  font-size: 9px;
  font-weight: 750;
  white-space: nowrap;
}

.course-foot strong {
  font-size: 13px;
}

.add-course-card {
  display: grid;
  min-height: 178px;
  align-content: center;
  justify-items: center;
  gap: 8px;
  color: var(--muted);
  border: 1.5px dashed color-mix(in srgb, var(--accent) 30%, var(--line));
  border-radius: 22px;
  background: linear-gradient(150deg, color-mix(in srgb, var(--accent-soft) 62%, var(--mix-base)) 0%, var(--paper) 70%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.9);
  text-align: center;
}

.add-course-card::before {
  display: none;
}

.add-course-card > i {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  color: #fff;
  border-radius: 50%;
  background: var(--accent-gradient);
  box-shadow: 0 10px 22px -10px rgba(255,122,69,.8), inset 0 1px 0 rgba(255,255,255,.35);
}

.add-course-card svg {
  width: 23px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 1.8;
}

.add-course-card strong { color: var(--ink); font-size: 14px; }
.add-course-card span { font-size: 10px; }

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
  animation: dialog-in .3s cubic-bezier(.2, .85, .25, 1) both;
}

.confirm-icon {
  display: grid;
  width: 50px;
  height: 50px;
  margin: 0 auto 14px;
  place-items: center;
  color: #f05b6d;
  border-radius: 17px;
  background: color-mix(in srgb, #f05b6d 14%, var(--paper));
  font-size: 23px;
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

@keyframes dialog-in {
  from { opacity: 0; transform: scale(.88); }
  to { opacity: 1; transform: scale(1); }
}

@media (max-width: 360px) {
  .course-grid {
    grid-template-columns: 1fr;
  }

  .course {
    min-height: 162px;
  }
}
</style>
