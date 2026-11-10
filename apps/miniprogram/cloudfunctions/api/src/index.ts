import cloud from 'wx-server-sdk'
import type { AppSnapshot, ChildAvatarKey } from '../../../../../server/src/domain/types'
import { createEmptyFamilySnapshot } from '../../../../../server/src/workspace/empty-snapshot'
import { applyFamilyAction, FamilyActionError } from '../../../../../server/src/workspace/family-actions'
import { createFamilyWorkspace, hourlyBillsNeedRefresh } from '../../../../../server/src/workspace/family-workspace'
import { listReminders, resolveRemindTemplate, subscribeReminder } from '../../../cloud-shared/remind'
import {
  canInviteRole,
  canLeaveFamily,
  canRemoveMember,
  canWriteFamily,
  createInviteCode,
  defaultDisplayName,
  INVITE_MAX_USES,
  inviteExpiresAt,
  isInviteActive,
  isWorkspaceReadAction,
  maskSnapshotForRole,
  normalizeAvatarUrl,
  normalizeInviteCode,
  normalizeInviteRole,
  normalizeRole,
  toInviteView,
  type FamilyInviteRecord,
  type FamilyInviteView,
  type FamilyMemberRecord,
  type FamilyMemberView,
  type FamilyRole,
} from '../../../src/domain/family-account'

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const users = () => db.collection('users')
const families = () => db.collection('families')
const invites = () => db.collection('invites')
const COLLECTIONS = ['users', 'families', 'invites']

function errorText(error: unknown) {
  const value = error as { errCode?: number; errMsg?: string; message?: string } | undefined
  return `${value?.errCode ?? ''} ${value?.errMsg ?? ''} ${value?.message ?? ''}`
}

function isCollectionMissing(error: unknown) {
  return /-502005|DATABASE_COLLECTION_NOT_EXIST|collection not exist/i.test(errorText(error))
}

/** 新环境第一次调用时自动建好集合，不需要在控制台手动建表。 */
async function ensureCollections() {
  for (const name of COLLECTIONS) {
    try {
      await db.createCollection(name)
    } catch (error) {
      if (!/-501001|already exist|DATABASE_COLLECTION_ALREADY_EXIST/i.test(errorText(error))) throw error
    }
  }
}

/** 按字段名限制长度，比前端 maxlength 略宽，只做兜底；其余字符串统一不超过 DEFAULT_TEXT_LIMIT。 */
const TEXT_LIMITS: Record<string, number> = {
  name: 20,
  childName: 20,
  displayName: 16,
  nickName: 20,
  avatarUrl: 300,
  title: 40,
  teacher: 20,
  location: 60,
  note: 300,
  code: 16,
  subject: 20,
  content: 1000,
}
const DEFAULT_TEXT_LIMIT = 200
const UNSAFE_CHARS = /[\u0000-\u001F\u007F\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF<>]/g
/** 从群里粘贴的作业要保留分行。 */
const MULTILINE_KEYS = new Set(['content'])
const UNSAFE_MULTILINE_CHARS = /[\u0000-\u0009\u000B-\u001F\u007F\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF<>]/g

function cleanString(value: string, max: number, multiline = false) {
  const text = multiline
    ? value.replace(/\r\n?/g, '\n').replace(UNSAFE_MULTILINE_CHARS, '').replace(/\n{3,}/g, '\n\n')
    : value.replace(UNSAFE_CHARS, '')
  const chars = Array.from(text.trim())
  return chars.length > max ? chars.slice(0, max).join('').trim() : chars.join('')
}

/** 客户端传来的所有字符串去掉控制字符、零宽字符和尖括号，并限制长度。 */
function sanitizePayload(value: unknown, key = '', depth = 0): unknown {
  if (depth > 8) return undefined
  if (typeof value === 'string') return cleanString(value, TEXT_LIMITS[key] ?? DEFAULT_TEXT_LIMIT, MULTILINE_KEYS.has(key))
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (Array.isArray(value)) return value.slice(0, 500).map((item) => sanitizePayload(item, key, depth + 1))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [field, item] of Object.entries(value as Record<string, unknown>)) {
      if (field.startsWith('$') || field === '__proto__' || field === 'constructor' || field === 'prototype') continue
      out[field] = sanitizePayload(item, field, depth + 1)
    }
    return out
  }
  return value
}

type FamilyDoc = {
  snapshotJson?: string
  version?: number
  ownerOpenid?: string
}

