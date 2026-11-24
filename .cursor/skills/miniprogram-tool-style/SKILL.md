---
name: miniprogram-tool-style
description: >-
  按 Uday 小程序工具箱里认识时钟、认识分数、单位换算、3D 几何体的现有实现，统一新工具的页面结构、探索操作、小测验、打印题、首次引导和动效。
  在新增或改动工具箱工具、探索台、小测验、打印练习、引导镂空、分段切换、点击反馈或舞台动画时使用。
  Use when adding or restyling a miniprogram toolbox tool, explore stage, quiz, worksheet, coach mark, segmented control, or motion.
---

# 小程序工具交互

新的「孩子动手学」工具照这条做。先读本文件，要抄结构和样式时再读 [patterns.md](patterns.md)。不要另起一套按钮、遮罩或缓动。

## 先选哪一类

| 孩子怎么用 | 照谁做 | 顶部分段 |
| --- | --- | --- |
| 拖、点、数，然后做题、打印 | `subpages/units`（模式多）、`subpages/clock`（一种玩法）、`subpages/pizza`、`subsolar/cube` | 探索 / 小测验 / 打印题目 |
| 只看、听讲解，没有对错 | `subsolar/body`、`subsolar/index`（太阳系） | 身体探索 / 工作演示，或单场景。不要硬加测验 |
| 连续小游戏，对错就在台上 | `subpages/logic` | 一条闯关，画布上拖、点、推或称。问号和下面的说明都是这一关怎么操作，并有看答案。不要按题型分成固定分段，不要另开测验和打印，也不要做成点一下就过的选项题 |
| 填参数后出一张卷子 | `subpages/copybook`、`subpages/maths` | 没有探索台。表单 + 生成 + 保存 |

用户没指定时，认识类新工具用第一行。

## 页面必须有的东西

动手学工具的页面壳：

- `page-meta` 绑 `usePageBackground()`，根节点是 `theme-root page sub`，加上 `useThemePage()` 的 class。`useFamilyPage()` 让未登录也能进。
- `PageHeader`：`safe`、`show-back`，标题是工具名，caption 用两个动宾短语（单位换算是「量一量、称一称、铺一铺、倒一倒」）。
- 顶部分段三个：探索、小测验、打印题目。白块用 `transform` 滑过去，0.42s，`cubic-bezier(0.34, 1.3, 0.64, 1)`。档位数变了就改指示器宽度，公式在 patterns.md。
- 分享写在页面文件里。`onShareAppMessage` / `onShareTimeline` 按当前 tab 换标题，路径带 `?tab=`。`useSearchTitle` 用同一句。测验和打印共用工具那张分享图。
- `onLoad` 只接受 `quiz` 和 `print`，用来接分享深链。

探索台：

- 一张 `card stage`。顶上左边一句当前能做什么（`stage-hint`），右边两个 34px 圆角方钮：有内容才显示橡皮 `AppIcon name="eraser"`，永远有「?」。
- 「?」重放当前模式的引导，不看本地是否已经看过。
- 多种玩法时，舞台上方再放一条小分段（`.seg.small`）。相邻刻度用横滑 `.chip`，选中是 `active`。
- 舞台下面用 `.card.panel` 放规则、进率、单位家族。先玩，再读说明。
- 橡皮只清当前模式的操作，不清引导记录。

## 小测验

一轮 5 题。状态和文案照 `subpages/units/index.vue` 的测验段，不要改词：

- 未答：反馈条是这道题的规则，灰色。
- 点选项后立刻锁定，不能改。答对振动 `light`，条变绿，文案「答对了，真棒！」再接规则，1600ms 后自己下一题。答错振动 `heavy`，条变橙红，「再想想，正确答案是 {answer}」，露出「下一题」，不自动跳。
- 对的选项 `.is-right`，选错的 `.is-wrong`，其余 `.is-dim`。
- 进度是一排 8px 圆点：当前放大并着浅橙，对 `#34c77b`，错 `#f15a36`。旁边「第 {n}/{total} 题 · 得分 {score}」。
- 结束：大号得分，全对「太棒了，全部答对！」，3 分及以上「不错，继续加油！」，否则「多练几次就会啦」，按钮「再来一轮」。
- 换题型或难度就 `newRound()`。第一次点进小测验才出题。换顶部分段时清掉自动下一题的定时器。

难度固定三个词：简单、中等、困难。打印页用同一组，并给每一档一句说明这个难度会出什么。

## 首次引导

每个模式单独记一次，键名 `uday-{工具}-{模式}-v1`。看完或点「跳过」才写入。`onReady` 后 600ms，仅当停在探索且该模式没记录时自动开始。换模式延迟 400ms 再判断，避免分段动画还没停就量位置。

一步一个目标，目标是页面元素的 `id`。步骤写在 `lessons.ts` 的 `GUIDES`，不写在模板里。

