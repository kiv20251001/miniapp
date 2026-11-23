# 动手学工具：照抄什么

结构以 `apps/miniprogram/src/subpages/units/index.vue` 为准。一种玩法、没有多模式时，用 `subpages/clock/index.vue` 更短。3D 舞台用 `subsolar/cube/index.vue`。

## 文件

```
src/subpages/{name}/
  index.vue          页面壳、探索、测验、引导
  lessons.ts         文案、物件、GUIDES
  quiz.ts            出题。换题时避开上一题
  {Name}Print.vue    第三段
  worksheet.ts       卷子题型
  render.ts          画到 src/print 的离屏画布
  art.ts             需要小图时，手写 SVG，运行时转 data URI
```

用 three.js 时把这一目录放到 `src/subsolar/{name}/`。

## 页面骨架

脚本顶部固定这些：

```ts
useFamilyPage()
const themeClass = useThemePage()
const pageBg = usePageBackground()

type Tab = 'explore' | 'quiz' | 'print'
const TAB_SHARE: Record<Tab, ToolShareKey> = { explore: 'tool', quiz: 'toolQuiz', print: 'toolPrint' }

onShareAppMessage(() => toolShare(TAB_SHARE[tab.value], `/subpages/{name}/index?tab=${tab.value}`))
onShareTimeline(() => toolMoments(TAB_SHARE[tab.value], `tab=${tab.value}`))
useSearchTitle(() => t(TOOL_SHARE_TITLES[TAB_SHARE[tab.value]]))
```

模板：

```vue
<page-meta :page-style="pageBg.style" :background-color="pageBg.bg" :background-color-top="pageBg.bg" :background-color-bottom="pageBg.bg" :root-background-color="pageBg.bg" :background-text-style="pageBg.text" />
<view class="theme-root page sub" :class="themeClass">
  <PageHeader safe show-back :title="t('工具名')" :caption="t('动词一、动词二')" />

  <view class="seg three">
    <view class="seg-indicator" :class="tab" />
    <text class="seg-item" :class="{ active: tab === 'explore' }" @click="setTab('explore')">{{ t('探索') }}</text>
    <text id="guide-quiz" class="seg-item" :class="{ active: tab === 'quiz' }" @click="setTab('quiz')">{{ t('小测验') }}</text>
    <text class="seg-item" :class="{ active: tab === 'print' }" @click="setTab('print')">{{ t('打印题目') }}</text>
  </view>

  <ToolPrint v-if="tab === 'print'" />
  <template v-else-if="tab === 'explore'">
    <!-- 可选：.seg.small 切换玩法 -->
    <view class="card stage">
      <view class="stage-top">
        <text class="stage-hint">{{ stageHint }}</text>
        <view class="tools">
          <view v-if="canReset" class="tool press" hover-class="press-on" hover-stay-time="80" @click="resetStage">
            <AppIcon name="eraser" tone="muted" :size="17" />
          </view>
          <view class="tool help press" hover-class="press-on" hover-stay-time="80" @click="startGuide()">
            <text>?</text>
          </view>
        </view>
      </view>
      <!-- 舞台。会变的读数： :key + bump / fade-up -->
    </view>
    <view class="card panel"><!-- 规则、进率 --></view>
  </template>
  <view v-else class="card quiz"><!-- 见下方测验 --></view>

  <!-- guide 整段从 units/index.vue 抄，含样式 -->
</view>
```

分段指示器：`.seg-indicator` 宽度是 `calc((100% - 8px) / 档数)`。第 n 档（从 0 起）`translateX(n * 100%)`。三档主分段用 class `explore` / `quiz` / `print`。小分段用 `m-`、`q-` 前缀，避免和主分段撞 class。样式从 units 的 `.seg` 到 `.theme-dark .seg.small .seg-indicator` 整段复制，再改 translate 档位。

可点元素一律 `press` + `hover-class="press-on"` + `hover-stay-time="80"`。选中 chip 用全局 `.chip.active`。

## 测验状态

照 units 的这几个 ref：`index`、`score`、`results`（长度 5，元素 `'right' | 'wrong' | null`）、`picked`、`answer`（`'' | 'right' | 'wrong'`）、`finished`、一个 `advanceTimer`。

```ts
const QUESTIONS = 5

function choose(at: number) {
  if (answer.value || !question.value) return
  picked.value = at
  const right = at === rightIndex.value
  answer.value = right ? 'right' : 'wrong'
  results.value[index.value] = answer.value
  vibrate(right ? 'light' : 'heavy')
  if (right) {
    score.value += 1
    advanceTimer = setTimeout(advance, 1600)
  }
}
```

反馈三句不要改：

