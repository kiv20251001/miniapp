# Uday家庭课表计划小程序

从注册账号到提交审核的逐步说明见仓库 `docs/miniprogram-launch.md`；日常打包、分环境部署云函数、发体验版和正式版见 `docs/miniprogram-deploy.md`。课前 15 分钟提醒在时间轴的闹钟上，定时云函数部署见 `docs/miniprogram-remind.md`。下面是开发时的目录和命令。

uni-app（Vue 3）家长端。微信小程序走云开发：登录用微信号 `openid`，读写走云函数 `api`。页面里的日期、时间和下拉都用小程序原生 `picker`。

抖音小程序可以先编译页面（`mp-toutiao`）。云函数目前只接微信，抖音端打开会提示尚未接入。

网页版仍使用 `server/` 的账号密码和 SQLite。两边复用同一套排课、账单规则（`server/src/domain` 与 `server/src/workspace/family-workspace.ts`），数据不互通。

## 目录

```text
src/pages/              主包：登录和四个 tab 页
src/subpages/           分包：账单、课程编辑、课程账单、记账、家庭成员
src/                    其余是组件、Pinia、云函数调用
cloudfunctions/api/     微信云函数。src/index.ts 是源码，index.js 是打包结果
scripts/build-cloud.mjs 把家庭工作区打进云函数
scripts/use-env.mjs     打包前按 .env 改 project.config.json 的 miniprogramRoot / appid
scripts/report-size.mjs 打包后统计主包、分包体积
scripts/optimize-logo.mjs 把 docs/prd/UI/logo.svg 压成 src/static/logo-u.svg
.env                    测试 / 正式云环境 ID、AppID，所有打包命令共用，入库
```

新增二级页面放进 `src/subpages/` 并登记到 `pages.json` 的 `subPackages`，路由写 `/subpages/xxx/index`。主包限制 2MB，图片先压缩。

云数据库三个集合。第一次调用时云函数会自动创建，不需要手动建：

- `users`：`openid`、`unionid`、`familyId`、`role`（`owner` / `parent` / `viewer`）、`displayName`
- `families`：`snapshotJson`（与网页版家庭快照相同）、`version`、`timezone`、`ownerOpenid`
- `invites`：邀请码做文档 ID，含 `familyId`、`role`、`expireAt`、`maxUses`、`usedCount`

课程、排课、账单等业务数据都在 `families.snapshotJson` 里，没有单独的集合。建议在云开发控制台把三个集合的权限设为「所有用户不可读写」，小程序端只调用云函数。

## 本地运行

1. 用自己的小程序 AppID 开通云开发。在 `.env` 填 `WX_APPID`、`VITE_CLOUD_ENV_DEV`、`VITE_CLOUD_ENV_PROD`；开发版和体验版连测试环境，正式版连正式环境，运行时按 `envVersion` 自动选择，见 `docs/miniprogram-deploy.md`。不要手改 `project.config.json` 的 `miniprogramRoot` / `appid`，打包命令会改。
2. 在仓库根目录安装依赖：`npm install`
3. 打包云函数：`npm run build:cloud`
4. 安装云函数依赖：在微信开发者工具里对 `api` 选择「安装依赖」，或进入 `apps/miniprogram/cloudfunctions/api` 后执行 `npm install`
5. 启动微信端：`npm run dev:mp`（开发环境，输出 `dist/dev`）。体验包：`npm run build:mp:dev`（开发环境，输出 `dist/build`）。正式包：`npm run build:mp`（正式环境，输出 `dist/build`）
6. 用微信开发者工具导入 **`apps/miniprogram`**（这一层同时包含小程序和 `cloudfunctions/`）。
7. 右键 `cloudfunctions` 选择要部署的云环境，再右键 `api`「上传并部署：云端安装依赖」，并用微信扫码预览。登录身份是真实 openid，数据写在云数据库。

开发者工具不要再用游客 AppID。游客没有 openid，云函数会直接拒绝。

抖音端编译：`npm run dev:mp-toutiao --prefix apps/miniprogram`

## 云函数动作

小程序只调用 `wx.cloud.callFunction({ name: 'api', data: { action, payload } })`。身份以云函数里的 `OPENID` 为准，不信任客户端传来的家庭 ID。

`login` 会按 openid 找到或创建家庭。其余动作包括孩子、课程、加课、临时安排、课次、出勤、账单、退款和出账，规则与网页版家庭工作区一致。
