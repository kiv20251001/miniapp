import { callCloud } from '@/cloud/call'
import { REMIND_TEMPLATE_FIELDS, REMIND_TEMPLATE_ID, type RemindTemplate } from '@/domain/remind'

let task: Promise<RemindTemplate> | null = null

/** 点闹钟之前就要拿到模板 ID。同一次打开只问一次云端。 */
export function loadRemindTemplate() {
  if (!task) {
    task = (REMIND_TEMPLATE_ID
      ? Promise.resolve({ id: REMIND_TEMPLATE_ID, fields: { ...REMIND_TEMPLATE_FIELDS } })
      : callCloud<RemindTemplate>('remindTemplate')
    ).catch((error: unknown) => {
      task = null
      throw error
    })
  }
  return task
}