type UserDoc = FamilyMemberRecord & {
  _id?: string
  unionid?: string
}

function fail(code: string, message: string) {
  return { ok: false as const, code, message }
}

function cloneSnapshot(snapshot: AppSnapshot) {
  return JSON.parse(JSON.stringify(snapshot)) as AppSnapshot
}

function raise(code: string, message: string): never {
  throw new FamilyActionError(code, message)
}

function displayNameOf(payload: Record<string, unknown>, role: FamilyRole) {
  const name = String(payload.displayName || '').trim().slice(0, 16)
  return name || defaultDisplayName(role)
}

function nickNameOf(payload: Record<string, unknown>) {
  return String(payload.nickName || '').trim().slice(0, 20)
}

/**
 * 创建或加入时带来的称呼、微信昵称和头像。称呼为空保持原样；
 * 不勾选微信资料时客户端不带 nickName / avatarUrl，原有的也清掉，回到图标加称呼的展示。
 */
async function applyProfile(user: UserDoc, payload: Record<string, unknown>) {
  const name = String(payload.displayName || '').trim().slice(0, 16)
  const nickName = nickNameOf(payload)
  const avatarUrl = normalizeAvatarUrl(payload.avatarUrl)
  const data: Partial<UserDoc> = {}
  if (name && name !== user.displayName) data.displayName = name
  if (nickName !== (user.nickName || '')) data.nickName = nickName
  if (avatarUrl !== (user.avatarUrl || '')) data.avatarUrl = avatarUrl
  if (!user._id || !Object.keys(data).length) return
  await users().doc(user._id).update({ data })
  Object.assign(user, data)
}

async function findUser(openid: string): Promise<UserDoc | null> {
  const found = await users().where({ openid }).limit(1).get()
  const user = found.data?.[0] as UserDoc | undefined
  if (!user?.familyId) return null
  return {
    ...user,
    _id: user._id ? String(user._id) : undefined,
    role: normalizeRole(user.role),
    displayName: user.displayName || defaultDisplayName(normalizeRole(user.role)),
    nickName: user.nickName || '',
    avatarUrl: user.avatarUrl || '',
  }
}

/** 没有成员记录：从没加入过，或者已被移出、已自己退出。客户端据此回到未登录状态。 */
async function requireUser(openid: string) {
  const user = await findUser(openid)
  if (!user) raise('NOT_MEMBER', '你已不在这个家庭中，可以重新创建或加入家庭')
  return user
}

async function loadFamilyDoc(familyId: string) {
  const got = await families().doc(familyId).get()
  const raw = got.data as FamilyDoc | undefined
  if (!raw?.snapshotJson) raise('FAMILY_MISMATCH', '家庭不存在或无权访问')
  return raw
}

async function loadFamily(familyId: string) {
  const family = await loadFamilyDoc(familyId)
  return {
    snapshot: JSON.parse(family.snapshotJson as string) as AppSnapshot,
    version: versionOf(family),
  }
}

/** 返回给客户端的快照都带版本号，客户端切页时拿它问一次有没有变化。 */
async function familyMutation(user: UserDoc, result: unknown) {
  const family = await loadFamily(user.familyId)
  return { snapshot: maskSnapshotForRole(family.snapshot, user.role), result, version: family.version }
}

/**
 * 切页、回到前台时调用。只读一次成员记录和家庭文档，版本号、角色、家庭都没变就只回 changed: false，
 * 不传快照，开销很小；任何一项变了才把完整快照带回去。成员记录不在了由 requireUser 报 NOT_MEMBER。
 */
async function syncFamily(user: UserDoc, payload: Record<string, unknown>) {
  const family = await loadFamily(user.familyId)
  if (hourlyBillsNeedRefresh(family.snapshot)) {
    const healed = await withFamily(user.familyId, (workspace) => {
      workspace.refreshUnpaidSessionAmounts()
    })
    return { changed: true, session: sessionOf(user, healed.snapshot, healed.version) }
  }
  const same = Number(payload.version) === family.version
    && payload.familyId === user.familyId
    && payload.role === user.role
  if (same) return { changed: false }
  return { changed: true, session: sessionOf(user, family.snapshot, family.version) }
}

