import { needsFamily } from '@/stores/family'
import { promptLogin } from '@/utils/login-prompt'

/**
 * 审核要求先体验、提交时才引导：页面和表单都能打开，只有真正要写入云端时调用。
 * 还没有家庭时弹一次引导并返回 true，调用方直接结束这次提交。
 * 本机标记被清掉、身份还在向云端确认时也先放行，由 store 按 openid 恢复后再决定要不要引导创建。
 */
export function needFamily() {
  if (!needsFamily()) return false
  promptLogin()
  return true
}
