# AI 开发约定

本仓库是「Uday家庭课表计划」单仓：网页 H5 在 `apps/web/`，NestJS 在 `server/`，微信小程序在 `apps/miniprogram/`。改代码前先读本文件。新对话先读 `.cursor/skills/myhome-project/SKILL.md` 了解产品功能和两端数据边界。

## 现在改哪里

- **H5 UI / 路由 / Pinia**：`apps/web/`，技术栈保持 Vue3 + Vite + TS + Pinia + Vue Router。业务数据走 `/api`，不要再写 `myhome.v1`。
- **NestJS API**：`server/`，本地 SQLite，`npm run dev:server`。
- **微信小程序**：`apps/miniprogram/`。页面用 uni-app，登录和数据走微信云开发，不要改成调用 Nest API。上线步骤见 `docs/miniprogram-launch.md`，日常打包与体验版 / 正式版发布见 `docs/miniprogram-deploy.md`。课前 15 分钟提醒在课程色块的「设置提醒」上，部署定时云函数见 `docs/miniprogram-remind.md`。二级页面放 `src/subpages/` 分包，主包限制 2MB。云环境 ID 和 AppID 写在 `apps/miniprogram/.env`（开发版、体验版连 `VITE_CLOUD_ENV_DEV`，正式版连 `VITE_CLOUD_ENV_PROD`，运行时自动选择），不要手改 `project.config.json` 的 `miniprogramRoot`。
- **项目是什么、用户怎么走**：`.cursor/skills/myhome-project/`（`SKILL.md` 入口，`flows.md` 是小程序流程）。
- **业务规则、能力地图、账号与接口**：`.cursor/skills/myhome-backend-contracts/`（`SKILL.md` 入口；`capability-map.md` / `product-map.md` / `account-model.md` / `data-and-api.md` / `backend-contracts.md` / `billing-model-v2.md` / `gaps-and-backlog.md`）。
- **产品与口径说明**：`docs/prd/`、`docs/domain/`、`docs/design/`、`docs/architecture.md`。

不要把级联删除、共享课、统计口径只写在页面组件里；Store 保持业务语义，契约保持与 `apps/web/src/domain/types.ts`、`apps/web/src/stores/app.ts` 一致。

## 还没做

- 可复用类型与口径再抽到 `packages/domain/`。现在规则在 `server/src/domain`，云函数打包时引用它。
- 课前 15 分钟提醒的定时云函数要在微信开发者工具里上传部署后才会发通知，见 `docs/miniprogram-remind.md`。
- 网页和小程序不要合成同一套数据库。现在网页走 SQLite，小程序走微信云数据库。

## 明确不要做

- 不要修改本机全局 Git `user.name` / `user.email`。本仓库本地身份是 `jj` / `jj@admin.com`。
- 不要提交 `node_modules/`、`dist/`、`.env`、日志或密钥。例外：`apps/miniprogram/.env` 入库，但只能放 AppID、云环境 ID 这类公开标识。
- 不要为了小程序提前重写现有 H5 业务逻辑。
