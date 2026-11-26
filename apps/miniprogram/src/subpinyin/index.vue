<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { onLoad, onReady, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { TOOL_SHARE_TITLES, toolMoments, toolShare, useSearchTitle, type ToolShareKey } from '@/utils/share'
import { useFamilyPage } from '@/composables/useFamilyPage'
import { usePageBackground, useThemePage } from '@/utils/wx-theme'
import PageHeader from '@/components/PageHeader.vue'
import { isEn, t } from '@/i18n'
import { windowHeight } from '@/utils/system'
import DictationPanel from './DictationPanel.vue'
import PinyinPrint from './PinyinPrint.vue'
import { mouthArt, nasalArt, toneArt } from './art'
import {
  ASPIRATED,
  CURLED,
  FINAL_GROUPS,
  FINAL_SOUND,
  FLAT,
  INITIAL_ROWS,
  INITIAL_SOUND,
  LAB_FINALS,
  MEDIAL_FINALS,
  NASAL_PAIRS,
  WHOLE,
  WHOLE_SET,
  display,
  glide,
  groupOf,
  mark,
  markPlace,
  soundKey,
  spell,
  type Tone,
} from './pinyin'
import {
  DOT_KEEP,
  DOT_OFF,
  DOT_RULE,
  FIND_DONE,
  FIND_WHOLE,
  FINAL_NOTES,
  GROUP_NAMES,
  GUIDES,
  HINTS,
  INITIAL_RHYME,
  INITIAL_TAGS,
  MARK_ASK,
  MARK_RULES,
  MARK_SAMPLES,
  MODES,
  MOUTH_TIP,
  SPELL_NOTES,
  SPELL_RHYME,
  THREE_RHYME,
  TONE_NAMES,
  TONE_STORY,
  WHOLE_NOTE,
  pick,
  type GuideAction,
  type Mode,
} from './lessons'
import { makeQuestion, ruleText, type Level, type Question, type QuizMode } from './quiz'
import { prepareVoice, say, stopVoice, voice } from './voice'

useFamilyPage()
const themeClass = useThemePage()
const pageBg = usePageBackground()
const en = computed(() => isEn())

type Tab = 'explore' | 'quiz' | 'dictate' | 'print'
const TAB_SHARE: Record<Tab, ToolShareKey> = { explore: 'pinyin', quiz: 'pinyinQuiz', dictate: 'pinyinDictate', print: 'pinyinPrint' }
const tab = ref<Tab>('explore')
onShareAppMessage(() => toolShare(TAB_SHARE[tab.value], `/subpinyin/index?tab=${tab.value}`))
onShareTimeline(() => toolMoments(TAB_SHARE[tab.value], `tab=${tab.value}`))
useSearchTitle(() => t(TOOL_SHARE_TITLES[TAB_SHARE[tab.value]]))
onLoad((query) => {
  const value = query?.tab
  if (value === 'quiz' || value === 'print' || value === 'dictate') setTab(value)
})

const QUESTIONS = 5

let timers: Array<ReturnType<typeof setTimeout>> = []
function later(fn: () => void, ms: number) {
  timers.push(setTimeout(fn, ms))
}
function clearTimers() {
  timers.forEach(clearTimeout)
  timers = []
  blending.value = false
}

function vibrate(type: 'light' | 'medium' | 'heavy') {
  uni.vibrateShort({ type })
}

// ---- 声音 ----
const voiceTip = computed(() => {
  if (voice.status === 'loading') return voice.progress ? t('声音下载中 {n}%', { n: voice.progress }) : t('正在下载读音…')
  if (voice.status === 'error') return t('声音没下载好，点这里重试')
  if (voice.status === 'off') return t('这个版本没有配置声音')
  return ''
})

function retryVoice() {
  if (voice.status === 'error') prepareVoice()
}

function play(keys: string[] | string) {
  const list = Array.isArray(keys) ? keys : [keys]
  return say(list).then((ok) => {
    if (!ok && (voice.status === 'error' || voice.status === 'off')) {
      uni.showToast({ title: voice.status === 'off' ? t('这个版本没有配置声音') : t('声音没下载好，点这里重试'), icon: 'none' })
    }
    return ok
  })
}

// ---- 探索 ----
const mode = ref<Mode>('initial')
const modeIndex = computed(() => MODES.findIndex((item) => item.value === mode.value))

function setMode(value: Mode) {
  if (mode.value === value) return
  if (guideIndex.value >= 0) endGuide()
  clearTimers()
  stopVoice()
  mode.value = value
  later(maybeGuide, 400)
}

// 声母
const curInitial = ref('b')
const initialBump = ref(0)
const initialTags = computed(() => {
  const item = curInitial.value
  const tags = [pick(ASPIRATED.has(item) ? INITIAL_TAGS.aspirated : INITIAL_TAGS.plain, en.value)]
  if (CURLED.has(item)) tags.push(pick(INITIAL_TAGS.curled, en.value))
  if (FLAT.has(item)) tags.push(pick(INITIAL_TAGS.flat, en.value))
  return tags
})
const isAspirated = computed(() => ASPIRATED.has(curInitial.value))

function tapInitial(item: string) {
  curInitial.value = item
  initialBump.value += 1
  vibrate('light')
  play(INITIAL_SOUND[item])
  passGuide('tap')
}

const stickRight = ref(false)
const stickDown = ref(false)
const mirrorLetter = computed(() => (stickDown.value ? (stickRight.value ? 'q' : 'p') : stickRight.value ? 'd' : 'b'))
const mirrorBump = ref(0)

function flipStick(kind: 'side' | 'dir') {
  if (kind === 'side') stickRight.value = !stickRight.value
  else stickDown.value = !stickDown.value
  mirrorBump.value += 1
  vibrate('light')
  play(INITIAL_SOUND[mirrorLetter.value])
  passGuide('mirror')
}

const TONGUE_PAIRS: Array<[string, string]> = [['z', 'zh'], ['c', 'ch'], ['s', 'sh']]
const tongueOn = ref('')

function playPair(pair: [string, string]) {
  clearTimers()
  tongueOn.value = pair[0]
  play(INITIAL_SOUND[pair[0]])
  later(() => {
    tongueOn.value = pair[1]
    play(INITIAL_SOUND[pair[1]])
  }, 900)
  later(() => {
    tongueOn.value = ''
  }, 1900)
}

// 韵母
const curFinal = ref('a')
const finalBump = ref(0)
const finalGroup = computed(() => groupOf(curFinal.value) ?? 'single')
const finalGlide = computed(() => (finalGroup.value === 'compound' ? glide(curFinal.value) : null))
const finalNote = computed(() => {
  const item = curFinal.value
  if (item === 'er') return pick(FINAL_NOTES.er, en.value)
  if (item === 'ie' || item === 've') return pick(FINAL_NOTES.ehat, en.value)
  if (finalGroup.value === 'single') return pick(MOUTH_TIP[item], en.value)
  if (finalGroup.value === 'compound') return pick(FINAL_NOTES.glide, en.value)
  return pick(finalGroup.value === 'front' ? FINAL_NOTES.front : FINAL_NOTES.back, en.value)
})

function tapFinal(item: string) {
  curFinal.value = item
  finalBump.value += 1
  vibrate('light')
  play(FINAL_SOUND[item])
  passGuide('tap')
}

const nasalPair = ref(-1)
const nasalSide = ref<'' | 'front' | 'back'>('')

function playNasal(index: number) {
  clearTimers()
  nasalPair.value = index
  const [front, back] = NASAL_PAIRS[index]
  nasalSide.value = 'front'
  play(FINAL_SOUND[front])
  later(() => {
    nasalSide.value = 'back'
    play(FINAL_SOUND[back])
  }, 1000)
  later(() => passGuide('pair'), 1300)
}

const DOT_INITIALS = ['j', 'q', 'x', 'y', 'n', 'l']
const dotPick = ref('')
const dotRun = ref(0)
const dotDrop = computed(() => 'jqxy'.includes(dotPick.value) && dotPick.value !== '')
const dotResult = computed(() => {
  if (!dotPick.value) return ''
  return dotDrop.value ? `${dotPick.value}u` : `${dotPick.value}ü`
})

function tapDot(item: string) {
  dotPick.value = item
  dotRun.value += 1
  vibrate('light')
  play(item === 'y' ? 'yu3' : soundKey(item === 'n' || item === 'l' ? `${item}v` : `${item}u`, 3))
  passGuide('dots')
}

// 整体认读
const curWhole = ref('zhi')
const wholeTone = ref<Tone>(1)
const wholeBump = ref(0)

function tapWhole(item: string) {
  curWhole.value = item
  wholeTone.value = 1
  wholeBump.value += 1
  vibrate('light')
  play(soundKey(item, 1))
  passGuide('tap')
}

function tapWholeTone(tone: Tone) {
  wholeTone.value = tone
  wholeBump.value += 1
  play(soundKey(curWhole.value, tone))
}

const NOT_WHOLE = ['zha', 'che', 'sha', 'za', 'ce', 'su', 'ji', 'qi', 'xi', 'ya', 'wa', 'yao', 'wo', 'you', 'li', 'nu', 'ru', 'zhu', 'chu', 'yan']
const findItems = ref<string[]>([])
const found = ref<string[]>([])
const findWrong = ref('')
const findTotal = computed(() => findItems.value.filter((item) => WHOLE_SET.has(item)).length)
const findDone = computed(() => findTotal.value > 0 && found.value.length >= findTotal.value)

function shuffle<T>(list: T[]) {
  const out = [...list]
  for (let index = out.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1))
    ;[out[index], out[other]] = [out[other], out[index]]
  }
  return out
}

