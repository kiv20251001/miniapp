import cloud from 'wx-server-sdk'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import type { AppSnapshot } from '../../../server/src/domain/types'
import { occurrencesOnDate } from '../../../server/src/domain/schedule'
import { FamilyActionError } from '../../../server/src/workspace/family-actions'
import {
  parseTemplateContent,
  REMIND_TEMPLATE_FIELDS,
  REMIND_TEMPLATE_ID,
  remindFieldValue,
  type RemindFields,
  type RemindTemplate,
} from '../src/domain/remind'

dayjs.extend(utc)
dayjs.extend(timezone)

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = () => cloud.database()
const reminders = () => db().collection('reminders')

export interface ReminderRow {
  _id?: string
  openid: string
  familyId: string
  courseId: string
  date: string
  envVersion?: string
  templateId?: string
  fields?: RemindFields
  status: 'pending' | 'sent' | 'skipped' | 'noquota'
}

let templateCache: RemindTemplate | null = null

function errorText(error: unknown) {
  const value = error as { errCode?: number; errcode?: number; errMsg?: string; message?: string } | undefined
  return `${value?.errCode ?? value?.errcode ?? ''} ${value?.errMsg ?? ''} ${value?.message ?? ''}`
}

function isCollectionMissing(error: unknown) {
  return /-502005|DATABASE_COLLECTION_NOT_EXIST|collection not exist/i.test(errorText(error))
}

export async function ensureReminders() {
  try {
    await db().createCollection('reminders')
  } catch (error) {
    if (/already exist|DATABASE_COLLECTION_ALREADY_EXIST|-501001|Table exist/i.test(errorText(error))) return
    throw error
  }
}

function shanghaiNow() {
  return dayjs().tz('Asia/Shanghai')
}

export function minutesUntil(date: string, startTime: string) {
  const start = dayjs.tz(`${date} ${startTime}`, 'YYYY-MM-DD HH:mm', 'Asia/Shanghai')
  return start.diff(dayjs(), 'minute')
}

function reminderId(openid: string, courseId: string, date: string) {
  return `${openid}_${courseId}_${date}`.replace(/[^\w-]/g, '').slice(0, 200)
}

function mpState(envVersion: string | undefined) {
  if (envVersion === 'develop') return 'developer'
  if (envVersion === 'trial') return 'trial'
  return 'formal'
}

async function loadSnapshot(familyId: string) {
  try {
    const got = await db().collection('families').doc(familyId).get()
    const raw = got.data as { snapshotJson?: string } | undefined
    if (!raw?.snapshotJson) return null
    return JSON.parse(raw.snapshotJson) as AppSnapshot
  } catch {
    return null
  }
}

function findOccurrence(snapshot: AppSnapshot, courseId: string, date: string) {
  return occurrencesOnDate(snapshot.courses, date, snapshot.scheduleExceptions)
    .find((item) => item.course.id === courseId) ?? null
}

function extractTemplates(result: unknown) {
  const body = result as { data?: unknown; result?: unknown } | unknown[] | null
  const list = Array.isArray(body)
    ? body
    : Array.isArray((body as { data?: unknown })?.data)
      ? (body as { data: unknown[] }).data
      : Array.isArray((body as { result?: { data?: unknown[] } })?.result?.data)
        ? (body as { result: { data: unknown[] } }).result.data
        : []
  return list.filter((item) => item && typeof item === 'object') as Array<{ priTmplId?: string; content?: string; title?: string }>
}

async function fetchTemplateList() {
  const api = cloud as unknown as {
    open?: { callOpenAPI?: (options: { api: string }) => Promise<{ result?: unknown }> }
    openapi: Record<string, Record<string, (data?: object) => Promise<unknown>>>
  }
  const attempts = [
    () => api.openapi.subscribeMessage.getTemplateList({}),
    () => api.openapi.wxaapi.newtmpl.gettemplate({}),
    () => api.openapi.newtmpl.gettemplate({}),
    () => api.openapi.subscribeMessage.getTemplate({}),
    async () => (await api.open?.callOpenAPI?.({ api: 'wxaapi.newtmpl.gettemplate' }))?.result,
  ]
  let last: unknown
  for (const run of attempts) {
    try {
      const list = extractTemplates(await run())
      if (list.length) return list
    } catch (error) {
      last = error
    }
  }
  if (last) throw last
  return []
}