function sessionOf(user: UserDoc, snapshot: AppSnapshot, version = 0) {
  const role = normalizeRole(user.role)
  return {
    openid: user.openid,
    familyId: user.familyId,
    role,
    displayName: user.displayName || defaultDisplayName(role),
    nickName: user.nickName || '',
    avatarUrl: user.avatarUrl || '',
    snapshot: maskSnapshotForRole(cloneSnapshot(snapshot), role),
    version,
  }
}

function versionOf(family: FamilyDoc) {
  return family.version || 1
}

async function withFamily<T>(familyId: string, apply: (workspace: ReturnType<typeof createFamilyWorkspace>) => T | Promise<T>) {
  return db.runTransaction(async (transaction) => {
    const ref = transaction.collection('families').doc(familyId)
    const got = await ref.get()
    const raw = got.data as FamilyDoc | undefined
    if (!raw?.snapshotJson) raise('FAMILY_MISMATCH', '家庭不存在或无权访问')

    const workspace = createFamilyWorkspace(JSON.parse(raw.snapshotJson) as AppSnapshot)
    const result = await apply(workspace)
    const nextJson = JSON.stringify(workspace.snapshot.value)
    let version = versionOf(raw)
    if (nextJson !== raw.snapshotJson) {
      version += 1
      await ref.update({
        data: {
          snapshotJson: nextJson,
          version,
          updatedAt: new Date().toISOString(),
        },
      })
    }
    return {
      snapshot: JSON.parse(nextJson) as AppSnapshot,
      result: result ?? null,
      version,
    }
  })
}

async function countFamilyMembers(familyId: string) {
  const counted = await users().where({ familyId }).count()
  return counted.total || 0
}

async function listFamilyUsers(familyId: string) {
  const found = await users().where({ familyId }).limit(50).get()
  return (found.data || []) as UserDoc[]
}

async function persistUserRole(user: UserDoc, role: FamilyRole, displayName: string) {
  if (!user._id) return
  if (user.role === role && user.displayName === displayName) return
  await users().doc(user._id).update({
    data: { role, displayName },
  })
  user.role = role
  user.displayName = displayName
}

async function login(openid: string, unionid: string, payload: Record<string, unknown>) {
  const existing = await findUser(openid)
  if (!existing && payload.resume === true) {
    raise('UNAUTHENTICATED', '请先创建或加入家庭')
  }
  if (existing) {
    const family = await loadFamilyDoc(existing.familyId)
    const role = normalizeRole(existing.role, family.ownerOpenid === openid)
    if (payload.resume !== true) await applyProfile(existing, payload)
    const displayName = existing.displayName || defaultDisplayName(role)
    await persistUserRole(existing, role, displayName)
    // 冷启动恢复先只读两份文档，把课表尽快交给客户端；账单校准由首屏完成后的 snapshot 执行。
    if (canWriteFamily(role) && payload.resume !== true) {
      const data = await withFamily(existing.familyId, (workspace) => {
        applyFamilyAction(workspace, 'snapshot', {})
        return null
      })
      return sessionOf({ ...existing, role, displayName }, data.snapshot, data.version)
    }
    return sessionOf({ ...existing, role, displayName }, JSON.parse(family.snapshotJson as string) as AppSnapshot, versionOf(family))
  }

  const childName = String(payload.childName || '').trim().slice(0, 20) || '小U'
  const avatarKey = typeof payload.avatarKey === 'string' ? payload.avatarKey as ChildAvatarKey : undefined
  const snapshot = createEmptyFamilySnapshot(childName, avatarKey)
  const created = await families().add({
    data: {
      name: `${snapshot.children[0]?.name || '小U'}的家庭`,
      timezone: 'Asia/Shanghai',
      ownerOpenid: openid,
      snapshotJson: JSON.stringify(snapshot),
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  })
  const familyId = String(created._id || created.id || '')
  if (!familyId) raise('CLOUD_ERROR', '创建家庭失败')
  const displayName = displayNameOf(payload, 'owner')
  const nickName = nickNameOf(payload)
  const avatarUrl = normalizeAvatarUrl(payload.avatarUrl)
  await users().add({
    data: {
      openid,
      unionid,
      familyId,
      role: 'owner',
      displayName,
      nickName,
      avatarUrl,
      createdAt: new Date().toISOString(),
    },
  })
  return sessionOf({
    openid,
    familyId,
    role: 'owner',
    displayName,
    nickName,
    avatarUrl,
    createdAt: new Date().toISOString(),
  }, snapshot, 1)
}

async function findInvite(code: string): Promise<FamilyInviteRecord | null> {
  const normalized = normalizeInviteCode(code)
  if (!normalized) return null
  try {
    const got = await invites().doc(normalized).get()
    const invite = got.data as FamilyInviteRecord | undefined
    if (!invite?.familyId || !invite.code) return null
    return invite
  } catch {
    return null
  }
}

async function createInvite(user: UserDoc, payload: Record<string, unknown>) {
  const role = normalizeInviteRole(payload.role)
  if (!canInviteRole(user.role, role)) raise('INVITE_FORBIDDEN', '没有邀请这个角色的权限')
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = createInviteCode()
    const record: FamilyInviteRecord = {
      code,
      familyId: user.familyId,
      createdBy: user.openid,
      role,
      expireAt: inviteExpiresAt(),
      maxUses: INVITE_MAX_USES,
      usedCount: 0,
      createdAt: new Date().toISOString(),
    }
    try {
      await db.runTransaction(async (transaction) => {
        const ref = transaction.collection('invites').doc(code)
        let taken = false
        try {
          const got = await ref.get()
          taken = Boolean((got.data as FamilyInviteRecord | undefined)?.code)
        } catch {
          taken = false
        }
        if (taken) throw new Error('INVITE_CODE_TAKEN')
        await ref.set({ data: record })
      })
      return toInviteView(record)
    } catch (error) {
      if (error instanceof Error && error.message === 'INVITE_CODE_TAKEN') continue
      throw error
    }
  }
  raise('CLOUD_ERROR', '生成邀请码失败，请再试一次')
}

