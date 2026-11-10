<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import { appShare, isMomentsPreview, momentsShare } from '@/utils/share'
import { CHILD_AVATAR_OPTIONS } from '@server-domain/constants'
import type { ChildAvatarKey } from '@server-domain/types'
import { showCloudError, uploadAvatar } from '@/cloud/call'
import ChildAvatar from '@/components/ChildAvatar.vue'
import { ensureSession, hasLocalSession, useFamilyStore } from '@/stores/family'
import { usePageBackground, useThemePage } from '@/utils/wx-theme'
import { FAMILY_ROLE_LABEL, normalizeInviteCode } from '@/domain/family-account'
import { avatarDefaultName } from '@/domain/avatar-names'
import { TEXT_LIMIT } from '@/domain/limits'
import { cleanText, formTip } from '@/utils/form'
import { openTab } from '@/utils/nav'
import { capsuleBox, statusBarHeight } from '@/utils/system'
import ThemeToggle from '@/components/ThemeToggle.vue'
import WechatProfileField from '@/components/WechatProfileField.vue'

const store = useFamilyStore()
const themeClass = useThemePage()
onShareAppMessage(appShare)
onShareTimeline(momentsShare)
const pageBg = usePageBackground()
const statusBar = statusBarHeight()
const capsule = capsuleBox()
const toggleStyle = {
  top: `${capsule.top + capsule.height / 2 - 19}px`,
  right: `${capsule.inset + 6}px`,
}
const avatarOptions = CHILD_AVATAR_OPTIONS
const mode = ref<'create' | 'join'>('create')
const childName = ref('')
const avatarKey = ref<ChildAvatarKey>('boy-blue')
const inviteCode = ref('')
/** 家里的称呼，加入家庭时填。 */
const displayName = ref('')
const useWechat = ref(true)
const nickName = ref('')
/** 刚选的头像是本地临时路径，提交时才传到云存储；已有家庭时预填 cloud:// 文件 ID。 */
const userAvatar = ref('')
const submitting = ref(false)
/** 身份还没从云端确认时先显示骨架，避免本地标记被清掉后先闪创建表单。 */
const booting = ref(!store.ready)
let resuming = false
/** 选头像等系统页返回也会触发 onShow，同一个邀请码只向云端确认一次。 */
let checkedInvite = ''
const childPlaceholder = computed(() => avatarDefaultName(avatarKey.value))

onLoad((query) => {
  const invite = typeof query?.invite === 'string' ? normalizeInviteCode(query.invite) : ''
  if (!invite) return
  inviteCode.value = invite
  mode.value = 'join'
  if (!store.ready) booting.value = true
})

onShow(() => {
  if (isMomentsPreview()) return
  if (inviteCode.value) {
    if (checkedInvite !== inviteCode.value) {
      checkedInvite = inviteCode.value
      void skipJoinedInvite(inviteCode.value)
    }
    if (store.ready && !displayName.value && !Object.values(FAMILY_ROLE_LABEL).includes(store.displayName)) {
      displayName.value = store.displayName
    }
    if (store.ready && !nickName.value) nickName.value = store.nickName
    if (store.ready && !userAvatar.value) userAvatar.value = store.avatarUrl
    return
  }
  if (store.ready) {
    openTab('today')
    return
  }
  if (resuming) return
  resuming = true
  booting.value = true
  ensureSession().then(() => {
    if (store.ready) openTab('today')
    else booting.value = false
  }).finally(() => {
    resuming = false
  })
})

/**
 * 「重新进入小程序」会按原入口重开，从邀请卡片进来的家人又会落到这里。
 * 已经在邀请对应的家庭，或本机有家庭而邀请已失效时，直接回课表；邀请别的家庭才显示加入表单。
 */
async function skipJoinedInvite(code: string) {
  if (!store.ready) await ensureSession()
  const known = store.ready
  let status = 'invalid'
  try {
    status = (await store.previewInvite(code)).status
  } catch {
    // 邀请失效或网络失败，按「invalid」处理。
  }
  if (status === 'same' || (status === 'invalid' && known)) {
    if (store.ready) {
      openTab('today')
      return
    }
  }
  booting.value = false
}