export async function resolveRemindTemplate(): Promise<RemindTemplate> {
  if (REMIND_TEMPLATE_ID) {
    return { id: REMIND_TEMPLATE_ID, fields: { ...REMIND_TEMPLATE_FIELDS } }
  }
  if (templateCache) return templateCache
  const list = await fetchTemplateList()
  for (const item of list) {
    const fields = item.content ? parseTemplateContent(item.content) : null
    if (item.priTmplId && fields) {
      templateCache = { id: item.priTmplId, fields }
      return templateCache
    }
  }
  const only = list.length === 1 ? list[0] : undefined
  const fallback = only?.content ? parseTemplateContent(only.content) : null
  if (only?.priTmplId && fallback) {
    templateCache = { id: only.priTmplId, fields: fallback }
    return templateCache
  }
  throw new FamilyActionError('TEMPLATE_MISSING', '还没有可用的课前提醒模板')
}

export async function listReminders(openid: string) {
  await ensureReminders()
  const today = shanghaiNow().format('YYYY-MM-DD')
  try {
    const found = await reminders().where({ openid }).limit(100).get()
    const rows = (found.data || []) as ReminderRow[]
    return rows
      .filter((item) => (item.status === 'pending' || item.status === 'sent') && item.date >= today)
      .map((item) => ({ courseId: item.courseId, date: item.date, status: item.status }))
  } catch (error) {
    if (isCollectionMissing(error)) return []
    throw error
  }
}

export async function subscribeReminder(
  user: { openid: string; familyId: string },
  payload: Record<string, unknown>,
) {
  const courseId = String(payload.courseId || '')
  const date = String(payload.date || '')
  const envVersion = String(payload.envVersion || '')
  if (!courseId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new FamilyActionError('INVALID_ACTION', '请选择一节课')
  }
  await ensureReminders()
  const snapshot = await loadSnapshot(user.familyId)
  const occurrence = snapshot ? findOccurrence(snapshot, courseId, date) : null
  if (!occurrence) throw new FamilyActionError('OCCURRENCE_GONE', '这节课已取消或不存在')
  const startTime = occurrence.course.recurrence.startTime
  const minutes = minutesUntil(date, startTime)
  if (minutes < 1) throw new FamilyActionError('ALREADY_STARTED', '这节课已经开始了')
  const template = await resolveRemindTemplate().catch(() => null)
  await reminders().doc(reminderId(user.openid, courseId, date)).set({
    data: {
      openid: user.openid,
      familyId: user.familyId,
      courseId,
      date,
      envVersion: envVersion === 'develop' || envVersion === 'trial' ? envVersion : 'release',
      templateId: template?.id || '',
      fields: template?.fields || null,
      status: 'pending',
      createdAt: new Date().toISOString(),
    },
  })
  return { late: minutes < 15 }
}

function rowDocId(row: ReminderRow) {
  return row._id || reminderId(row.openid, row.courseId, row.date)
}

function templateOf(row: ReminderRow, fallback: RemindTemplate | null) {
  if (row.templateId && row.fields?.title && row.fields.time && row.fields.location && row.fields.note) {
    return { id: row.templateId, fields: row.fields }
  }
  return fallback
}

async function sendOne(template: RemindTemplate, row: ReminderRow, title: string, startTime: string, location: string, note: string) {
  const value = (key: string, plain: string, fallback: string) =>
    remindFieldValue(key, plain, fallback, row.date, startTime)
  const data: Record<string, { value: string }> = {
    [template.fields.title]: { value: value(template.fields.title, title, '课程') },
    [template.fields.time]: { value: value(template.fields.time, startTime, startTime) },
    [template.fields.location]: { value: value(template.fields.location, location, '地点待定') },
    [template.fields.note]: { value: value(template.fields.note, note, '无') },
  }
  const api = cloud as unknown as {
    openapi: { subscribeMessage: { send: (input: Record<string, unknown>) => Promise<unknown> } }
  }
  await api.openapi.subscribeMessage.send({
    touser: row.openid,
    templateId: template.id,
    page: 'pages/home/index?tab=today',
    miniprogramState: mpState(row.envVersion),
    lang: 'zh_CN',
    data,
  })
}

