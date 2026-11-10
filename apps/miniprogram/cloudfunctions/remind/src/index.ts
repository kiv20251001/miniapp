import cloud from 'wx-server-sdk'
import { tickReminders } from '../../../cloud-shared/remind'

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

/** 定时器传 `Type: 'Timer'`。云端测试可传 `{ "force": true }` 立刻试发今天还没开始的课。 */
export async function main(event: { Type?: string; TriggerName?: string; force?: boolean }) {
  console.log('[remind] invoke', event?.Type || 'manual', event?.TriggerName || '')
  try {
    return { ok: true, ...(await tickReminders({ force: event?.force === true })) }
  } catch (error) {
    const message = error instanceof Error ? error.message : '提醒扫描失败'
    console.error('[remind]', message)
    return { ok: false, message }
  }
}
