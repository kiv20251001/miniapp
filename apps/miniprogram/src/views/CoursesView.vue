<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { CHILD_AVATAR_OPTIONS, childAvatarOption, COURSE_TYPE_LABEL } from '@server-domain/constants'
import type { ChildAvatarKey, Course } from '@server-domain/types'
import { getCourseAmountLabel, getCourseBillingSummary, getCourseLifecycle, getCoursePricingLabel } from '@server-domain/courseOverview'
import { courseScheduleProgress } from '@server-domain/courseSchedule'
import { showCloudError } from '@/cloud/call'
import { avatarDefaultName } from '@/domain/avatar-names'
import { TEXT_LIMIT } from '@/domain/limits'
import { cleanText, formTip } from '@/utils/form'
import { useFamilyStore } from '@/stores/family'
import { useThemeStore } from '@/utils/wx-theme'
import { useUiStore } from '@/stores/ui'
import AppIcon from '@/components/AppIcon.vue'
import { SCHEDULE_LOADING, SCHEDULE_OFFLINE } from '@/domain/copy'
import EmptyHint from '@/components/EmptyHint.vue'
import ChildAvatar from '@/components/ChildAvatar.vue'
import { cardBackground, currentMixBase, deepTone, folderTab, mix, tileBackground } from '@/utils/color'
import PageHeader from '@/components/PageHeader.vue'

defineProps<{ active: boolean }>()
const emit = defineEmits<{ cover: [covered: boolean] }>()
const store = useFamilyStore()
const theme = useThemeStore()
const managing = ref(false)

function openCreate() {
  uni.navigateTo({ url: '/subpages/course-edit/index' })
}

function openManage() {
  managing.value = true
}

const editingAvatarId = ref('')
const newName = ref('')
const newAvatar = ref<ChildAvatarKey>('boy-blue')
const names = reactive<Record<string, string>>({})
const newChildPlaceholder = computed(() => avatarDefaultName(newAvatar.value))

function avatarUsedByOther(key: ChildAvatarKey, exceptId?: string) {
  return store.snapshot.children.some((child) => child.id !== exceptId && childAvatarOption(child.avatarKey).key === key)
}

function firstFreeAvatar() {
  return CHILD_AVATAR_OPTIONS.find((option) => !avatarUsedByOther(option.key))?.key
}

function pickNewAvatar(key: ChildAvatarKey) {
  if (avatarUsedByOther(key)) {
    formTip('这个头像已经有孩子在用')
    return
  }
  newAvatar.value = key
}

const canAddChild = computed(() =>
  store.snapshot.children.length < CHILD_AVATAR_OPTIONS.length && Boolean(firstFreeAvatar()),
)

watch(managing, (open) => {
  emit('cover', open)
  if (!open) return
  editingAvatarId.value = ''
  newName.value = ''
  newAvatar.value = firstFreeAvatar() ?? 'boy-blue'
  for (const child of store.snapshot.children) names[child.id] = child.name
})
const ui = useUiStore()
function faceStyle(color: string, inactive: boolean) {
  const paper = currentMixBase()
  const dark = theme.isDark
  if (inactive) {
    return { background: `linear-gradient(150deg, ${mix('#8b93a5', paper, 0.86)} 0%, ${paper} 62%)` }
  }
  return {
    background: cardBackground(color),
    boxShadow: dark
      ? `0 2px 6px rgba(0,0,0,.3), 0 18px 34px -16px ${mix(color, '#10131b', 0.35)}, inset 0 1px 0 rgba(255,255,255,.08)`
      : `0 2px 5px rgba(25,31,58,.04), 0 18px 34px -16px ${mix(color, '#6d6780', 0.35)}, inset 0 1px 0 rgba(255,255,255,.9)`,
  }
}

const cards = computed(() => {
  const today = ui.today
  const period = today.slice(0, 7)
  const dark = theme.isDark
  return store.allCourses
    .filter((course) => course.source !== 'temporary')
    .map((course) => {
      const lifecycle = getCourseLifecycle(course, store.scheduleExceptions, today)
      return {
        course,
        lifecycle,
        progress: courseScheduleProgress(course, today, store.scheduleExceptions),
        billing: getCourseBillingSummary(
          course,
          store.expenses,
          period,
          store.snapshot.charges ?? [],
          store.snapshot.occurrenceRecords ?? [],
        ),
        face: faceStyle(course.color, lifecycle.inactive),
        dark,
      }
    })
})