function skip(id: string, reason: string) {
  return reminders().doc(id).update({
    data: { status: 'skipped', skipReason: reason, updatedAt: new Date().toISOString() },
  })
}

/**
 * 每 5 分钟跑一次。只在上课前 1–18 分钟内发送，正常会落在提前约 15 分钟。
 * `force` 只给云端测试用：今天还没开始的课立刻发，不等 15 分钟窗口，会用掉那次额度。
 */
export async function tickReminders(options: { force?: boolean } = {}) {
  await ensureReminders()
  let fallback: RemindTemplate | null = null
  try {
    fallback = await resolveRemindTemplate()
    console.log('[remind] template', fallback.id, fallback.fields)
  } catch (error) {
    console.error('[remind] template', error instanceof Error ? error.message : errorText(error))
  }
  const today = shanghaiNow().format('YYYY-MM-DD')
  const found = await reminders().where({ status: 'pending' }).limit(100).get()
  const rows = (found.data || []) as ReminderRow[]
  const families = new Map<string, AppSnapshot | null>()
  const report: Array<Record<string, unknown>> = []
  let sent = 0
  let skipped = 0
  for (const row of rows) {
    const id = rowDocId(row)
    const entry: Record<string, unknown> = { id, courseId: row.courseId, date: row.date, envVersion: row.envVersion }
    report.push(entry)
    if (row.date < today) {
      await skip(id, 'past-date')
      skipped += 1
      entry.result = 'skipped: 日期已过'
      continue
    }
    if (row.date > today) {
      entry.result = 'wait: 不是今天'
      continue
    }
    let snapshot = families.get(row.familyId)
    if (snapshot === undefined) {
      snapshot = await loadSnapshot(row.familyId)
      families.set(row.familyId, snapshot)
    }
    const occurrence = snapshot ? findOccurrence(snapshot, row.courseId, row.date) : null
    if (!occurrence) {
      await skip(id, 'occurrence-gone')
      skipped += 1
      entry.result = 'skipped: 课已取消或不存在'
      continue
    }
    const startTime = occurrence.course.recurrence.startTime
    const minutes = minutesUntil(row.date, startTime)
    entry.startTime = startTime
    entry.minutesUntil = minutes
    if (minutes > 18 && !options.force) {
      console.log('[remind] wait', row.courseId, startTime, `in ${minutes}m`)
      entry.result = `wait: 还有 ${minutes} 分钟，进入课前 18 分钟后才发`
      continue
    }
    if (minutes < 1) {
      await skip(id, 'started')
      skipped += 1
      console.log('[remind] skipped late', row.courseId, startTime, minutes)
      entry.result = 'skipped: 已经开课'
      continue
    }
    const template = templateOf(row, fallback)
    if (!template) {
      console.error('[remind] no template', row.courseId)
      await reminders().doc(id).update({ data: { lastError: 'no template', triedAt: new Date().toISOString() } })
      entry.result = 'error: 没有模板 ID'
      continue
    }
    entry.templateId = template.id
    entry.fields = template.fields
    try {
      await sendOne(
        template,
        row,
        occurrence.course.title,
        startTime,
        occurrence.course.location,
        occurrence.course.note,
      )
      await reminders().doc(id).update({ data: { status: 'sent', sentAt: new Date().toISOString() } })
      sent += 1
      entry.result = 'sent'
    } catch (error) {
      const code = Number((error as { errCode?: number; errcode?: number }).errCode
        ?? (error as { errcode?: number }).errcode
        ?? 0)
      const detail = errorText(error).trim()
      await reminders().doc(id).update({
        data: {
          ...(code === 43101 ? { status: 'noquota' } : {}),
          lastError: detail,
          triedAt: new Date().toISOString(),
        },
      })
      console.error('[remind] send failed', row.courseId, detail)
      entry.result = `error: ${detail}`
    }
  }
  console.log(`[remind] sent=${sent} skipped=${skipped} pending=${rows.length}`)
  return { sent, skipped, today, template: fallback, rows: report }
}
