/**
 * 语音讲解：用微信官方「同声传译」插件把讲解文字合成语音再播放，
 * 插件在 pages.json 的 subsolar 分包里声明，要先在小程序后台添加（见 docs/miniprogram-backend-settings.md）。
 * 只有正式打包才带插件（__SOLAR_SPEECH__），开发包和测试号里不显示「听讲解」。
 * 合成出的音频地址有有效期，按文字缓存到过期前。
 */

type Plugin = {
  textToSpeech(options: {
    lang: 'zh_CN' | 'en_US'
    tts: boolean
    content: string
    success: (res: { retcode: number; filename: string; expired_time: number }) => void
    fail: (err: { retcode?: number; msg?: string }) => void
  }): void
}

export type SpeechState = 'idle' | 'loading' | 'playing'

let plugin: Plugin | null | undefined
const cache = new Map<string, { url: string; expires: number }>()
let audio: UniApp.InnerAudioContext | null = null
let listener: ((state: SpeechState) => void) | null = null
let token = 0

function loadPlugin() {
  if (plugin !== undefined) return plugin
  plugin = null
  if (!__SOLAR_SPEECH__) return plugin
  // #ifdef MP-WEIXIN
  try {
    plugin = requirePlugin('WechatSI') as Plugin
  } catch {
    plugin = null
  }
  // #endif
  return plugin
}

export function speechAvailable() {
  return Boolean(loadPlugin())
}

function emit(state: SpeechState) {
  listener?.(state)
}

function player() {
  if (audio) return audio
  try {
    uni.setInnerAudioOption?.({ obeyMuteSwitch: false })
  } catch {
    // 旧版本基础库没有这个设置，静音键打开时可能听不到，不影响使用
  }
  audio = uni.createInnerAudioContext()
  audio.onPlay(() => emit('playing'))
  audio.onEnded(() => emit('idle'))
  audio.onStop(() => emit('idle'))
  audio.onError(() => emit('idle'))
  return audio
}

function synthesize(text: string, en: boolean) {
  const key = `${en ? 'en' : 'zh'}:${text}`
  const hit = cache.get(key)
  if (hit && hit.expires > Date.now() + 60000) return Promise.resolve(hit.url)
  const si = loadPlugin()
  if (!si) return Promise.reject(new Error('no-plugin'))
  return new Promise<string>((resolve, reject) => {
    si.textToSpeech({
      lang: en ? 'en_US' : 'zh_CN',
      tts: true,
      content: text,
      success: (res) => {
        if (res.retcode !== 0 || !res.filename) {
          reject(new Error(`tts ${res.retcode}`))
          return
        }
        cache.set(key, { url: res.filename, expires: res.expired_time * 1000 })
        resolve(res.filename)
      },
      fail: (err) => reject(new Error(err?.msg || 'tts fail')),
    })
  })
}

export function onSpeechState(callback: ((state: SpeechState) => void) | null) {
  listener = callback
}

export async function speak(text: string, en: boolean) {
  const current = ++token
  stopSpeech()
  emit('loading')
  try {
    const url = await synthesize(text, en)
    if (current !== token) return
    const ctx = player()
    ctx.src = url
    ctx.play()
  } catch (error) {
    if (current === token) emit('idle')
    throw error
  }
}

export function stopSpeech() {
  if (audio) audio.stop()
  emit('idle')
}

export function disposeSpeech() {
  token += 1
  listener = null
  if (audio) {
    audio.destroy()
    audio = null
  }
}
