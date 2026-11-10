# server

NestJS API。H5 与后期微信小程序共用这一套后端。

本地默认 SQLite（`prisma/dev.db`），端口 `3000`。

```bash
npm install
npx prisma generate
npx prisma db push
npm run start:dev
```

也可在仓库根目录执行 `npm run dev:server`。

健康检查：`GET http://127.0.0.1:3000/api/health`

一期认证：`POST /api/auth/register`、`POST /api/auth/login`（账号+密码）。家庭业务仍按 `AppSnapshot` 语义接口读写，规则与 `apps/web/src/stores/app.ts` 对齐。

接口形状、事务和迁移规则见 `.cursor/skills/myhome-backend-contracts/`。