function newFind() {
  const right = shuffle(WHOLE).slice(0, 4)
  const wrong = shuffle(NOT_WHOLE).slice(0, 5)
  findItems.value = shuffle([...right, ...wrong])
  found.value = []
  findWrong.value = ''
}
newFind()

function tapFind(item: string) {
  if (found.value.includes(item) || findDone.value) return
  if (WHOLE_SET.has(item)) {
    found.value = [...found.value, item]
    play(soundKey(item, 1))
    if (found.value.length >= findTotal.value) {
      vibrate('medium')
      passGuide('find')
    } else vibrate('light')
    return
  }
  findWrong.value = item
  vibrate('heavy')
  later(() => {
    if (findWrong.value === item) findWrong.value = ''
  }, 450)
}

// 拼一拼
const LAB_INITIALS = ['', ...INITIAL_ROWS.flat().filter((item) => item !== 'y' && item !== 'w')]
const labInitial = ref('b')
const labFinal = ref('a')
const labTone = ref<Tone>(1)
const labRun = ref(0)
const blending = ref(false)
const blendStep = ref(-1)
const labSpell = computed(() => spell(labInitial.value, labFinal.value))
const labSyllable = computed(() => (labSpell.value ? mark(labSpell.value.base, labTone.value) : ''))
const labThree = computed(() => Boolean(labInitial.value) && MEDIAL_FINALS.has(labFinal.value) && Boolean(labSpell.value))
type Part = { text: string; role: 'i' | 'm' | 'f' }
const labParts = computed<Part[]>(() => {
  const final = labSpell.value && labInitial.value ? labSpell.value.base.slice(labInitial.value.length) : labFinal.value
  const parts: Part[] = labInitial.value ? [{ text: labInitial.value, role: 'i' }] : []
  if (labThree.value) parts.push({ text: display(final[0]), role: 'm' }, { text: mark(final.slice(1), labTone.value), role: 'f' })
  else parts.push({ text: mark(final, labTone.value), role: 'f' })
  return parts
})
/** 拼读时亮起的部分：第 0 步声母，第 1 步韵母（三拼时介母和韵母一起亮） */
function partLit(part: Part) {
  return (blendStep.value === 0 && part.role === 'i') || (blendStep.value === 1 && part.role !== 'i')
}

const labNotes = computed(() => {
  const notes: string[] = []
  if (!labSpell.value) notes.push(pick(labFinal.value === 'er' && labInitial.value ? SPELL_NOTES.er : SPELL_NOTES.none, en.value))
  else {
    if (labSpell.value.dropDots) notes.push(pick(SPELL_NOTES.dots, en.value))
    if (labSpell.value.yw) notes.push(pick(SPELL_NOTES.yw, en.value))
    if (labInitial.value && ['iu', 'ui', 'un'].includes(labFinal.value)) notes.push(pick(SPELL_NOTES.short, en.value))
  }
  return notes
})

function labChanged() {
  labRun.value += 1
  if (labSpell.value) {
    vibrate('light')
    play(soundKey(labSpell.value.base, labTone.value))
  } else vibrate('heavy')
}

function pickLabInitial(item: string) {
  if (labInitial.value === item) return
  labInitial.value = item
  labChanged()
}

function pickLabFinal(item: string) {
  if (labFinal.value === item) return
  labFinal.value = item
  labChanged()
  if (labSpell.value) passGuide('pickFinal')
}

function pickLabTone(tone: Tone) {
  labTone.value = tone
  labChanged()
}

function randomLab() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const initial = LAB_INITIALS[1 + Math.floor(Math.random() * (LAB_INITIALS.length - 1))]
    const final = LAB_FINALS[Math.floor(Math.random() * LAB_FINALS.length)]
    if (!spell(initial, final)) continue
    labInitial.value = initial
    labFinal.value = final
    labTone.value = (1 + Math.floor(Math.random() * 4)) as Tone
    labChanged()
    return
  }
}

/** 拼读过程：先念声母，再念韵母，最后连起来 */
function blend() {
  const done = labSpell.value
  if (!done || blending.value) return
  clearTimers()
  blending.value = true
  const finalAlone = spell('', labFinal.value)
  const steps: string[] = []
  if (labInitial.value) steps.push(INITIAL_SOUND[labInitial.value])
  steps.push(finalAlone ? soundKey(finalAlone.base, labTone.value) : FINAL_SOUND[labFinal.value])
  steps.push(soundKey(done.base, labTone.value))
  steps.forEach((key, index) => {
    later(() => {
      blendStep.value = labInitial.value ? index : index + 1
      play(key)
    }, index * 900)
  })
  later(() => {
    blending.value = false
    blendStep.value = -1
  }, steps.length * 900 + 200)
}

// 声调
const TONE_BASES = ['a', 'o', 'e', 'i', 'u', 'v', 'ma', 'yu']
const toneBase = ref('a')
const curTone = ref(0)
const toneRun = ref(0)
const TONES: Tone[] = [1, 2, 3, 4]
const toneArts = TONES.map((tone) => toneArt(tone))
const toneFaint = TONES.map((tone) => toneArt(tone, '#c9d0dc'))

function soundForBase(base: string, tone: Tone) {
  const alone = spell('', base)
  return soundKey(alone ? alone.base : base, tone)
}

function tapTone(tone: Tone) {
  curTone.value = tone
  toneRun.value += 1
  vibrate('light')
  play(soundForBase(toneBase.value, tone))
  passGuide('tone')
}

function pickToneBase(base: string) {
  toneBase.value = base
  if (curTone.value) tapTone(curTone.value as Tone)
}

const markAt = ref(0)
const markPicked = ref(-1)
const markState = ref<'' | 'right' | 'wrong'>('')
const markSample = computed(() => MARK_SAMPLES[markAt.value % MARK_SAMPLES.length])
const markLetters = computed(() => [...markSample.value[0]].map((char) => display(char)))
const markTarget = computed(() => markPlace(markSample.value[0]).index)
const markRule = computed(() => markPlace(markSample.value[0]).rule)
const markDone = computed(() => mark(markSample.value[0], markSample.value[1]))
const TONE_SIGNS = ['ˉ', 'ˊ', 'ˇ', 'ˋ']

function tapLetter(index: number) {
  if (markState.value) return
  if (!'aoeiuv'.includes(markSample.value[0][index])) {
    markPicked.value = index
    markState.value = 'wrong'
    vibrate('heavy')
    later(() => {
      markPicked.value = -1
      markState.value = ''
    }, 600)
    return
  }
  markPicked.value = index
  const right = index === markTarget.value
  markState.value = right ? 'right' : 'wrong'
  vibrate(right ? 'light' : 'heavy')
  if (right) {
    play(soundKey(markSample.value[0], markSample.value[1]))
    passGuide('mark')
  } else {
    later(() => {
      markPicked.value = markTarget.value
      markState.value = 'right'
      play(soundKey(markSample.value[0], markSample.value[1]))
    }, 900)
  }
}

function nextMark() {
  clearTimers()
  let next = markAt.value
  while (next === markAt.value) next = Math.floor(Math.random() * MARK_SAMPLES.length)
  markAt.value = next
  markPicked.value = -1
  markState.value = ''
}

const canReset = computed(() => {
  if (mode.value === 'whole') return found.value.length > 0
  if (mode.value === 'tone') return markState.value !== ''
  return false
})

function resetStage() {
  clearTimers()
  if (mode.value === 'whole') newFind()
  if (mode.value === 'tone') nextMark()
}

// ---- 小测验 ----
const quizMode = ref<QuizMode>('listen')
const QUIZ_MODES: Array<{ value: QuizMode; label: string }> = [
  { value: 'listen', label: '听一听' },
  { value: 'mark', label: '标一标' },
  { value: 'kind', label: '认一认' },
  { value: 'char', label: '读一读' },
]
const level = ref<Level>('easy')
const LEVELS: Array<{ value: Level; label: string }> = [
  { value: 'easy', label: '简单' },
  { value: 'medium', label: '中等' },
  { value: 'hard', label: '困难' },
]
const index = ref(0)
const score = ref(0)
const results = ref<Array<'right' | 'wrong' | null>>([])
const question = ref<Question | null>(null)
const picked = ref(-1)
const answer = ref<'' | 'right' | 'wrong'>('')
const finished = ref(false)
let advanceTimer: ReturnType<typeof setTimeout> | null = null

const quizIndicator = computed(() => `q-${quizMode.value}`)
const resultText = computed(() => {
  if (score.value === QUESTIONS) return t('太棒了，全部答对！')
  if (score.value >= 3) return t('不错，继续加油！')
  return t('多练几次就会啦')
})
const answerText = computed(() => (question.value ? question.value.options[question.value.answer] : ''))
const quizToneName = computed(() => (question.value?.tone ? pick(TONE_NAMES[question.value.tone - 1], en.value) : ''))

function clearAdvance() {
  if (advanceTimer) clearTimeout(advanceTimer)
  advanceTimer = null
}

function nextQuestion() {
  clearAdvance()
  answer.value = ''
  picked.value = -1
  question.value = makeQuestion(quizMode.value, level.value, question.value ?? undefined)
  if (question.value.mode === 'listen') setTimeout(replayQuestion, 300)
}

function replayQuestion() {
  if (question.value?.sound) play(question.value.sound)
}

function newRound() {
  index.value = 0
  score.value = 0
  results.value = Array.from({ length: QUESTIONS }, () => null)
  finished.value = false
  nextQuestion()
}

