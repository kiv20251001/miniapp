<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { t } from '@/i18n'
import { formTip } from '@/utils/form'
import { isHan, readingsOf, splitItems, toPinyin, type Glyph } from './convert'
import { prepareVoice, say, stopVoice, voice, wordKeys } from './voice'
import Stepper from './Stepper.vue'
import Toggle from './Toggle.vue'
import WordInput from './WordInput.vue'
import SpeakerIcon from './SpeakerIcon.vue'

const STORE_KEY = 'uday-pinyin-dictation-v1'
const MAX_ITEMS = 50
/** 同一个词连读几遍时，两遍之间停多久。 */
const GAP_MS = 2500
/** 自动报下一个时，每个词写多久可以选的秒数。 */
const WAIT_CHOICES = [3, 5, 8, 10, 15, 20, 30, 45, 60]
const EXTRA_SECONDS = 5

type Saved = { text: string; times: number; shuffle: boolean; auto: boolean; wait: number; overrides: Record<string, string[]> }
const saved = (uni.getStorageSync(STORE_KEY) || {}) as Partial<Saved>

const text = ref(saved.text ?? '')
const times = ref(saved.times ?? 2)
const shuffleOn = ref(saved.shuffle ?? false)
const auto = ref(saved.auto ?? false)
const wait = ref(WAIT_CHOICES.includes(saved.wait as number) ? (saved.wait as number) : 10)
const overrides = ref<Record<string, string[]>>(saved.overrides ?? {})
const checking = ref(false)

watch([text, times, shuffleOn, auto, wait, overrides], () => {
  uni.setStorageSync(STORE_KEY, { text: text.value, times: times.value, shuffle: shuffleOn.value, auto: auto.value, wait: wait.value, overrides: overrides.value })
}, { deep: true })

type Item = { word: string; glyphs: Glyph[] }

function withOverride(word: string): Glyph[] {
  const glyphs = toPinyin(word)
  const custom = overrides.value[word]
  if (!custom || custom.length !== glyphs.length) return glyphs
  return glyphs.map((glyph, index) => ({ ...glyph, py: custom[index] || glyph.py }))
}

const allItems = computed<Item[]>(() => splitItems(text.value).map((word) => ({ word, glyphs: withOverride(word) })))
const items = computed(() => allItems.value.slice(0, MAX_ITEMS))

/** 家长点一个多音字，换成它的下一个读音 */
function cycleReading(word: string, index: number) {
  const glyphs = withOverride(word)
  const glyph = glyphs[index]
  if (!isHan(glyph.char)) return
  const list = readingsOf(glyph.char)
  if (list.length < 2) {
    formTip(t('这个字只有一个读音'))
    return
  }
  const next = list[(list.indexOf(glyph.py) + 1) % list.length]
  const py = glyphs.map((item) => item.py)
  py[index] = next
  overrides.value = { ...overrides.value, [word]: py }
  uni.vibrateShort({ type: 'light' })
  say(wordKeys([next]))
}

function isPoly(char: string) {
  return isHan(char) && readingsOf(char).length > 1
}

// ---- 听写 ----
type Stage = 'setup' | 'run' | 'answer'
const stage = ref<Stage>('setup')
const queue = ref<Item[]>([])
const cursor = ref(0)
const round = ref(0)
const wrong = ref<boolean[]>([])
/** 读完以后留给孩子写字的倒计时（自动模式）。countLeft 为 0 表示没有在倒计时。 */
const countLeft = ref(0)
const countTotal = ref(1)
const paused = ref(false)
const timeUp = ref(false)
let token = 0
let timer: ReturnType<typeof setInterval> | null = null