async function saveName(id: string) {
  const current = store.snapshot.children.find((child) => child.id === id)?.name || ''
  const name = cleanText(names[id], TEXT_LIMIT.childName)
  if (!name) {
    names[id] = current
    formTip('孩子名字不能为空')
    return
  }
  names[id] = name
  if (name === current) return
  try {
    await store.updateChild(id, { name })
  } catch (error) {
    showCloudError(error)
  }
}

async function setAvatar(id: string, key: ChildAvatarKey) {
  const current = store.snapshot.children.find((child) => child.id === id)
  if (current && childAvatarOption(current.avatarKey).key === key) {
    editingAvatarId.value = ''
    return
  }
  if (avatarUsedByOther(key, id)) {
    formTip('这个头像已经有孩子在用')
    return
  }
  try {
    await store.updateChild(id, { avatarKey: key })
    editingAvatarId.value = ''
  } catch (error) {
    showCloudError(error)
  }
}

async function addChild() {
  if (!canAddChild.value) {
    formTip('最多添加 4 个孩子')
    return
  }
  if (avatarUsedByOther(newAvatar.value)) {
    formTip('这个头像已经有孩子在用')
    return
  }
  const name = cleanText(newName.value, TEXT_LIMIT.childName) || newChildPlaceholder.value
  try {
    const id = await store.addChild(name, newAvatar.value)
    if (!id) {
      formTip('请先填写孩子名字')
      return
    }
    names[id] = name
    newName.value = ''
    newAvatar.value = firstFreeAvatar() ?? newAvatar.value
  } catch (error) {
    showCloudError(error)
  }
}

function removeCurrentChild(id: string, name: string) {
  uni.showModal({
    title: `删除${name}`,
    content: '会删除只属于这个孩子的课程和账单。共享课只解除关联。',
    success: async (res) => {
      if (!res.confirm) return
      try {
        await store.removeChild(id)
      } catch (error) {
        showCloudError(error)
      }
    },
  })
}

async function onChildChange(id: string) {
  try {
    await store.selectChild(id)
  } catch (error) {
    showCloudError(error)
  }
}

function more(course: Course) {
  if (!store.canWrite) {
    uni.showModal({
      title: course.title,
      content: [course.teacher || '老师待定', course.location || '地点待定'].join('\n'),
      showCancel: false,
    })
    return
  }
  uni.showActionSheet({
    itemList: ['编辑课程', course.archived ? '恢复课程' : '标记已结课', '查看账单', '删除课程'],
    success: async (res) => {
      try {
        if (res.tapIndex === 0) {
          uni.navigateTo({ url: `/subpages/course-edit/index?id=${course.id}` })
        }
        if (res.tapIndex === 1) {
          if (course.archived) await store.restoreCourse(course.id)
          else await store.archiveCourse(course.id)
        }
        if (res.tapIndex === 2) {
          uni.navigateTo({ url: `/subpages/course-bills/index?id=${course.id}` })
        }
        if (res.tapIndex === 3) {
          uni.showModal({
            title: '删除课程',
            content: '未付账单会删除，已付账单会保留。',
            success: async (answer) => {
              if (!answer.confirm) return
              try {
                await store.removeCourse(course.id)
              } catch (error) {
                showCloudError(error)
              }
            },
          })
        }
      } catch (error) {
        showCloudError(error)
      }
    },
  })
}
</script>

