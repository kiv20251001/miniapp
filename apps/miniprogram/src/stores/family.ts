import { markRaw } from 'vue'
import { defineStore } from 'pinia'
import dayjs from 'dayjs'
import type {
  AppSnapshot,
  Charge,
  ChildAvatarKey,
  ChildProfile,
  Course,
  Expense,
  ExpenseStatus,
  Homework,
  OccurrenceAttendance,
  Payment,
  ScheduleException,
} from '@server-domain/types'
import { emptySnapshot } from '@server-domain/constants'
import { callCloud, CloudError, NEED_FAMILY, NOT_MEMBER } from '@/cloud/call'
import type { WxEnvVersion } from '@/config'
import { promptLogin } from '@/utils/login-prompt'
import {
  canInviteRole,
  canLeaveFamily,
  canRemoveMember,
  canViewBills,
  canWriteFamily,
  FAMILY_ROLE_LABEL,
  type FamilyInviteView,
  type FamilyMemberView,
  type InviteJoinPreview,
  type FamilyRole,
  type InviteRole,
} from '@/domain/family-account'

const LOGGED_KEY = 'myhome.mp.logged'
/** 上次成功拉到的家庭快照。只给冷启动先画出来，授权仍以云端恢复结果为准。单 key 上限 1MB。 */
const CACHE_KEY = 'myhome.mp.cache'

interface SessionCache {
  openid: string
  familyId: string
  role: FamilyRole
  displayName: string
  nickName: string
  avatarUrl: string
  preferredChildId: string
  version: number
  snapshot: AppSnapshot
}

function isRole(value: unknown): value is FamilyRole {
  return value === 'owner' || value === 'parent' || value === 'viewer'
}

function readCache(): SessionCache | null {
  try {
    const raw = uni.getStorageSync(CACHE_KEY) as SessionCache | ''
    if (!raw || typeof raw !== 'object' || !raw.familyId || !isRole(raw.role)) return null
    const snap = raw.snapshot
    if (!snap || !Array.isArray(snap.children) || !Array.isArray(snap.courses) || !Array.isArray(snap.expenses)) return null
    return raw
  } catch {
    return null
  }
}

function writeCache(input: SessionCache) {
  try {
    uni.setStorageSync(CACHE_KEY, input)
  } catch {
    // 超出单 key 1MB 或存储失败时放弃，下次冷启动仍等云端。
  }
}

function clearCache() {
  try {
    uni.removeStorageSync(CACHE_KEY)
  } catch {
    // 已经没有这份缓存。
  }
}

/**
 * 这次冷启动已经问过云端，确认这个微信号没有家庭。
 * 从微信「最近使用 / 搜索记录」删掉小程序会清掉 storage，本机标记没了不代表没登录过。
 */
let guestConfirmed = false
let resumeTask: Promise<void> | null = null
let remindLoad: Promise<unknown> | null = null

let inflight: Promise<unknown> | null = null

/** 倒数第二个课程色从灰蓝、玫红换成 #DC5454，已保存的课跟着换，卡片渐变一起变。 */
const LEGACY_COURSE_COLORS: Record<string, string> = {
  '#7c8aa5': '#DC5454',
  '#e7e9ef': '#DC5454',
  '#ff3d9a': '#DC5454',
}

function withCurrentCourseColors(snapshot: AppSnapshot) {
  let changed = false
  const courses = snapshot.courses.map((course) => {
    const next = LEGACY_COURSE_COLORS[course.color?.toLowerCase()]
    if (!next || next === course.color) return course
    changed = true
    return { ...course, color: next }
  })
  return changed ? { ...snapshot, courses } : snapshot
}

/** 快照总是整体替换、从不就地修改，不需要深层响应式代理。 */
function frozen(snapshot: AppSnapshot) {
  return markRaw(snapshot)
}

function belongsToChild(course: Course, childId: string) {
  const ids = course.childIds?.length ? course.childIds : [course.childId]
  return ids.includes(childId)
}

export interface CloudMutation<T> {
  snapshot: AppSnapshot
  result: T
  version?: number
}

export interface CloudSession {
  openid: string
  familyId: string
  role?: FamilyRole
  displayName?: string
  nickName?: string
  avatarUrl?: string
  snapshot: AppSnapshot
  version?: number
}

type SyncResult = { changed: false } | { changed: true; session: CloudSession }

