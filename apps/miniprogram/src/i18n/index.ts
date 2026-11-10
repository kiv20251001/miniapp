import { ref } from 'vue'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import { EN, EN_PATTERNS, EN_WEEKDAY_SHORT, EN_MONTH_SHORT } from './en'

export type Locale = 'zh' | 'en'

export const LOCALE_KEY = 'myhome.mp.locale'

type Params = Record<string, string | number | undefined | null>

function readLocale(): Locale {
  try {
    return uni.getStorageSync(LOCALE_KEY) === 'en' ? 'en' : 'zh'
  } catch {
    return 'zh'
  }
}

/** 模板和 computed 里调用 t() 时会读到它，切换语言后页面自动重渲染。 */
export const locale = ref<Locale>(readLocale())

function applyDayjs() {
  dayjs.locale(locale.value === 'en' ? 'en' : 'zh-cn')
}

applyDayjs()

export function isEn() {
  return locale.value === 'en'
}

const CJK = /[\u3400-\u9fff\uff08-\uff1f\u3001-\u3011]/
const cache = new Map<string, string>()

function fill(text: string, params?: Params) {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key]
    return value === undefined || value === null ? match : String(value)
  })
}

export function monthShort(month: number | string) {
  return EN_MONTH_SHORT[(Number(month) - 1 + 12) % 12] || String(month)
}

/** 英文查找顺序：整句词典 → 动态句式 → 按「 · 」拆段逐段翻译。都没有就原样返回（多半是用户自己写的内容）。 */
export function translate(text: string): string {
  if (!text || !CJK.test(text)) return text
  const hit = cache.get(text)
  if (hit !== undefined) return hit
  let out: string | undefined = EN[text]
  if (out === undefined) {
    for (const [pattern, render] of EN_PATTERNS) {
      const match = text.match(pattern)
      if (match) {
        out = render(match, translate)
        break
      }
    }
  }
  if (out === undefined && text.includes(' · ')) {
    out = text.split(' · ').map(translate).join(' · ')
  }
  if (out === undefined) out = text
  cache.set(text, out)
  return out
}

/** 文案统一用中文原文当 key：中文环境原样返回，界面与之前完全一致。 */
export function t(text: string, params?: Params) {
  if (locale.value !== 'en') return fill(text, params)
  return fill(translate(text), params)
}

/** 同一句中文在不同位置英文不同时，用上下文区分，例如按钮上的「未完成」是动作不是状态。 */
export function tc(context: string, text: string, params?: Params) {
  if (locale.value !== 'en') return fill(text, params)
  return fill(EN[`${context}:${text}`] ?? translate(text), params)
}

/** dayjs 格式也走词典，例如 t('M月D日') 在英文下是 'MMM D'。 */
export function fmt(date: dayjs.ConfigType, format: string) {
  return dayjs(date).format(t(format))
}

/** 周几短标签，0 是周日，和 dayjs().day() 一致。 */
export function weekdayShort(day: number, zh: readonly string[]) {
  return locale.value === 'en' ? EN_WEEKDAY_SHORT[day] : zh[day]
}

export function toggleLocale() {
  locale.value = locale.value === 'en' ? 'zh' : 'en'
  uni.setStorageSync(LOCALE_KEY, locale.value)
  applyDayjs()
  uni.showToast({ icon: 'none', title: locale.value === 'en' ? 'English' : '中文' })
}

type UniOptions = Record<string, unknown>

function translateFields(options: UniOptions, fields: string[]) {
  if (locale.value !== 'en' || !options) return options
  const next: UniOptions = { ...options }
  for (const field of fields) {
    const value = next[field]
    if (typeof value === 'string') next[field] = translate(value)
  }
  if (Array.isArray(next.itemList)) next.itemList = (next.itemList as string[]).map(translate)
  if (fields.includes('confirmText')) {
    next.confirmText = next.confirmText || 'OK'
    if (next.showCancel !== false) next.cancelText = next.cancelText || 'Cancel'
  }
  return next
}

/** 提示框、确认框、操作菜单的文案统一在出口翻译，store 和页面里的中文提示不用逐个改。 */
export function installUniI18n() {
  const target = uni as unknown as Record<string, (options: UniOptions) => unknown>
  const wrap = (name: string, fields: string[]) => {
    const raw = target[name]
    if (typeof raw !== 'function' || (raw as { i18n?: boolean }).i18n) return
    const wrapped = (options: UniOptions) => raw.call(uni, translateFields(options, fields))
    ;(wrapped as { i18n?: boolean }).i18n = true
    target[name] = wrapped
  }
  wrap('showToast', ['title'])
  wrap('showLoading', ['title'])
  wrap('showModal', ['title', 'content', 'confirmText', 'cancelText', 'placeholderText'])
  wrap('showActionSheet', ['alertText'])
}
