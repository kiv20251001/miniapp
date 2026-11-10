# 微信小程序打包与发布（开发版 / 体验版 / 正式版）

第一次注册账号、填资料、选类目，看 [miniprogram-launch.md](miniprogram-launch.md)。本文讲已经有 AppID 之后，每次怎么打包、上传云函数、发体验版和正式版。课前 15 分钟提醒的定时云函数要单独上传，见 [miniprogram-remind.md](miniprogram-remind.md)。

Windows PowerShell 里命令一条一条执行，不要用 `&&` 连起来。下面的命令都在仓库根目录 `myhome` 执行。

## 0. 一句话版本

- 一个 AppID `wxappid`，两个云环境：测试 `cloud_dev`，正式 `cloud_1213242xzzzz_prod`。
- **只打一种包：`npm run build:mp`。** 包里同时带两个环境 ID，打开时由微信告诉我们这是哪个版本：

  | 微信里的版本 | 怎么打开 | 连接的云环境 |
  | --- | --- | --- |
  | 开发版 | 开发者工具模拟器、「预览」扫码、「真机调试」 | `cloud_dev` |
  | 体验版 | 后台「版本管理」里的体验版二维码 | `cloud_dev` |
  | 正式版 | 微信搜索 / 发布后的正式入口 | `cloud_1213242xzzzz_prod` |

- 同一个上传版本：先选为体验版自测（连测试库），没问题再提交审核、发布（自动连正式库），**中间不用重新打包**。
- 云函数 `api` 要在两个环境各部署一次；先部署测试环境，发布正式版之前再部署正式环境。

## 1. 数据存在哪里

小程序所有新增、修改、删除都走云函数 `api`，前端不直接读写数据库：

```text
页面 → Pinia store（src/stores/family.ts）
     → wx.cloud.callFunction({ name: 'api', data: { action, payload } })
     → 云函数按 openid 找到家庭，在事务里改快照
     → 写回云数据库
```

云数据库只有三个集合：

| 集合 | 存什么 |
| --- | --- |
| `users` | 每个微信用户一条：`openid`、`familyId`、`role`、`displayName` |
| `families` | 每个家庭一条。孩子、课程、排课、临时安排、出勤、账单、付款、退款**全部**放在字段 `snapshotJson` 里（一段 JSON 字符串），另有 `version`、`ownerOpenid` |
| `invites` | 邀请码，文档 ID 就是邀请码 |

所以云开发控制台里**不会**出现 `courses`、`expenses` 这类集合。想看刚加的课或账单，打开「数据库」→ `families` → 自己家庭那条记录 → `snapshotJson`。

两个云环境的数据库完全独立。体验版里建的家庭、课和账单只在 `cloud_dev`，正式版看不到；反过来也一样。同一个微信在两个环境里是两个互不相干的用户。

## 2. 集合会自动创建

不需要手动建 `users`、`families`、`invites`，两个环境都不需要。

新环境里第一次调用云函数时，如果数据库报「集合不存在」，云函数会自动创建这三个集合，然后把这次请求重新执行一遍。这段逻辑在 `cloudfunctions/api/src/index.ts` 的 `ensureCollections()`。

建议做一次（可选）：集合出现后，在「数据库」里把三个集合的权限都改成「所有用户不可读写」。小程序端本来就不直接访问数据库，云函数用管理员身份读写，不受这条限制。

## 3. 环境配置

所有打包命令共用一个文件 `apps/miniprogram/.env`，它会进 git：

```text
VITE_CLOUD_ENV_DEV=cloud_dev    # 开发版、体验版连这个
VITE_CLOUD_ENV_PROD=cloud_1213242xzzzz_prod  # 正式版连这个
WX_APPID=wxappid                       # 小程序后台 → 开发管理 → 开发设置
```

环境 ID 在云开发控制台 →「设置」→「环境 ID」复制，不是环境名称。这里只放 AppID、环境 ID 这类公开标识，任何人打开小程序都能看到它们，入库没有风险。**不要放 AppSecret 或任何密钥**，本机才用的配置写进 `apps/miniprogram/.env.local`，它不进 git。

不再区分 `.env.development` 和 `.env.production`：连哪个云环境是打开小程序时按版本决定的，和打包模式无关，所有模式的配置都一样。

选择逻辑在 `src/config.ts`：启动时调用 `wx.getAccountInfoSync().miniProgram.envVersion`，`develop` / `trial` 连 `VITE_CLOUD_ENV_DEV`，其他情况（`release`，或拿不到版本）连 `VITE_CLOUD_ENV_PROD`。`App.vue` 用这个结果调用 `wx.cloud.init({ env })`。云函数里是 `cloud.DYNAMIC_CURRENT_ENV`，谁调用它就用谁的环境，不用改。

