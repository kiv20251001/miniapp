# AI 开发约定

本仓库是「Uday家庭课表计划」单仓：网页 H5 在 `apps/web/`，NestJS 在 `server/`，微信小程序在 `apps/miniprogram/`。改代码前先读本文件。新对话先读 `.cursor/skills/myhome-project/SKILL.md` 了解产品功能和两端数据边界。

## 现在改哪里

- **H5 UI / 路由 / Pinia**：`apps/web/`，技术栈保持 Vue3 + Vite + TS + Pinia + Vue Router。业务数据走 `/api`，不要再写 `myhome.v1`。
- **NestJS API**：`server/`，本地 SQLite，`npm run dev:server`。
- **微信小程序**：`apps/miniprogram/`。页面用 uni-app，登录和数据走微信云开发，不要改成调用 Nest API。上线步骤见 `docs/miniprogram-launch.md`，微信后台要设置和勾选的项（隐私指引、订阅模板、云函数权限等）汇总在 `docs/miniprogram-backend-settings.md`，新增隐私接口时同步更新它，日常打包与体验版 / 正式版发布见 `docs/miniprogram-deploy.md`。课前 15 分钟提醒在课程色块的「设置提醒」上，部署定时云函数见 `docs/miniprogram-remind.md`。二级页面放 `src/subpages/` 分包，主包限制 2MB。「3D 太阳系」体积大，单独放 `src/subsolar/` 分包：three.js 由 `scripts/vendor-three.mjs` 复制进分包（uni-app 会把 `node_modules` 打进主包）；语音讲解用微信同声传译插件，只有正式打包（`npm run build:mp`）带插件，开发包自动去掉，测试号也能调试。云环境 ID 和 AppID 写在 `apps/miniprogram/.env`（开发版、体验版连 `VITE_CLOUD_ENV_DEV`，正式版连 `VITE_CLOUD_ENV_PROD`，运行时自动选择），不要手改 `project.config.json` 的 `miniprogramRoot`。小程序支持中英文，点左上角 logo 切换：页面文案用 `src/i18n` 的 `t('中文原文')` 包起来，英文写在 `src/i18n/en.ts`，改完跑 `npm run check:i18n -w @myhome/miniprogram` 查漏翻；toast / 弹窗文案在出口统一翻译。
- **项目是什么、用户怎么走**：`.cursor/skills/myhome-project/`（`SKILL.md` 入口，`flows.md` 是小程序流程）。
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
