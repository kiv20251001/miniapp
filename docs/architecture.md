# 架构说明

## 目标

单仓维护。H5 使用 NestJS API。微信小程序使用 uni-app，登录和数据走微信云开发，不走网页版账号。

```text
[H5 Vue] --> [Node.js API] --> SQLite

[uni-app 小程序] --> [微信云函数 api] --> 云数据库
                         |
                         复用 server/src/domain 与 family-workspace 规则
```

当前实现：H5（`apps/web/`）+ NestJS API（`server/`，本地 SQLite）。小程序在 `apps/miniprogram/`，用微信 `openid` 登录，家庭快照存在云数据库。两端规则同源，数据不互通。

## 目录

```text
apps/web/              H5（现有）
apps/miniprogram/      uni-app 小程序（微信云开发，可再编抖音）
server/                NestJS API（一期 Prisma + SQLite）
packages/domain/       共用领域模型（占位，尚未从 web 抽出）
docs/                  PRD / 设计 / 口径
.cursor/skills/        AI 契约（能力地图、账号、数据与接口、规则）
```

## 分层

1. **表现层**：H5（`apps/web/`）、小程序（`apps/miniprogram/`，日期时间下拉用原生 picker）。
2. **应用服务**：H5 走 `server/src`；小程序走云函数 `api`，云函数内调用同一套家庭 Workspace。
3. **领域规则**：类型暂在 `apps/web/src/domain/`；事务与 API 形状在 skills 契约中；稳定后抽到 `packages/domain/`。
4. **文档**：`docs/` 描述产品与口径，不替代契约中的接口细节。

## 迁移原则

- 不改现有 H5 技术栈。
- 真正拆 `packages/domain` 与上 Node 分开做。
- 小程序不复用 H5 的 Vue 组件。领域规则从 `server/src/domain` 与 `family-workspace` 打包进云函数，页面用 uni-app 重写。