临时想让所有版本都连同一个环境（例如用体验版排查正式数据），新建不进 git 的 `apps/miniprogram/.env.local`，写一行 `VITE_CLOUD_ENV=cloud_1213242xzzzz_prod`。打包时终端会出现黄色提醒。**排查完删掉这个文件再重新打包**，否则正式版、体验版会连同一个库。

每次打包前，脚本 `scripts/use-env.mjs` 会自动：

- 把 `project.config.json` 的 `miniprogramRoot` 改成本次的输出目录。`dev:mp` 是 `dist/dev/mp-weixin/`，`build:mp` / `build:mp:dev` 是 `dist/build/mp-weixin/`。
- 把 `WX_APPID` 写进 `project.config.json` 和 `src/manifest.json`。
- 清掉上一次的输出目录。
- 在终端打印本次的 AppID 和两个环境 ID。缺任何一个都会有黄色警告。

不用手动改 `miniprogramRoot` 和 `appid`。

## 4. 打包命令

| 命令 | 输出目录 | 用途 |
| --- | --- | --- |
| `npm run dev:mp` | `dist/dev/mp-weixin/` | 日常改页面，保存后自动重新编译。不压缩，**不要拿来上传** |
| `npm run build:mp` | `dist/build/mp-weixin/` | **上传体验版和正式版都用这个** |
| `npm run build:mp:dev` | `dist/build/mp-weixin/` | 和 `build:mp` 一样，只是保留 `console.log`，排查问题时临时用 |
| `npm run build:cloud` | `cloudfunctions/api/index.js` | 打包云函数，改了云函数或共享规则后执行 |

连哪个云环境和打包命令无关，只看打开的是哪个版本（第 0 节表格）。

`build:*` 结束时会打印主包和分包体积。微信限制主包和单个分包各不超过 2MB，整包不超过 20MB。超过时命令会返回失败，并列出 200KB 以上的大文件。

开发者工具已经打开项目时，换命令之后点一下工具栏「编译」。如果工具没有切到新目录，关掉项目重新打开 `apps/miniprogram`。

## 5. 包体积做了什么

- 首页 tab（今日、日历、课程、统计）和登录页在主包。日历、课程、统计三个视图按需注入，第一次切到对应 tab 才渲染。账单、课程编辑、课程账单、记账、家庭成员在分包 `subpages/`，点进去时才下载，不和首屏抢网络。
- 孩子头像雪碧图从 1.4MB 的 PNG 压成 47KB 的 JPG（`src/static/user_icon.jpg`）。
- 云函数不再复制进 `dist`，它只从 `apps/miniprogram/cloudfunctions/` 上传。
- 开启了按需注入组件（`lazyCodeLoading`），以及 JS / WXSS / WXML 压缩和上传时过滤无用文件。
- 关闭了 uni 统计，不再打包统计代码，也不会请求 dcloud 的统计域名。
- `build:mp`（`--mode production`）去掉 `debugger` 和 `console.log/debug/info`，保留 `console.warn/error` 方便排错。
- 上传时附带 source map（不计入包体积），小程序后台「开发管理 → 运维中心」的报错能还原到源码行。
- Logo 字母用 `src/static/logo-u.svg`（约 0.7KB）。设计稿 `docs/prd/UI/logo.svg` 更新后执行 `node apps/miniprogram/scripts/optimize-logo.mjs` 重新生成。
- 登录页恢复登录、家庭成员页加载成员、统计页画图之前显示骨架屏，数据到了再换成真实内容，布局不跳动。

新增图片时，先压缩再放进 `src/static/`。单张超过 200KB 的图，建议放到云存储，用链接加载。

当前体积：主包约 437KB，分包约 68KB，合计约 505KB。

## 6. 上传云函数（每个环境各一次）

页面代码和云函数要分开上传。改了 `cloudfunctions/api/src/index.ts`，或者改了 `server/src/domain`、`server/src/workspace`、`src/domain` 里的共享规则，都要重新打包并上传云函数。

1. 打包云函数：

   ```text
   npm run build:cloud
   ```

   生成 `apps/miniprogram/cloudfunctions/api/index.js`。工具上传的是这个文件，不是 `src/index.ts`。

2. 开发者工具左侧找到 `cloudfunctions` 目录，它后面会显示当前环境名。右键 `cloudfunctions` →「选择环境」，选要部署到的环境。
3. 右键 `cloudfunctions/api` →「上传并部署：云端安装依赖」。不要选「不安装依赖」。
4. 云开发控制台右上角切到同一个环境 →「云函数」，确认 `api` 的更新时间是刚才。

