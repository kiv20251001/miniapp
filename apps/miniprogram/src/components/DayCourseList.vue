<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import dayjs from 'dayjs'
import { COURSE_TYPE_LABEL } from '@server-domain/constants'
import { courseCardFee } from '@server-domain/charges'
import { buildCourseBillLedger } from '@server-domain/courseBills'
import { courseScheduleProgress } from '@server-domain/courseSchedule'
import { money } from '@server-domain/billing'
import type { DayOccurrence, Homework } from '@server-domain/types'
import { showCloudError } from '@/cloud/call'
import { homeworkOn } from '@/domain/homework'
import { WX_ENV_VERSION } from '@/config'
import { useFamilyStore } from '@/stores/family'
import { loadRemindTemplate } from '@/utils/remind'
import { occurrenceExpense, temporaryRemark } from '@/utils/view'
import { EMPTY_DAY_LINES, EMPTY_DAY_LINES_VIEWER, SCHEDULE_LOADING, SCHEDULE_OFFLINE, pickDailyLine } from '@/domain/copy'
import { storeToRefs } from 'pinia'
import { useThemeStore } from '@/utils/wx-theme'
import { cardBackground, currentMixBase, deepTone, mix, tileBackground } from '@/utils/color'
import AppIcon from '@/components/AppIcon.vue'
import EmptyHint from '@/components/EmptyHint.vue'
import ChildAvatar from '@/components/ChildAvatar.vue'
import HomeworkCard from '@/components/HomeworkCard.vue'

const props = withDefaults(defineProps<{
  title: string
  items: DayOccurrence[]
  date?: string
  actionLabel?: string
  readonly?: boolean
  hideFee?: boolean
}>(), {
  actionLabel: '新增',
  readonly: false,
  hideFee: false,
})

const emit = defineEmits<{
  add: []
  edit: [item: DayOccurrence]
  editHomework: [item: Homework]
}>()

const store = useFamilyStore()
let templateId = ''
void loadRemindTemplate().then((item) => {
  templateId = item.id
}).catch(() => {
  templateId = ''
})
const { isDark } = storeToRefs(useThemeStore())
const now = ref(dayjs().format('HH:mm'))
function tick() {
  now.value = dayjs().format('HH:mm')
}
onShow(() => {
  tick()
  if (store.ready) void store.loadReminders()
})
const clock = setInterval(tick, 30000)
onUnmounted(() => clearInterval(clock))
/** 每次打开小程序换一批，同一天内切页不跳。 */
const lineSeed = String(Math.floor(Math.random() * 1000))
const emptyLine = computed(() => pickDailyLine(
  props.readonly ? EMPTY_DAY_LINES_VIEWER : EMPTY_DAY_LINES,
  `${lineSeed}|${props.title}`,
))

function progress(item: DayOccurrence) {
  return courseScheduleProgress(item.course, item.date, store.overviewScheduleExceptions)
}

function startOf(item: DayOccurrence) {
  return item.exception?.startTime ?? item.course.recurrence.startTime
}

function endOf(item: DayOccurrence) {
  return item.exception?.endTime ?? item.course.recurrence.endTime
}

