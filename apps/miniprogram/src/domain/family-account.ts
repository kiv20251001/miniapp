import type { AppSnapshot } from '@server-domain/types'

export type FamilyRole = 'owner' | 'parent' | 'viewer'
export type InviteRole = 'parent' | 'viewer'

export interface FamilyMemberRecord {
  openid: string
  familyId: string
  role: FamilyRole
  /** 家里的称呼（爸爸、奶奶…）；没填时是角色名。 */
  displayName: string
  /** 微信昵称，用户勾选使用微信资料时才有。 */
  nickName?: string
  /** 微信头像，存在云存储里的 cloud:// 文件 ID。 */
  avatarUrl?: string
  createdAt: string
}

export interface FamilyInviteRecord {
  code: string
  familyId: string
  createdBy: string
  role: InviteRole
  expireAt: string
  maxUses: number
  usedCount: number
  createdAt: string
}

export interface FamilyMemberView {
  openid: string
  role: FamilyRole
  displayName: string
  nickName: string
  avatarUrl: string
  self: boolean
  createdAt: string
}

/** 已有家庭的人打开邀请码时，先看这个结果再决定要不要加入。 */
export type InviteJoinStatus = 'new' | 'same' | 'blocked' | 'replace' | 'leave'

export interface InviteJoinPreview {
  status: InviteJoinStatus
}

export interface FamilyInviteView {
  code: string
  role: InviteRole
  expireAt: string
  maxUses: number
  usedCount: number
  expired: boolean
}

export const FAMILY_ROLE_HINT: Record<FamilyRole, string> = {
  owner: '邀请家长一起管课表，或邀请家人只看计划。',
  parent: '可以一起改课表和账单，也可以邀请家人只看计划。',
  viewer: '接送时看今天上哪节课、在哪里。改课和账单由家长来。',
}

export const FAMILY_ROLE_LABEL: Record<FamilyRole, string> = {
  owner: '创建者',
  parent: '家长',
  viewer: '家人',
}

export const INVITE_ROLE_HINT: Record<InviteRole, string> = {
  parent: '可编辑课表、账单共同管理',
  viewer: '只可查看课表信息 方便接送',
}

export const INVITE_MAX_USES = 10
export const INVITE_TTL_MS = 24 * 60 * 60 * 1000
export const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const WORKSPACE_READ_ACTIONS = new Set(['snapshot'])

export function isWorkspaceReadAction(action: string) {
  return WORKSPACE_READ_ACTIONS.has(action)
}

export function canWriteFamily(role: FamilyRole) {
  return role === 'owner' || role === 'parent'
}

export function canViewBills(role: FamilyRole) {
  return role === 'owner' || role === 'parent'
}

export function canInviteRole(actor: FamilyRole, target: InviteRole) {
  if (actor === 'owner') return target === 'parent' || target === 'viewer'
  if (actor === 'parent') return target === 'viewer'
  return false
}

export function canRemoveMember(actor: FamilyRole, target: FamilyRole, self: boolean) {
  return actor === 'owner' && !self && target !== 'owner'
}

/** 家长和家人可以自己退出；创建者走开会让家庭没人管，不能退出。 */
export function canLeaveFamily(role: FamilyRole) {
  return role !== 'owner'
}

/** 只接受本小程序云存储里的头像文件，别的地址一律丢掉。 */
export function normalizeAvatarUrl(value: unknown) {
  const text = String(value || '').trim()
  return /^cloud:\/\/[\w.-]+\/[\w./-]+$/.test(text) ? text : ''
}

export function normalizeRole(role: string | undefined, isOwner = false): FamilyRole {
  if (role === 'owner' || role === 'parent' || role === 'viewer') return role
  return isOwner ? 'owner' : 'parent'
}

export function normalizeInviteRole(role: unknown): InviteRole {
  return role === 'parent' ? 'parent' : 'viewer'
}

export function defaultDisplayName(role: FamilyRole) {
  return FAMILY_ROLE_LABEL[role]
}

/** 称呼只是默认的角色名时不算用户填过。 */
export function isDefaultDisplayName(name: string) {
  return (Object.values(FAMILY_ROLE_LABEL) as string[]).includes(name)
}

/**
 * 成员列表怎么显示：有微信昵称时主名用昵称，称呼放在后面的小标签；
 * 没有昵称就用称呼当主名，不出标签。
 */
export function memberTitle(member: Pick<FamilyMemberView, 'displayName' | 'nickName'>) {
  if (!member.nickName) return { name: member.displayName, tag: '' }
  return {
    name: member.nickName,
    tag: isDefaultDisplayName(member.displayName) ? '' : member.displayName,
  }
}

export function createInviteCode() {
  let code = ''
  for (let index = 0; index < 6; index += 1) {
    code += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)]
  }
  return code
}

export function normalizeInviteCode(value: string) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8)
}

export function formatInviteCode(code: string) {
  const normalized = normalizeInviteCode(code)
  return normalized.length === 6 ? `${normalized.slice(0, 3)} ${normalized.slice(3)}` : normalized
}

export function inviteExpiresAt(from = Date.now()) {
  return new Date(from + INVITE_TTL_MS).toISOString()
}

export function isInviteActive(invite: Pick<FamilyInviteRecord, 'expireAt' | 'usedCount' | 'maxUses'>, now = Date.now()) {
  return Date.parse(invite.expireAt) > now && invite.usedCount < invite.maxUses
}

export function toInviteView(invite: FamilyInviteRecord, now = Date.now()): FamilyInviteView {
  return {
    code: invite.code,
    role: invite.role,
    expireAt: invite.expireAt,
    maxUses: invite.maxUses,
    usedCount: invite.usedCount,
    expired: !isInviteActive(invite, now),
  }
}

export function maskSnapshotForRole(snapshot: AppSnapshot, role: FamilyRole): AppSnapshot {
  if (canViewBills(role)) return snapshot
  const next = JSON.parse(JSON.stringify(snapshot)) as AppSnapshot
  next.expenses = []
  next.payments = []
  next.charges = []
  return next
}