async function listFamilyInvites(familyId: string): Promise<FamilyInviteView[]> {
  const found = await invites().where({ familyId }).limit(50).get()
  const now = Date.now()
  return ((found.data || []) as FamilyInviteRecord[])
    .map((invite) => toInviteView(invite, now))
    .filter((invite) => !invite.expired)
    .sort((left, right) => left.expireAt.localeCompare(right.expireAt))
}

function toMemberViews(records: UserDoc[], openid: string): FamilyMemberView[] {
  const rank: Record<FamilyRole, number> = { owner: 0, parent: 1, viewer: 2 }
  return records
    .map((item) => {
      const role = normalizeRole(item.role)
      return {
        openid: item.openid,
        role,
        displayName: item.displayName || defaultDisplayName(role),
        nickName: item.nickName || '',
        avatarUrl: item.avatarUrl || '',
        self: item.openid === openid,
        createdAt: item.createdAt || '',
      }
    })
    .sort((left, right) => rank[left.role] - rank[right.role] || left.displayName.localeCompare(right.displayName, 'zh'))
}

/**
 * 客户端 uploadFile 得到的 cloud:// 默认只有上传者自己能读，所以成员页里别人的头像是空白。
 * 云函数用管理员身份换成临时 https，家里其他人就能显示。库里仍存 cloud://。
 */
async function readableAvatarUrls(members: FamilyMemberView[]) {
  const fileList = [...new Set(members.map((item) => item.avatarUrl).filter((url) => url.startsWith('cloud://')))]
  if (!fileList.length) return members
  try {
    const got = await cloud.getTempFileURL({ fileList })
    const urls = new Map<string, string>()
    for (const file of (got.fileList || []) as Array<{ fileID?: string; tempFileURL?: string }>) {
      if (file.fileID && file.tempFileURL) urls.set(file.fileID, file.tempFileURL)
    }
    return members.map((item) => ({ ...item, avatarUrl: urls.get(item.avatarUrl) || item.avatarUrl }))
  } catch (error) {
    console.error('getTempFileURL', errorText(error))
    return members
  }
}

/** 登录时没选头像的成员，之后只补自己的头像，不改称呼和昵称。 */
async function setAvatar(user: UserDoc, payload: Record<string, unknown>) {
  const avatarUrl = normalizeAvatarUrl(payload.avatarUrl)
  if (!avatarUrl) raise('INVALID_INPUT', '请重新选择微信头像')
  if (!user._id) raise('CLOUD_ERROR', '成员记录不存在')
  if (avatarUrl !== (user.avatarUrl || '')) {
    await users().doc(user._id).update({ data: { avatarUrl } })
  }
  return avatarUrl
}

async function listMembers(user: UserDoc) {
  const [members, inviteViews] = await Promise.all([
    listFamilyUsers(user.familyId),
    listFamilyInvites(user.familyId),
  ])
  return {
    members: await readableAvatarUrls(toMemberViews(members, user.openid)),
    invites: inviteViews,
  }
}