/** 创建、加入家庭时一起带上的称呼、微信昵称和头像，都可以不填。 */
export interface MemberProfile {
  displayName?: string
  nickName?: string
  avatarUrl?: string
}

/** 切页时最多这么久问一次云端，连续切 tab 不重复请求。 */
const SYNC_GAP_MS = 3000
let syncTask: Promise<unknown> | null = null
let syncedVersionAt = 0

export interface FamilyRoster {
  members: FamilyMemberView[]
  invites: FamilyInviteView[]
}

export const useFamilyStore = defineStore('family', {
  state: () => {
    const cache = readCache()
    const snapshot = cache ? withCurrentCourseColors(cache.snapshot) : emptySnapshot() as AppSnapshot
    return {
      /** 这次进程里云端已经确认过家庭会话。 */
      ready: false,
      /** 当前画面用的是上次存下的快照，云端还没确认。 */
      fromCache: Boolean(cache),
      /** 这次冷启动的第一次恢复已经结束（成功、没有家庭或失败）。 */
      bootDone: false,
      /** 恢复失败，画面仍是上次课表。 */
      stale: false,
      /** 恢复失败，而且没有可先展示的课表。 */
      offline: false,
      openid: cache?.openid || '',
      familyId: cache?.familyId || '',
      role: (cache?.role || 'owner') as FamilyRole,
      displayName: cache?.displayName || '',
      nickName: cache?.nickName || '',
      avatarUrl: cache?.avatarUrl || '',
      /** 云端家庭文档的版本号，任何人改了课表都会 +1，用来判断本机数据是不是最新的。 */
      version: cache?.version || 0,
      /** 家人只在本机切换正在看的孩子，不写进全家共用的快照。 */
      preferredChildId: cache?.preferredChildId || '',
      snapshot: frozen(snapshot),
      syncedAt: 0,
      rangeMonth: '',
      /** 已经点过闹钟、还没过期的课。键是「课程 ID_日期」。 */
      remindKeys: [] as string[],
    }
  },
  getters: {
    roleLabel(state): string {
      return FAMILY_ROLE_LABEL[state.role]
    },
    canWrite(): boolean {
      return canWriteFamily(this.role)
    },
    canViewBills(): boolean {
      return canViewBills(this.role)
    },
    canInviteParent(): boolean {
      return canInviteRole(this.role, 'parent')
    },
    canInviteViewer(): boolean {
      return canInviteRole(this.role, 'viewer')
    },
    canManageMembers(): boolean {
      return this.role === 'owner'
    },
    canLeave(): boolean {
      return canLeaveFamily(this.role)
    },
    child(state): ChildProfile | undefined {
      const preferred = state.preferredChildId
      const id = state.snapshot.children.some((item) => item.id === preferred)
        ? preferred
        : state.snapshot.session.childId
      return state.snapshot.children.find((item) => item.id === id)
        ?? state.snapshot.children[0]
    },
    childId(): string {
      return this.child?.id ?? ''
    },
    allCourses(): Course[] {
      const id = this.childId
      return this.snapshot.courses.filter((course) => belongsToChild(course, id))
    },
    courses(): Course[] {
      return this.allCourses.filter((course) => !course.archived)
    },
    expenses(): Expense[] {
      const id = this.childId
      return this.snapshot.expenses.filter((item) => item.childId === id)
    },
    scheduleExceptions(): ScheduleException[] {
      const ids = new Set(this.allCourses.map((course) => course.id))
      return this.snapshot.scheduleExceptions.filter((item) => ids.has(item.courseId))
    },
    overviewCourses(state): Course[] {
      return state.snapshot.courses.filter((course) => !course.archived)
    },
    overviewExpenses(state): Expense[] {
      return state.snapshot.expenses
    },
    overviewScheduleExceptions(): ScheduleException[] {
      const ids = new Set(this.overviewCourses.map((course) => course.id))
      return this.snapshot.scheduleExceptions.filter((item) => ids.has(item.courseId))
    },
    overviewCharges(state): Charge[] {
      return state.snapshot.charges ?? []
    },
    overviewPayments(state): Payment[] {
      return state.snapshot.payments ?? []
    },
    /** 和今日课表一样不按当前孩子拆开，切孩子后作业不会消失。 */
    homework(state): Homework[] {
      return state.snapshot.homework ?? []
    },
    /** 还没有上次课表，云端也还没回来：今日计划画骨架，不要画成当天没课。 */
    booting(): boolean {
      return !this.ready && !this.fromCache && !this.bootDone
    },
    /** 已经先画出上次课表，云端恢复还在进行或上次失败。朋友圈单页不再转圈。 */
    syncing(): boolean {
      return !this.ready && this.fromCache && (!this.bootDone || this.stale)
    },
  },
  actions: {
    /** 云端版本没变就不替换快照；避免为整份家庭数据 stringify 后再比较。 */
    applySnapshot(snapshot: AppSnapshot, version?: number) {
      if (this.ready && version && version === this.version) {
        this.syncedAt = Date.now()
        return
      }
      snapshot = withCurrentCourseColors(snapshot)
      this.snapshot = frozen(snapshot)
      if (version) this.version = version
      this.syncedAt = Date.now()
      if (this.ready && this.familyId) this.persist()
    },
    /** 把当前会话写进本机，供下次冷启动先画出来。失败不影响云端数据。 */
    persist() {
      if (!this.familyId) return
      writeCache({
        openid: this.openid,
        familyId: this.familyId,
        role: this.role,
        displayName: this.displayName,
        nickName: this.nickName,
        avatarUrl: this.avatarUrl,
        preferredChildId: this.preferredChildId,
        version: this.version,
        snapshot: this.snapshot,
      })
    },
    applySession(data: CloudSession) {
      guestConfirmed = false
      this.openid = data.openid
      this.familyId = data.familyId
      this.role = data.role || 'owner'
      this.displayName = data.displayName || FAMILY_ROLE_LABEL[this.role]
      this.nickName = data.nickName || ''
      this.avatarUrl = data.avatarUrl || ''
      if (canWriteFamily(this.role)) this.preferredChildId = ''
      // 会话可能只改了角色而家庭版本没变；必须接收云端已经按新角色脱敏的快照。
      this.applySnapshot(data.snapshot)
      if (data.version) this.version = data.version
      this.rangeMonth = ''
      this.fromCache = false
      this.stale = false
      this.offline = false
      this.ready = true
      this.persist()
      uni.setStorageSync(LOGGED_KEY, '1')
    },
    async dispatch<T>(action: string, payload?: Record<string, unknown>) {
      if (!this.ready) await ensureSession()
      if (needsFamily()) {
        promptLogin()
        throw new CloudError('请先创建家庭', NEED_FAMILY)
      }
      let data: CloudMutation<T>
      try {
        data = await callCloud<CloudMutation<T>>(action, payload)
      } catch (error) {
        if (error instanceof CloudError && error.code === NOT_MEMBER) this.logout()
        throw error
      }
      this.applySnapshot(data.snapshot, data.version)
      if (data.version) this.version = data.version
      this.ready = true
      return data.result
    },
    /**
     * 问云端家庭数据有没有被别人改过。没变只回一个标记，变了才带回完整快照。
     * 跨月时走 refresh，顺带生成本月账期。被移出时抛 NOT_MEMBER 并回到未登录状态。
     */
    sync(force = false) {
      if (!this.ready) return Promise.resolve(false)
      if (this.rangeMonth !== dayjs().format('YYYY-MM')) return this.refresh().then(() => true)
      if (syncTask) return syncTask
      if (!force && Date.now() - syncedVersionAt < SYNC_GAP_MS) return Promise.resolve(false)
      syncedVersionAt = Date.now()
      syncTask = callCloud<SyncResult>('sync', { version: this.version, familyId: this.familyId, role: this.role })
        .then((data) => {
          this.syncedAt = Date.now()
          if (!data.changed) return false
          const month = this.rangeMonth
          this.applySession(data.session)
          this.rangeMonth = month
          return true
        })
        .catch((error) => {
          if (error instanceof CloudError && error.code === NOT_MEMBER) this.logout()
          throw error
        })
        .finally(() => {
          syncTask = null
        })
      return syncTask
    },
    async login(childName = '小U', avatarKey?: ChildAvatarKey, profile: MemberProfile = {}) {
      this.applySession(await callCloud<CloudSession>('login', { childName, avatarKey, ...profile }))
    },
    /** 这个微信号已经有家庭时直接进入。没有家庭时不创建，回到登录页让用户自己选。 */
    async resume() {
      this.applySession(await callCloud<CloudSession>('login', { resume: true }))
    },
    async joinFamily(code: string, profile: MemberProfile = {}) {
      this.applySession(await callCloud<CloudSession>('joinFamily', { code, ...profile }))
    },
    /** 退出后这台手机回到没有家庭的状态，可以继续浏览或重新创建、加入。 */
    async leaveFamily() {
      await callCloud('leaveFamily')
      this.logout()
    },
    previewInvite(code: string) {
      return callCloud<InviteJoinPreview>('previewInvite', { code })
    },
    listMembers() {
      return this.dispatch<FamilyRoster>('listMembers')
    },
    /** 只补自己的微信头像。入库的是 cloud:// 文件 ID，成员列表再换成其他人也能看的临时链接。 */
    async setAvatar(avatarUrl: string) {
      const saved = await this.dispatch<string>('setAvatar', { avatarUrl })
      this.avatarUrl = saved || avatarUrl
    },
    createInvite(role: InviteRole) {
      return this.dispatch<FamilyInviteView>('createInvite', { role })
    },
    removeMember(openid: string) {
      return this.dispatch('removeMember', { openid })
    },
    canRemove(member: FamilyMemberView) {
      return canRemoveMember(this.role, member.role, member.self)
    },
    logout() {
      this.ready = false
      this.fromCache = false
      this.stale = false
      this.offline = false
      this.bootDone = true
      this.openid = ''
      this.familyId = ''
      this.role = 'owner'
      this.displayName = ''
      this.nickName = ''
      this.avatarUrl = ''
      this.version = 0
      this.preferredChildId = ''
      this.snapshot = frozen(emptySnapshot())
      this.syncedAt = 0
      this.rangeMonth = ''
      this.remindKeys = []
      uni.removeStorageSync(LOGGED_KEY)
      clearCache()
    },
    refresh() {
      if (inflight) return inflight
      const month = dayjs().format('YYYY-MM')
      const from = dayjs().startOf('month').format('YYYY-MM-DD')
      const to = dayjs().endOf('month').format('YYYY-MM-DD')
      inflight = this.dispatch('snapshot', { from, to })
        .then((result) => {
          this.rangeMonth = month
          return result
        })
        .finally(() => {
          inflight = null
        })
      return inflight
    },
    addChild(name: string, avatarKey?: ChildAvatarKey) {
      return this.dispatch<string>('addChild', { name, avatarKey })
    },
    updateChild(id: string, input: { name?: string; avatarKey?: ChildAvatarKey }) {
      return this.dispatch('updateChild', { id, ...input })
    },
    removeChild(id: string) {
      return this.dispatch('removeChild', { id })
    },
    selectChild(childId: string) {
      if (!this.snapshot.children.some((item) => item.id === childId)) {
        return Promise.reject(new Error('孩子不存在'))
      }
      if (!this.canWrite) {
        this.preferredChildId = childId
        this.persist()
        return Promise.resolve(childId)
      }
      this.preferredChildId = ''
      return this.dispatch<string>('selectChild', { childId })
    },
    saveCourse(course: Record<string, unknown>, paymentStatus: 'paid' | 'unpaid') {
      return this.dispatch<string>('saveCourse', { course, paymentStatus })
    },
    archiveCourse(id: string) {
      return this.dispatch('archiveCourse', { id })
    },
    restoreCourse(id: string) {
      return this.dispatch('restoreCourse', { id })
    },
    removeCourse(id: string) {
      return this.dispatch('removeCourse', { id })
    },
    addOccurrences(courseId: string, dates: string[]) {
      return this.dispatch('addOccurrences', { courseId, dates })
    },
    quickArrangement(input: Record<string, unknown>) {
      return this.dispatch('quickArrangement', input)
    },
    updateCourseNote(courseId: string, note: string) {
      return this.dispatch('updateCourseNote', { courseId, note })
    },
    upsertException(input: Record<string, unknown>) {
      return this.dispatch('upsertException', input)
    },
    restoreOccurrence(input: { courseId: string; date: string; startTime: string; endTime: string }) {
      return this.dispatch('restoreOccurrence', input)
    },
    dropOccurrence(courseId: string, date: string) {
      return this.dispatch('dropOccurrence', { courseId, date })
    },
    setAttendance(courseId: string, date: string, status: OccurrenceAttendance, billable: boolean) {
      return this.dispatch('attendance', { courseId, date, status, billable })
    },
    saveOccurrenceExpense(courseId: string, date: string, amount: number, paid: boolean) {
      return this.dispatch('occurrenceExpense', { courseId, date, amount, paid })
    },
    upsertExpense(input: Record<string, unknown>) {
      return this.dispatch('upsertExpense', input)
    },
    generateBills(period: string) {
      return this.dispatch('generateBills', { period })
    },
    setExpenseStatus(id: string, status: ExpenseStatus) {
      return this.dispatch('setExpenseStatus', { id, status })
    },
    refund(id: string, amount: number, note = '') {
      return this.dispatch('refund', { id, amount, note })
    },
    removeExpense(id: string) {
      return this.dispatch('removeExpense', { id })
    },
    saveHomework(input: { id?: string; date: string; subject: string; content: string; note: string }) {
      return this.dispatch<string>('saveHomework', input)
    },
    /** 先在本机改掉状态，界面立刻变；云端失败时只把这一条改回去，不动期间别的更新。 */
    async setHomeworkDone(id: string, done: boolean) {
      const previous = (this.snapshot.homework ?? []).find((item) => item.id === id)
      const patch = (next: Homework | undefined) => {
        if (!next) return
        this.snapshot = frozen({
          ...this.snapshot,
          homework: (this.snapshot.homework ?? []).map((item) => (item.id === id ? next : item)),
        })
      }
      if (previous) {
        const { doneAt: _doneAt, ...rest } = previous
        patch(done ? { ...rest, done, doneAt: new Date().toISOString() } : { ...rest, done })
      }
      try {
        return await this.dispatch('setHomeworkDone', { id, done })
      } catch (error) {
        const current = (this.snapshot.homework ?? []).find((item) => item.id === id)
        if (previous && current && current.done === done) patch(previous)
        throw error
      }
    },
    removeHomework(id: string) {
      return this.dispatch('removeHomework', { id })
    },
    /** 今天及以后、已经订阅成功的课。失败时保持原样，下次再问。 */
    async loadReminders() {
      if (!this.ready) return
      if (remindLoad) return remindLoad
      const current = this
      remindLoad = callCloud<Array<{ courseId: string; date: string }>>('listReminders')
        .then((rows) => {
          current.remindKeys = rows.map((item) => `${item.courseId}_${item.date}`)
        })
        .catch(() => undefined)
        .finally(() => {
          remindLoad = null
        })
      return remindLoad
    },
    /** 用户已经在微信弹窗里点了允许。这里只记下这一节课，好让定时任务到点发送。 */
    async subscribeReminder(courseId: string, date: string, envVersion: WxEnvVersion) {
      if (!this.ready) await ensureSession()
      if (needsFamily()) {
        promptLogin()
        throw new CloudError('请先创建家庭', NEED_FAMILY)
      }
      const result = await callCloud<{ late: boolean }>('subscribeReminder', { courseId, date, envVersion })
      const key = `${courseId}_${date}`
      if (!this.remindKeys.includes(key)) this.remindKeys = [...this.remindKeys, key]
      return result
    },
  },
})