const current = computed(() => queue.value[cursor.value])
const isLast = computed(() => cursor.value >= queue.value.length - 1)
const wrongCount = computed(() => wrong.value.filter(Boolean).length)
const countStyle = computed(() => ({ width: `${(countLeft.value / Math.max(1, countTotal.value)) * 100}%` }))
const reading = computed(() => round.value > 0)
const status = computed(() => {
  if (reading.value) return t('第 {n} / {total} 遍', { n: round.value, total: times.value })
  if (paused.value) return t('已暂停')
  if (countLeft.value > 0) return isLast.value ? t('{n} 秒后时间到', { n: countLeft.value }) : t('{n} 秒后读下一个', { n: countLeft.value })
  if (timeUp.value) return t('时间到，写完了就看答案')
  return auto.value ? t('点喇叭再听一遍') : t('写完了点「下一个」')
})
const progressStyle = computed(() => ({ width: `${((cursor.value + 1) / Math.max(1, queue.value.length)) * 100}%` }))
const voiceReady = computed(() => voice.status === 'ready')
const startLabel = computed(() => {
  if (voice.status === 'loading') return voice.progress ? t('声音下载中 {n}%', { n: voice.progress }) : t('正在下载读音…')
  if (voice.status === 'off') return t('这个版本没有配置声音')
  if (voice.status === 'error') return t('声音没下载好，点这里重试')
  return t('开始听写')
})

function keysOf(item: Item) {
  return wordKeys(item.glyphs.filter((glyph) => isHan(glyph.char)).map((glyph) => glyph.py))
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function clearTimer() {
  if (timer) clearInterval(timer)
  timer = null
}

function halt() {
  token += 1
  round.value = 0
  clearTimer()
  countLeft.value = 0
  timeUp.value = false
  stopVoice()
}

/** 自动模式：读完后倒数，到 0 就报下一个；最后一个词只提示时间到，不替孩子翻页。 */
function startCountdown(seconds: number) {
  clearTimer()
  countTotal.value = seconds
  countLeft.value = seconds
  timer = setInterval(() => {
    countLeft.value -= 1
    if (countLeft.value > 0) return
    clearTimer()
    if (isLast.value) {
      timeUp.value = true
      uni.vibrateShort({ type: 'medium' })
    } else go(1)
  }, 1000)
}

function togglePause() {
  if (paused.value) {
    paused.value = false
    if (!reading.value) startCountdown(countLeft.value > 0 ? countLeft.value : wait.value)
  } else {
    paused.value = true
    clearTimer()
  }
}

function addTime() {
  if (reading.value) return
  paused.value = false
  timeUp.value = false
  const left = countLeft.value + EXTRA_SECONDS
  startCountdown(left)
  countTotal.value = Math.max(left, wait.value)
  uni.vibrateShort({ type: 'light' })
}

/** 当前这个词按设置的遍数读，中间停一会儿让孩子写 */
async function playCurrent() {
  const item = current.value
  if (!item) return
  halt()
  const mine = token
  for (let n = 0; n < times.value; n += 1) {
    round.value = n + 1
    await say(keysOf(item), item.word)
    if (mine !== token) return
    if (n < times.value - 1) {
      await sleep(GAP_MS)
      if (mine !== token) return
    }
  }
  round.value = 0
  if (auto.value && !paused.value) startCountdown(wait.value)
}

function shuffle<T>(list: T[]) {
  const out = [...list]
  for (let index = out.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1))
    ;[out[index], out[other]] = [out[other], out[index]]
  }
  return out
}

function begin(list: Item[]) {
  queue.value = shuffleOn.value ? shuffle(list) : [...list]
  wrong.value = queue.value.map(() => false)
  cursor.value = 0
  stage.value = 'run'
  paused.value = false
  uni.pageScrollTo({ scrollTop: 0, duration: 200 })
  setTimeout(playCurrent, 400)
}

async function start() {
  if (!items.value.length) {
    formTip('请先输入听写的词语，或按年级随机生成')
    return
  }
  if (voice.status === 'off') return
  if (!voiceReady.value) {
    const ok = await prepareVoice()
    if (!ok) return
  }
  if (allItems.value.length > MAX_ITEMS) formTip(t('一次最多 {n} 个，只听写前 {n} 个', { n: MAX_ITEMS }))
  begin(items.value)
}

function go(step: number) {
  const next = cursor.value + step
  if (next < 0 || next >= queue.value.length) return
  cursor.value = next
  uni.vibrateShort({ type: 'light' })
  playCurrent()
}