<template>
  <view class="courses-view">
    <view class="page courses-page">
      <PageHeader title="长期课程/计划" :caption="store.canWrite ? `管理 ${store.child?.name || '孩子'} 的排课、进度与费用` : `查看 ${store.child?.name || '孩子'} 的课程、老师和地点`">
        <template #actions>
          <view class="child-row">
            <view
              v-for="child in store.snapshot.children"
              :key="child.id"
              class="child-pill press"
              :class="{ on: child.id === store.childId }"
              hover-class="press-on"
              hover-stay-time="80"
              @click="onChildChange(child.id)"
            >
              <view class="face-ring"><ChildAvatar :avatar-key="child.avatarKey" :size="34" /></view>
              <text>{{ child.name }}</text>
            </view>
            <view v-if="store.canWrite" class="manage press" hover-class="press-on" hover-stay-time="80" @click="openManage">
              <AppIcon name="plus" tone="accent" :size="18" />
            </view>
          </view>
        </template>
      </PageHeader>

      <view v-if="store.booting || (store.offline && !cards.length)" class="card">
        <EmptyHint icon="calendar" :label="store.booting ? SCHEDULE_LOADING : SCHEDULE_OFFLINE" />
      </view>
      <view v-else-if="!cards.length && !store.canWrite" class="card">
        <EmptyHint icon="calendar" label="还没有课程" />
      </view>
      <view v-else class="course-grid">
        <view
          v-for="card in cards"
          :key="card.course.id"
          class="course"
          :class="{ inactive: card.lifecycle.inactive }"
        >
          <view class="bookmark" :style="{ background: card.lifecycle.inactive ? (card.dark ? '#2a3142' : '#eceef4') : folderTab(card.course.color) }" />
          <view class="course-face" :style="card.face">
          <text v-if="card.lifecycle.inactive" class="watermark">{{ card.lifecycle.label }}</text>
          <view class="course-top">
            <view class="course-icon" :style="{ background: card.lifecycle.inactive ? '#aeb4c0' : tileBackground(card.course.color) }">
              <AppIcon :name="card.course.icon || 'generic'" tone="white" :size="23" />
            </view>
            <view class="course-actions" @click.stop>
              <text class="badge" :class="`is-${card.lifecycle.key}`">{{ card.lifecycle.label }}</text>
              <button hover-class="press-on" hover-stay-time="80" class="more" @click="more(card.course)"><AppIcon name="dots" tone="muted" :size="18" /></button>
            </view>
          </view>
          <text class="type" :style="{ color: card.lifecycle.inactive ? '#8b93a5' : deepTone(card.course.color), background: card.lifecycle.inactive ? (card.dark ? '#2a3142' : '#eef0f4') : mix(card.course.color, currentMixBase(), card.dark ? 0.72 : 0.82) }">{{ COURSE_TYPE_LABEL[card.course.type] }}</text>
          <text class="name">{{ card.course.title }}</text>
          <view class="bar" :style="{ background: mix(card.course.color, card.dark ? '#2a3142' : '#eceef4', 0.86) }">
            <view :style="{ width: card.progress.percent + '%', background: card.lifecycle.inactive ? '#aeb4c0' : tileBackground(card.course.color) }" />
          </view>
          <text class="meta">{{ card.progress.completed }}/{{ card.progress.total }} 课时 · {{ card.progress.percent }}%</text>
          <view class="foot">
            <view v-if="store.canViewBills">
              <text class="price">{{ getCoursePricingLabel(card.course) }}</text>
              <text v-if="card.billing.key !== 'free'" class="bill-state" :class="`is-${card.billing.key}`">{{ card.billing.label }}</text>
            </view>
            <view v-else>
              <text class="price">{{ card.course.teacher || '老师待定' }}</text>
              <text class="bill-state">{{ card.course.location || '地点待定' }}</text>
            </view>
            <view v-if="store.canViewBills" class="amount-col">
              <text class="amount">{{ getCourseAmountLabel(card.course) }}</text>
              <text v-if="card.billing.key === 'open'" class="pay press" hover-class="press-on" hover-stay-time="80" @click.stop="uni.navigateTo({ url: `/subpages/course-bills/index?id=${card.course.id}` })">去支付</text>
            </view>
          </view>
          </view>
        </view>
        <view v-if="store.canWrite" class="course add press" hover-class="press-on" hover-stay-time="80" @click="openCreate">
          <view class="plus"><AppIcon name="plus" tone="white" :size="22" /></view>
          <text class="name">新增课程/计划</text>
          <text class="meta">创建新的课程与排课计划</text>
        </view>
      </view>
    </view>

    <view v-if="managing" class="mask" @click="managing = false">
      <view class="sheet" @click.stop>
        <view class="sheet-head">
          <view>
            <text class="eyebrow">家庭成员</text>
            <text class="sheet-title">孩子资料管理</text>
          </view>
          <text class="close press" hover-class="press-on" hover-stay-time="80" @click="managing = false">×</text>
        </view>
        <scroll-view scroll-y class="sheet-scroll" :show-scrollbar="false">
          <view v-for="child in store.snapshot.children" :key="child.id" class="profile">
            <view v-if="editingAvatarId !== child.id" class="press" hover-class="press-on" hover-stay-time="80" @click="editingAvatarId = child.id">
              <ChildAvatar :avatar-key="child.avatarKey" :size="42" />
            </view>
            <view v-else class="avatar-choices">
              <view
                v-for="option in CHILD_AVATAR_OPTIONS"
                :key="option.key"
                class="face-ring press"
                :class="{ on: child.avatarKey === option.key, off: child.avatarKey !== option.key && avatarUsedByOther(option.key, child.id) }"
                hover-class="press-on"
                hover-stay-time="80"
                @click="setAvatar(child.id, option.key)"
              >
                <ChildAvatar :avatar-key="option.key" :size="36" />
              </view>
            </view>
            <view class="field profile-name">
              <text class="field-label">孩子名称</text>
              <input v-model="names[child.id]" :maxlength="TEXT_LIMIT.childName" placeholder-class="ph" @blur="saveName(child.id)" />
            </view>
            <text class="delete press" hover-class="press-on" hover-stay-time="80" @click="removeCurrentChild(child.id, child.name)">删除</text>
          </view>
          <template v-if="canAddChild">
            <text class="field-label">选择头像</text>
            <view class="avatar-choices new">
              <view
                v-for="option in CHILD_AVATAR_OPTIONS"
                :key="option.key"
                class="face-ring press"
                :class="{ on: newAvatar === option.key, off: avatarUsedByOther(option.key) }"
                hover-class="press-on"
                hover-stay-time="80"
                @click="pickNewAvatar(option.key)"
              >
                <ChildAvatar :avatar-key="option.key" :size="44" />
              </view>
            </view>
            <view class="new-row">
              <input v-model="newName" :maxlength="TEXT_LIMIT.childName" :placeholder="newChildPlaceholder" placeholder-class="ph" />
              <button hover-class="press-on" hover-stay-time="80" class="btn" @click="addChild">添加</button>
            </view>
          </template>
          <text v-else class="child-limit">最多 4 个孩子，每个头像只能用一次</text>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.courses-page { padding-top: 8px; }
