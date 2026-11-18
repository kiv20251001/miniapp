# 小程序后台设置清单

拿到代码、准备自己发一版的人先看这份。这里列出微信公众平台（[mp.weixin.qq.com](https://mp.weixin.qq.com)）和云开发控制台里**必须设置、必须勾选**的每一项，以及不做会出现什么现象。

一步一步怎么点，看这三份：

- 第一次上线：[miniprogram-launch.md](miniprogram-launch.md)
- 日常打包、分环境部署、发体验版和正式版：[miniprogram-deploy.md](miniprogram-deploy.md)
- 课前 15 分钟提醒（订阅消息、定时云函数）：[miniprogram-remind.md](miniprogram-remind.md)

代码里新增了用到隐私信息或微信开放接口的功能时，同步更新这份清单。

## 总览

| 在哪里 | 设置什么 | 给哪个功能用 |
| --- | --- | --- |
| 开发管理 → 开发设置 | 复制 AppID，填进 `apps/miniprogram/.env` | 全部 |
| 云开发控制台 | 开通环境，部署云函数 `api`、`remind`，上传 `remind` 的触发器 | 登录、课表、账单、提醒 |
| 云开发 → 数据库 | `users`、`families`、`invites`、`reminders` 权限改成「所有用户不可读写」 | 数据安全 |
| 功能 → 订阅消息 | 从公共模板库选一个上课提醒模板 | 课前 15 分钟提醒 |
| 设置 → 服务内容声明 → 用户隐私保护指引 | 勾选「用户信息」「剪切板」「相册（仅写入）」 | 登录头像昵称、邀请码、粘贴作业、保存练习图片 |
| 设置 → 基本设置 | 名称、头像、简介、服务类目（工具类） | 审核 |
| 设置 → 基本设置 → 基础库最低版本 | 2.32.3 或更高 | 隐私授权、离屏画布生成练习图片 |
| 管理 → 成员管理 | 开发者、体验成员 | 上传代码、试用体验版 |

**不需要**：微信支付；「开发管理 → 开发设置」里的服务器域名、业务域名（所有数据都走云开发，没有 `wx.request`）；「开发管理 → 接口设置」里的任何接口申请（不用手机号、位置等需要申请的接口）。

## 1. AppID 和云开发

1. 「开发管理」→「开发设置」复制 AppID，填到 `apps/miniprogram/.env` 的 `WX_APPID=`。不要用测试号或游客 `touristappid`，游客没有 openid，登录会失败。
2. 开发者工具「云开发」开通环境。建议建两个：测试环境填 `VITE_CLOUD_ENV_DEV=`，正式环境填 `VITE_CLOUD_ENV_PROD=`。开发版、体验版连测试环境，正式版连正式环境，运行时自动选择。只建一个就两项填同一个。
3. 每个环境都部署 `api` 和 `remind` 两个云函数，选「上传并部署：云端安装依赖」。
4. `remind` 还要右键 `cloudfunctions/remind/config.json` →「上传触发器」。上传函数**不会**带上触发器。到「云函数 → remind → 触发器」确认能看到每 5 分钟一次的 `tick`。
5. 集合由云函数自动创建。出现后把权限改成「所有用户不可读写」。小程序只调用云函数，云函数用管理员权限，不受影响。

不做的现象：没部署 `api` 时登录提示云函数调用失败；没上传触发器时订阅成功但永远收不到提醒，`reminders` 里的记录一直是 `pending`。

### 云函数的接口权限（写在代码里，部署时生效）

云函数要调用微信开放接口，必须在各自的 `config.json` 里声明，否则会报 `-604101`。仓库里已经写好，**不要删**：

| 云函数 | `permissions.openapi` |
| --- | --- |
| `api` | `subscribeMessage.getTemplateList`、`subscribeMessage.send` |
| `remind` | `subscribeMessage.send`、`subscribeMessage.getTemplateList`，外加 `triggers` 定时器 |

## 2. 订阅消息（课前 15 分钟提醒）

1. 「功能」→「订阅消息」→「公共模板库」，选一个上课提醒类的**一次性订阅**模板。个人主体、工具类目选不到长期订阅，这是正常的。
2. 关键词按顺序选：课程名称、上课时间、上课地点、备注。
3. 模板里的键名（例如 `thing34`、`time6`）要和 `apps/miniprogram/src/domain/remind.config.json` 的 `fields` 对上。`templateId` 一般留空，云函数会按模板正文自动识别；识别失败时再把模板 ID 填进去。改完执行 `npm run build:cloud`，重新上传 `api` 和 `remind`。

不做的现象：点课程上的「设置提醒」没有授权弹窗，或提示读不到模板。

模拟器收不到服务通知。要用自己的 AppID 在真机的开发版、体验版或正式版上测。

## 3. 用户隐私保护指引（必须勾选的项）

位置：「设置」→「服务内容声明」→「用户隐私保护指引」。

从基础库 2.32.3 起，**代码里调用了、但指引里没声明的隐私接口会直接失败**（报 `errno 112`，`api scope is not declared in the privacy agreement`）。用户第一次用到这些接口时，微信会自动弹出隐私授权，用户同意后才能继续。

| 勾选项 | 用途怎么写 | 代码里哪里用 |
| --- | --- | --- |
| 用户信息（微信昵称、头像） | 家庭成员互相识别 | 登录页、家庭页的 `open-type="chooseAvatar"` 和 `type="nickname"` 输入框 |
| 剪切板 | 复制家庭邀请码；粘贴作业内容 | 家庭页 `uni.setClipboardData`；添加作业 `uni.getClipboardData` |
| 相册（仅写入）权限 | 保存字帖、计算题、时钟练习图片，方便打印 | 工具箱各打印页的「保存图片」：`uni.saveImageToPhotosAlbum` |

**不要勾选**：手机号、位置、麦克风、摄像头、通讯录、选择相册中的照片或视频（读取）。小程序没有这些功能，勾了反而可能被审核问到。选头像时的「从相册选择」由 `chooseAvatar` 处理，已包含在「用户信息」里，不用另外声明相册读取。

修改隐私指引后，要等平台审核通过才生效。**先改指引、等它通过，再发带新功能的版本**，否则新版本里的接口会因为未声明而失败。

不做的现象：

- 没声明「用户信息」：键盘上方没有「使用微信昵称」，点头像没反应。
- 没声明「剪切板」：复制邀请码、粘贴作业没反应或报错。
- 没声明「相册（仅写入）」：点「保存图片」直接失败。

## 4. 工具箱的「保存图片」和「保存 PDF」

字帖、计算题、认识时钟的「打印题目」共用 `apps/miniprogram/src/subpages/print/` 这一套导出。

**保存图片**

- 后台只需要在隐私指引里勾选「相册（仅写入）权限」，见第 3 节。不需要在「接口设置」里申请。
- 用户第一次保存时，微信弹「保存到相册」授权。拒绝后，小程序会弹「需要相册权限」，点「去设置」打开授权页（`uni.openSetting`）。
- `manifest.json` 里 `scope.writePhotosAlbum` 的 `desc` 是授权说明文案，已写成「保存字帖、计算题、时钟练习图片到相册，方便打印」。

**保存 PDF**

- 不需要任何后台设置，也不用在隐私指引里声明。
- 做法是把已生成的页面在本地拼成 PDF，写到小程序自己的用户目录（`wx.env.USER_DATA_PATH`），再用 `wx.openDocument` 打开。用户在右上角菜单里转发给自己或电脑，再打印。
- 文件只在本地，不上传、不下载，所以不需要配置业务域名或下载域名。

**生成页面本身**

- 用离屏画布 `wx.createOffscreenCanvas` 画 A4 页面，需要较新的基础库。建议在「设置」→「基本设置」把**基础库最低版本**设为 2.32.3 或更高，太旧的微信会被提示升级，不会生成到一半失败。

## 5. 基本信息、类目和成员

- 「设置」→「基本设置」：名称、简称、头像、功能介绍按 [miniprogram-profile.md](miniprogram-profile.md) 填写。
- 服务类目选个人主体可用、**不需要资质**的工具类（效率、备忘录一类）。不要选教育培训类，会要求办学资质。
- 「管理」→「成员管理」：
  - 要上传代码、部署云函数的人加为**开发者**。
  - 要提前试用的家人加为**体验成员**，才能打开体验版。

## 6. 代码里要和后台保持一致的地方

这些不在后台点，但改了后台就要同步改代码，反过来也一样：

| 文件 | 内容 |
| --- | --- |
| `apps/miniprogram/.env` | `WX_APPID`、`VITE_CLOUD_ENV_DEV`、`VITE_CLOUD_ENV_PROD`。只放公开标识，可以入库 |
| `apps/miniprogram/src/domain/remind.config.json` | 订阅模板 ID 和字段键名 |
| `apps/miniprogram/cloudfunctions/api/config.json` | 云函数接口权限 |
| `apps/miniprogram/cloudfunctions/remind/config.json` | 云函数接口权限和定时触发器 |
| `apps/miniprogram/src/manifest.json` | `scope.writePhotosAlbum` 授权说明 |

`project.config.json` 的 `miniprogramRoot` 和 AppID 由打包脚本写入，不要手改。

## 发版前核对

- [ ] `.env` 的 AppID 是自己的，不是 `touristappid`
- [ ] 两个云环境都部署了 `api`、`remind`，`remind` 的触发器已启用
- [ ] 数据库集合权限是「所有用户不可读写」
- [ ] 订阅消息模板已选用，字段和 `remind.config.json` 一致
- [ ] 隐私指引已勾选「用户信息」「剪切板」「相册（仅写入）」，且审核通过
- [ ] 基础库最低版本 ≥ 2.32.3
- [ ] 服务类目是不需要资质的工具类
- [ ] 真机试过：登录选头像昵称、复制邀请码、设置提醒、保存练习图片、保存 PDF