function advance() {
  clearAdvance()
  if (index.value + 1 >= QUESTIONS) {
    finished.value = true
    return
  }
  index.value += 1
  nextQuestion()
}

function choose(at: number) {
  if (answer.value || !question.value) return
  picked.value = at
  const right = at === question.value.answer
  answer.value = right ? 'right' : 'wrong'
  results.value[index.value] = answer.value
  vibrate(right ? 'light' : 'heavy')
  if (question.value.mode !== 'listen' && question.value.sound) play(question.value.sound)
  if (right) {
    score.value += 1
    advanceTimer = setTimeout(advance, 1600)
  }
}

function optionClass(at: number) {
  if (!answer.value || !question.value) return ''
  if (at === question.value.answer) return 'is-right'
  if (at === picked.value) return 'is-wrong'
  return 'is-dim'
}

function setQuizMode(value: QuizMode) {
  if (quizMode.value === value) return
  quizMode.value = value
  newRound()
}

function setLevel(value: Level) {
  if (level.value === value) return
  level.value = value
  newRound()
}

function setTab(value: Tab) {
  if (tab.value === value) return
  if (guideIndex.value >= 0) endGuide()
  clearTimers()
  clearAdvance()
  stopVoice()
  tab.value = value
  if (value === 'quiz' && !results.value.length) newRound()
}

onUnmounted(() => {
  clearTimers()
  clearAdvance()
  stopVoice()
})

// ---- 首次进入的引导 ----
type Rect = { left: number; top: number; width: number; height: number }
const guideIndex = ref(-1)
const guideRect = ref<Rect | null>(null)
const guidePassed = ref(false)
const viewH = ref(667)
const guides = computed(() => GUIDES[mode.value])
const guideStep = computed(() => (guideIndex.value >= 0 ? guides.value[guideIndex.value] : null))
const guideKey = () => `uday-pinyin-guide-${mode.value}-v1`

function passGuide(action: GuideAction) {
  if (guideStep.value?.action !== action || guidePassed.value) return
  guidePassed.value = true
  const at = guideIndex.value
  setTimeout(() => {
    if (guideIndex.value === at) nextGuide()
  }, 1300)
}

const holeStyle = computed(() => {
  const rect = guideRect.value
  if (!rect) return {}
  const pad = 8
  return { left: `${rect.left - pad}px`, top: `${rect.top - pad}px`, width: `${rect.width + pad * 2}px`, height: `${rect.height + pad * 2}px` }
})

const blockers = computed(() => {
  const rect = guideRect.value
  if (!rect) return []
  const pad = 8
  const top = rect.top - pad
  const bottom = rect.top + rect.height + pad
  const left = rect.left - pad
  const right = rect.left + rect.width + pad
  return [
    { top: '0px', left: '0px', right: '0px', height: `${Math.max(0, top)}px` },
    { top: `${bottom}px`, left: '0px', right: '0px', bottom: '0px' },
    { top: `${top}px`, left: '0px', width: `${Math.max(0, left)}px`, height: `${bottom - top}px` },
    { top: `${top}px`, left: `${right}px`, right: '0px', height: `${bottom - top}px` },
  ]
})

const cardStyle = computed(() => {
  const rect = guideRect.value
  if (!rect) return {}
  const cardH = 200
  const below = rect.top + rect.height + 16
  if (below + cardH < viewH.value) return { top: `${below}px` }
  if (rect.top - 16 - cardH > 0) return { bottom: `${viewH.value - rect.top + 16}px` }
  return { bottom: '24px' }
})

function noop() {}

function onHoleTap() {
  if (guideStep.value?.target === 'guide-quiz') {
    endGuide()
    setTab('quiz')
  } else nextGuide()
}

function measure(id: string) {
  return new Promise<{ rect: Rect; scrollTop: number } | null>((resolve) => {
    uni.createSelectorQuery()
      .select(`#${id}`).boundingClientRect()
      .selectViewport().scrollOffset(noop)
      .exec((result) => {
        const box = result?.[0]
        if (!box) return resolve(null)
        resolve({ rect: { left: box.left, top: box.top, width: box.width, height: box.height }, scrollTop: result?.[1]?.scrollTop ?? 0 })
      })
  })
}

async function measureRetry(id: string) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = await measure(id)
    if (result) return result
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  return null
}

async function focusGuide() {
  const step = guideStep.value
  if (!step) return
  guidePassed.value = false
  guideRect.value = null
  const first = await measureRetry(step.target)
  if (guideStep.value !== step) return
  if (!first) {
    nextGuide()
    return
  }
  const wanted = Math.max(0, first.scrollTop + first.rect.top - Math.max(90, (viewH.value - first.rect.height - 220) / 2))
  if (Math.abs(wanted - first.scrollTop) > 4) {
    uni.pageScrollTo({ scrollTop: wanted, duration: 260 })
    await new Promise((resolve) => setTimeout(resolve, 320))
  }
  const settled = (await measure(step.target)) ?? first
  if (guideStep.value === step) guideRect.value = settled.rect
}

function startGuide() {
  tab.value = 'explore'
  viewH.value = windowHeight()
  guideIndex.value = 0
  setTimeout(focusGuide, 60)
}

function nextGuide() {
  if (guideIndex.value < 0) return
  if (guideIndex.value + 1 >= guides.value.length) {
    endGuide()
    return
  }
  guideIndex.value += 1
  focusGuide()
}

function endGuide() {
  if (guideIndex.value < 0) return
  guideIndex.value = -1
  guideRect.value = null
  uni.setStorageSync(guideKey(), 1)
  uni.pageScrollTo({ scrollTop: 0, duration: 260 })
}

function maybeGuide() {
  if (tab.value === 'explore' && guideIndex.value < 0 && !uni.getStorageSync(guideKey())) startGuide()
}

onReady(() => {
  prepareVoice()
  setTimeout(maybeGuide, 600)
})
</script>