export function hasLocalSession() {
  return uni.getStorageSync(LOGGED_KEY) === '1'
}

/**
 * 用 openid 向云端恢复家庭。有本机标记时照旧恢复；标记被清掉时也会问一次，避免用户重新选孩子。
 * 没有家庭时记在本次进程里，不再反复请求，也不会新建家庭。
 * 网络失败不记成游客，也不清掉上次课表；下次打开再试。确认没有家庭、被移出时才清缓存。
 */
export function ensureSession() {
  const store = useFamilyStore()
  if (store.ready || guestConfirmed) {
    store.bootDone = true
    return Promise.resolve()
  }
  if (!resumeTask) {
    const hadLocal = hasLocalSession() || store.fromCache
    resumeTask = store.resume()
      .then(() => undefined)
      .catch((error: unknown) => {
        const code = error instanceof CloudError ? error.code : 'CALL_FAILED'
        if (code === 'UNAUTHENTICATED') guestConfirmed = true
        if (code === 'UNAUTHENTICATED' || code === 'NOT_MEMBER' || code === 'FAMILY_MISMATCH') {
          if (hadLocal) store.logout()
          return
        }
        store.stale = store.fromCache
        store.offline = !store.fromCache
      })
      .finally(() => {
        store.bootDone = true
        resumeTask = null
      })
  }
  return resumeTask
}

/**
 * 还没确认身份时不要当成游客：写操作会先等 ensureSession。
 * 确认没有家庭之后，提交才引导去创建。
 */
export function needsFamily() {
  if (useFamilyStore().ready || hasLocalSession()) return false
  return guestConfirmed
}