async function removeMember(actor: UserDoc, payload: Record<string, unknown>) {
  const targetOpenid = String(payload.openid || '')
  if (!targetOpenid) raise('INVALID_INPUT', '请选择要移除的成员')
  const members = await listFamilyUsers(actor.familyId)
  const target = members.find((item) => item.openid === targetOpenid)
  if (!target) raise('MEMBER_NOT_FOUND', '该成员已不在家庭中')
  const targetRole = normalizeRole(target.role)
  if (!canRemoveMember(actor.role, targetRole, target.openid === actor.openid)) {
    if (target.openid === actor.openid) raise('CANNOT_REMOVE_SELF', '不能移除自己')
    if (targetRole === 'owner') raise('CANNOT_REMOVE_OWNER', '不能移除创建者')
    raise('MEMBER_REMOVE_FORBIDDEN', '只有创建者可以移除成员')
  }
  if (target._id) await users().doc(String(target._id)).remove()
  return null
}

/** 家长或家人自己退出：删掉成员记录，家庭和课表留给其他人。 */
async function leaveFamily(user: UserDoc) {
  if (!canLeaveFamily(user.role)) raise('OWNER_CANNOT_LEAVE', '创建者不能退出家庭')
  if (user._id) await users().doc(user._id).remove()
  return { left: true }
}

/** 只读判断，不占用邀请码、不换家庭。结论要和 joinFamily 的分支保持一致。 */
async function previewInvite(openid: string, payload: Record<string, unknown>) {
  const code = normalizeInviteCode(String(payload.code || ''))
  const invite = await findInvite(code)
  if (!invite) raise('INVITE_INVALID', '邀请码无效或已失效')
  if (!isInviteActive(invite)) {
    if (Date.parse(invite.expireAt) <= Date.now()) raise('INVITE_EXPIRED', '邀请已过期，请让家长重新生成')
    raise('INVITE_USED_UP', '邀请已用完，请让家长重新生成')
  }
  const existing = await findUser(openid)
  if (!existing) return { status: 'new' as const }
  if (existing.familyId === invite.familyId) return { status: 'same' as const }
  if (existing.role === 'owner' && await countFamilyMembers(existing.familyId) > 1) {
    return { status: 'blocked' as const }
  }
  if (existing.role === 'owner') return { status: 'replace' as const }
  return { status: 'leave' as const }
}

async function joinFamily(openid: string, unionid: string, payload: Record<string, unknown>) {
  const code = normalizeInviteCode(String(payload.code || ''))
  const invite = await findInvite(code)
  if (!invite) raise('INVITE_INVALID', '邀请码无效或已失效')
  if (!isInviteActive(invite)) {
    if (Date.parse(invite.expireAt) <= Date.now()) raise('INVITE_EXPIRED', '邀请已过期，请让家长重新生成')
    raise('INVITE_USED_UP', '邀请已用完，请让家长重新生成')
  }

  const existing = await findUser(openid)
  if (existing?.familyId === invite.familyId) {
    await applyProfile(existing, payload)
    const family = await loadFamily(existing.familyId)
    return sessionOf(existing, family.snapshot, family.version)
  }
  if (existing && existing.role === 'owner' && await countFamilyMembers(existing.familyId) > 1) {
    raise('OWNER_HAS_MEMBERS', '请先让其他成员退出后再加入别的家庭')
  }

  const role = normalizeInviteRole(invite.role)
  const keptName = existing && !(['owner', 'parent', 'viewer'] as FamilyRole[]).some((item) => defaultDisplayName(item) === existing.displayName)
    ? existing.displayName
    : ''
  const displayName = String(payload.displayName || '').trim().slice(0, 16) || keptName || defaultDisplayName(role)
  const nickName = nickNameOf(payload)
  const avatarUrl = normalizeAvatarUrl(payload.avatarUrl)
  const now = new Date().toISOString()
  const previousFamilyId = existing?.role === 'owner' ? existing.familyId : ''
  await db.runTransaction(async (transaction) => {
    const inviteRef = transaction.collection('invites').doc(invite.code)
    let current: FamilyInviteRecord | undefined
    try {
      const got = await inviteRef.get()
      current = got.data as FamilyInviteRecord | undefined
    } catch {
      current = undefined
    }
    if (!current?.familyId || !current.code) raise('INVITE_INVALID', '邀请码无效或已失效')
    if (!isInviteActive(current)) {
      if (Date.parse(current.expireAt) <= Date.now()) raise('INVITE_EXPIRED', '邀请已过期，请让家长重新生成')
      raise('INVITE_USED_UP', '邀请已用完，请让家长重新生成')
    }
    await inviteRef.update({
      data: { usedCount: current.usedCount + 1 },
    })
    if (existing?._id) {
      await transaction.collection('users').doc(existing._id).update({
        data: {
          familyId: current.familyId,
          role,
          displayName,
          nickName,
          avatarUrl,
        },
      })
    } else {
      await transaction.collection('users').add({
        data: {
          openid,
          unionid,
          familyId: current.familyId,
          role,
          displayName,
          nickName,
          avatarUrl,
          createdAt: now,
        },
      })
    }
  })
  if (previousFamilyId) {
    const left = await countFamilyMembers(previousFamilyId)
    if (left === 0) {
      try {
        await families().doc(previousFamilyId).remove()
      } catch {
        // 旧家庭已经空了；删不掉不影响这次加入
      }
    }
  }
  const family = await loadFamily(invite.familyId)
  return sessionOf({
    openid,
    familyId: invite.familyId,
    role,
    displayName,
    nickName,
    avatarUrl,
    createdAt: existing?.createdAt || now,
  }, family.snapshot, family.version)
}