function duration(item: DayOccurrence) {
  const [sh, sm] = startOf(item).split(':').map(Number)
  const [eh, em] = endOf(item).split(':').map(Number)
  let minutes = eh * 60 + em - (sh * 60 + sm)
  if (minutes < 0) minutes += 24 * 60
  if (minutes < 60) return `${minutes}min`
  const hours = minutes / 60
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`
}

function feeOf(item: DayOccurrence) {
  const course = item.course
  const expense = course.billingPolicy?.pricingMode === 'prepaid' || course.billingMode === 'term'
    ? store.snapshot.expenses.find((bill) =>
      bill.courseId === course.id && bill.status !== 'void' && (bill.source === 'course_upfront' || bill.billingMode === 'term'),
    )
    : occurrenceExpense(store.overviewExpenses, course, item.date)
  return courseCardFee(course, expense)
}

function totals(item: DayOccurrence) {
  if (item.course.billingPolicy?.pricingMode === 'free' || item.course.billingMode === 'free') return null
  return buildCourseBillLedger(item.course, store.overviewExpenses, store.overviewScheduleExceptions, store.overviewCharges, store.overviewPayments)
}

function participants(item: DayOccurrence) {
  if (store.snapshot.children.length <= 1) return []
  const assigned = item.course.childIds?.length ? item.course.childIds : [item.course.childId]
  return store.snapshot.children.filter((child) => assigned.includes(child.id))
}

/** 当天看结束时间；更早的日期整张卡都算已过。 */
function isFinished(date: string, end: string) {
  const today = dayjs().format('YYYY-MM-DD')
  if (date < today) return true
  if (date > today) return false
  return end <= now.value
}

function canRemind(item: DayOccurrence) {
  const today = dayjs().format('YYYY-MM-DD')
  if (item.date > today) return true
  if (item.date < today) return false
  const start = item.exception?.startTime ?? item.course.recurrence.startTime
  return start > now.value
}

function tell(message: string) {
  if (Array.from(message).length <= 7) {
    uni.showToast({ icon: 'none', title: message })
    return
  }
  uni.showModal({ title: '课前提醒', content: message, showCancel: false })
}

function subscribeStatus(result: Record<string, unknown>, id: string) {
  const direct = result[id]
  if (direct === 'accept' || direct === 'reject' || direct === 'ban' || direct === 'filter') return direct
  for (const [key, value] of Object.entries(result)) {
    if (key === 'errMsg') continue
    if (value === 'accept' || value === 'reject' || value === 'ban' || value === 'filter') return value
  }
  return ''
}

function subscribeFailText(errMsg: string) {
  const text = errMsg.toLowerCase()
  if (text.includes('main switch') || text.includes('switched off')) {
    return '请先在微信「设置 - 通知管理」里打开订阅消息，再点设置提醒。'
  }
  if (text.includes('template')) {
    return '模板 ID 还没对上。请把后台的模板 ID 和 thing 编号填进配置，重新打包后再试。'
  }
  if (text.includes('tap gesture') || text.includes('user tap')) return '请再点一次「设置提醒」。'
  if (text.includes('ban')) return '这则提醒被微信限制了，请到通知管理里查看。'
  return '提醒没有打开。若弹出了窗口，请点「允许」。'
}

function subscribe(item: DayOccurrence) {
  if (!canRemind(item)) {
    tell('这节课已经开始了')
    return
  }
  if (!store.ready && !store.fromCache) {
    tell(store.booting ? '正在读取课表…' : '请先创建或加入家庭')
    return
  }
  if (store.remindKeys.includes(item.id)) {
    tell('这节课会在课前提醒你')
    return
  }
  if (!templateId) {
    tell('提醒模板还没准备好。请先填写模板 ID，或等云端读到已选用的模板。')
    void loadRemindTemplate().then((found) => {
      templateId = found.id
    }).catch(() => {})
    return
  }
  const id = templateId
  const options = {
    tmplIds: [id],
    success: (result: Record<string, unknown>) => {
      const decision = subscribeStatus(result, id)
      if (decision !== 'accept') {
        if (decision === 'ban') tell('这则提醒被微信限制了，请到通知管理里查看。')
        else if (decision === 'filter') tell('这套模板被微信过滤了。请到小程序后台确认模板已选用，且没有同名模板。')
        else if (WX_ENV_VERSION === 'develop' && decision === 'reject') {
          tell('开发者工具里经常不弹出允许窗口。请用手机预览，点「设置提醒」后在弹窗里点允许。')
        } else tell('需要在弹窗里点「允许」，才会在课前 15 分钟提醒你。')
        return
      }
      void store.subscribeReminder(item.course.id, item.date, WX_ENV_VERSION).then((saved) => {
        tell(saved.late ? '已开启。离上课不足 15 分钟，可能来不及提醒。' : '已开启。退出小程序后，会在课前约 15 分钟提醒你。')
      }).catch((error: unknown) => {
        showCloudError(error)
      })
    },
    fail: (error: { errMsg?: string }) => {
      tell(subscribeFailText(String(error?.errMsg || '')))
    },
  }
  if (typeof wx !== 'undefined' && wx.requestSubscribeMessage) wx.requestSubscribeMessage(options)
  else uni.requestSubscribeMessage(options)
}

const homeworkRows = computed(() => (props.date ? homeworkOn(store.homework, props.date) : []))
const homeworkDone = computed(() => homeworkRows.value.filter((item) => item.done).length)
const swipedId = ref('')
/** 同一条作业的上一次切换还没回到云端时，不再连发，避免两个请求先后落地造成状态来回跳。 */
const toggling = new Set<string>()

function homeworkMissed(item: Homework) {
  return !item.done && item.date < dayjs().format('YYYY-MM-DD')
}

function closeSwipe(id: string) {
  if (swipedId.value === id) swipedId.value = ''
}

function editHomework(item: Homework) {
  swipedId.value = ''
  emit('editHomework', item)
}

async function toggleHomework(item: Homework) {
  if (toggling.has(item.id)) return
  const done = !item.done
  toggling.add(item.id)
  swipedId.value = ''
  uni.showToast({ icon: 'none', title: done ? '作业已完成' : '已改回未完成' })
  try {
    await store.setHomeworkDone(item.id, done)
  } catch (error) {
    showCloudError(error)
  } finally {
    toggling.delete(item.id)
  }
}

function courseIcon(item: DayOccurrence) {
  const live = store.snapshot.courses.find((course) => course.id === item.course.id)
  return live?.icon || item.course.icon || 'generic'
}

/** 深色下顶部高光只留一丝，带一点课程色，不再是一条亮白线。 */
function cardStyle(item: DayOccurrence, dark: boolean) {
  const tint = item.course.color
  return {
    background: cardBackground(tint),
    boxShadow: dark
      ? `0 2px 6px rgba(0,0,0,.28), 0 18px 34px -18px rgba(0,0,0,.6), inset 0 1px 0 ${mix(tint, '#1c2230', 0.78)}`
      : `0 2px 5px rgba(25,31,58,.04), 0 18px 34px -16px ${mix(tint, '#191f3a', 0.58)}, inset 0 1px 0 rgba(255,255,255,.9)`,
  }
}

function tileStyle(item: DayOccurrence, dark: boolean) {
  const tint = item.course.color
  return {
    background: tileBackground(tint),
    boxShadow: dark
      ? `0 10px 20px -12px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.14)`
      : `0 10px 20px -10px ${mix(tint, '#191f3a', 0.3)}, inset 0 1px 0 rgba(255,255,255,.4)`,
  }
}

/** 每张卡片的账单、进度只算一次；缓存的页面在数据变化时也只重算一遍。 */
const rows = computed(() => {
  const paper = currentMixBase()
  const dark = isDark.value
  return props.items.map((item) => {
  const color = item.course.color
  const done = progress(item)
  return {
    item,
    start: startOf(item),
    end: endOf(item),
    duration: duration(item),
    temporary: item.course.source === 'temporary',
    remark: temporaryRemark(item.course),
    fee: feeOf(item),
    totals: totals(item),
    progress: done,
    faces: participants(item),
    icon: courseIcon(item),
    cardStyle: cardStyle(item, dark),
    tileStyle: tileStyle(item, dark),
    typeStyle: { color: deepTone(color), background: mix(color, paper, dark ? 0.72 : 0.82) },
    trackStyle: { background: mix(color, dark ? '#2a3142' : '#eceef4', 0.86) },
    fillStyle: {
      width: done.percent + '%',
      background: `linear-gradient(90deg, ${mix(color, paper, 0.28)} 0%, ${deepTone(color)} 100%)`,
    },
    startStyle: { color: deepTone(color) },
    finished: isFinished(props.date || item.date, endOf(item)),
    endStyle: { color: mix(color, paper, dark ? 0.42 : 0.36) },
    lineStyle: {
      background: `linear-gradient(180deg, ${deepTone(color)} 0%, ${mix(color, paper, dark ? 0.68 : 0.58)} 100%)`,
    },
    dotStyle: {
      background: deepTone(color),
      boxShadow: `0 0 0 2px ${mix(color, paper, 0.55)}`,
    },
  }
})
})
</script>

<template>
  <view class="schedule">
    <view class="schedule-head">
      <view class="schedule-title-wrap">
        <text class="schedule-title">{{ title }}</text>
        <text v-if="store.syncing" class="syncing">{{ store.stale ? '上次课表' : '同步中' }}</text>
      </view>
      <button hover-class="press-on" hover-stay-time="80" v-if="!readonly && !store.booting" class="add" @click="emit('add')">
        <AppIcon name="plus" tone="accent" :size="14" />
        <text>{{ actionLabel }}</text>
      </button>
    </view>

    <template v-if="rows.length || homeworkRows.length">
    <view v-if="rows.length" class="lesson-list">
      <view v-for="(row, index) in rows" :key="row.item.id" class="timeline-entry">
        <view class="timeline-marker">
          <view class="timeline-times">
            <text class="timeline-start" :style="row.startStyle">{{ row.start }}</text>
            <text class="timeline-end" :style="row.endStyle">{{ row.end }}</text>
          </view>
          <view class="timeline-rail">
            <view class="timeline-line" :class="{ last: index === rows.length - 1 }" :style="row.lineStyle" />
            <view class="timeline-dot" :style="row.dotStyle" />
            <view v-if="row.faces.length" class="timeline-faces">
              <ChildAvatar v-for="child in row.faces" :key="child.id" :avatar-key="child.avatarKey" :size="26" />
            </view>
          </view>
        </view>
        <view class="lesson-card" :style="row.cardStyle">
          <view v-if="row.finished" class="done-seal">
            <view class="done-ring">
              <view class="done-inner"><text>已完成</text></view>
            </view>
          </view>
          <view class="lesson-body">
            <view class="lesson-time" :style="row.tileStyle">
              <button
                v-if="canRemind(row.item)"
                hover-class="press-on"
                hover-stay-time="80"
                class="alarm press"
                :class="{ on: store.remindKeys.includes(row.item.id) }"
                @click.stop="subscribe(row.item)"
              >
                <AppIcon name="alarm" tone="white" :size="13" />
                <text>{{ store.remindKeys.includes(row.item.id) ? '已提醒' : '设置提醒' }}</text>
              </button>
              <AppIcon :key="row.icon" :name="row.icon" tone="white" :size="26" />
            </view>
            <view class="lesson-copy">
              <text class="lesson-type" :style="row.typeStyle">{{ row.temporary ? '临时计划' : COURSE_TYPE_LABEL[row.item.course.type] }}</text>
              <text class="lesson-name">{{ row.item.course.title }}</text>
              <view class="lesson-meta">
                <text v-if="row.temporary" class="remark">{{ row.remark }}</text>
                <template v-else>
                  <text>{{ row.item.course.teacher || '老师待定' }}</text>
                  <view class="dot" />
                  <text>{{ row.item.course.location || '地点待定' }}</text>
                </template>
              </view>
              <view class="lesson-period">
                <text class="dur">{{ row.duration }}</text>
                <view class="range">
                  <AppIcon name="clock" tone="muted" :size="12" />
                  <text>{{ row.start }}–{{ row.end }}</text>
                </view>
              </view>
              <text v-if="row.item.exception" class="adjust" :style="{ color: row.item.course.color }">
                {{ row.item.exception.status === 'added' ? '本次临时添加' : '本次计划已调整' }}
              </text>
            </view>
            <view class="lesson-side">
              <button hover-class="press-on" hover-stay-time="80" class="more" @click="emit('edit', row.item)">
                <AppIcon name="dots" tone="muted" :size="18" />
              </button>
              <view v-if="!hideFee" class="fee-row">
                <text class="fee">{{ row.fee.label }}</text>
                <text
                  v-if="row.fee.paid !== undefined"
                  class="pay-pill"
                  :class="row.fee.paid ? 'paid' : 'unpaid'"
                >{{ row.fee.paid ? '本次已付' : '本次未付' }}</text>
              </view>
            </view>
          </view>
          <view class="course-progress">
            <view class="progress-copy">
              <text class="progress-label">课程进度 {{ row.progress.completed }}/{{ row.progress.total }} 课时</text>
              <text v-if="row.totals && !hideFee" class="fee-totals">已付 {{ money(row.totals.paid) }} · 未付 {{ money(row.totals.unpaid) }}</text>
            </view>
            <view class="progress-track" :style="row.trackStyle">
              <view :style="row.fillStyle" />
            </view>
          </view>
        </view>
      </view>
    </view>

    <view v-if="homeworkRows.length" class="homework-block">
      <view class="homework-head">
        <view class="homework-dot" />
        <text class="homework-title">课堂作业</text>
        <text class="homework-count">{{ homeworkDone }}/{{ homeworkRows.length }} 已完成</text>
        <text v-if="!readonly" class="homework-hint">左滑卡片可更改状态</text>
      </view>
      <HomeworkCard
        v-for="item in homeworkRows"
        :key="item.id"
        :homework="item"
        :missed="homeworkMissed(item)"
        :readonly="readonly"
        :opened="swipedId === item.id"
        @open="swipedId = item.id"
        @close="closeSwipe(item.id)"
        @edit="editHomework(item)"
        @toggle="toggleHomework(item)"
      />
    </view>
    </template>

    <view v-else-if="store.booting" class="boot-list">
      <view v-for="n in 2" :key="n" class="boot-row">
        <view class="sk boot-time" />
        <view class="boot-card">
          <view class="sk boot-icon" />
          <view class="boot-copy">
            <view class="sk sk-line boot-line-short" />
            <view class="sk sk-title boot-line-title" />
            <view class="sk sk-line boot-line-long" />
          </view>
        </view>
      </view>
      <text class="boot-hint">{{ SCHEDULE_LOADING }}</text>
    </view>

    <view v-else-if="store.offline" class="empty-card">
      <EmptyHint icon="calendar" :label="SCHEDULE_OFFLINE" />
    </view>

    <view v-else class="empty-card">
      <EmptyHint icon="calendar" :label="emptyLine">
        <template v-if="!readonly" #mark>
          <button hover-class="press-on" hover-stay-time="80" class="empty-add press" @click="emit('add')">
            <AppIcon name="plus" tone="accent" :size="22" />
          </button>
        </template>
      </EmptyHint>
    </view>
  </view>
</template>

<style scoped>
.schedule { margin-bottom: 28px; }
.schedule-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 13px; }
.schedule-title-wrap { display: flex; align-items: baseline; min-width: 0; gap: 8px; }
.schedule-title { font-size: 19px; font-weight: 800; letter-spacing: -0.025em; }
.syncing { color: var(--muted); font-size: 12px; font-weight: 650; }
.boot-list { display: flex; flex-direction: column; gap: 12px; }
.boot-row { display: flex; align-items: stretch; gap: 8px; }
.boot-time { width: 36px; height: 72px; flex: 0 0 auto; border-radius: 12px; }
.boot-card {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 108px;
  padding: 16px;
  border-radius: 24px;
  background: var(--paper);
  box-shadow: var(--elev-md);
}
.boot-icon { width: 52px; height: 52px; flex: 0 0 auto; border-radius: 18px; }
.boot-copy { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.boot-line-short { width: 72px; }
.boot-line-title { width: 46%; }
.boot-line-long { width: 64%; }
.boot-hint { color: var(--muted); font-size: 12px; text-align: center; }
.add {
  display: flex;
  min-height: 32px;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  color: var(--accent-text);
  border-radius: 11px;
  background: var(--accent-soft);
  font-size: 12px;
  font-weight: 700;
}
.timeline-entry { display: flex; align-items: stretch; gap: 8px; margin-bottom: 12px; }
.timeline-marker {
  display: flex;
  width: 52px;
  flex: 0 0 auto;
  align-items: stretch;
  padding-top: 2px;
}
.timeline-times {
  display: flex;
  width: 36px;
  flex-direction: column;
  justify-content: space-between;
  padding: 1px 3px 2px 0;
}
.timeline-start, .timeline-end {
  width: 100%;
  font-size: 9px;
  letter-spacing: -0.04em;
  line-height: 1;
  text-align: right;
}
.timeline-start { font-weight: 800; }
.timeline-end { font-weight: 650; }
.timeline-rail { position: relative; flex: 1; width: 12px; min-width: 12px; }
.timeline-line {
  position: absolute;
  top: 7px;
  bottom: -12px;
  left: 50%;
  width: 2px;
  margin-left: -1px;
  border-radius: 999px;
}
.timeline-line.last { bottom: 10px; }
.timeline-dot {
  position: absolute;
  z-index: 1;
  top: 1px;
  left: 50%;
  width: 7px;
  height: 7px;
  margin-left: -5.5px;
  border: 2px solid var(--bg);
  border-radius: 50%;
}
.timeline-faces {
  position: absolute;
  z-index: 2;
  top: 18px;
  left: 50%;
  display: flex;
  flex-direction: column;
  gap: 5px;
  transform: translateX(-50%);
}
.lesson-card {
  position: relative;
  flex: 1;
  min-width: 0;
  padding: 14px;
  overflow: hidden;
  border-radius: 22px;
}
/* 盖在右下角、压在内容下面：「已完成」落在进度条上方的空白处，不压金额。 */
.done-seal {
  position: absolute;
  z-index: 0;
  right: -18px;
  bottom: 14px;
  display: flex;
  width: 84px;
  height: 84px;
  align-items: center;
  justify-content: center;
  color: var(--paid);
  opacity: 0.32;
  transform: rotate(-16deg);
  pointer-events: none;
}
.done-ring {
  display: flex;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 4px;
  border: 2px solid currentColor;
  border-radius: 50%;
}
.done-inner {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  border: 1px solid currentColor;
  border-radius: 50%;
}
.done-inner text {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.1em;
  line-height: 1;
  transform: translate(-6px, -4px);
}
.lesson-body,
.course-progress { position: relative; z-index: 1; }
.lesson-body { display: flex; align-items: flex-start; gap: 10px; }
.lesson-time {
  display: flex;
  width: 54px;
  min-height: 102px;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 6px 2px;
  box-sizing: border-box;
  border-radius: 16px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
}
.alarm {
  display: flex;
  width: 46px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  margin: 0;
  padding: 4px 1px 3px;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.22);
  line-height: 1;
}
.alarm::after { border: 0; }
.alarm text {
  color: #fff;
  font-size: 8.5px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.02em;
  white-space: nowrap;
}
.alarm.on { background: rgba(255, 255, 255, 0.42); }
.lesson-copy { min-width: 0; flex: 1; }
.lesson-type {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 7px;
  font-size: 9px;
  font-weight: 700;
}
.lesson-name {
  display: block;
  margin: 7px 0 5px;
  overflow: hidden;
  color: var(--ink);
  font-size: 17px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lesson-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; color: var(--muted); font-size: 11px; }
.lesson-meta text { min-width: 0; line-height: 1.35; }
.remark {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-height: 1.4;
}
.lesson-meta .dot { width: 3px; height: 3px; flex: 0 0 auto; border-radius: 50%; background: var(--faint); }
.range { display: flex; align-items: center; gap: 4px; color: var(--muted); font-size: 9px; }
.lesson-period { display: flex; flex-wrap: wrap; gap: 5px 9px; align-items: center; margin-top: 11px; }
.dur { font-size: 15px; font-weight: 750; }
.adjust { display: block; margin-top: 6px; font-size: 10px; font-weight: 650; }
.lesson-side {
  display: flex;
  width: 78px;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}
.fee-row {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  text-align: right;
}
.fee { font-size: 15px; font-weight: 750; white-space: nowrap; }
.pay-pill { padding: 3px 8px; border-radius: 999px; font-size: 10px; font-weight: 750; }
.pay-pill.paid { color: var(--paid); background: var(--paid-soft); }
.pay-pill.unpaid { color: var(--unpaid); background: var(--unpaid-soft); }
.fee-totals { flex: 0 0 auto; white-space: nowrap; }
.more {
  display: flex;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
}
.course-progress { margin-top: 12px; padding-top: 11px; border-top: 1px solid var(--line); }
.progress-copy { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; color: var(--muted); font-size: 10px; }
.progress-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.progress-track { height: 5px; border-radius: 999px; overflow: hidden; }
.progress-track view { height: 100%; border-radius: 999px; }
.homework-block { margin-top: 6px; }
.lesson-list + .homework-block { margin-top: 18px; }
.homework-head { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; padding-left: 2px; }
.homework-dot { width: 7px; height: 7px; border-radius: 50%; background: #6c63ff; box-shadow: 0 0 0 3px rgba(108, 99, 255, 0.18); }
.homework-title { color: var(--ink); font-size: 14px; font-weight: 800; }
.homework-count { color: var(--muted); font-size: 11px; font-weight: 650; }
.homework-hint { margin-left: auto; color: var(--faint); font-size: 10px; }
.empty-card {
  border-radius: 24px;
  background: var(--paper);
  box-shadow: var(--elev-md);
}
.empty-add {
  display: flex;
  width: 52px;
  height: 52px;
  min-height: 52px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  border-radius: 18px;
  background: var(--accent-soft);
  line-height: 1;
}
.empty-add::after { border: 0; }
</style>
