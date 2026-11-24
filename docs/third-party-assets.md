# 第三方素材与许可清单

小程序里每一张图片、每一个字体、每一份数据都要能说清楚「从哪来、什么许可、能不能商用」。规则写在根目录 `AGENTS.md` 的「版权」一节，这份是清单。新增素材时在这里加一行；说不清来源的素材不要上线。

## 正在使用

| 素材 | 用在哪里 | 来源 | 许可 | 注意 |
| --- | --- | --- | --- | --- |
| 霞鹜文楷 GB（`cloud-storage/fonts/copybook-kai.woff`） | 字帖楷体，放云存储 | [lxgw/LxgwWenkaiGB](https://github.com/lxgw/LxgwWenkaiGB) | SIL OFL 1.1，可商用 | 子集化时保留 name 表里的版权和许可（`build-copybook-font.mjs` 已加 `--name-IDs=*`）；不能单独售卖字体 |
| 思源黑体 Noto Sans SC | 生成分享图、工具图标时的文字 | [notofonts/noto-cjk](https://github.com/notofonts/noto-cjk) | SIL OFL 1.1，可商用 | 只在生成脚本里用（`scripts/open-fonts.mjs`），字体文件不随包发布 |
| hanzi-writer-data（Make Me a Hanzi） | 字帖笔顺、工具图标和分享图里的「米」等汉字笔画 | [chanind/hanzi-writer-data](https://github.com/chanind/hanzi-writer-data) | Arphic Public License，可商用、可再分发 | 派生数据（`subpages/copybook/strokes.ts`）沿用同一许可，文件头已写明 |
| pinyin-pro | 字帖读音表（生成后只引用结果） | npm | MIT | — |
| Natural Earth 1:110m 陆地 | 「3D 太阳系」地球的海陆轮廓 `subsolar/earth-mask.ts` | [naturalearthdata.com](https://www.naturalearthdata.com/about/terms-of-use/) | 公有领域 | 不需要署名 |
| BodyParts3D 4.0（`cloud-storage/body/body-v1.bin` 的皮肤、肌肉、骨骼、大脑、心脏、血管、消化和泌尿器官） | 「3D 人体器官」写实人体，放云存储 | [DBCLS LSDB Archive](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html)，经 [tahfimism/human-atlas](https://github.com/tahfimism/human-atlas)（固定提交 `02c8184`）转成米、Y 朝上的整理版 | CC BY 4.0（官方许可页 2025-02-27 起；2013 年的 OBJ 文件头还写着 CC BY-SA 2.1 JP，按许可页为准，旧许可下商用也允许），可商用、可改编 | 必须署名「BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International」并注明修改：页面「身体里有什么」卡片底部和模型文件头 `credits` 都写了，不要删。我们的修改：减面、改色、量化、去掉外生殖器（`scripts/build-body-model.mjs` 的 `mannequin()`）。正式商用前建议发邮件请 DBCLS 书面确认一次 |
| HuBMAP 人体参考图谱 3D 器官（男性肺 v1.4） | 「3D 人体器官」写实人体的肺（BodyParts3D 没有完整的肺表面） | [HuBMAP HRA](https://cdn.humanatlas.io/digital-objects/ref-organ/lung-male/v1.4/) | CC BY 4.0，可商用 | 同上署名并注明修改（减面、按支气管树对齐到 BodyParts3D） |
| meshoptimizer | 生成写实人体时减面（只在构建脚本里用） | npm | MIT | 不随包发布 |
| three.js r162 | 「3D 太阳系」「3D 几何体」「3D 人体器官」3D 渲染 | npm `three` | MIT | 打包后的 `subsolar/vendor/three.js` 保留了文件头的版权声明，不要删 |
| dayjs、vue、pinia、uni-app | 运行时 | npm | MIT / Apache-2.0 | — |

## 项目自己画或自己写的

这些没有第三方版权，但要保证以后改动时不混进别人的东西：

- `src/static/icons/`：`scripts/render-icons.mjs` 里手写的 SVG 路径。
- `src/static/tools/`、`src/static/share/`、`src/static/share-cover.jpg`：`render-tool-icons.mjs`、`render-share-covers.mjs`、`render-share-cover.mjs` 生成，文字用思源黑体。
- `src/static/logo-u.svg`、`src/static/brand/yimu-logo.svg`：本项目品牌标识，源文件在 `docs/prd/UI/`。
- 「3D 太阳系」的星球表面：`src/subsolar/textures.ts` 用着色器现场生成，没有贴图文件；天体讲解文字为本项目原创，数字取自公开天文常数。
- 「3D 几何体」：几何体的顶点由代码算出（`src/subsolar/cube/solids.ts`），面上的字和颜色由 `src/subsolar/cube/textures.ts` 在画布上现场画，没有贴图文件；知识点和题目为本项目原创，参考网站只借鉴了交互方式。
- 「单位换算」：天平、砝码、尺子、量杯、物品小图标都是 `src/subpages/units/art.ts` 里手写的 SVG（运行时转成 data URI，没有图片文件），天平和刻度用 view + CSS 画；工具箱图标 `static/tools/units.png` 和分享图 `static/share/units.jpg` 由 `scripts/render-tool-icons.mjs`、`scripts/render-share-covers.mjs` 生成；物品重量、长度等常识数据和题目为本项目原创。
- 「3D 人体器官」：写实人体用上表的 BodyParts3D 和 HuBMAP 肺；下载不到时退回的简化人体由 `src/subsolar/body/procedural.ts` 用代码生成（球体变形、管道、车削体），器官位置和形状按常识自己摆，没有描摹任何图谱或参考网站的模型。食物旅行、呼吸、血液循环的路线由 `scripts/build-body-model.mjs` 从网格算出。讲解文字、演示文案为本项目原创；工具箱图标 `static/tools/body.png` 和分享图 `static/share/body.jpg` 由 `scripts/render-tool-icons.mjs`、`scripts/render-share-covers.mjs` 生成。
- 「逻辑思维」：青蛙、河岸、船、人物、灯、水管、鸡、兔、天平、箱子、方块、连线、跳子、火柴、拼板、桥、滚珠、摩天楼、马步、皇后、破译、点灯、骨牌、齿轮、围栏、扫雷、密码盘都是页面画布里用代码画的，没有图片素材，局面和线索为本项目原创。工具箱图标 `static/tools/logic.png` 和分享图 `static/share/logic.jpg` 由 `scripts/render-tool-icons.mjs`、`scripts/render-share-covers.mjs` 生成。
- 页面文字：小程序运行时用手机系统字体显示，不随包带字体文件。

## 待确认

- `src/static/user_icon.jpg`（孩子头像四宫格雪碧图，网页端对应 `apps/web/src/assets/user_icon.png`）：仓库里没有记录来源。请确认是自己绘制、AI 生成后有商用权，或购买了授权；确认不了就换成自绘或可商用的头像，并在上表补一行。
