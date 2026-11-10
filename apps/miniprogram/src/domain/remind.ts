import config from './remind.config.json'

/**
 * 模板 ID 和 thing 编号只改 `remind.config.json`。
 * 小程序、api 云函数、remind 云函数都读这一份。
 * 改完后在 `apps/miniprogram` 执行 `npm run build:cloud`，再上传 `api` 和 `remind`。
 * 微信发送接口的键名不带 `.DATA`。后台写 `{{thing3.DATA}}`，这里填 `thing3`。
 * 模板 ID 留空时，云函数按后台模板正文识别键名。
 */
export const REMIND_TEMPLATE_ID = config.templateId
export const REMIND_TEMPLATE_FIELDS: RemindFields = config.fields

export interface RemindFields {
  title: string
  time: string
  location: string
  note: string
}

export interface RemindTemplate {
  id: string
  fields: RemindFields
}

const FIELD_LABELS: Record<keyof RemindFields, string[]> = {
  title: ['计划名称', '课程名称', '课程名'],
  time: ['开始时间', '上课时间'],
  location: ['地点', '上课地点'],
  note: ['备注', '温馨提示'],
}

/** 订阅消息 thing 最多约 20 个字，不能为空，也不能带换行。 */
export function clipThing(value: string, fallback: string) {
  const text = Array.from(value.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim())
  const clipped = text.slice(0, 20).join('').trim()
  return clipped || fallback
}

export function remindTimeText(date: string, startTime: string) {
  const [, month, day] = date.split('-')
  return `${Number(month)}月${Number(day)}日 ${startTime}`
}

/**
 * 按字段类型整理发送内容。
 * thing 用原文截断；time、date 必须是「2019年10月1日 15:01」，否则微信返回 47003，消息发不出去。
 */
export function remindFieldValue(key: string, plain: string, fallback: string, date = '', startTime = '') {
  const kind = key.replace(/\d+$/, '')
  if ((kind === 'time' || kind === 'date') && /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(startTime)) {
    const [year, month, day] = date.split('-')
    return `${year}年${Number(month)}月${Number(day)}日 ${startTime}`
  }
  return clipThing(plain, fallback)
}

/** 从模板 content「计划名称:{{thing1.DATA}}」里认出四个字段的键名。 */
export function parseTemplateContent(content: string): RemindFields | null {
  const matches = [...content.matchAll(/([^:\n{：]+)[:：]\{\{(\w+)\.(?:DATA|data)\}\}/g)]
  if (!matches.length) return null
  const fields: Partial<RemindFields> = {}
  for (const [, rawLabel, key] of matches) {
    const label = rawLabel.trim()
    for (const slot of Object.keys(FIELD_LABELS) as (keyof RemindFields)[]) {
      if (FIELD_LABELS[slot].some((item) => label.includes(item))) fields[slot] = key
    }
  }
  if (fields.title && fields.time && fields.location && fields.note) return fields as RemindFields
  if (matches.length >= 4) {
    return {
      title: matches[0][2],
      time: matches[1][2],
      location: matches[2][2],
      note: matches[3][2],
    }
  }
  return null
}