第一次在某个环境部署后，改一次超时时间：云开发控制台 →「云函数」→ `api` →「版本与配置」，把超时时间从默认的 3 秒改成 **20 秒**，内存保持 256MB。冷启动加一次数据库事务偶尔会超过 3 秒，表现为早上第一次打开报「云函数调用失败」。**两个环境各改一次**，之后重新上传代码不会被覆盖。

什么时候部署到哪个环境：

| 时机 | 部署到 |
| --- | --- |
| 改了云函数，准备发体验版自测 | 只部署 `cloud_dev` |
| 体验版测完，准备发布正式版 | 再部署 `cloud_1213242xzzzz_prod` |

正式环境的云函数要能同时服务旧版正式包和新版正式包：审核期间、发布后几小时内，都还有用户在用旧版本。云函数只加新动作、不删旧动作，就不会出问题。

## 7. 发体验版（只自测，不上线）

体验版不需要审核，只有体验成员能打开，正式用户完全不受影响。适合「代码改了但还不想上线」的情况。

1. 确认 `apps/miniprogram/.env` 里的两个环境 ID 和 AppID 正确（第 3 节）。
2. 如果改了云函数：`npm run build:cloud`，按第 6 节**只部署到 `cloud_dev`**。
3. 打包小程序：

   ```text
   npm run build:mp
   ```

   终端第一行应是：

   ```text
   [env] production · ... · appid=wxappid · 开发版/体验版=cloud_dev · 正式版=cloud_1213242xzzzz_prod
   ```

   不应有黄色的 `[env]` 警告。

