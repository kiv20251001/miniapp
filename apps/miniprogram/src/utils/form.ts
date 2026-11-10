import { MAX_AMOUNT } from '@/domain/limits'
import { isEn, t } from '@/i18n'

// 控制字符、零宽字符和尖括号：页面不渲染 HTML，这里去掉是为了数据干净、防止拼接注入。
const UNSAFE_CHARS = /[\u0000-\u001F\u007F\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF<>]/g

/** 去首尾空白和不安全字符，并按字符（不拆 emoji）截断。 */
export function cleanText(value: unknown, max: number) {
  const text = String(value ?? '').replace(UNSAFE_CHARS, '').trim()
  const chars = Array.from(text)
  return chars.length > max ? chars.slice(0, max).join('').trim() : text
}

/** 校验不通过时的提示：短句用轻提示，长句用弹窗，避免被截断。 */
export function formTip(message: string) {
  const text = t(message)
  if (Array.from(text).length > (isEn() ? 36 : 16)) {
    uni.showModal({ title: '请检查', content: text, showCancel: false, confirmText: '知道了' })
    return
  }
  uni.showToast({ icon: 'none', title: text, duration: 2000 })
}

/** 金额输入的初始值：0 留空，输入框用 placeholder 显示 0，点进去可以直接输入。 */
export function amountInputValue(value: number | string | null | undefined) {
  const text = String(value ?? '').trim()
  if (!text || Number(text) === 0) return ''
  return text
}

/** 金额校验：返回错误文案，合法时返回空字符串。 */
export function amountError(value: string, label: string, options: { required?: boolean } = {}) {
  const text = String(value ?? '').trim()
  const name = t(label)
  if (!text) return options.required ? t('请填写{label}', { label: name }) : ''
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return t('{label}格式不对，最多两位小数', { label: name })
  const amount = Number(text)
  if (options.required && !(amount > 0)) return t('请填写{label}', { label: name })
  if (amount > MAX_AMOUNT) return t('{label}不能超过 {max} 元', { label: name, max: MAX_AMOUNT })
  return ''
}
