<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import { showCloudError, uploadAvatar } from '@/cloud/call'
import { useFamilyPage } from '@/composables/useFamilyPage'
import { ensureSession } from '@/stores/family'
import { usePageBackground, useThemePage } from '@/utils/wx-theme'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import EmptyHint from '@/components/EmptyHint.vue'
import { inviteShare, isMomentsPreview, momentsShare } from '@/utils/share'
import { openTab } from '@/utils/nav'
import {
  FAMILY_ROLE_HINT,
  FAMILY_ROLE_LABEL,
  formatInviteCode,
  INVITE_ROLE_HINT,
  isInviteActive,
  memberTitle,
  type FamilyInviteView,
  type FamilyMemberView,
  type InviteRole,
} from '@/domain/family-account'

const store = useFamilyPage()
const themeClass = useThemePage()
const pageBg = usePageBackground()
const members = ref<FamilyMemberView[]>([])
const invites = ref<FamilyInviteView[]>([])
const loading = ref(false)
const loaded = ref(false)
const inviting = ref('')
const pickingAvatar = ref(false)
const inviteRole = ref<InviteRole>(store.canInviteParent ? 'parent' : 'viewer')
const roleTabs = computed(() => [
  ...(store.canInviteParent ? [{ role: 'parent' as const, label: '邀请家长' }] : []),
  ...(store.canInviteViewer ? [{ role: 'viewer' as const, label: '邀请家人' }] : []),
])
/** 过期或次数用完的邀请码不展示，列表里只留还能打开的。 */
const activeInvites = computed(() => invites.value.filter((item) => isInviteActive(item)))
const current = computed(() => activeInvites.value.find((item) => item.role === inviteRole.value) || null)
const others = computed(() => activeInvites.value.filter((item) => item.code !== current.value?.code))

watch(roleTabs, (tabs) => {
  if (tabs.length && !tabs.some((tab) => tab.role === inviteRole.value)) inviteRole.value = tabs[0].role
}, { immediate: true })

onShow(() => {
  if (isMomentsPreview()) {
    loaded.value = true
    return
  }
  void openRoster()
})

async function openRoster() {
  if (!store.ready) await ensureSession()
  if (!store.ready) {
    loaded.value = true
    return
  }
  refreshRoster()
}

onShareTimeline(momentsShare)

onShareAppMessage((options) => {
  const target = (options as { target?: { dataset?: { code?: string } } } | undefined)?.target
  return inviteShare(target?.dataset?.code || current.value?.code || '')
})

async function refreshRoster() {
  loading.value = true
  try {
    const roster = await store.listMembers()
    members.value = roster.members
    invites.value = roster.invites.filter((item) => isInviteActive(item))
  } catch (error) {
    showCloudError(error)
  } finally {
    loading.value = false
    loaded.value = true
  }
}

function pickRole(role: InviteRole) {
  inviteRole.value = role
  if (!current.value && !loading.value) invite(role)
}

async function invite(role: InviteRole) {
  if (inviting.value) return
  inviting.value = role
  try {
    const created = await store.createInvite(role)
    if (created && !invites.value.some((item) => item.code === created.code)) {
      invites.value = [created, ...invites.value]
    }
    await refreshRoster()
  } catch (error) {
    showCloudError(error)
  } finally {
    inviting.value = ''
  }
}

function copyCode(code: string) {
  uni.setClipboardData({
    data: code,
    success: () => uni.showToast({ icon: 'none', title: '已复制邀请码' }),
  })
}

function expireLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${month}月${day}日 ${hour}:${minute} 前有效`
}

function remove(member: FamilyMemberView) {
  if (!store.canRemove(member)) return
  uni.showModal({
    title: '移出家庭',
    content: `确定把「${memberTitle(member).name}」移出这个家庭？`,
    success: async (res) => {
      if (!res.confirm) return
      try {
        await store.removeMember(member.openid)
        await refreshRoster()
      } catch (error) {
        showCloudError(error)
      }
    },
  })
}

/** 还没有头像时，点自己的色块用微信选一张。上传后其他成员刷新成员页就能看到。 */
async function onChooseAvatar(event: { detail?: { avatarUrl?: string } }) {
  const file = event.detail?.avatarUrl
  if (!file || pickingAvatar.value) return
  pickingAvatar.value = true
  try {
    const avatarUrl = await uploadAvatar(file)
    await store.setAvatar(avatarUrl)
    await refreshRoster()
    uni.showToast({ icon: 'none', title: '头像已更新' })
  } catch (error) {
    showCloudError(error)
  } finally {
    pickingAvatar.value = false
  }
}

function leave() {
  if (!store.canLeave) return
  uni.showModal({
    title: '退出家庭',
    content: '退出后将看不到这个家庭的课表，需要家长重新邀请才能再加入。',
    confirmText: '退出',
    confirmColor: '#ed5d6e',
    success: async (res) => {
      if (!res.confirm) return
      try {
        await store.leaveFamily()
        uni.showToast({ icon: 'none', title: '已退出家庭' })
        openTab('today')
      } catch (error) {
        showCloudError(error)
      }
    },
  })
}

</script>

<template>
  <page-meta :page-style="pageBg.style" :background-color="pageBg.bg" :background-color-top="pageBg.bg" :background-color-bottom="pageBg.bg" :root-background-color="pageBg.bg" :background-text-style="pageBg.text" />
  <view class="theme-root" :class="themeClass">
    <view class="page family-page">
      <PageHeader show-back safe title="家庭成员" />

      <view class="card role-card">
        <view class="role-copy">
          <text class="eyebrow">当前身份</text>
          <text class="role-name">{{ store.ready || store.fromCache ? store.roleLabel : (store.booting ? '正在同步…' : '还没有家庭') }}</text>
          <text class="muted">{{ store.ready || store.fromCache ? FAMILY_ROLE_HINT[store.role] : '创建或加入家庭后，可以和家人一起看课表。' }}</text>
        </view>
      </view>

      <view class="section-head">
        <text class="h2">成员</text>
        <text class="muted">{{ loading || !loaded ? '同步中…' : `${members.length} 人` }}</text>
      </view>
      <view class="card list">
        <template v-if="!loaded">
          <view v-for="n in 2" :key="n" class="member">
            <view class="sk avatar-sk" />
            <view class="member-copy">
              <view class="sk sk-line" style="width: 96px" />
              <view class="sk sk-line" style="width: 48px; margin-top: 8px" />
            </view>
          </view>
        </template>
        <view v-for="member in members" :key="member.openid" class="member">
          <image v-if="member.avatarUrl" class="avatar photo" :src="member.avatarUrl" mode="aspectFill" />
          <button
            v-else-if="member.self"
            class="avatar pickable"
            :class="[member.role, { busy: pickingAvatar }]"
            hover-class="press-on"
            hover-stay-time="80"
            open-type="chooseAvatar"
            @chooseavatar="onChooseAvatar"
          >{{ memberTitle(member).name.slice(0, 1) }}</button>
          <view v-else class="avatar" :class="member.role">{{ memberTitle(member).name.slice(0, 1) }}</view>
          <view class="member-copy">
            <view class="name-row">
              <text class="name">{{ memberTitle(member).name }}</text>
              <text v-if="memberTitle(member).tag" class="name-tag">{{ memberTitle(member).tag }}</text>
              <text v-if="member.self" class="name-self">· 我</text>
            </view>
            <text class="muted">{{ FAMILY_ROLE_LABEL[member.role] }}{{ member.self && !member.avatarUrl ? ' · 点头像设置' : '' }}</text>
          </view>
          <button hover-class="press-on" hover-stay-time="80" v-if="store.canRemove(member)" class="ghost" @click="remove(member)">移出</button>
          <button hover-class="press-on" hover-stay-time="80" v-else-if="member.self && store.canLeave" class="ghost" @click="leave">退出</button>
        </view>
        <EmptyHint v-if="loaded && !members.length" icon="family" label="还没有成员" />
      </view>

      <view v-if="store.canInviteParent || store.canInviteViewer" class="section-head">
        <text class="h2">邀请加入</text>
      </view>
      <view v-if="store.canInviteParent || store.canInviteViewer" class="card">
        <view class="role-tabs">
          <view
            v-if="roleTabs.length > 1"
            class="role-thumb"
            :class="{ right: inviteRole === roleTabs[1].role }"
          />
          <view
            v-for="tab in roleTabs"
            :key="tab.role"
            class="role-tab press"
            :class="{ on: inviteRole === tab.role, solo: roleTabs.length === 1 }"
            hover-class="press-on"
            hover-stay-time="80"
            @click="pickRole(tab.role)"
          >{{ tab.label }}</view>
        </view>
        <text class="hint">{{ INVITE_ROLE_HINT[inviteRole] }}</text>
        <view class="code-box">
          <template v-if="!loaded">
            <view class="sk sk-line code-sk" style="width: 88px" />
            <view class="sk code-sk" style="width: 168px; height: 30px; margin-top: 10px" />
            <view class="sk sk-line code-sk" style="width: 140px; margin-top: 10px" />
            <view class="sk" style="height: 44px; margin-top: 14px; border-radius: 14px" />
          </template>
          <template v-else-if="current">
            <text class="code-label">邀请码 · {{ FAMILY_ROLE_LABEL[current.role] }}</text>
            <text class="code press" hover-class="press-on" hover-stay-time="80" @click="copyCode(current.code)">{{ formatInviteCode(current.code) }}</text>
            <text class="muted">{{ expireLabel(current.expireAt) }} · 已用 {{ current.usedCount }}/{{ current.maxUses }}</text>
            <button hover-class="press-on" hover-stay-time="80" class="btn share-btn" open-type="share" :data-code="current.code">
              <AppIcon name="share" tone="white" :size="17" />
              <text>发给微信好友</text>
            </button>
          </template>
          <template v-else>
            <text class="muted">{{ inviting ? '正在生成邀请码…' : '还没有可用的邀请码' }}</text>
            <button hover-class="press-on" hover-stay-time="80" class="btn share-btn" :disabled="Boolean(inviting)" @click="invite(inviteRole)">
              {{ inviting ? '生成中…' : '生成邀请码' }}
            </button>
          </template>
        </view>
        <view v-for="item in others" :key="item.code" class="invite-row">
          <view class="invite-copy">
            <text class="invite-title">{{ formatInviteCode(item.code) }} · {{ FAMILY_ROLE_LABEL[item.role] }}</text>
            <text class="invite-meta">{{ expireLabel(item.expireAt) }} · 已用 {{ item.usedCount }}/{{ item.maxUses }}</text>
          </view>
          <button
            hover-class="press-on"
            hover-stay-time="80"
            class="share-icon"
            open-type="share"
            :data-code="item.code"
          >
            <AppIcon name="share" tone="accent" :size="17" />
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.family-page { padding-bottom: 48px; }
.role-card { display: flex; align-items: center; gap: 12px; margin-bottom: 22px; }
.role-copy { flex: 1; min-width: 0; }
.role-name {
  display: block;
  margin: 6px 0 8px;
  color: var(--ink);
  font-size: 22px;
  font-weight: 800;
}
.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 8px 2px 10px;
}
.h2 { font-size: 17px; font-weight: 800; }
.list { padding: 6px 14px; }
.member {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
}
.member:last-child { border-bottom: 0; }
.avatar {
  display: flex;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  color: #fff;
  font-weight: 800;
  background: #8c93a3;
}
.avatar.photo { flex: 0 0 auto; background: var(--surface-2); }
.avatar.owner { background: linear-gradient(135deg, #ffb45c, #f15a36); }
.avatar.parent { background: linear-gradient(135deg, #5d9cff, #3c6fe0); }
.avatar.viewer { background: linear-gradient(135deg, #39c6a4, #1fa98c); }
.avatar.pickable {
  flex: 0 0 auto;
  padding: 0;
  line-height: 40px;
}
.avatar.pickable.busy { opacity: 0.6; }
.member-copy { flex: 1; min-width: 0; }
.avatar-sk { width: 40px; height: 40px; border-radius: 14px; }
.code-sk { margin-left: auto; margin-right: auto; }
.name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.name {
  overflow: hidden;
  font-size: 15px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.name-tag {
  flex: 0 0 auto;
  padding: 1px 7px;
  border-radius: 999px;
  color: #f15a36;
  background: rgba(255, 122, 69, 0.12);
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
}
.name-self {
  flex: 0 0 auto;
  color: var(--muted);
  font-size: 13px;
}
.ghost {
  flex: 0 0 auto;
  padding: 6px 10px;
  color: #ed5d6e;
  background: var(--danger-soft);
  border-radius: 999px;
  font-size: 12px;
}
.role-tabs {
  position: relative;
  display: flex;
  padding: 4px;
  border-radius: 16px;
  background: var(--bg);
}
.role-thumb {
  position: absolute;
  top: 4px;
  left: 4px;
  width: calc(50% - 4px);
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, #ffb45c 0%, #ff7a45 48%, #f15a36 100%);
  box-shadow: 0 8px 18px -8px rgba(255, 122, 69, 0.6);
  transition: transform 0.42s cubic-bezier(0.32, 0.72, 0, 1);
}
.role-thumb.right { transform: translateX(100%); }
.role-tab {
  position: relative;
  z-index: 1;
  flex: 1;
  height: 40px;
  line-height: 40px;
  border-radius: 12px;
  color: var(--muted);
  font-size: 14px;
  font-weight: 700;
  text-align: center;
  transition: color 0.3s ease, transform 0.46s cubic-bezier(0.34, 1.4, 0.64, 1);
}
.role-tab.on { color: #fff; }
.role-tab.solo.on {
  background: linear-gradient(135deg, #ffb45c 0%, #ff7a45 48%, #f15a36 100%);
}
.share-btn {
  gap: 6px;
  width: 100%;
  margin-top: 12px;
}
.invite-copy { flex: 1; min-width: 0; }
.invite-title {
  display: block;
  overflow: hidden;
  color: var(--ink);
  font-size: 15px;
  font-weight: 700;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.invite-meta {
  display: block;
  margin-top: 2px;
  overflow: hidden;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.share-icon {
  display: flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: var(--accent-soft);
}
.hint {
  display: block;
  margin-top: 12px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}
.code-box {
  margin-top: 16px;
  padding: 16px;
  border-radius: 18px;
  background: var(--bg);
  text-align: center;
}
.code-label {
  display: block;
  color: var(--accent-text);
  font-size: 11px;
  font-weight: 700;
}
.code {
  display: block;
  margin: 8px 0 6px;
  color: var(--ink);
  font-size: 28px;
  font-weight: 800;
  letter-spacing: 0.12em;
}
.invite-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}
.eyebrow {
  display: block;
  color: var(--accent-text);
  font-size: 11px;
  font-weight: 700;
}
</style>