<template>
  <page-meta :page-style="pageBg.style" :background-color="pageBg.bg" :background-color-top="pageBg.bg" :background-color-bottom="pageBg.bg" :root-background-color="pageBg.bg" :background-text-style="pageBg.text" />
  <view class="theme-root page sub pinyin-page" :class="themeClass">
    <PageHeader safe show-back :title="t('拼音听写')" :caption="t('认一认、拼一拼、听一听、写一写')" />

    <view class="seg four">
      <view class="seg-indicator" :class="tab" />
      <text class="seg-item" :class="{ active: tab === 'explore' }" @click="setTab('explore')">{{ t('探索') }}</text>
      <text id="guide-quiz" class="seg-item" :class="{ active: tab === 'quiz' }" @click="setTab('quiz')">{{ t('小测验') }}</text>
      <text class="seg-item" :class="{ active: tab === 'dictate' }" @click="setTab('dictate')">{{ t('听写') }}</text>
      <text class="seg-item" :class="{ active: tab === 'print' }" @click="setTab('print')">{{ t('打印题目') }}</text>
    </view>

    <view v-if="voice.status === 'loading'" class="voice-bar">
      <view class="voice-bar-fill" :class="{ unknown: !voice.progress }" :style="voice.progress ? { width: `${voice.progress}%` } : {}" />
      <text class="voice-bar-text">{{ voiceTip }}</text>
    </view>
    <view v-else-if="voiceTip && tab !== 'print'" class="voice-tip press" :class="voice.status" @click="retryVoice">
      <view class="voice-dot" />
      <text>{{ voiceTip }}</text>
    </view>

    <PinyinPrint v-if="tab === 'print'" />
    <DictationPanel v-else-if="tab === 'dictate'" />

    <template v-else-if="tab === 'explore'">
      <view class="seg small five">
        <view class="seg-indicator" :style="{ transform: `translateX(${modeIndex * 100}%)` }" />
        <text v-for="item in MODES" :key="item.value" class="seg-item" :class="{ active: mode === item.value }" @click="setMode(item.value)">{{ pick(item.label, en) }}</text>
      </view>

      <view class="card stage">
        <view class="stage-top">
          <text :key="mode" class="stage-hint fade-up">{{ pick(HINTS[mode], en) }}</text>
          <view class="tools">
            <view v-if="canReset" class="tool press" hover-class="press-on" hover-stay-time="80" @click="resetStage">
              <text class="tool-glyph">↻</text>
            </view>
            <view class="tool help press" hover-class="press-on" hover-stay-time="80" @click="startGuide()">
              <text>?</text>
            </view>
          </view>
        </view>

        <!-- 声母 -->
        <template v-if="mode === 'initial'">
          <view class="focus">
            <view :key="`i-${initialBump}`" class="focus-letter bump">{{ curInitial }}</view>
            <view class="focus-side">
              <text class="focus-rhyme">{{ pick(INITIAL_RHYME[curInitial], en) }}</text>
              <view class="tags">
                <text v-for="tag in initialTags" :key="tag" class="tag">{{ tag }}</text>
              </view>
              <text v-if="curInitial === 'y' || curInitial === 'w'" class="focus-note">{{ pick(INITIAL_TAGS.yw, en) }}</text>
            </view>
            <view class="paper-wrap">
              <view :key="`p-${initialBump}`" class="paper" :class="isAspirated ? 'blow' : 'still'" />
              <view class="paper-pin" />
            </view>
          </view>
          <view id="guide-grid" class="letter-grid">
            <view v-for="(row, at) in INITIAL_ROWS" :key="at" class="letter-row">
              <view
                v-for="item in row"
                :key="item"
                class="letter press"
                :class="{ on: curInitial === item, curled: CURLED.has(item), yw: item === 'y' || item === 'w' }"
                hover-class="press-on"
                hover-stay-time="80"
                @click="tapInitial(item)"
              >{{ item }}</view>
            </view>
          </view>
        </template>

        <!-- 韵母 -->
        <template v-else-if="mode === 'final'">
          <view class="focus">
            <view :key="`f-${finalBump}`" class="focus-letter bump" :class="finalGroup">{{ display(curFinal) }}</view>
            <view class="focus-side">
              <text class="tag strong" :class="finalGroup">{{ pick(GROUP_NAMES[finalGroup], en) }}</text>
              <text :key="`fn-${finalBump}`" class="focus-rhyme fade-up">{{ finalNote }}</text>
            </view>
            <view class="focus-art">
              <view v-if="finalGroup === 'single'" :key="`m-${curFinal}`" class="art mouth bump" :style="{ backgroundImage: mouthArt(curFinal) }" />
              <view v-else-if="finalGlide" :key="`g-${finalBump}`" class="glide">
                <text class="glide-a">{{ finalGlide[0] }}</text>
                <view class="glide-arrow" />
                <text class="glide-b">{{ finalGlide[1] }}</text>
              </view>
              <view v-else-if="finalGroup === 'front' || finalGroup === 'back'" :key="`n-${curFinal}`" class="art nasal bump" :style="{ backgroundImage: nasalArt(finalGroup) }" />
              <text v-else class="er-curl">ㄦ</text>
            </view>
          </view>
          <view id="guide-grid" class="final-groups">
            <view v-for="group in FINAL_GROUPS" :key="group.id" class="final-group">
              <text class="group-name" :class="group.id">{{ pick(GROUP_NAMES[group.id], en) }}</text>
              <view class="letter-row wrap">
                <view
                  v-for="item in group.finals"
                  :key="item"
                  class="letter final press"
                  :class="[group.id, { on: curFinal === item }]"
                  hover-class="press-on"
                  hover-stay-time="80"
                  @click="tapFinal(item)"
                >{{ display(item) }}</view>
              </view>
            </view>
          </view>
        </template>

        <!-- 整体认读 -->
        <template v-else-if="mode === 'whole'">
          <view class="focus whole-focus">
            <view class="whole-ring">
              <text :key="`w-${wholeBump}`" class="whole-big bump">{{ mark(curWhole, wholeTone) }}</text>
            </view>
            <view class="focus-side">
              <text class="tag strong whole">{{ pick(WHOLE_NOTE, en) }}</text>
              <view class="tone-chips">
                <text v-for="tone in TONES" :key="tone" class="tone-chip press" :class="{ on: wholeTone === tone }" hover-class="press-on" hover-stay-time="80" @click="tapWholeTone(tone)">{{ mark(curWhole, tone) }}</text>
              </view>
            </view>
          </view>
          <view id="guide-grid" class="letter-row wrap whole-grid">
            <view
              v-for="item in WHOLE"
              :key="item"
              class="letter syllable press"
              :class="{ on: curWhole === item }"
              hover-class="press-on"
              hover-stay-time="80"
              @click="tapWhole(item)"
            >{{ item }}</view>
          </view>
        </template>

        <!-- 拼一拼 -->
        <template v-else-if="mode === 'spell'">
          <view id="guide-formula" class="formula press" :class="{ none: !labSpell }" @click="blend">
            <view :key="`lab-${labRun}`" class="formula-row">
              <template v-for="(part, at) in labParts" :key="at">
                <text v-if="at > 0" class="formula-plus">+</text>
                <text class="formula-part" :class="[part.role, { lit: partLit(part) }]">{{ part.text }}</text>
              </template>
              <text class="formula-eq">→</text>
              <text class="formula-result" :class="{ lit: blendStep === 2 }">{{ labSyllable || '?' }}</text>
            </view>
            <text class="formula-rhyme">{{ pick(labThree ? THREE_RHYME : SPELL_RHYME, en) }}</text>
          </view>
          <view class="notes">
            <text v-for="note in labNotes" :key="note" class="note fade-up" :class="{ bad: !labSpell }">{{ note }}</text>
          </view>
          <view class="pick-label">
            <text>{{ t('声母') }}</text>
            <text class="shuffle press" @click="randomLab">{{ t('随机拼一个') }}</text>
          </view>
          <scroll-view scroll-x class="chip-scroll" :show-scrollbar="false" enhanced>
            <view class="chip-line">
              <text
                v-for="item in LAB_INITIALS"
                :key="item || 'none'"
                class="lab-chip press"
                :class="{ on: labInitial === item }"
                hover-class="press-on"
                hover-stay-time="80"
                @click="pickLabInitial(item)"
              >{{ item || t('无') }}</text>
            </view>
          </scroll-view>
          <view class="pick-label"><text>{{ t('韵母') }}</text></view>
          <view id="guide-finals" class="lab-finals">
            <text
              v-for="item in LAB_FINALS"
              :key="item"
              class="lab-chip small press"
              :class="{ on: labFinal === item, medial: MEDIAL_FINALS.has(item), off: !spell(labInitial, item) }"
              hover-class="press-on"
              hover-stay-time="80"
              @click="pickLabFinal(item)"
            >{{ display(item) }}</text>
          </view>
          <view class="pick-label"><text>{{ t('声调') }}</text></view>
          <view class="tone-chips wide">
            <text v-for="tone in TONES" :key="tone" class="tone-chip press" :class="{ on: labTone === tone }" hover-class="press-on" hover-stay-time="80" @click="pickLabTone(tone)">{{ TONE_SIGNS[tone - 1] }} {{ pick(TONE_NAMES[tone - 1], en) }}</text>
          </view>
        </template>

        <!-- 声调 -->
        <template v-else>
          <view class="chip-line center">
            <text
              v-for="item in TONE_BASES"
              :key="item"
              class="lab-chip small press"
              :class="{ on: toneBase === item }"
              hover-class="press-on"
              hover-stay-time="80"
              @click="pickToneBase(item)"
            >{{ display(item) }}</text>
          </view>
          <view id="guide-tones" class="tone-stage">
            <view class="staff">
              <view v-for="line in 5" :key="line" class="staff-line" :style="{ top: `${(line - 1) * 25}%` }" />
              <view v-for="(art, at) in toneFaint" :key="`f${at}`" class="tone-path" :style="{ backgroundImage: art }" />
              <view v-if="curTone" :key="`t-${toneRun}`" class="tone-path strong draw" :style="{ backgroundImage: toneArts[curTone - 1] }" />
              <view v-if="curTone" :key="`b-${toneRun}`" class="tone-ball" :class="`t${curTone}`" />
            </view>
            <view class="tone-buttons">
              <view v-for="tone in TONES" :key="tone" class="tone-btn press" :class="{ on: curTone === tone }" hover-class="press-on" hover-stay-time="80" @click="tapTone(tone)">
                <text class="tone-btn-py">{{ mark(toneBase, tone) }}</text>
                <text class="tone-btn-name">{{ pick(TONE_NAMES[tone - 1], en) }}</text>
              </view>
            </view>
            <text v-if="curTone" :key="`s-${toneRun}`" class="tone-story fade-up">{{ pick(TONE_STORY[curTone - 1], en) }}</text>
          </view>
        </template>
      </view>

      <!-- 下面的面板：先玩，再读规则 -->
      <view v-if="mode === 'initial'" class="card panel">
        <text class="panel-title">{{ t('b d p q 分清楚') }}</text>
        <view id="guide-mirror" class="mirror">
          <view class="mirror-box">
            <view class="mirror-glyph" :class="{ right: stickRight, down: stickDown }">
              <view class="mirror-stick" />
              <view class="mirror-ball" />
            </view>
          </view>
          <view class="mirror-side">
            <text :key="`mr-${mirrorBump}`" class="mirror-letter bump">{{ mirrorLetter }}</text>
            <text class="mirror-rhyme">{{ pick(INITIAL_RHYME[mirrorLetter], en) }}</text>
            <view class="mirror-buttons">
              <view class="mini-btn press" hover-class="press-on" hover-stay-time="80" @click="flipStick('side')">{{ stickRight ? '⇠' : '⇢' }} {{ t('竖线换边') }}</view>
              <view class="mini-btn press" hover-class="press-on" hover-stay-time="80" @click="flipStick('dir')">{{ stickDown ? '⇡' : '⇣' }} {{ t('竖线换方向') }}</view>
            </view>
          </view>
        </view>
      </view>
      <view v-if="mode === 'initial'" class="card panel">
        <text class="panel-title">{{ t('平舌和翘舌') }}</text>
        <view class="pair-row">
          <view v-for="pair in TONGUE_PAIRS" :key="pair[0]" class="pair press" hover-class="press-on" hover-stay-time="80" @click="playPair(pair)">
            <text class="pair-a" :class="{ lit: tongueOn === pair[0] }">{{ pair[0] }}</text>
            <text class="pair-b" :class="{ lit: tongueOn === pair[1] }">{{ pair[1] }}</text>
          </view>
        </view>
        <text class="tip">{{ t('加了 h，舌尖就要翘起来。点一对，听听有什么不同。') }}</text>
      </view>

      <view v-if="mode === 'final'" id="guide-nasal" class="card panel">
        <text class="panel-title">{{ t('前鼻音和后鼻音') }}</text>
        <view class="nasal-row">
          <view class="nasal-side" :class="{ lit: nasalSide === 'front' }">
            <view class="art nasal small" :style="{ backgroundImage: nasalArt('front') }" />
            <text class="nasal-name">{{ pick(GROUP_NAMES.front, en) }}</text>
          </view>
          <view class="nasal-side" :class="{ lit: nasalSide === 'back' }">
            <view class="art nasal small" :style="{ backgroundImage: nasalArt('back') }" />
            <text class="nasal-name">{{ pick(GROUP_NAMES.back, en) }}</text>
          </view>
        </view>
        <view class="pair-row">
          <view v-for="(pair, at) in NASAL_PAIRS" :key="pair[0]" class="pair press" :class="{ on: nasalPair === at }" hover-class="press-on" hover-stay-time="80" @click="playNasal(at)">
            <text class="pair-a" :class="{ lit: nasalPair === at && nasalSide === 'front' }">{{ pair[0] }}</text>
            <text class="pair-b" :class="{ lit: nasalPair === at && nasalSide === 'back' }">{{ pair[1] }}</text>
          </view>
        </view>
      </view>
      <view v-if="mode === 'final'" id="guide-dots" class="card panel">
        <text class="panel-title">{{ t('ü 的两点') }}</text>
        <view class="dots-stage">
          <view class="dots-pick">
            <text
              v-for="item in DOT_INITIALS"
              :key="item"
              class="lab-chip small press"
              :class="{ on: dotPick === item, keep: item === 'n' || item === 'l' }"
              hover-class="press-on"
              hover-stay-time="80"
              @click="tapDot(item)"
            >{{ item }}</text>
          </view>
          <view :key="`d-${dotRun}`" class="dots-show">
            <text class="dots-init">{{ dotPick || '?' }}</text>
            <text class="dots-plus">+</text>
            <view class="dots-u">
              <text class="u-body">u</text>
              <view class="u-dots" :class="{ fly: dotDrop }"><view /><view /></view>
            </view>
            <text class="dots-eq">→</text>
            <text class="dots-result" :class="{ pop: dotPick }">{{ dotResult || '?' }}</text>
          </view>
        </view>
        <text class="tip">{{ pick(DOT_RULE, en) }}；{{ pick(DOT_KEEP, en) }}</text>
      </view>

      <view v-if="mode === 'whole'" id="guide-find" class="card panel">
        <view class="panel-head">
          <text class="panel-title">{{ pick(FIND_WHOLE, en) }}</text>
          <text class="find-count">{{ found.length }}/{{ findTotal }}</text>
        </view>
        <view class="find-grid">
          <view
            v-for="item in findItems"
            :key="item"
            class="find-cell press"
            :class="{ got: found.includes(item), shake: findWrong === item }"
            hover-class="press-on"
            hover-stay-time="80"
            @click="tapFind(item)"
          >{{ item }}</view>
        </view>
        <view v-if="findDone" class="find-done fade-up">
          <text>{{ pick(FIND_DONE, en) }}</text>
          <text class="shuffle press" @click="newFind">{{ t('再来一组') }}</text>
        </view>
      </view>

      <view v-if="mode === 'spell'" class="card panel">
        <text class="panel-title">{{ t('拼写的小规则') }}</text>
        <view class="rule-list">
          <text class="rule-line">{{ pick(SPELL_NOTES.dots, en) }}</text>
          <text class="rule-line">{{ pick(SPELL_NOTES.yw, en) }}</text>
          <text class="rule-line">{{ pick(SPELL_NOTES.short, en) }}</text>
        </view>
      </view>

      <view v-if="mode === 'tone'" id="guide-mark" class="card panel">
        <view class="panel-head">
          <text class="panel-title">{{ t('声调标在哪') }}</text>
          <text class="shuffle press" @click="nextMark">{{ t('换一个') }}</text>
        </view>
        <text class="mark-ask">{{ pick(MARK_ASK, en) }} · {{ pick(TONE_NAMES[markSample[1] - 1], en) }}</text>
        <view :key="`mk-${markAt}`" class="mark-word fade-up">
          <view
            v-for="(letter, at) in markLetters"
            :key="at"
            class="mark-letter press"
            :class="{ right: markState === 'right' && markPicked === at, wrong: markState === 'wrong' && markPicked === at, shake: markState === 'wrong' && markPicked === at }"
            @click="tapLetter(at)"
          >
            <text v-if="markState === 'right' && markPicked === at" class="mark-sign drop">{{ TONE_SIGNS[markSample[1] - 1] }}</text>
            <text class="mark-char" :class="{ dotless: letter === 'i' && markState === 'right' && markPicked === at }">{{ letter === 'i' && markState === 'right' && markPicked === at ? 'ı' : letter }}</text>
          </view>
        </view>
        <text v-if="markState === 'right'" class="mark-done fade-up">{{ markDone }}</text>
        <view class="rule-list">
          <text v-for="item in MARK_RULES" :key="item.rule" class="rule-line" :class="{ lit: markState === 'right' && markRule === item.rule }">{{ pick(item.text, en) }}</text>
          <text class="rule-line" :class="{ lit: markState === 'right' && markSample[0][markTarget] === 'i' }">{{ pick(DOT_OFF, en) }}</text>
        </view>
      </view>
    </template>

    <view v-else class="card quiz">
      <view class="seg small four">
        <view class="seg-indicator" :class="quizIndicator" />
        <text v-for="item in QUIZ_MODES" :key="item.value" class="seg-item" :class="{ active: quizMode === item.value }" @click="setQuizMode(item.value)">{{ t(item.label) }}</text>
      </view>
      <view class="level-row">
        <text class="level-label">{{ t('难度') }}</text>
        <view class="chip-row tight">
          <text
            v-for="item in LEVELS"
            :key="item.value"
            class="chip press"
            :class="{ active: level === item.value }"
            hover-class="press-on"
            hover-stay-time="80"
            @click="setLevel(item.value)"
          >{{ t(item.label) }}</text>
        </view>
      </view>

      <view v-if="!finished && question" class="question">
        <view class="progress">
          <view v-for="(item, at) in results" :key="at" class="dot" :class="[item, { current: at === index && !item }]" />
          <text class="progress-text">{{ t('第 {n}/{total} 题 · 得分 {score}', { n: index + 1, total: QUESTIONS, score }) }}</text>
        </view>
        <text :key="question.id" class="prompt fade-up">{{ pick(question.ask, en) }}</text>
        <view v-if="question.mode === 'listen'" class="listen-btn press" :class="{ playing: voice.playing }" hover-class="press-on" hover-stay-time="80" @click="replayQuestion">
          <view class="speaker" />
          <text>{{ t('再听一遍') }}</text>
        </view>
        <view v-else-if="question.show" :key="`s-${question.id}`" class="quiz-show bump" :class="question.mode">
          <text>{{ question.show }}</text>
          <text v-if="quizToneName" class="quiz-tone">{{ quizToneName }}</text>
        </view>
        <view class="options">
          <view
            v-for="(option, at) in question.options"
            :key="`${question.id}-${at}`"
            class="option press"
            :class="optionClass(at)"
            hover-class="press-on"
            hover-stay-time="80"
            @click="choose(at)"
          >{{ option }}</view>
        </view>
        <view class="feedback" :class="answer">
          <text v-if="answer === 'right'">{{ t('答对了，真棒！') }}{{ pick(question.rule, en) }}</text>
          <text v-else-if="answer === 'wrong'">{{ t('再想想，正确答案是 {answer}', { answer: answerText }) }}</text>
          <text v-else>{{ pick(question.rule, en) }}</text>
        </view>
        <button v-if="answer === 'wrong'" hover-class="press-on" hover-stay-time="80" class="btn block" @click="advance">{{ t('下一题') }}</button>
      </view>

      <view v-else-if="finished" class="result">
        <text class="result-score">{{ score }}<text class="result-total">/{{ QUESTIONS }}</text></text>
        <view class="result-dots">
          <view v-for="(item, at) in results" :key="at" class="dot" :class="item" />
        </view>
        <text class="result-text">{{ resultText }}</text>
        <button hover-class="press-on" hover-stay-time="80" class="btn block" @click="newRound">{{ t('再来一轮') }}</button>
      </view>
    </view>

    <view v-if="guideStep" class="guide">
      <view v-if="!guideRect" class="guide-mask" @touchmove.stop.prevent="noop" />
      <template v-else>
        <view v-for="(block, at) in blockers" :key="at" class="guide-block" :style="block" @touchmove.stop.prevent="noop" />
        <view class="guide-hole" :style="holeStyle" />
        <view v-if="!guideStep.action" class="guide-block" :style="holeStyle" @click="onHoleTap" @touchmove.stop.prevent="noop" />
      </template>
      <view v-if="guideRect" class="guide-card" :style="cardStyle" @touchmove.stop.prevent="noop">
        <view class="guide-top">
          <text class="guide-count">{{ guideIndex + 1 }}/{{ guides.length }}</text>
          <text class="guide-skip press" @click="endGuide">{{ t('跳过') }}</text>
        </view>
        <text class="guide-title">{{ guidePassed ? t('做得好！') : pick(guideStep.title, en) }}</text>
        <text class="guide-text">{{ guidePassed && guideStep.done ? pick(guideStep.done, en) : pick(guideStep.text, en) }}</text>
        <view class="guide-foot">
          <view class="guide-dots">
            <view v-for="(item, at) in guides" :key="at" class="guide-pip" :class="{ on: at === guideIndex }" />
          </view>
          <view class="guide-next press" hover-class="press-on" hover-stay-time="80" @click="nextGuide">
            {{ guideIndex + 1 >= guides.length ? t('知道了') : t('下一步') }}
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.pinyin-page { padding-bottom: calc(40px + var(--safe-bottom)); }
.py, .letter, .focus-letter, .whole-big, .formula-row, .lab-chip, .tone-btn-py, .option, .find-cell, .mark-word, .mirror-letter, .dots-show, .pair, .quiz-show, .tone-chip {
  font-family: 'Avenir Next', 'Helvetica Neue', Arial, sans-serif;
}
.seg {
  position: relative;
  display: flex;
  margin-bottom: 14px;
  padding: 4px;
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.6);
  box-shadow: inset 0 1px 0 #fff, 0 10px 24px -16px rgba(40, 52, 88, 0.35);
}
.seg.small { margin-bottom: 12px; border-radius: 14px; background: var(--surface-2); box-shadow: none; border-color: transparent; }
.seg-indicator {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 4px;
  width: calc((100% - 8px) / 4);
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 6px 14px -8px rgba(40, 52, 88, 0.45), inset 0 1px 0 #fff;
  transition: transform 0.42s cubic-bezier(0.34, 1.3, 0.64, 1);
}
.seg.five .seg-indicator { width: calc((100% - 8px) / 5); }
.seg-indicator.quiz, .seg-indicator.q-mark { transform: translateX(100%); }
.seg-indicator.dictate, .seg-indicator.q-kind { transform: translateX(200%); }
.seg-indicator.print, .seg-indicator.q-char { transform: translateX(300%); }
.seg-item {
  position: relative;
  z-index: 1;
  flex: 1;
  height: 38px;
  color: var(--muted);
  font-size: 14px;
  font-weight: 700;
  line-height: 38px;
  text-align: center;
  white-space: nowrap;
}
.seg-item.active { color: var(--accent-text); }
.seg.small .seg-item { height: 34px; font-size: 13px; line-height: 34px; }
.theme-dark .seg { border-color: var(--line); background: var(--paper); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 10px 24px -16px rgba(0, 0, 0, 0.6); }
.theme-dark .seg-indicator { background: var(--surface-2); box-shadow: 0 6px 14px -8px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.06); }
.theme-dark .seg.small { border-color: transparent; background: var(--surface-2); box-shadow: none; }
.theme-dark .seg.small .seg-indicator { background: var(--paper); }