function showCreate() {
  mode.value = 'create'
}

function showJoin() {
  mode.value = 'join'
}

function pickAvatar(key: ChildAvatarKey) {
  avatarKey.value = key
}

function onCodeInput(event: { detail?: { value?: string } }) {
  inviteCode.value = normalizeInviteCode(event.detail?.value || '')
}

/** 没勾选微信资料时只带称呼；勾选了再带昵称和头像，头像先传到云存储。 */
async function memberProfile() {
  const profile = { displayName: cleanText(displayName.value, TEXT_LIMIT.displayName) }
  if (!useWechat.value) return profile
  let avatarUrl = userAvatar.value
  if (avatarUrl && !avatarUrl.startsWith('cloud://')) {
    avatarUrl = await uploadAvatar(avatarUrl)
    userAvatar.value = avatarUrl
  }
  return {
    ...profile,
    nickName: cleanText(nickName.value, TEXT_LIMIT.nickName),
    avatarUrl,
  }
}

function alertJoin(title: string, content: string) {
  return new Promise<void>((resolve) => {
    uni.showModal({
      title,
      content,
      showCancel: false,
      confirmText: '知道了',
      success: () => resolve(),
    })
  })
}

function askJoin(title: string, content: string) {
  return new Promise<boolean>((resolve) => {
    uni.showModal({
      title,
      content,
      confirmText: '仍然加入',
      cancelText: '先留下',
      confirmColor: '#ff7a45',
      success: (result) => resolve(Boolean(result.confirm)),
    })
  })
}

/** 从哪个页面点进来就回哪里，表单还在，可以接着提交；直接打开的登录页回今日。 */
function leave() {
  if (getCurrentPages().length > 1) uni.navigateBack()
  else openTab('today')
}

function cancel() {
  if (submitting.value) return
  leave()
}

async function stayHome() {
  if (submitting.value) return
  submitting.value = true
  try {
    if (!store.ready) await ensureSession()
  } finally {
    submitting.value = false
  }
  if (store.ready) openTab('today')
}

/** 已有家庭时先说明后果。返回 false 表示这次不加入。 */
async function confirmJoin(code: string) {
  if (!store.ready) await ensureSession()
  if (!store.ready) return true
  const preview = await store.previewInvite(code)
  if (preview.status === 'new') return true
  if (preview.status === 'same') {
    await alertJoin('你已经在这个家庭里', '不用重复加入，直接进入当前课表。')
    return false
  }
  if (preview.status === 'blocked') {
    await alertJoin('暂时不能加入', '请先让其他成员退出后再加入别的家庭。')
    return false
  }
  const content = preview.status === 'replace'
    ? '加入后将改用对方的家庭。你现在这份课程和账单会被清除，且无法恢复。'
    : '加入后将离开当前家庭，改用对方的课表。当前家庭的课程仍留给其他成员。'
  return askJoin('加入对方的家庭', content)
}