function finish() {
  halt()
  stage.value = 'answer'
  uni.vibrateShort({ type: 'medium' })
  uni.pageScrollTo({ scrollTop: 0, duration: 200 })
}

function quit() {
  halt()
  stage.value = 'setup'
}

function toggleWrong(index: number) {
  const next = [...wrong.value]
  next[index] = !next[index]
  wrong.value = next
  uni.vibrateShort({ type: next[index] ? 'heavy' : 'light' })
}

function retryWrong() {
  begin(queue.value.filter((_, index) => wrong.value[index]))
}

function replay(item: Item) {
  halt()
  say(keysOf(item), item.word)
}

onUnmounted(halt)
</script>

<template>
  <view class="dictation">
    <!-- 出题 -->
    <template v-if="stage === 'setup'">
      <view class="card">
        <WordInput v-model="text" :found="items.length" :found-label="t('听写题目')" :placeholder="t('例如：春天 朋友 快乐，一行一个也可以')" />

        <view v-if="items.length" class="check-head press" hover-class="press-on" hover-stay-time="80" @click="checking = !checking">
          <text>{{ t('家长检查读音') }}</text>
          <text class="check-arrow" :class="{ open: checking }">›</text>
        </view>
        <view v-if="checking && items.length" class="check-list fade-up">
          <text class="check-tip">{{ t('有下划线的是多音字，点一下换读音') }}</text>
          <view v-for="item in items" :key="item.word" class="ruby-word small">
            <view v-for="(glyph, at) in item.glyphs" :key="at" class="ruby press" :class="{ poly: isPoly(glyph.char) }" @click="cycleReading(item.word, at)">
              <text class="ruby-py">{{ glyph.py }}</text>
              <text class="ruby-han">{{ glyph.char }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="card settings">
        <text class="card-title">{{ t('听写设置') }}</text>
        <view class="setting">
          <view class="setting-copy">
            <text class="setting-name">{{ t('每个词读几遍') }}</text>
          </view>
          <Stepper v-model="times" :min="1" :max="5" unit="{n} 遍" />
        </view>
        <view class="setting">
          <view class="setting-copy">
            <text class="setting-name">{{ t('打乱顺序') }}</text>
          </view>
          <Toggle v-model="shuffleOn" />
        </view>
        <view class="setting top">
          <view class="setting-copy">
            <text class="setting-name">{{ t('什么时候报下一个') }}</text>
            <text class="setting-sub">{{ auto ? t('读完等一会儿，自动报下一个') : t('孩子写完，自己点「下一个」') }}</text>
          </view>
          <view class="seg">
            <view class="seg-thumb" :class="{ right: auto }" />
            <text class="seg-item" :class="{ on: !auto }" @click="auto = false">{{ t('手动') }}</text>
            <text class="seg-item" :class="{ on: auto }" @click="auto = true">{{ t('自动') }}</text>
          </view>
        </view>
        <view v-if="auto" class="setting fade-up">
          <view class="setting-copy">
            <text class="setting-name">{{ t('每个词留多久写') }}</text>
            <text class="setting-sub">{{ t('写得慢可以调长，运行时还能再加 5 秒') }}</text>
          </view>
          <Stepper v-model="wait" :values="WAIT_CHOICES" unit="{n} 秒" />
        </view>
      </view>

      <button hover-class="press-on" hover-stay-time="80" class="btn block start" :disabled="voice.status === 'off'" @click="start">{{ startLabel }}</button>
    </template>

    <!-- 报词 -->
    <view v-else-if="stage === 'run' && current" class="card run">
      <view class="run-top">
        <text class="run-count"><text :key="cursor" class="run-now bump">{{ cursor + 1 }}</text> / {{ queue.length }}</text>
        <text class="run-mode">{{ auto ? t('自动 · {n} 秒', { n: wait }) : t('手动') }}</text>
        <text class="run-quit press" @click="quit">{{ t('结束') }}</text>
      </view>
      <view class="run-bar"><view class="run-fill" :style="progressStyle" /></view>

      <view class="speaker-wrap press" hover-class="press-on" hover-stay-time="80" @click="playCurrent">
        <view v-if="voice.playing" class="ripple r1" />
        <view v-if="voice.playing" class="ripple r2" />
        <view class="speaker-btn" :class="{ playing: !!voice.cue }">
          <SpeakerIcon size="lg" :live="!!voice.cue" />
        </view>
      </view>
      <text class="run-round" :class="{ urgent: countLeft > 0 && countLeft <= 3 }">{{ status }}</text>
      <view v-if="auto" class="count-track" :class="{ show: countLeft > 0 || paused }"><view class="count-fill" :class="{ paused }" :style="countStyle" /></view>
      <text v-if="!auto" class="run-hint">{{ t('在本子上写下来，汉字或拼音都可以') }}</text>

      <view v-if="auto" class="auto-tools">
        <view class="mini-btn press" hover-class="press-on" hover-stay-time="80" @click="togglePause">
          <text class="mini-icon">{{ paused ? '▶' : '❚❚' }}</text>
          <text>{{ paused ? t('继续') : t('暂停') }}</text>
        </view>
        <view class="mini-btn press" :class="{ off: reading }" hover-class="press-on" hover-stay-time="80" @click="addTime">
          <text class="mini-icon">＋</text>
          <text>{{ t('再加 {n} 秒', { n: 5 }) }}</text>
        </view>
      </view>

      <view class="run-actions">
        <view class="nav-btn press" :class="{ off: cursor === 0 }" hover-class="press-on" hover-stay-time="80" @click="go(-1)">‹</view>
        <button v-if="!isLast" hover-class="press-on" hover-stay-time="80" class="btn grow" @click="go(1)">{{ auto ? t('写好了，下一个') : t('下一个') }}</button>
        <button v-else hover-class="press-on" hover-stay-time="80" class="btn grow done" :class="{ pulse: timeUp }" @click="finish">{{ t('写完了，看答案') }}</button>
      </view>
    </view>

    <!-- 对答案 -->
    <view v-else class="card answer">
      <view class="answer-head">
        <text class="answer-title">{{ t('对答案') }}</text>
        <text class="answer-score">{{ t('写对 {right}/{total}', { right: queue.length - wrongCount, total: queue.length }) }}</text>
      </view>
      <text class="answer-tip">{{ t('对照本子，写错的点一下右边的圆圈') }}</text>
      <view class="answer-list">
        <view v-for="(item, index) in queue" :key="index" class="answer-row" :class="{ wrong: wrong[index] }" :style="{ animationDelay: `${Math.min(index, 12) * 40}ms` }">
          <text class="answer-no">{{ index + 1 }}</text>
          <view class="ruby-word">
            <view v-for="(glyph, at) in item.glyphs" :key="at" class="ruby">
              <text class="ruby-py">{{ glyph.py }}</text>
              <text class="ruby-han">{{ glyph.char }}</text>
            </view>
          </view>
          <view class="answer-say press" hover-class="press-on" hover-stay-time="80" @click="replay(item)">
            <SpeakerIcon size="sm" :live="voice.cue === item.word" />
          </view>
          <view class="answer-mark press" hover-class="press-on" hover-stay-time="80" @click="toggleWrong(index)">
            <text>{{ wrong[index] ? '✗' : '✓' }}</text>
          </view>
        </view>
      </view>
      <button v-if="wrongCount" hover-class="press-on" hover-stay-time="80" class="btn block" @click="retryWrong">{{ t('错的 {n} 个再听写一遍', { n: wrongCount }) }}</button>
      <view class="answer-actions">
        <button hover-class="press-on" hover-stay-time="80" class="btn ghost grow" @click="begin(queue)">{{ t('重新听写') }}</button>
        <button hover-class="press-on" hover-stay-time="80" class="btn ghost grow" @click="quit">{{ t('换题目') }}</button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.check-head { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; padding: 10px 4px 4px; color: var(--ink); font-size: 14px; font-weight: 650; }
.check-arrow { color: var(--muted); font-size: 20px; transition: transform 0.25s ease; }
.check-arrow.open { transform: rotate(90deg); }
.check-list { display: flex; flex-wrap: wrap; gap: 10px 14px; padding: 8px 4px 4px; }
.check-tip { width: 100%; color: var(--muted); font-size: 12px; }
.card-title { display: block; margin-bottom: 4px; color: var(--ink); font-size: 15px; font-weight: 800; }
.settings { margin-top: 12px; }
.setting { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 48px; border-top: 1px solid var(--line); }
.setting:first-of-type { border-top: 0; }
.setting.top { padding: 8px 0; }
.setting-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 2px; }
.setting-name { color: var(--ink); font-size: 14px; font-weight: 650; }
.setting-sub { color: var(--muted); font-size: 11px; line-height: 1.4; }
.seg { position: relative; display: flex; flex: none; padding: 3px; border-radius: 12px; background: var(--surface-2); }
.seg-thumb { position: absolute; top: 3px; bottom: 3px; left: 3px; width: 52px; border-radius: 9px; background: #fff; box-shadow: 0 2px 8px rgba(25, 31, 58, 0.14); transition: transform 0.42s cubic-bezier(0.34, 1.3, 0.64, 1); }
.seg-thumb.right { transform: translateX(52px); }
.seg-item { position: relative; width: 52px; height: 30px; color: var(--muted); font-size: 13px; font-weight: 700; line-height: 30px; text-align: center; transition: color 0.25s ease; }
.seg-item.on { color: var(--accent-text); }
.start { margin-top: 16px; }

.ruby-word { display: flex; flex-wrap: wrap; gap: 2px; }
.ruby { display: flex; flex-direction: column; align-items: center; min-width: 40px; }
.ruby-py { color: #ff6a33; font-family: 'Avenir Next', 'Helvetica Neue', Arial, sans-serif; font-size: 14px; font-weight: 700; line-height: 20px; }
.ruby-han { color: var(--ink); font-size: 26px; font-weight: 700; line-height: 1.25; }
.ruby-word.small .ruby { min-width: 32px; }
.ruby-word.small .ruby-py { font-size: 12px; line-height: 16px; }
.ruby-word.small .ruby-han { font-size: 20px; }
.ruby.poly .ruby-han { text-decoration: underline dotted #ff9a6b; text-underline-offset: 4px; }

/* 报词 */
.run { display: flex; flex-direction: column; align-items: center; padding-bottom: 20px; }
.run-top { display: flex; align-self: stretch; align-items: center; justify-content: space-between; }
.run-count { color: var(--muted); font-size: 15px; font-weight: 700; }
.run-now { display: inline-block; color: #ff6a33; font-size: 26px; font-weight: 800; }
.run-mode { padding: 3px 10px; border-radius: 10px; background: var(--surface-2); color: var(--muted); font-size: 11px; font-weight: 700; }
.run-quit { color: var(--muted); font-size: 13px; }
.run-bar { align-self: stretch; height: 6px; margin-top: 10px; overflow: hidden; border-radius: 3px; background: var(--track); }
.run-fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, #ffb45c, #ff7a45); transition: width 0.5s cubic-bezier(0.34, 1.2, 0.64, 1); }
.speaker-wrap { position: relative; display: flex; width: 180px; height: 180px; align-items: center; justify-content: center; margin: 34px 0 12px; }
.ripple { position: absolute; inset: 20px; border-radius: 50%; background: rgba(255, 122, 69, 0.18); animation: ripple 1.6s ease-out infinite; }
.ripple.r2 { animation-delay: 0.8s; }
.speaker-btn { position: relative; display: flex; width: 132px; height: 132px; align-items: center; justify-content: center; border-radius: 50%; background: linear-gradient(135deg, #ffb45c 0%, #ff7a45 48%, #f15a36 100%); color: #fff; box-shadow: 0 18px 36px -16px rgba(241, 90, 54, 0.7); transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.speaker-btn.playing { transform: scale(1.06); }
.run-round { color: var(--ink); font-size: 16px; font-weight: 750; transition: color 0.25s ease; }
.run-round.urgent { color: #f15a36; }
.count-track { align-self: stretch; height: 8px; margin: 12px 8px 0; overflow: hidden; border-radius: 4px; background: var(--track); opacity: 0; transition: opacity 0.3s ease; }
.count-track.show { opacity: 1; }
.count-fill { height: 100%; border-radius: 4px; background: linear-gradient(90deg, #47d18c, #ffb45c); transition: width 1s linear; }
.count-fill.paused { opacity: 0.45; }
.auto-tools { display: flex; gap: 10px; margin-top: 16px; }
.mini-btn { display: flex; align-items: center; gap: 6px; height: 34px; padding: 0 14px; border-radius: 17px; background: var(--surface-2); color: var(--ink); font-size: 13px; font-weight: 700; line-height: 34px; transition: opacity 0.2s ease; }
.mini-btn.off { opacity: 0.4; }
.mini-icon { color: var(--accent-text); font-size: 12px; }
.run-hint { margin-top: 6px; color: var(--muted); font-size: 12px; }
.run-actions { display: flex; align-self: stretch; gap: 10px; margin-top: 26px; }
.nav-btn { display: flex; width: 50px; height: 46px; flex: none; align-items: center; justify-content: center; border-radius: 14px; background: var(--surface-2); color: var(--ink); font-size: 26px; font-weight: 600; transition: opacity 0.2s ease; }
.nav-btn.off { opacity: 0.3; pointer-events: none; }
.btn.grow { flex: 1; }
.btn.done { background: linear-gradient(135deg, #47d18c, #23a866); }
.btn.pulse { animation: pulse 1s ease-in-out infinite; }

/* 对答案 */
.answer-head { display: flex; align-items: baseline; justify-content: space-between; }
.answer-title { color: var(--ink); font-size: 17px; font-weight: 800; }
.answer-score { color: #1f9d5c; font-size: 14px; font-weight: 750; }
.answer-tip { display: block; margin-top: 4px; color: var(--muted); font-size: 12px; }
.answer-list { display: flex; flex-direction: column; gap: 8px; margin: 12px 0 16px; }
.answer-row { display: flex; align-items: center; gap: 10px; padding: 10px 10px 10px 8px; border: 1px solid var(--line); border-radius: 16px; background: var(--paper); animation: fade-up 0.35s ease both; transition: border-color 0.25s ease, background 0.25s ease; }
.answer-row.wrong { border-color: #f15a36; background: rgba(241, 90, 54, 0.08); }
.answer-no { width: 22px; color: var(--muted); font-size: 12px; font-weight: 750; text-align: center; }
.answer-row .ruby-word { flex: 1; }
.answer-say { display: flex; width: 34px; height: 34px; flex: none; align-items: center; justify-content: center; border-radius: 12px; background: var(--accent-soft); color: var(--accent-text); }
.answer-mark { display: flex; width: 34px; height: 34px; flex: none; align-items: center; justify-content: center; border-radius: 50%; background: rgba(52, 199, 123, 0.14); color: #1f9d5c; font-size: 16px; font-weight: 800; transition: background 0.25s ease, color 0.25s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.answer-row.wrong .answer-mark { background: #f15a36; color: #fff; transform: scale(1.08); }
.answer-actions { display: flex; gap: 10px; margin-top: 10px; }

.bump { animation: bump 0.45s cubic-bezier(0.34, 1.56, 0.64, 1); }
.fade-up { animation: fade-up 0.35s ease; }
@keyframes bump {
  0% { transform: scale(0.6); opacity: 0.4; }
  60% { transform: scale(1.12); opacity: 1; }
  100% { transform: scale(1); }
}
@keyframes fade-up {
  0% { opacity: 0; transform: translateY(6px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
}
@keyframes ripple {
  0% { transform: scale(0.8); opacity: 0.9; }
  100% { transform: scale(1.35); opacity: 0; }
}
</style>
