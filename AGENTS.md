# AI 开发约定

本仓库是「Uday家庭课表计划」单仓：网页 H5 在 `apps/web/`，NestJS 在 `server/`，微信小程序在 `apps/miniprogram/`。改代码前先读本文件。新对话先读 `.cursor/skills/myhome-project/SKILL.md` 了解产品功能和两端数据边界。

## 现在改哪里

- **H5 UI / 路由 / Pinia**：`apps/web/`，技术栈保持 Vue3 + Vite + TS + Pinia + Vue Router。业务数据走 `/api`，不要再写 `myhome.v1`。
- **NestJS API**：`server/`，本地 SQLite，`npm run dev:server`。
- **微信小程序**：`apps/miniprogram/`。页面用 uni-app，登录和数据走微信云开发，不要改成调用 Nest API。上线步骤见 `docs/miniprogram-launch.md`，微信后台要设置和勾选的项（隐私指引、订阅模板、云函数权限等）汇总在 `docs/miniprogram-backend-settings.md`，新增隐私接口时同步更新它，日常打包与体验版 / 正式版发布见 `docs/miniprogram-deploy.md`。课前 15 分钟提醒在课程色块的「设置提醒」上，部署定时云函数见 `docs/miniprogram-remind.md`。二级页面放 `src/subpages/` 分包，主包和每个分包上传限制 2MB，代码质量扫描按编译后 1.5MB 检查（大约是 `report-size` 显示体积的 1.5 倍）。代码质量扫描建议代码包里的图片、音频合计不超过 200K（不影响发布），界面图标要高清、线条图标用 SVG；字体、工具分享图（`cloud-storage/share/`）和以后的大图放 `apps/miniprogram/cloud-storage/` 再上传云存储；主包要小于 1.5MB（代码质量扫描），别往主包里加大文件，代码里用 `cloudFile('路径')` 取 File ID。「3D 太阳系」体积大，单独放 `src/subsolar/` 分包：three.js 由 `scripts/vendor-three.mjs` 复制进分包（uni-app 会把 `node_modules` 打进主包）；点星球只显示讲解文字。「3D 几何体」（`src/subsolar/cube/`，正方体、长方体、棱柱、棱锥、正多面体）也用 three.js，所以放同一个分包。「3D 人体器官」（`src/subsolar/body/`）同样在这个分包；场景只认 `model.ts` 的 `BodyModel`，现在用写实人体（BodyParts3D + HuBMAP 肺，CC BY 4.0），由 `scripts/build-body-model.mjs` 生成到 `cloud-storage/body/`、`realistic.ts` 下载读取，下载不到时用 `procedural.ts` 代码生成的人体；改模型要换文件名，见 `docs/prd/body-organs.md` 8.1。「拼音听写」单独放 `src/subpinyin/` 分包（`subpages` 分包编译后快到 1.5MB 了，代码质量扫描每个包都按 1.5MB 算）的读音是真人录的音节 MP3（Chen Wang，CC BY-SA），打包成 `cloud-storage/pinyin/pinyin-v2.bin` 放云存储，按字拼接播放，由 `scripts/build-pinyin-audio.mjs` 生成；汉字转拼音用 `words.ts` 多音词表加字帖读音表，不要接在线 TTS。分包之间不能互相引用 JS。主包页面也会用到的公共代码放主包，比如打印导出 `src/print/`；只被分包用到的数据不要放主包，代码质量扫描会报「主包未使用的 JS」，所以写字表、读音表在字帖和拼音听写里各放一份。个人主体加不了微信同声传译插件，开发包和正式包都不带语音。云环境 ID 和 AppID 写在 `apps/miniprogram/.env`（开发版、体验版连 `VITE_CLOUD_ENV_DEV`，正式版连 `VITE_CLOUD_ENV_PROD`，运行时自动选择），不要手改 `project.config.json` 的 `miniprogramRoot`。小程序支持中英文，点左上角 logo 切换：页面文案用 `src/i18n` 的 `t('中文原文')` 包起来，英文写在 `src/i18n/en.ts`，改完跑 `npm run check:i18n -w @myhome/miniprogram` 查漏翻；toast / 弹窗文案在出口统一翻译。
- **项目是什么、用户怎么走**：`.cursor/skills/myhome-project/`（`SKILL.md` 入口，`flows.md` 是小程序流程）。
- **工具箱里新工具的页面、引导、小测验和动效**：`.cursor/skills/miniprogram-tool-style/`（`SKILL.md` 入口，`patterns.md` 是照抄清单）。认识类工具跟现有的时钟、分数、单位换算、几何体对齐。
- **业务规则、能力地图、账号与接口**：`.cursor/skills/myhome-backend-contracts/`（`SKILL.md` 入口；`capability-map.md` / `product-map.md` / `account-model.md` / `data-and-api.md` / `backend-contracts.md` / `billing-model-v2.md` / `gaps-and-backlog.md`）。
- **产品与口径说明**：`docs/prd/`、`docs/domain/`、`docs/design/`、`docs/architecture.md`。

不要把级联删除、共享课、统计口径只写在页面组件里；Store 保持业务语义，契约保持与 `apps/web/src/domain/types.ts`、`apps/web/src/stores/app.ts` 一致。

## 版权（图片、字体、数据）

小程序是公开发布的产品，所有素材都要能商用。现有功能和新功能都按这条检查：

- **图片**：只用自己画的、代码生成的，或许可明确可商用的（公有领域、CC0、CC BY 并署名）。不要从网页、竞品（例如 NOBOOK）、图库、搜索结果里直接拿图或贴图，包括截图后描摹。星球、图标这类能用代码生成的优先代码生成。
- **字体**：随包、放云存储或画进图片里的文字，只能用开源可商用字体（思源黑体 / Noto Sans SC、霞鹜文楷等 SIL OFL 字体）。苹方、冬青黑、微软雅黑、方正、汉仪、Helvetica 这类系统或商业字体只能在手机上做界面显示，不能打包，也不能在生成脚本里画进图片。生成脚本统一用 `apps/miniprogram/scripts/open-fonts.mjs`，不要开 `loadSystemFonts`。
- **数据和文案**：地图、笔顺、词库等数据要确认许可；讲解文字自己写，不照抄百科或教材原文。
- **新增素材**：同步登记到 `docs/third-party-assets.md`，写清来源和许可；说不清来源的不上线。需要保留的许可声明（OFL 字体 name 表、MIT 文件头、Arphic 声明）不要删。

## 还没做

- 可复用类型与口径再抽到 `packages/domain/`。现在规则在 `server/src/domain`，云函数打包时引用它。
- 课前 15 分钟提醒的定时云函数要在微信开发者工具里上传部署后才会发通知，见 `docs/miniprogram-remind.md`。
- 网页和小程序不要合成同一套数据库。现在网页走 SQLite，小程序走微信云数据库。

## 明确不要做

- 不要修改本机全局 Git `user.name` / `user.email`。本仓库本地身份是 `jj` / `jj@admin.com`。
- 不要提交 `node_modules/`、`dist/`、`.env`、日志或密钥。例外：`apps/miniprogram/.env` 入库，但只能放 AppID、云环境 ID 这类公开标识。
- 不要为了小程序提前重写现有 H5 业务逻辑。