async function submit() {
  if (submitting.value) return
  submitting.value = true
  try {
    if (mode.value === 'join') {
      const code = normalizeInviteCode(inviteCode.value)
      if (code.length < 6) {
        formTip(code ? '邀请码是 6 位字母或数字' : '请填写邀请码')
        return
      }
      const proceed = await confirmJoin(code)
      if (!proceed) {
        if (store.ready) openTab('today')
        return
      }
      await store.joinFamily(code, await memberProfile())
    } else {
      if (!store.ready) await ensureSession()
      if (store.ready) {
        leave()
        return
      }
      const profile = await memberProfile()
      await store.login(cleanText(childName.value, TEXT_LIMIT.childName) || childPlaceholder.value, avatarKey.value, profile)
    }
    leave()
  } catch (error) {
    showCloudError(error)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <page-meta :page-style="pageBg.style" :background-color="pageBg.bg" :background-color-top="pageBg.bg" :background-color-bottom="pageBg.bg" :root-background-color="pageBg.bg" :background-text-style="pageBg.text" />
  <view class="theme-root login" :class="themeClass" :style="{ paddingTop: statusBar + 'px' }">
    <view class="login-bar" :style="toggleStyle">
      <ThemeToggle />
    </view>
    <view class="stage">
      <view class="mark"><image class="mark-glyph" src="/static/logo-u.svg" mode="aspectFit" /></view>
      <view class="word">Uday</view>
      <view class="slogan">Plan Your Day. Grow Your Way.</view>
    </view>

    <view v-if="booting" class="panel">
      <view class="sk boot-modes" />
      <view class="boot-form">
        <view class="picks">
          <view v-for="n in 4" :key="n" class="sk boot-pick" />
        </view>
        <view class="sk sk-line boot-label" />
        <view class="sk boot-field" />
        <view class="sk boot-submit"><text class="boot-text">正在进入…</text></view>
      </view>
    </view>
    <view v-else class="panel">
      <view class="modes">
        <view class="mode-thumb" :class="{ join: mode === 'join' }" />
        <view class="mode-tab press" :class="{ on: mode === 'create' }" hover-class="press-on" hover-stay-time="80" @click="showCreate">创建家庭</view>
        <view class="mode-tab press" :class="{ on: mode === 'join' }" hover-class="press-on" hover-stay-time="80" @click="showJoin">加入家庭</view>
      </view>

      <view class="forms">
        <view v-if="mode === 'create'" class="form">
          <view class="field-label">孩子头像</view>
          <view class="picks">
            <view
              v-for="option in avatarOptions"
              :key="option.key"
              class="pick press"
              :class="{ on: avatarKey === option.key }"
              hover-class="press-on"
              hover-stay-time="80"
              @click="pickAvatar(option.key)"
            >
              <ChildAvatar :avatar-key="option.key" :size="56" />
            </view>
          </view>
          <view class="field">
            <view class="field-label">孩子名字</view>
            <input v-model="childName" :maxlength="TEXT_LIMIT.childName" :placeholder="childPlaceholder" placeholder-class="ph" />
          </view>
          <WechatProfileField v-model:enabled="useWechat" v-model:avatar="userAvatar" v-model:nick-name="nickName" />
          <view class="submit press" :class="{ busy: submitting }" hover-class="press-on" hover-stay-time="80" @click="submit">
            <text class="submit-label">{{ submitting ? '进入中…' : '创建并进入' }}</text>
          </view>
          <view class="cancel press" hover-class="press-on" hover-stay-time="80" @click="cancel">
            <text class="cancel-label">取消创建</text>
          </view>
        </view>

        <view v-else class="form join-form">
          <view class="field">
            <view class="field-label">邀请码<text class="req">*</text></view>
            <input :value="inviteCode" :maxlength="TEXT_LIMIT.inviteCode" placeholder="例如 AB12CD" placeholder-class="ph" @input="onCodeInput" />
          </view>
          <view class="field">
            <view class="field-label">你的称呼</view>
            <input v-model="displayName" :maxlength="TEXT_LIMIT.displayName" placeholder="爸爸/妈妈/爷爷/奶奶" placeholder-class="ph" />
          </view>
          <WechatProfileField v-model:enabled="useWechat" v-model:avatar="userAvatar" v-model:nick-name="nickName" />
          <view class="submit press" :class="{ busy: submitting }" hover-class="press-on" hover-stay-time="80" @click="submit">
            <text class="submit-label">{{ submitting ? '加入中…' : '加入家庭' }}</text>
          </view>
          <text v-if="store.ready || hasLocalSession()" class="stay" @click="stayHome">回到我的课表</text>
          <view v-else class="cancel press" hover-class="press-on" hover-stay-time="80" @click="cancel">
            <text class="cancel-label">暂不加入</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.login {
  position: relative;
  box-sizing: border-box;
  display: flex;
  width: 100%;
  min-height: 100vh;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 28px 28px 48px;
}

.login-bar {
  position: absolute;
  z-index: 2;
}

.stage {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: center;
  margin-bottom: 36px;
  text-align: center;
}

.mark {
  display: flex;
  width: 84px;
  height: 84px;
  align-items: center;
  justify-content: center;
  color: #fff;
  border-radius: 28px;
  background: linear-gradient(135deg, #ffb45c 0%, #ff7a45 48%, #f15a36 100%);
  box-shadow: 0 18px 32px -14px rgba(255, 122, 69, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

.mark-glyph {
  display: block;
  width: 44px;
  height: 42px;
}

.word {
  margin-top: 16px;
  color: var(--ink);
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.04em;
}

.slogan {
  margin-top: 6px;
  color: var(--muted);
  font-size: 13px;
}

.boot-modes {
  height: 44px;
  margin-bottom: 22px;
  border-radius: 16px;
}
.boot-form {
  display: flex;
  height: 240px;
  flex-direction: column;
}
.boot-pick {
  width: 72px;
  height: 72px;
  border-radius: 24px;
}
.boot-label {
  width: 64px;
  margin-bottom: 10px;
}
.boot-field {
  height: 48px;
  border-radius: 14px;
}
.boot-submit {
  height: 48px;
  margin-top: auto;
  border-radius: 14px;
  text-align: center;
}
.boot-text {
  line-height: 48px;
  color: var(--muted);
  font-size: 14px;
}

.panel {
  width: 100%;
  max-width: 360px;
  box-sizing: border-box;
}

.modes {
  position: relative;
  display: flex;
  width: 100%;
  margin-bottom: 22px;
  padding: 4px;
  box-sizing: border-box;
  border-radius: 16px;
  background: var(--paper);
  box-shadow: var(--elev-sm);
}
.mode-thumb {
  position: absolute;
  top: 4px;
  left: 4px;
  width: calc(50% - 4px);
  height: 36px;
  border-radius: 12px;
  background: var(--accent-soft);
  transition: transform 0.42s cubic-bezier(0.32, 0.72, 0, 1);
}
.mode-thumb.join {
  transform: translateX(100%);
}
.mode-tab {
  position: relative;
  z-index: 1;
  flex: 1;
  height: 36px;
  line-height: 36px;
  color: var(--muted);
  border-radius: 12px;
  font-size: 13px;
  font-weight: 700;
  text-align: center;
}
.mode-tab.on {
  color: var(--accent-text);
}
.form {
  display: flex;
  min-height: 240px;
  flex-direction: column;
  animation: form-in 0.32s cubic-bezier(0.32, 0.72, 0, 1);
}
.stay {
  display: block;
  margin-top: 14px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 650;
  text-align: center;
}
@keyframes form-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
.submit {
  width: 100%;
  height: 48px;
  margin-top: auto;
  box-sizing: border-box;
  border-radius: 14px;
  background: linear-gradient(135deg, #ffb45c 0%, #ff7a45 48%, #f15a36 100%);
  box-shadow: 0 10px 24px -8px rgba(255, 122, 69, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.28);
  text-align: center;
}
.submit-label {
  display: block;
  height: 48px;
  line-height: 48px;
  color: #fff;
  font-size: 16px;
  font-weight: 700;
}
.submit.busy {
  opacity: 0.6;
}
.cancel {
  width: 100%;
  height: 44px;
  margin-top: 10px;
  box-sizing: border-box;
  border-radius: 14px;
  text-align: center;
}
.cancel-label {
  display: block;
  height: 44px;
  line-height: 44px;
  color: var(--muted);
  font-size: 15px;
  font-weight: 650;
}

.picks {
  display: flex;
  justify-content: space-between;
  margin-bottom: 18px;
}
.form > .field-label { margin-bottom: 8px; }

.pick {
  display: flex;
  width: 72px;
  height: 72px;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  border-radius: 24px;
  background: var(--paper);
  box-shadow: var(--elev-sm);
}
.pick.on {
  box-shadow: 0 0 0 2px #ff7a45, var(--elev-sm);
  transform: scale(1.04);
}
.mode-tab.press-on,
.submit.press-on,
.cancel.press-on,
.pick.press-on,
.pick.on.press-on {
  transition: transform 0.12s cubic-bezier(0.2, 0, 0.2, 1);
  transform: scale(0.94);
}

</style>
