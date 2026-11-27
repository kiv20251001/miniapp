/**
 * 拼音的声音：scripts/build-pinyin-audio.mjs 打包的真人音节录音 pinyin-v3.bin，放云存储（cloud-storage/pinyin）。
 * 第一次用时下载并存在本地，之后直接读。播放一个词时把几个音节的 MP3 片段接成一个文件再放。
 *
 * 文件格式：'UPY1' + u32 文件头长度 + JSON 文件头（items: { ma1: [偏移, 长度] }）+ MP3 数据，偏移从数据开头算。
 */
import { reactive } from 'vue'
import { cloudFile } from '@/config'
import { parse, soundKey, type Tone } from './pinyin'

const FILE = 'pinyin/pinyin-v3.bin'
const SOURCE = cloudFile(FILE)
/** 64kbps 左右。估短了会提前停，所以按更低的码率留出余量。 */
const BYTES_PER_SECOND = 5000

type Fail = (err: { errMsg?: string }) => void
type DownloadTask = { onProgressUpdate?: (listener: (res: { progress: number; totalBytesWritten: number; totalBytesExpectedToWrite: number }) => void) => void }
type FileApi = {
  getFileSystemManager: () => {
    access: (options: { path: string; success?: () => void; fail?: Fail }) => void
    copyFile: (options: { srcPath: string; destPath: string; success?: () => void; fail?: Fail }) => void
    readFile: (options: { filePath: string; success?: (res: { data: ArrayBuffer }) => void; fail?: Fail }) => void
    writeFile: (options: { filePath: string; data: ArrayBuffer; success?: () => void; fail?: Fail }) => void
    unlink: (options: { filePath: string; success?: () => void; fail?: Fail }) => void
  }
  env: { USER_DATA_PATH: string }
  cloud?: { downloadFile: (options: { fileID: string; success?: (res: { tempFilePath: string }) => void; fail?: Fail }) => DownloadTask | void }
  setInnerAudioOption?: (options: { obeyMuteSwitch?: boolean; mixWithOther?: boolean }) => void
}

const api = () => wx as unknown as FileApi

export type VoiceStatus = 'idle' | 'loading' | 'ready' | 'off' | 'error'
export const voice = reactive({ status: (SOURCE ? 'idle' : 'off') as VoiceStatus, progress: 0, playing: '', cue: '' })

let bytes: Uint8Array | null = null
let items: Record<string, [number, number]> = {}
let dataStart = 0
let loading: Promise<boolean> | null = null

function hash(value: string) {
  let h = 0
  for (let index = 0; index < value.length; index += 1) h = (h * 31 + value.charCodeAt(index)) | 0
  return (h >>> 0).toString(36)
}

const cachePath = () => `${api().env.USER_DATA_PATH}/pinyin-v3-${hash(SOURCE)}.bin`

function exists(path: string) {
  return new Promise<boolean>((resolve) => api().getFileSystemManager().access({ path, success: () => resolve(true), fail: () => resolve(false) }))
}

function read(filePath: string) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    api().getFileSystemManager().readFile({ filePath, success: (res) => resolve(res.data), fail: (err) => reject(new Error(err?.errMsg || 'read')) })
  })
}

function download() {
  return new Promise<string>((resolve, reject) => {
    const cloud = api().cloud
    if (!cloud) return reject(new Error('wx.cloud 不可用'))
    const task = cloud.downloadFile({
      fileID: SOURCE,
      success: (res) => resolve(res.tempFilePath),
      fail: (err) => reject(new Error(err?.errMsg || 'download')),
    })
    task?.onProgressUpdate?.((res) => {
      const expected = res.totalBytesExpectedToWrite
      const percent = res.progress || (expected ? Math.min(99, Math.round((res.totalBytesWritten / expected) * 100)) : 0)
      if (percent) voice.progress = percent
    })
  })
}

function ascii(data: Uint8Array) {
  let out = ''
  for (let index = 0; index < data.length; index += 8192) out += String.fromCharCode(...data.subarray(index, index + 8192))
  return out
}

function open(buffer: ArrayBuffer) {
  const data = new Uint8Array(buffer)
  if (ascii(data.subarray(0, 4)) !== 'UPY1') throw new Error('不是拼音声音文件')
  const length = new DataView(buffer).getUint32(4, true)
  const header = JSON.parse(ascii(data.subarray(8, 8 + length))) as { items: Record<string, [number, number]> }
  bytes = data
  items = header.items
  dataStart = 8 + length
}

async function load() {
  const cached = cachePath()
  if (await exists(cached)) {
    try {
      open(await read(cached))
      return true
    } catch {
      api().getFileSystemManager().unlink({ filePath: cached })
    }
  }
  const temp = await download()
  open(await read(temp))
  api().getFileSystemManager().copyFile({ srcPath: temp, destPath: cached })
  return true
}