.voice-bar { position: relative; overflow: hidden; height: 36px; margin: -4px 0 12px; border-radius: 12px; background: var(--surface-2); }
.voice-bar-fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: rgba(255, 122, 69, 0.28); }
.voice-bar-fill.unknown { width: 38%; animation: voice-slide 1.1s ease-in-out infinite; }
.voice-bar-text { position: relative; z-index: 1; display: block; color: var(--ink); font-size: 13px; font-weight: 700; line-height: 36px; text-align: center; }
@keyframes voice-slide {
  0% { transform: translateX(-120%); }
  100% { transform: translateX(320%); }
}
.voice-tip { display: flex; align-items: center; gap: 8px; margin: -4px 0 12px; padding: 8px 12px; border-radius: 12px; background: var(--surface-2); color: var(--muted); font-size: 12px; font-weight: 650; }
.voice-tip.error { background: rgba(241, 90, 54, 0.12); color: #d9482a; }
.voice-dot { width: 8px; height: 8px; border-radius: 50%; background: #ffb08d; animation: breathe 1.2s ease-in-out infinite; }
.voice-tip.error .voice-dot, .voice-tip.off .voice-dot { animation: none; background: currentColor; }

.stage { padding: 14px 14px 18px; border-radius: 28px; }
.stage-top { display: flex; align-items: center; justify-content: space-between; padding: 0 4px; }
.stage-hint { color: var(--muted); font-size: 13px; }
.tools { display: flex; gap: 8px; }
.tool { display: flex; width: 34px; height: 34px; align-items: center; justify-content: center; border-radius: 12px; background: var(--surface-2); color: var(--muted); font-size: 16px; font-weight: 800; }
.tool-glyph { font-size: 18px; }

/* 上半部分：当前选中的字母和讲解 */
.focus { display: flex; align-items: center; gap: 12px; margin: 12px 0 14px; padding: 14px; min-height: 96px; border-radius: 22px; background: var(--surface-2); }
.focus-letter { min-width: 84px; color: #ff6a33; font-size: 58px; font-weight: 800; line-height: 1; text-align: center; letter-spacing: -0.02em; }
.focus-letter.compound { color: #8a5cf6; }
.focus-letter.front { color: #1f9d5c; }
.focus-letter.back { color: #2f86f6; }
.focus-side { display: flex; flex: 1; flex-direction: column; gap: 8px; min-width: 0; }
.focus-rhyme { color: var(--ink); font-size: 15px; font-weight: 750; line-height: 1.45; }
.focus-note { color: var(--muted); font-size: 12px; line-height: 1.5; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
.tag { align-self: flex-start; padding: 0 10px; border-radius: 999px; background: var(--paper); color: var(--muted); font-size: 12px; font-weight: 700; line-height: 24px; }
.tag.strong { color: #fff; background: #ff7a45; }
.tag.strong.compound { background: #8a5cf6; }
.tag.strong.front { background: #34c77b; }
.tag.strong.back { background: #4fa3ff; }
.tag.strong.whole { background: #f2a93b; }

/* 吹纸条：送气音飘起来，不送气只轻轻晃 */
.paper-wrap { position: relative; width: 44px; height: 70px; flex: none; }
.paper-pin { position: absolute; top: 2px; left: 16px; width: 12px; height: 6px; border-radius: 3px; background: #9aa3b5; }
.paper { position: absolute; top: 6px; left: 19px; width: 6px; height: 58px; border-radius: 3px; background: linear-gradient(180deg, #fff, #ffe7d6); box-shadow: 0 0 0 1px #ffc9a8; transform-origin: 50% 0; }
.paper.blow { animation: blow 1.1s cubic-bezier(0.34, 1.3, 0.64, 1); }
.paper.still { animation: wiggle 0.8s ease; }

.letter-grid { display: flex; flex-direction: column; gap: 8px; }
.letter-row { display: flex; justify-content: center; gap: 8px; }
.letter-row.wrap { justify-content: flex-start; }
.letter-row.wrap { flex-wrap: wrap; }
.letter {
  display: flex;
  width: calc((100% - 24px) / 4);
  height: 52px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line);
  border-radius: 16px;
  box-sizing: border-box;
  background: var(--paper);
  color: var(--ink);
  font-size: 24px;
  font-weight: 750;
  transition: border-color 0.25s ease, background 0.25s ease, transform 0.25s ease, color 0.25s ease;
}
.letter.curled { color: #d9622d; }
.letter.yw { color: var(--muted); border-style: dashed; }
.letter.on { border-color: #ff9a6b; background: var(--accent-soft); transform: translateY(-2px); }
.final-groups { display: flex; flex-direction: column; gap: 10px; }
.group-name { display: block; margin-bottom: 6px; font-size: 12px; font-weight: 750; }
.group-name.single { color: #ff6a33; }
.group-name.compound { color: #8a5cf6; }
.group-name.front { color: #1f9d5c; }
.group-name.back { color: #2f86f6; }
.letter.final { width: calc((100% - 32px) / 5); height: 46px; font-size: 20px; }
.letter.final.single { color: #ff6a33; }
.letter.final.compound { color: #8a5cf6; }
.letter.final.front { color: #1f9d5c; }
.letter.final.back { color: #2f86f6; }
.letter.syllable { height: 46px; font-size: 19px; }
.whole-grid { margin-top: 2px; }

.focus-art { display: flex; width: 92px; height: 92px; flex: none; align-items: center; justify-content: center; }
.art { background-repeat: no-repeat; background-position: center; background-size: contain; }
.art.mouth, .art.nasal { width: 88px; height: 88px; }
.art.nasal.small { width: 96px; height: 96px; }
.glide { display: flex; align-items: center; gap: 2px; font-size: 26px; font-weight: 800; color: #8a5cf6; }
.glide-a { animation: glide-a 1.2s ease; }
.glide-b { animation: glide-b 1.2s ease; }
.glide-arrow { width: 22px; height: 3px; border-radius: 2px; background: #c8b5ff; animation: grow 1.2s ease; transform-origin: 0 50%; }
.er-curl { color: #ff6a33; font-size: 40px; font-weight: 800; animation: curl 1.4s ease; }

/* 整体认读 */
.whole-ring { display: flex; width: 108px; height: 108px; flex: none; align-items: center; justify-content: center; border: 3px dashed #f2a93b; border-radius: 50%; animation: spin-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }
.whole-big { color: var(--ink); font-size: 32px; font-weight: 800; }
.tone-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.tone-chips.wide { gap: 8px; }
.tone-chip { padding: 0 10px; border-radius: 999px; background: var(--paper); color: var(--ink); font-size: 15px; font-weight: 700; line-height: 30px; transition: background 0.25s ease, color 0.25s ease, transform 0.25s ease; }
.tone-chip.on { background: #ff7a45; color: #fff; transform: translateY(-2px); }
.tone-chips.wide .tone-chip { flex: 1; min-width: 40%; background: var(--surface-2); text-align: center; font-size: 13px; }
.tone-chips.wide .tone-chip.on { background: #ff7a45; }

/* 拼一拼 */
.formula { margin: 12px 0 8px; padding: 18px 12px 12px; border-radius: 22px; background: var(--surface-2); transition: background 0.25s ease; }
.formula.none { background: rgba(241, 90, 54, 0.08); }
.formula-row { display: flex; align-items: center; justify-content: center; gap: 6px; animation: merge 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
.formula-part { min-width: 44px; padding: 6px 8px; border-radius: 14px; background: var(--paper); color: var(--ink); font-size: 26px; font-weight: 800; text-align: center; box-shadow: 0 6px 14px -10px rgba(40, 52, 88, 0.5); transition: transform 0.25s ease, background 0.25s ease, color 0.25s ease; }
.formula-part.i { color: #ff6a33; }
.formula-part.m { color: #8a5cf6; }
.formula-part.f { color: #2f86f6; }
.formula-part.lit { background: #ff7a45; color: #fff; transform: translateY(-4px) scale(1.08); }
.formula-plus, .formula-eq { color: var(--muted); font-size: 20px; font-weight: 700; }
.formula-result { min-width: 72px; color: var(--ink); font-size: 36px; font-weight: 800; text-align: center; transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.25s ease; }
.formula-result.lit { color: #ff6a33; transform: scale(1.15); }
.formula.none .formula-result { color: #d9482a; }
.formula-rhyme { display: block; margin-top: 10px; color: var(--muted); font-size: 12px; text-align: center; }
.notes { display: flex; flex-direction: column; gap: 6px; min-height: 8px; margin-bottom: 4px; }
.note { padding: 6px 12px; border-radius: 12px; background: var(--accent-soft); color: var(--accent-text); font-size: 12px; font-weight: 650; line-height: 1.5; }
.note.bad { background: rgba(241, 90, 54, 0.12); color: #d9482a; animation: shake 0.4s ease; }
.pick-label { display: flex; align-items: center; justify-content: space-between; margin: 12px 4px 8px; color: var(--ink); font-size: 13px; font-weight: 750; }
.shuffle { color: var(--accent-text); font-size: 12px; font-weight: 700; }
.chip-scroll { width: 100%; white-space: nowrap; }
.chip-line { display: inline-flex; gap: 8px; padding: 2px 2px 6px; }
.chip-line.center { display: flex; flex-wrap: wrap; justify-content: center; margin: 12px 0 6px; }
.lab-chip { display: inline-block; min-width: 44px; padding: 0 12px; border: 1px solid var(--line); border-radius: 14px; box-sizing: border-box; background: var(--paper); color: var(--ink); font-size: 18px; font-weight: 750; line-height: 40px; text-align: center; transition: border-color 0.25s ease, background 0.25s ease, transform 0.25s ease, opacity 0.25s ease; }
.lab-chip.small { min-width: 40px; padding: 0 8px; font-size: 16px; line-height: 36px; }
.lab-chip.on { border-color: #ff9a6b; background: var(--accent-soft); transform: translateY(-2px); }
.lab-chip.medial { border-style: dashed; }
.lab-chip.off { opacity: 0.35; }
.lab-chip.keep { color: #1f9d5c; }
.lab-finals { display: flex; flex-wrap: wrap; gap: 6px; }

/* 声调 */
.tone-stage { margin-top: 4px; }
.staff { position: relative; height: 150px; margin: 8px 8px 14px; }
.staff-line { position: absolute; left: 0; right: 0; height: 1px; background: var(--line); }
.tone-path { position: absolute; inset: 0; background-repeat: no-repeat; background-size: 100% 100%; }
.tone-path.strong { animation: draw 0.9s ease; }
.tone-ball { position: absolute; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #ffd6a8, #ff7a45); box-shadow: 0 6px 12px -4px rgba(255, 106, 51, 0.6); animation-duration: 1s; animation-timing-function: ease-in-out; animation-fill-mode: forwards; }
.tone-ball.t1 { animation-name: tone1; }
.tone-ball.t2 { animation-name: tone2; }
.tone-ball.t3 { animation-name: tone3; }
.tone-ball.t4 { animation-name: tone4; }
.tone-buttons { display: flex; gap: 8px; }
.tone-btn { display: flex; flex: 1; flex-direction: column; align-items: center; gap: 2px; padding: 10px 0 8px; border: 1px solid var(--line); border-radius: 16px; background: var(--paper); transition: border-color 0.25s ease, background 0.25s ease, transform 0.25s ease; }
.tone-btn.on { border-color: #ff9a6b; background: var(--accent-soft); transform: translateY(-2px); }
.tone-btn-py { color: var(--ink); font-size: 24px; font-weight: 800; }
.tone-btn-name { color: var(--muted); font-size: 11px; font-weight: 650; }
.tone-story { display: block; margin-top: 10px; color: var(--muted); font-size: 13px; text-align: center; }

/* 面板 */
.panel { margin-top: 14px; }
.panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.panel-title { display: block; color: var(--ink); font-size: 14px; font-weight: 750; }
.panel > .panel-title { margin-bottom: 10px; }
.tip { display: block; margin-top: 10px; color: var(--muted); font-size: 12px; line-height: 1.6; }

.mirror { display: flex; align-items: center; gap: 16px; }
.mirror-box { display: flex; width: 120px; height: 140px; flex: none; align-items: center; justify-content: center; border-radius: 20px; background: var(--surface-2); }
.mirror-glyph { position: relative; width: 70px; height: 110px; }
.mirror-stick { position: absolute; top: 0; left: 0; width: 12px; height: 110px; border-radius: 6px; background: #ff7a45; transition: left 0.5s cubic-bezier(0.34, 1.4, 0.64, 1); }
.mirror-ball { position: absolute; top: 58px; left: 10px; width: 52px; height: 52px; border: 12px solid #4fa3ff; border-radius: 50%; box-sizing: border-box; transition: top 0.5s cubic-bezier(0.34, 1.4, 0.64, 1), left 0.5s cubic-bezier(0.34, 1.4, 0.64, 1); }
.mirror-glyph.right .mirror-stick { left: 58px; }
.mirror-glyph.right .mirror-ball { left: 8px; }
.mirror-glyph.down .mirror-ball { top: 0; }
.mirror-side { display: flex; flex: 1; flex-direction: column; gap: 6px; }
.mirror-letter { color: #ff6a33; font-size: 52px; font-weight: 800; line-height: 1; }
.mirror-rhyme { color: var(--ink); font-size: 14px; font-weight: 700; }
.mirror-buttons { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
.mini-btn { padding: 0 12px; border-radius: 12px; background: var(--surface-2); color: var(--ink); font-size: 13px; font-weight: 700; line-height: 34px; }

.pair-row { display: flex; gap: 8px; }
.pair { display: flex; flex: 1; align-items: center; justify-content: center; gap: 8px; padding: 10px 0; border: 1px solid var(--line); border-radius: 16px; background: var(--paper); font-size: 20px; font-weight: 800; transition: border-color 0.25s ease, background 0.25s ease; }
.pair.on { border-color: #ff9a6b; background: var(--accent-soft); }
.pair-a, .pair-b { color: var(--ink); transition: color 0.2s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.pair-a.lit, .pair-b.lit { color: #ff6a33; transform: scale(1.3); }
.nasal-row { display: flex; gap: 10px; margin-bottom: 12px; }
.nasal-side { display: flex; flex: 1; flex-direction: column; align-items: center; gap: 4px; padding: 8px 0; border-radius: 18px; background: var(--surface-2); transition: background 0.25s ease, transform 0.25s ease; }
.nasal-side.lit { background: var(--accent-soft); transform: translateY(-2px); }
.nasal-name { color: var(--ink); font-size: 12px; font-weight: 700; }

.dots-stage { display: flex; flex-direction: column; gap: 12px; }
.dots-pick { display: flex; gap: 8px; }
.dots-pick .lab-chip { flex: 1; min-width: 0; }
.dots-show { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 14px 0; border-radius: 18px; background: var(--surface-2); font-size: 30px; font-weight: 800; color: var(--ink); }
.dots-plus, .dots-eq { color: var(--muted); font-size: 22px; }
.dots-u { position: relative; color: #ff6a33; }
.u-dots { position: absolute; top: 2px; left: 50%; display: flex; gap: 6px; transform: translateX(-50%); }
.u-dots view { width: 6px; height: 6px; border-radius: 50%; background: #ff6a33; }
.u-dots.fly { animation: fly-off 0.9s ease forwards; }
.dots-result { min-width: 56px; text-align: center; }
.dots-result.pop { animation: bump 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s both; color: #1f9d5c; }

.find-count { color: var(--accent-text); font-size: 13px; font-weight: 750; }
.find-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.find-cell { display: flex; width: calc((100% - 16px) / 3); height: 48px; align-items: center; justify-content: center; border: 1px solid var(--line); border-radius: 16px; box-sizing: border-box; background: var(--paper); color: var(--ink); font-size: 19px; font-weight: 750; transition: background 0.25s ease, color 0.25s ease, transform 0.25s ease; }
.find-cell.got { border-color: #34c77b; background: rgba(52, 199, 123, 0.14); color: #1f9d5c; transform: scale(1.04); }
.find-cell.shake { border-color: #f15a36; color: #d9482a; animation: shake 0.4s ease; }
.find-done { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; padding: 8px 14px; border-radius: 12px; background: rgba(52, 199, 123, 0.14); color: #1f9d5c; font-size: 13px; font-weight: 750; }

.rule-list { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
.rule-line { padding: 6px 12px; border-radius: 12px; background: var(--surface-2); color: var(--muted); font-size: 12px; font-weight: 650; line-height: 1.5; transition: background 0.3s ease, color 0.3s ease, transform 0.3s ease; }
.rule-line.lit { background: rgba(52, 199, 123, 0.14); color: #1f9d5c; transform: translateX(4px); }
.mark-ask { display: block; color: var(--muted); font-size: 12px; }
.mark-word { display: flex; justify-content: center; gap: 6px; margin: 16px 0 6px; }
.mark-letter { position: relative; display: flex; width: 46px; height: 64px; align-items: flex-end; justify-content: center; padding-bottom: 6px; border: 1px solid var(--line); border-radius: 14px; box-sizing: border-box; background: var(--paper); transition: border-color 0.25s ease, background 0.25s ease; }
.mark-letter.right { border-color: #34c77b; background: rgba(52, 199, 123, 0.14); }
.mark-letter.wrong { border-color: #f15a36; background: rgba(241, 90, 54, 0.12); }
.mark-char { color: var(--ink); font-size: 30px; font-weight: 800; line-height: 1; }
.mark-sign { position: absolute; top: 4px; left: 0; right: 0; color: #ff6a33; font-size: 28px; font-weight: 800; line-height: 1; text-align: center; }
.mark-sign.drop { animation: drop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
.mark-done { display: block; color: #1f9d5c; font-size: 22px; font-weight: 800; text-align: center; }

/* 小测验 */
.level-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.level-label { color: var(--ink); font-size: 14px; font-weight: 650; }
.question { display: flex; flex-direction: column; align-items: center; }
.progress { display: flex; align-items: center; gap: 6px; margin-top: 10px; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--track); transition: background 0.3s ease, transform 0.3s ease; }
.dot.current { background: #ffb08d; transform: scale(1.25); }
.dot.right { background: #34c77b; }
.dot.wrong { background: #f15a36; }
.progress-text { margin-left: 6px; color: var(--muted); font-size: 12px; }
.prompt { margin-top: 14px; color: var(--ink); font-size: 17px; font-weight: 700; }
.listen-btn { display: flex; align-items: center; gap: 10px; margin-top: 14px; padding: 12px 22px; border-radius: 999px; background: var(--accent-soft); color: var(--accent-text); font-size: 15px; font-weight: 750; }
.listen-btn.playing .speaker { animation: breathe 0.6s ease-in-out infinite; }
.speaker { position: relative; width: 14px; height: 14px; border-radius: 3px 0 0 3px; background: currentColor; }
.speaker::after { content: ''; position: absolute; top: -4px; left: 8px; border-top: 11px solid transparent; border-bottom: 11px solid transparent; border-right: 12px solid currentColor; transform: scaleX(-1); }
.quiz-show { display: flex; flex-direction: column; align-items: center; margin-top: 12px; color: var(--ink); font-size: 44px; font-weight: 800; line-height: 1.2; }
.quiz-show.char { font-size: 64px; }
.quiz-tone { margin-top: 2px; padding: 0 10px; border-radius: 999px; background: var(--accent-soft); color: var(--accent-text); font-size: 13px; line-height: 24px; }
.options { display: flex; flex-wrap: wrap; justify-content: space-between; align-self: stretch; gap: 10px; margin-top: 16px; }
.option { display: flex; width: calc(50% - 5px); height: 60px; align-items: center; justify-content: center; border: 1px solid var(--line); border-radius: 16px; box-sizing: border-box; background: var(--paper); color: var(--ink); font-size: 24px; font-weight: 750; transition: background 0.25s ease, opacity 0.25s ease, transform 0.25s ease, color 0.25s ease; }
.option.is-right { border-color: #34c77b; background: #34c77b; color: #fff; transform: scale(1.03); }
.option.is-wrong { border-color: #f15a36; background: #f15a36; color: #fff; }
.option.is-dim { opacity: 0.45; }
.feedback { align-self: stretch; margin-top: 12px; padding: 8px 14px; border-radius: 12px; color: var(--muted); font-size: 13px; font-weight: 650; line-height: 1.5; text-align: center; transition: background 0.25s ease, color 0.25s ease; }
.feedback.right { background: rgba(52, 199, 123, 0.14); color: #1f9d5c; }
.feedback.wrong { background: rgba(241, 90, 54, 0.12); color: #d9482a; }
.question .btn.block { align-self: stretch; margin-top: 14px; }
.result { display: flex; flex-direction: column; align-items: center; padding: 26px 0 6px; }
.result-score { color: var(--ink); font-size: 56px; font-weight: 800; }
.result-total { color: var(--muted); font-size: 24px; }
.result-dots { display: flex; gap: 8px; margin-top: 8px; }
.result-dots .dot { width: 12px; height: 12px; }
.result-text { margin: 14px 0 18px; color: var(--ink); font-size: 15px; font-weight: 700; }
.result .btn.block { align-self: stretch; }

.guide { position: fixed; inset: 0; z-index: 70; pointer-events: none; }
.guide-mask { position: absolute; inset: 0; background: rgba(15, 18, 30, 0.62); pointer-events: auto; }
.guide-block { position: fixed; pointer-events: auto; }
.guide-hole {
  position: fixed;
  border-radius: 18px;
  box-shadow: 0 0 0 3000px rgba(15, 18, 30, 0.62), 0 0 0 2px rgba(255, 255, 255, 0.9);
  pointer-events: none;
  transition: left 0.3s ease, top 0.3s ease, width 0.3s ease, height 0.3s ease;
}
.guide-card {
  position: fixed;
  left: 20px;
  right: 20px;
  z-index: 2;
  padding: 16px 18px 14px;
  border-radius: 20px;
  background: #ffffff;
  box-shadow: 0 18px 40px -16px rgba(15, 18, 30, 0.5);
  pointer-events: auto;
  animation: fade-up 0.3s ease;
}
.guide-top { display: flex; align-items: center; justify-content: space-between; }
.guide-count { color: #ff7a45; font-size: 12px; font-weight: 750; }
.guide-skip { padding: 2px 0 2px 12px; color: #8a93a3; font-size: 13px; }
.guide-title { display: block; margin-top: 6px; color: #1c2430; font-size: 17px; font-weight: 800; }
.guide-text { display: block; margin-top: 6px; color: #4a5363; font-size: 14px; line-height: 1.6; }
.guide-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 14px; }
.guide-dots { display: flex; gap: 5px; }
.guide-pip { width: 6px; height: 6px; border-radius: 3px; background: #dde2ea; transition: width 0.25s ease, background 0.25s ease; }
.guide-pip.on { width: 16px; background: #ff7a45; }
.guide-next { padding: 8px 18px; border-radius: 999px; background: #1c2430; color: #ffffff; font-size: 14px; font-weight: 700; }

.bump { animation: bump 0.45s cubic-bezier(0.34, 1.56, 0.64, 1); }
.fade-up { animation: fade-up 0.35s ease; }
.shake { animation: shake 0.4s ease; }
@keyframes bump {
  0% { transform: scale(0.6); opacity: 0.4; }
  60% { transform: scale(1.12); opacity: 1; }
  100% { transform: scale(1); }
}
@keyframes fade-up {
  0% { opacity: 0; transform: translateY(6px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-8px); }
  75% { transform: translateX(8px); }
}
@keyframes breathe {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.3); opacity: 0.6; }
}
@keyframes blow {
  0% { transform: rotate(0); }
  25% { transform: rotate(-62deg); }
  55% { transform: rotate(-40deg); }
  80% { transform: rotate(-12deg); }
  100% { transform: rotate(0); }
}
@keyframes wiggle {
  0%, 100% { transform: rotate(0); }
  40% { transform: rotate(-5deg); }
  70% { transform: rotate(2deg); }
}
@keyframes glide-a {
  0% { opacity: 0.3; transform: translateX(-8px); }
  40% { opacity: 1; transform: translateX(0); }
  100% { opacity: 1; }
}
@keyframes glide-b {
  0%, 45% { opacity: 0.2; transform: translateX(-10px); }
  100% { opacity: 1; transform: translateX(0); }
}
@keyframes grow {
  0%, 20% { transform: scaleX(0); }
  70%, 100% { transform: scaleX(1); }
}
@keyframes curl {
  0% { transform: rotate(-40deg) scale(0.6); }
  60% { transform: rotate(12deg) scale(1.1); }
  100% { transform: rotate(0) scale(1); }
}
@keyframes spin-in {
  0% { transform: rotate(-90deg) scale(0.7); }
  100% { transform: rotate(0) scale(1); }
}
@keyframes merge {
  0% { opacity: 0.4; letter-spacing: 12px; transform: scale(0.94); }
  100% { opacity: 1; letter-spacing: 0; transform: scale(1); }
}
@keyframes draw {
  0% { opacity: 0; clip-path: inset(0 100% 0 0); }
  100% { opacity: 1; clip-path: inset(0 0 0 0); }
}
@keyframes tone1 {
  0% { left: 4%; top: 14%; }
  100% { left: 96%; top: 14%; }
}
@keyframes tone2 {
  0% { left: 4%; top: 52%; }
  100% { left: 96%; top: 10%; }
}
@keyframes tone3 {
  0% { left: 4%; top: 34%; }
  25% { left: 24%; top: 76.5%; }
  50% { left: 46%; top: 88%; }
  75% { left: 70%; top: 68.5%; }
  100% { left: 96%; top: 18%; }
}
@keyframes tone4 {
  0% { left: 4%; top: 10%; }
  100% { left: 96%; top: 90%; }
}
@keyframes fly-off {
  0% { transform: translate(-50%, 0); opacity: 1; }
  100% { transform: translate(40%, -40px) rotate(40deg); opacity: 0; }
}
@keyframes drop {
  0% { transform: translateY(-24px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
