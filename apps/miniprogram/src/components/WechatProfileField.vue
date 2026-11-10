<script setup lang="ts">
import { TEXT_LIMIT } from '@/domain/limits'
import AppIcon from './AppIcon.vue'

/**
 * 勾选后用微信原生能力选头像（chooseAvatar）、填昵称（type="nickname"）。
 * 审核不允许强制授权，所以能取消勾选；默认勾上，方便家里人认出是谁。
 */
defineProps<{
  enabled: boolean
  avatar: string
  nickName: string
}>()

const emit = defineEmits<{
  'update:enabled': [value: boolean]
  'update:avatar': [value: string]
  'update:nickName': [value: string]
}>()

function onChooseAvatar(event: { detail?: { avatarUrl?: string } }) {
  const url = event.detail?.avatarUrl
  if (url) emit('update:avatar', url)
}

/** 选微信昵称时有时只触发 blur，不触发 input，两个都接。 */
function onNickname(event: { detail?: { value?: string } }) {
  emit('update:nickName', event.detail?.value ?? '')
}
</script>

<template>
  <view class="wechat-profile">
    <view v-if="enabled" class="row">
      <button class="avatar press" :class="{ picked: avatar }" hover-class="press-on" hover-stay-time="80" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
        <image v-if="avatar" class="avatar-image" :src="avatar" mode="aspectFill" />
        <AppIcon v-else name="image" tone="accent" :size="22" />
      </button>
      <input
        class="nick"
        type="nickname"
        :value="nickName"
        :maxlength="TEXT_LIMIT.nickName"
        placeholder="点击使用微信昵称"
        placeholder-class="ph"
        @input="onNickname"
        @blur="onNickname"
      />
    </view>
    <view class="check press" hover-class="press-on" hover-stay-time="80" @click="emit('update:enabled', !enabled)">
      <view class="box" :class="{ on: enabled }"><text v-if="enabled" class="tick">✓</text></view>
      <text class="check-label">使用微信头像和昵称，方便家人认出你</text>
    </view>
  </view>
</template>

<style scoped>
.wechat-profile { margin-bottom: 16px; }
.check {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}
.box {
  display: flex;
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border: 1.5px solid var(--faint);
  border-radius: 6px;
  transition: background 0.2s ease, border-color 0.2s ease;
}
.box.on {
  border-color: #ff7a45;
  background: linear-gradient(135deg, #ffb45c 0%, #ff7a45 48%, #f15a36 100%);
}
.tick {
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
}
.check-label {
  color: var(--muted);
  font-size: 13px;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  animation: row-in 0.28s cubic-bezier(0.32, 0.72, 0, 1);
}
.avatar {
  display: flex;
  width: 46px;
  height: 46px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 0;
  border: 1.5px dashed rgba(255, 122, 69, 0.55);
  border-radius: 16px;
  background: var(--accent-soft);
}
.avatar.picked {
  border-style: solid;
  border-color: transparent;
  background: var(--paper);
  box-shadow: var(--elev-sm);
}
.avatar::after { border: 0; }
.avatar-image {
  width: 46px;
  height: 46px;
}
.nick {
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  min-height: 44px;
  padding: 11px 12px;
  border-radius: 14px;
  color: var(--ink);
  background: var(--field-bg);
  box-shadow: inset 0 0 0 1px var(--line), 0 4px 12px -8px rgba(25, 31, 58, 0.22);
  font-size: 15px;
}
.check.press-on,
.avatar.press-on {
  transition: transform 0.12s cubic-bezier(0.2, 0, 0.2, 1);
  transform: scale(0.96);
}
@keyframes row-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