4. 开发者工具打开 `apps/miniprogram`，确认右上角 AppID 是 `wxappid`（不是「测试号」或「游客」），点「编译」，模拟器能正常进入登录页。
5. 先点「预览」用手机扫码试一次。预览也连测试库，能打开说明包和网络都没问题。
6. 右上角「上传」。版本号填例如 `0.3.0-beta.1`，备注写「体验：xxx」。
7. 打开 [mp.weixin.qq.com](https://mp.weixin.qq.com) →「管理」→「版本管理」→「开发版本」，在刚上传的版本上选「选为体验版」。
8. 「管理」→「成员管理」→「体验成员」，添加要试用的微信号（个人主体最多 15 人）。管理员和开发者不用加。
9. 用体验版二维码扫码打开，把改动的功能走一遍。
10. 到云开发控制台，切到 `cloud_dev` →「数据库」→ `families`，确认数据写在这里；切到 `cloud_1213242xzzzz_prod` 看，不应出现这次测试的数据。

需要改代码就重复 2～9 步，再上传一个新版本并选为体验版。体验版只有一个位置，新选的会替换旧的；正式版不受影响。

## 8. 发正式版

前提：第 7 节的体验版已经测完。下面直接把**同一个版本**提交审核，不用重新打包。

1. 如果这次改了云函数：确认 `cloudfunctions/api/index.js` 是体验时那一份（期间没再改源码），按第 6 节**部署到 `cloud_1213242xzzzz_prod`**。上线顺序是先云函数、后小程序。新版页面调用了旧云函数没有的动作时，会提示「不支持的操作」。
2. 正式环境第一次使用时，确认 `api` 超时已改成 20 秒。
3. mp.weixin.qq.com →「版本管理」→「开发版本」，找到第 7 节测过的那个版本 →「提交审核」。审核备注可复制 [miniprogram-profile.md](miniprogram-profile.md) 里的段落。
4. 审核期间可以继续发新的体验版，不影响正在审核的版本。
5. 审核通过后，在「审核版本」里点「发布」。不点发布，用户仍在用旧版本。
6. 发布后用一个没有开发者、体验者权限的微信搜索小程序名打开，登录、加课、记账走一遍。到 `cloud_1213242xzzzz_prod` 的数据库确认数据写在这里。

以后每次迭代：第 7 节测完 → 第 8 节发布。

### 一张图看完整流程

```text
改代码
  │
  ├─ 改了云函数？ ── 是 ──> npm run build:cloud ──> 部署到 dev 环境
  │
  ▼
npm run build:mp ──> 开发者工具「编译」「预览」（连 dev）
  │
  ▼
「上传」──> 后台「选为体验版」──> 体验成员扫码自测（连 dev）
  │                                  │
  │                         有问题 <──┘ 回到「改代码」
  ▼
测完 ── 改了云函数？ ── 是 ──> 部署到 prod 环境
  │
  ▼
同一个版本「提交审核」──> 通过后「发布」──> 正式用户（连 prod）
```

## 9. 上线前检查

提交审核前过一遍：

1. `npm run build:mp` 的 `[env]` 行 AppID 和两个环境 ID 正确，没有黄色警告；没有 `.env.local` 里残留的 `VITE_CLOUD_ENV`。
2. `[size]` 没有超限提示，也没有「大文件」提示。
3. 开发者工具「详情」→「基本信息」里的代码包大小和终端输出接近。
4. 「上传」前的「代码质量」面板：主包大小、图片和音频大小、组件按需注入都显示通过。
5. 真机预览关掉网络再打开，登录页显示骨架屏，恢复网络后正常进入；不应出现白屏或文字错位。
6. 两个环境的 `api` 都已部署，超时时间都是 20 秒。
7. 体验版已经在 `cloud_dev` 上把改动走过一遍。

## 10. 常见问题

### 真机预览或体验版提示「当前网络不可用，无法打开小程序」，正式版正常

这个提示是微信客户端在**下载代码包阶段**报的，那时我们的代码（包括 `wx.cloud.init`）还没开始执行。所以它和连哪个云环境、云函数有没有部署都无关：连错环境或云函数报错时，小程序能打开，只是登录失败或提示「云函数调用失败」。

`build:mp:dev` 和 `build:mp` 打出来的包大小、结构基本一样（都约 505KB），也不是打包命令导致的。

正式版和开发版、体验版的代码包走的下载通道不同。正式版走公开 CDN，开发版、体验版走微信的开发服务，还会按上传时选的基础库版本加载。按顺序排查：

1. **换网络。** 关掉 Wi-Fi 用 4G/5G，关掉手机上的 VPN、代理、加速器、广告过滤。公司或家里路由器拦截开发服务域名，是最常见的原因。
2. **关掉调试状态。** 如果之前点过「真机调试」，在开发者工具里结束真机调试；手机上打开小程序右上角「···」→「开发调试」，如果显示「关闭调试」就点一下。然后彻底退出微信再进。
3. **删掉旧入口重扫。** 微信下拉「最近使用」里长按这个小程序删除，再用最新的预览码或体验版二维码打开。不要从聊天记录里点很久以前的预览码，预览码有有效期。
4. **基础库版本。** 开发者工具「详情」→「本地设置」→「调试基础库」选一个标注稳定、不带 beta 的版本，重新编译、上传。手机微信升到最新版。
5. **权限。** 体验版要求打开它的微信是管理员、开发者或体验成员。不是的话通常提示「无体验权限」；如果提示不明确，也到「成员管理」核对一遍。
6. **AppID。** 开发者工具右上角必须是 `wxappid`。用「测试号」或「游客」打开的项目，预览出来的码在别人手机上打不开。

一般第 1、2 步就能解决。都不行时，把手机微信版本、网络类型和出现提示的时间记下来，到 [微信开放社区](https://developers.weixin.qq.com/community/develop/mixflow) 反馈，或在小程序后台「运维中心」看有没有下载失败记录。

### 体验版能打开，但登录失败或提示「云函数调用失败」

`cloud_dev` 环境没有部署 `api`，或部署的是旧版本。切到 dev 环境重新上传部署。偶尔一次、重试就好的，是冷启动超时，把超时时间改成 20 秒。

### 正式版登录失败，体验版正常

`cloud_1213242xzzzz_prod` 没有部署 `api`，或超时还是 3 秒。按第 6 节切到 prod 环境部署。

### 体验版里看到了正式数据（或反过来）

`.env.local` 里有 `VITE_CLOUD_ENV`，或打包时 `[env]` 行显示的环境 ID 不对。删掉 `VITE_CLOUD_ENV`，确认两个环境 ID 没写反，重新 `npm run build:mp` 并上传。

### 控制台数据库里看不到刚加的课

课和账单在 `families` 那条记录的 `snapshotJson` 字段里，没有单独的集合。再确认控制台右上角的环境：开发版、体验版的数据在 `cloud_dev`，正式版在 `cloud_1213242xzzzz_prod`。

### 早上第一次打开报「云函数调用失败」，再试一次就好

云函数冷启动超时。按第 6 节把对应环境的超时时间改成 20 秒。

### 开发者工具提示主包超过 2MB

执行 `npm run build:mp`，看最后几行 `[size]` 输出里哪个文件大。确认工具编译的是 `dist/build/mp-weixin/`，不是 `dev:mp` 的 `dist/dev/mp-weixin/`：`dev` 目录没压缩，体积会大很多。

### 云函数报「collection not exists」

云函数还是旧版本，没有自动建集合的逻辑。重新 `npm run build:cloud`，再上传部署一次。

### 提示「请在微信内打开小程序」

用了游客 AppID，或 `WX_APPID` 没填。填好后重新打包，开发者工具里确认右上角是 `wxappid`。

### 换了电脑，页面空白或是旧页面

`dist` 不进 git。执行 `npm install`、`npm run build:cloud`、`npm run build:mp`，再用开发者工具打开 `apps/miniprogram`，菜单「清缓存」→「全部清除」后编译。