/** 准备声音：已经下好就直接读，没有就下载。没配置云存储或下载失败返回 false，页面照常能用，只是不出声。 */
export function prepareVoice() {
  if (!SOURCE) return Promise.resolve(false)
  if (bytes) return Promise.resolve(true)
  if (!loading) {
    voice.status = 'loading'
    loading = load()
      .then(() => {
        voice.status = 'ready'
        return true
      })
      .catch((error) => {
        console.warn('[pinyin] voice unavailable', error)
        voice.status = 'error'
        loading = null
        return false
      })
  }
  return loading
}

export function hasSound(key: string) {
  return Boolean(items[key])
}

// ---- 播放 ----

let player: UniApp.InnerAudioContext | null = null
let finish: (() => void) | null = null
let guard: ReturnType<typeof setTimeout> | null = null
let generation = 0
/** stop() 触发的 onStop 如果晚到，不能把新的播放清掉 */
let ignoreStops = 0
const files = new Map<string, string>()
let fileCount = 0

function audio() {
  if (!player) {
    api().setInnerAudioOption?.({ obeyMuteSwitch: false, mixWithOther: false })
    player = uni.createInnerAudioContext()
    player.onEnded(() => settle())
    player.onStop(() => {
      if (ignoreStops > 0) {
        ignoreStops -= 1
        return
      }
      settle()
    })
    player.onError(() => settle())
  }
  return player
}

function settle() {
  if (guard) clearTimeout(guard)
  guard = null
  voice.playing = ''
  const done = finish
  finish = null
  done?.()
}

/** 把几个音节拼成一个 MP3 文件。同一串音节只写一次。 */
function fileFor(keys: string[]) {
  const name = keys.join('-')
  const known = files.get(name)
  if (known) return Promise.resolve({ path: known, size: 0 })
  const parts = keys.map((key) => items[key]).filter(Boolean)
  const size = parts.reduce((sum, [, length]) => sum + length, 0)
  const out = new Uint8Array(size)
  let at = 0
  for (const [offset, length] of parts) {
    out.set(bytes!.subarray(dataStart + offset, dataStart + offset + length), at)
    at += length
  }
  // 只留最近的 40 个文件，旧的删掉
  if (files.size >= 40) {
    const [oldName, oldPath] = files.entries().next().value as [string, string]
    files.delete(oldName)
    api().getFileSystemManager().unlink({ filePath: oldPath })
  }
  fileCount += 1
  const path = `${api().env.USER_DATA_PATH}/pinyin-say-${Date.now().toString(36)}-${fileCount}.mp3`
  return new Promise<{ path: string; size: number }>((resolve, reject) => {
    api().getFileSystemManager().writeFile({
      filePath: path,
      data: out.buffer as ArrayBuffer,
      success: () => {
        files.set(name, path)
        resolve({ path, size })
      },
      fail: (err) => reject(new Error(err?.errMsg || 'write')),
    })
  })
}

export function stopVoice() {
  if (player && finish) {
    ignoreStops += 1
    player.stop()
  }
  settle()
}

/** 轻声没有单独录音时，用同一个音节的一声，避免这个字被跳过不读。 */
function soundFor(key: string) {
  if (hasSound(key)) return key
  if (key.endsWith('5') && hasSound(`${key.slice(0, -1)}1`)) return `${key.slice(0, -1)}1`
  return ''
}

/** 依次读出这几个音节（'ma1'）。一点击就亮喇叭；声音还在下载时先等下载完再放。被新的点击打断时 resolve(false)。 */
export async function say(keys: string[], tag = keys.join(' ')) {
  const mine = ++generation
  voice.cue = tag
  if (!bytes) {
    const ok = await prepareVoice()
    if (mine !== generation) return false
    if (!ok) {
      voice.cue = ''
      return false
    }
  }
  const list = keys.map(soundFor).filter(Boolean)
  if (!list.length) {
    if (mine === generation) voice.cue = ''
    return false
  }
  stopVoice()
  if (mine !== generation) return false
  voice.cue = tag
  const { path, size } = await fileFor(list)
  if (mine !== generation) return false
  const length = size || list.reduce((sum, key) => sum + items[key][1], 0)
  const context = audio()
  voice.playing = tag
  return new Promise<boolean>((resolve) => {
    finish = () => {
      if (mine === generation) voice.cue = ''
      resolve(mine === generation)
    }
    guard = setTimeout(() => {
      if (mine === generation) settle()
    }, (length / BYTES_PER_SECOND) * 1000 + 1500)
    context.src = path
    context.play()
  })
}

/** 一个词的拼音（'píng guǒ'）转成要读的音节。两个三声连读时前一个读成二声。 */
export function wordKeys(readings: string[]) {
  const parsed = readings.map(parse).filter((item): item is { base: string; tone: Tone } => Boolean(item))
  return parsed.map((item, index) => {
    const next = parsed[index + 1]
    const tone: Tone = item.tone === 3 && next?.tone === 3 ? 2 : item.tone
    return soundKey(item.base, tone)
  })
}