- 未答：本题规则
- 答对：`t('答对了，真棒！')` + 规则
- 答错：`t('再想想，正确答案是 {answer}', { answer: answerText })`

结束三句：`太棒了，全部答对！` / `不错，继续加油！`（`score >= 3`）/ `多练几次就会啦`。

选项 class：未答不出色；揭晓后正确项 `is-right`，选错项 `is-wrong`，其他 `is-dim`。样式用 units 的 `.option`、`.feedback`、`.dot`、`.result`。

## 引导

`lessons.ts`：

```ts
export type GuideStep = {
  target: string
  title: { zh: string; en: string }
  text: { zh: string; en: string }
  action?: 'drag' | 'object' // 本工具真实会发生的动作
  done?: { zh: string; en: string }
}
```

时序照 units 的 `focusGuide` / `passGuide` / `maybeGuide` / `endGuide`：

- 存储键 `uday-{name}-guide-{mode}-v1`。`endGuide` 才 `setStorageSync`。
- `passGuide`：action 对得上且还没过，就 `guidePassed = true`，记下当前下标，1300ms 后若下标没变再 `nextGuide`。
- `focusGuide`：量 4 次，每次隔 150ms；仍没有就 `nextGuide`。量到了就 `pageScrollTo` 把目标滚到中部，260ms，再量一次写入 `guideRect`。
- 有 `action` 时镂空不盖挡板，孩子直接操作舞台。没有 `action` 时挡板接 `onHoleTap`。
- 换 `setTab` 时若 `guideIndex >= 0` 先 `endGuide`。

卡片文案：

```vue
<text class="guide-title">{{ guidePassed ? t('做得好！') : pick(guideStep.title, en) }}</text>
<text class="guide-text">{{ guidePassed && guideStep.done ? pick(guideStep.done, en) : pick(guideStep.text, en) }}</text>
```

底部「跳过」、圆点、「下一步」/ 最后一步「知道了」。样式从 units 的 `.guide` 到 `@keyframes fade-up` 复制。

## 分段动画

```ts
let timers: Array<ReturnType<typeof setTimeout>> = []
function later(fn: () => void, ms: number) {
  timers.push(setTimeout(fn, ms))
}
function clearTimers() {
  timers.forEach(clearTimeout)
  timers = []
}
```

数一数这种逐格动画：

```ts
function startZoom() {
  if (zooming.value) return
  clearTimers()
  zooming.value = true
  zoomCount.value = 0
  for (let at = 1; at <= 10; at += 1) {
    later(() => {
      zoomCount.value = at
      vibrate(at === 10 ? 'medium' : 'light')
      if (at === 10) {
        zooming.value = false
        passGuide('zoom')
      }
    }, at * 180)
  }
}
```

`resetMode`、`setTab`、`onUnload` 都要 `clearTimers()`，并把 `zooming` 一类标记设回 `false`。拖动中的尺带加 `live`，CSS 写 `.tape.live { transition: none; }`。

会变的数字用 `:key` 触发 `bump`。CSS：

```css
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
```

## 打印页

照 `UnitsPrint.vue` 的流程，不要新写保存逻辑：

1. 题型、难度、页数（1–3）、是否附答案。
2. `watch` 这些选项，一变就清空 `images`。
3. `generate`：`rendering` 挡住重复点，`uni.showLoading({ title: '正在排版…', mask: true })`，`renderPages` 画完 `scrollToFirstSheet`。
4. 保存用 `saveSheetImages` / `saveSheetPdf`，进行中用 `saving`。
5. 失败走 `formTip`。

画布字体、分页、页眉走 `src/print/sheet.ts` 和 `src/print/frame.ts`。

## 登记

- `src/data/tools.ts` 加一项。注释里写了分包规则。
- `src/pages.json` 的对应分包加页面。新的 3D 分包才需要改 `preloadRule`；普通工具放已有的 `subpages`。
- `src/utils/share.ts`：`TOOL_SHARE_TITLES` 加工具、测验、打印三句；`TOOL_SHARE_IMAGES` 三句都指向同一张图。
- `scripts/render-tool-icons.mjs`、`scripts/render-share-covers.mjs` 各加一笔并跑脚本，产出 `static/tools/{key}.png` 和 `static/share/{key}.jpg`。
- 工具箱副标题在 `views/ToolboxView.vue` 的 `PageHeader` caption。工具变多时改这一句，并给 `t()` 补英文。
- `sitemap.json` 不用改。工具页默认可被搜到，不要加 disallow。
- 有新图或新数据：`docs/third-party-assets.md` 写来源和许可。
- `npm run check:i18n -w @myhome/miniprogram`。