async function dispatchWorkspace(user: UserDoc, action: string, payload: Record<string, unknown>) {
  if (!canWriteFamily(user.role) && !isWorkspaceReadAction(action)) {
    raise('SCOPE_FORBIDDEN', '家人只能查看课表和地点')
  }
  if (!canWriteFamily(user.role) && action === 'snapshot') {
    return familyMutation(user, null)
  }
  const data = await withFamily(user.familyId, (workspace) => applyFamilyAction(workspace, action, payload))
  return {
    snapshot: maskSnapshotForRole(data.snapshot, user.role),
    result: data.result,
    version: data.version,
  }
}

async function dispatchAccount(user: UserDoc, action: string, payload: Record<string, unknown>) {
  if (action === 'createInvite') return familyMutation(user, await createInvite(user, payload))
  if (action === 'listMembers') return familyMutation(user, await listMembers(user))
  if (action === 'setAvatar') return familyMutation(user, await setAvatar(user, payload))
  if (action === 'removeMember') {
    await removeMember(user, payload)
    return familyMutation(user, null)
  }
  raise('INVALID_ACTION', '不支持的操作')
}

async function handle(openid: string, unionid: string, action: string, payload: Record<string, unknown>) {
  if (action === 'login') return login(openid, unionid, payload)
  if (action === 'previewInvite') return previewInvite(openid, payload)
  if (action === 'joinFamily') return joinFamily(openid, unionid, payload)
  if (action === 'remindTemplate') return resolveRemindTemplate()
  const user = await requireUser(openid)
  if (action === 'listReminders') return listReminders(openid)
  if (action === 'subscribeReminder') return subscribeReminder(user, payload)
  if (action === 'leaveFamily') return leaveFamily(user)
  if (action === 'sync') return syncFamily(user, payload)
  if (action === 'createInvite' || action === 'listMembers' || action === 'removeMember' || action === 'setAvatar') {
    return dispatchAccount(user, action, payload)
  }
  return dispatchWorkspace(user, action, payload)
}

export async function main(event: { action?: string; payload?: Record<string, unknown> }) {
  const context = cloud.getWXContext()
  const openid = context.OPENID || ''
  if (!openid) return fail('UNAUTHENTICATED', '请在微信内打开小程序')

  try {
    const action = event?.action || ''
    const payload = sanitizePayload(event?.payload ?? {}) as Record<string, unknown>
    const unionid = context.UNIONID || ''
    try {
      return { ok: true as const, data: await handle(openid, unionid, action, payload) }
    } catch (error) {
      // 集合缺失时读写在落库前就会失败，建好集合后整次重试是安全的。
      if (!isCollectionMissing(error)) throw error
      await ensureCollections()
      return { ok: true as const, data: await handle(openid, unionid, action, payload) }
    }
  } catch (error) {
    const code = error instanceof FamilyActionError ? error.code : 'CLOUD_ERROR'
    const message = error instanceof Error ? error.message : '云函数执行失败'
    return fail(code, message)
  }
}