.courses-view :deep(.page-header) { align-items: flex-start; flex-wrap: wrap; }
.courses-view :deep(.page-header-copy) { flex: 1 1 auto; min-width: 8.2em; }
.courses-view :deep(.page-header-copy .h1) {
  overflow: visible;
  font-size: 17px;
  letter-spacing: -0.03em;
  text-overflow: clip;
}
.child-row { display: flex; flex-wrap: nowrap; align-items: flex-start; justify-content: flex-end; gap: 6px; padding-top: 4px; }
.child-pill { display: flex; width: 40px; flex: 0 0 auto; flex-direction: column; align-items: center; gap: 3px; color: var(--muted); font-size: 9px; font-weight: 650; }
.child-pill text { width: 100%; overflow: hidden; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
.child-pill.on { color: var(--ink); font-weight: 750; }
/* 视图是组件，样式穿不进 ChildAvatar，选中环画在外层。和新增课程页选孩子同一个环。 */
.face-ring { display: flex; flex: 0 0 auto; border-radius: 50%; }
.child-pill.on .face-ring,
.avatar-choices .face-ring.on { box-shadow: 0 0 0 2px var(--halo), 0 0 0 4px #ff7a45; }
.manage {
  display: flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border: 1px dashed rgba(255, 122, 69, 0.45);
  border-radius: 50%;
  background: var(--accent-soft);
}
.course-grid { display: flex; flex-wrap: wrap; gap: 12px; }
.course {
  position: relative;
  width: calc(50% - 6px);
  margin-top: 10px;
  background: transparent;
}
.bookmark {
  position: absolute;
  z-index: 0;
  top: 0;
  left: 0;
  width: 66px;
  height: 18px;
  border-radius: 13px 13px 0 0;
}
.course-face {
  position: relative;
  z-index: 1;
  min-height: 168px;
  box-sizing: border-box;
  margin-top: 10px;
  padding: 14px 15px;
  overflow: hidden;
  border-radius: 6px 22px 22px 22px;
}
.course-top, .type, .name, .bar, .meta, .foot { position: relative; z-index: 1; }
.course-top { display: flex; justify-content: space-between; align-items: center; }
.course-icon {
  display: flex;
  width: 45px;
  height: 45px;
  align-items: center;
  justify-content: center;
  border-radius: 15px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.45);
}
.course-actions { display: flex; align-items: center; gap: 2px; }
.badge { padding: 4px 7px; border-radius: 999px; color: #1c8a5f; background: rgba(38,194,129,.16); font-size: 8px; font-weight: 800; }
.badge.is-upcoming, .badge.is-unscheduled { color: #a06a12; background: rgba(240,169,43,.18); }
.badge.is-ended, .badge.is-completed { color: #6e7482; background: rgba(124,138,165,.16); }
.more { display: flex; width: 28px; height: 28px; align-items: center; justify-content: center; }
.type { display: inline-block; margin-top: 14px; padding: 3px 8px; border-radius: 7px; font-size: 9px; font-weight: 700; }
.name { display: block; margin: 5px 0 10px; overflow: hidden; color: var(--ink); font-size: 17px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.bar { height: 5px; border-radius: 999px; overflow: hidden; }
.bar view { height: 100%; border-radius: inherit; }
.meta { display: block; margin-top: 6px; color: var(--muted); font-size: 10px; }
.foot { display: flex; justify-content: space-between; align-items: flex-end; gap: 8px; margin-top: 10px; }
.price, .bill-state { display: block; font-size: 11px; }
.bill-state.is-open { color: var(--unpaid); }
.bill-state.is-settled { color: var(--paid); }
.amount-col { text-align: right; }
.amount { display: block; font-size: 13px; font-weight: 750; }
.pay { display: block; margin-top: 4px; color: var(--accent-text); font-size: 11px; font-weight: 700; }
.watermark {
  position: absolute;
  right: 8px;
  bottom: 42px;
  color: rgba(91,96,110,.08);
  font-size: 28px;
  font-weight: 900;
  transform: rotate(-16deg);
}
.course.add {
  display: flex;
  margin-top: 20px;
  min-height: 178px;
  box-sizing: border-box;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px 12px;
  border: 1.5px dashed rgba(255, 122, 69, 0.35);
  border-radius: 22px;
  background: linear-gradient(150deg, var(--accent-soft) 0%, var(--paper) 70%);
  text-align: center;
}
.course.add .name, .course.add .meta { width: 100%; text-align: center; }
.course.add .name {
  overflow: visible;
  font-size: 13px;
  letter-spacing: -0.03em;
  text-overflow: clip;
  white-space: nowrap;
}
.plus {
  display: flex;
  width: 48px;
  height: 48px;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ffb45c 0%, #ff7a45 48%, #f15a36 100%);
  box-shadow: 0 10px 22px -10px rgba(255, 122, 69, 0.8);
}
.eyebrow { display: block; color: var(--accent-text); font-size: 11px; font-weight: 700; }
.close { width: 34px; height: 34px; border-radius: 50%; background: var(--bg); color: var(--muted); text-align: center; line-height: 34px; font-size: 22px; }
.profile { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; padding: 9px; border-radius: 16px; background: var(--surface-2); }
.profile-name { flex: 1; min-width: 0; margin-bottom: 0; }
.delete { color: #ed5d6e; font-size: 12px; font-weight: 700; }
.avatar-choices { display: flex; flex-wrap: nowrap; gap: 10px; padding: 4px; }
.avatar-choices.new { margin: 8px 0 12px; justify-content: space-between; }
.avatar-choices .off { opacity: 0.35; }
.child-limit { display: block; margin: 8px 2px 4px; color: var(--muted); font-size: 12px; }
.new-row { display: flex; align-items: center; gap: 8px; }
.new-row input { flex: 1; min-height: 44px; padding: 0 12px; border-radius: 14px; color: var(--ink); background: var(--field-bg); box-shadow: inset 0 0 0 1px var(--line); }
.course.inactive { color: var(--muted); }
</style>