- 有 `action` 的步：镂空可以真的拖、点。页面在对应操作成功时调用 `passGuide(action)`，标题改成「做得好！」，有 `done` 就换文案，1300ms 后下一步。
- 没有 `action` 的步：镂空上盖一层挡板，点镂空等于「下一步」。最后一步的目标是 `guide-quiz`，点镂空切到小测验。
- 最后一步说明右上角「?」可以再看，以及可以打印。
- 量不到目标就跳过这一步，不能留一层没有卡片的遮罩。
- 卡片放在镂空下面；下面不够就放上面。换顶部分段立刻结束引导。
- 文案对孩子说，一句操作、一句会看到什么。中英都写在步骤的 `{ zh, en }` 里，界面用现成的 `pick()`。

镂空、挡板、卡片的 DOM 和样式从 `subpages/units/index.vue` 的 `guide` 段照抄。需要一根跟着转的手指时，再抄 `subpages/clock/index.vue` 的 `guide-swing`。不要抽成公共组件，除非用户明确要求：引导现在各页自带，`subpages` 和 `subsolar` 不能互相引用。

## 动效

只用这几组，时间不要另写一套：

| 什么时候 | 怎么动 |
| --- | --- |
| 可点的 view | `class="press"`，`hover-class="press-on"`，`hover-stay-time="80"`。按下缩到 0.96，松手用全局 0.46s 弹性。按钮用全局 `button` 过渡，同样加 `hover-class="press-on"` |
| 分段白块 | 0.42s，`cubic-bezier(0.34, 1.3, 0.64, 1)` |
| 读数、题干换了 | 元素加 `:key`，class `bump` 或 `fade-up`。`bump` 0.45s、`cubic-bezier(0.34, 1.56, 0.64, 1)`，从 0.6 倍弹到 1.12 再回到 1。`fade-up` 0.35s，上移 6px |
| 选中的物件、单位阶梯 | 0.25s 内边框变 `#ff9a6b`、底 `var(--accent-soft)`、`translateY(-2px)` |
| 逐个铺满、数格子 | 一格 180ms，最后一格振动 `medium`，并 `passGuide` |
| 尺带、水位、天平这种连续量 | 0.7s–0.9s，`cubic-bezier(0.34, 1.2, 0.64, 1)` 到 `cubic-bezier(0.34, 1.5, 0.64, 1)` |
| 手指正拖着 | 加 `live`（或同等 class），`transition: none`。松手再开过渡 |
| 做错、溢出 | `shake` 0.4s，左右 8px。颜色走错题橙红，不要再加红色闪屏 |
| 做完、平衡、铺满 | 底 `rgba(52, 199, 123, 0.14)`，字 `#1f9d5c`。读数常态是 `#ff6a33` |

颜色用 `app.scss` 的变量：`--ink`、`--muted`、`--paper`、`--surface-2`、`--line`、`--accent-soft`、`--accent-text`。成功绿和错题橙是工具页的固定色，不跟主题紫走。深色只要覆盖分段条，照 units 里 `.theme-dark .seg` 四行。

定时器收进一个 `later()` 数组。换模式、换刻度、离开页面时 `clearTimers()`，并且把「进行中」标记一起放下（`zooming`、`filling`、`building` 这类）。只清定时器、不放下标记，下一次点击会被拦住。

操作成功用 `uni.vibrateShort`：轻一点 `light`，数完或放上砝码 `medium`，答错 `heavy`。

## 打印

打印是顶部分段的第三页，组件如 `UnitsPrint.vue`，不要做成独立路由。生成走主包 `src/print/`：`renderPages`、`saveSheetImages`、`saveSheetPdf`、`scrollToFirstSheet`。加载文案「正在排版…」。至少留一种题型，用 `formTip('至少选一种题型')`。改难度、页数、题型或答案开关时清掉已生成的图。题图用代码画，不截屏。

## 文案和素材

- 界面句子包 `t('中文')`，英文写进 `src/i18n/en.ts`。改完跑 `npm run check:i18n -w @myhome/miniprogram`。
- 讲解自己写，不抄教材和百科。
- 图标、天平、尺子、物品用代码画。工具箱图标走 `scripts/render-tool-icons.mjs`，分享图走 `scripts/render-share-covers.mjs`。来源记到 `docs/third-party-assets.md`。
- 用到 three.js 的放 `src/subsolar/`，别的放 `src/subpages/`。两个分包不能互相 import。

## 不要做

- 不要新做底部弹层、系统 `wx.showModal` 教学、或另一套聚光灯。
- 不要让答对还要点「下一题」，也不要答错了自动跳走。
- 不要在拖动过程中开宽度、角度过渡。
- 不要把引导、测验抽进主包，除非用户要求。新工具整页抄最近的一个同类页，再换玩法。
- 不要改 `docs/miniprogram-seo.md` 里已经发出去的介绍，除非用户要更新对外文案。

## 做完核对

- [ ] 顶部分段、分享深链、`?`、橡皮（有脏状态时）都在
- [ ] 第一次进每个模式会引导，跳过之后不再自动出现，`?` 仍能重放
- [ ] 有 `action` 的步必须真的做出动作才算过
- [ ] 测验 5 题、对错颜色和那五句固定文案一致
- [ ] 换模式或离开页会清定时器和进行中标记
- [ ] 拖动时没有过渡滞后
- [ ] 登记项按 [patterns.md](patterns.md) 的清单走完，`check:i18n` 通过
