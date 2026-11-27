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
| 云开发 → 存储 | 把 `apps/miniprogram/cloud-storage/` 下的 `fonts`、`body`、`pinyin`、`share` 四个文件夹原样上传，File ID 填进 `.env` 的 `VITE_CLOUD_STORAGE_*` | 真机字帖显示楷体、「3D 人体器官」显示写实人体、「拼音听写」能发声、工具转发卡片显示各自的图 |
| 功能 → 订阅消息 | 从公共模板库选一个上课提醒模板 | 课前 15 分钟提醒 |
| 设置 → 服务内容声明 → 用户隐私保护指引 | 勾选「用户信息」「剪切板」「相册（仅写入）」 | 登录头像昵称、邀请码、粘贴作业、保存练习图片 |
| 设置 → 基本设置 | 名称、头像、简介、服务类目（工具类） | 审核 |
| 设置 → 基本设置 → 基础库最低版本 | 2.32.3 或更高 | 隐私授权、离屏画布生成练习图片 |
| 管理 → 成员管理 | 开发者、体验成员 | 上传代码、试用体验版 |

**不需要**：微信支付；任何小程序插件（个人主体加不了「微信同声传译」，3D 太阳系只显示文字讲解）；「开发管理 → 开发设置」里的服务器域名、业务域名（所有数据都走云开发，没有 `wx.request`）；「开发管理 → 接口设置」里的任何接口申请（不用手机号、位置等需要申请的接口）。

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

字帖、计算题、认识时钟、认识分数、3D 几何体的「打印题目」共用 `apps/miniprogram/src/print/` 这一套导出（放主包，两个分包都要用）。

**保存图片**

- 后台只需要在隐私指引里勾选「相册（仅写入）权限」，见第 3 节。不需要在「接口设置」里申请。
- 用户第一次保存时，微信弹「保存到相册」授权。拒绝后，小程序会弹「需要相册权限」，点「去设置」打开授权页（`uni.openSetting`）。
- `manifest.json` 里 `scope.writePhotosAlbum` 的 `desc` 是授权说明文案，已写成「保存字帖、计算题和练习题图片到相册，方便打印」。

**保存 PDF**

- 不需要任何后台设置，也不用在隐私指引里声明。
- 做法是把已生成的页面在本地拼成 PDF，写到小程序自己的用户目录（`wx.env.USER_DATA_PATH`），再用 `wx.openDocument` 打开。用户在右上角菜单里转发给自己或电脑，再打印。
- 文件只在本地，不上传、不下载，所以不需要配置业务域名或下载域名。

**生成页面本身**

- 用离屏画布 `wx.createOffscreenCanvas` 画 A4 页面，需要较新的基础库。建议在「设置」→「基本设置」把**基础库最低版本**设为 2.32.3 或更高，太旧的微信会被提示升级，不会生成到一半失败。

**云存储文件（字帖楷体）**

手机上没有楷体，模拟器能用 Mac 自带的华文楷体，真机会退回宋体或黑体，字帖就成了印刷体。字体约 3.4MB，超过分包上限，只能放云存储。仓库里按云存储的目录结构放在 `apps/miniprogram/cloud-storage/`，现在有 `fonts/copybook-kai.ttf` 和下面的 `body/body-v1.bin`。

步骤：

1. 云开发控制台 →「存储」→「存储管理」，在**测试和正式两个环境**里各新建 `fonts` 文件夹，上传 `cloud-storage/fonts/copybook-kai.ttf`。文件夹名和文件名要和仓库里一样。如果以前传过 `copybook-kai.woff`，那个文件手机画布用不上，换成这个 ttf。
2. 在该环境里点这个文件，复制 File ID（`cloud://` 开头），填进 `.env`：测试环境的填 `VITE_CLOUD_STORAGE_DEV=`，正式环境的填 `VITE_CLOUD_STORAGE_PROD=`。代码只取 `cloud://环境.桶` 这一段，后面的路径不影响。只建了一个环境就两项填同一个。
3. 重新打包。打包输出里不再有「没有填写 VITE_CLOUD_STORAGE_…」的警告就对了。
4. 存储权限保持默认的「所有用户可读，仅创建者可读写」即可。

字体用 `node scripts/build-copybook-font.mjs` 生成（需要 `pip3 install fonttools`），是霞鹜文楷 GB（SIL OFL 1.1，可免费商用），只保留 GB2312 的 6763 个字和写字表里的字，输出 TTF，家族名改成 `UdayKai`（OFL 不许派生字体继续叫霞鹜或 LXGW）。下载的 25MB 源字体放在不入库的 `fonts/`。小程序第一次打开字帖页时用 `wx.cloud.downloadFile` 在后台下载，存到用户目录，之后不再下载，不需要配置下载域名。生成时把这份本地文件读成 Data URL，用 `wx.loadFontFace` 注册（`scopes` 先用 `native`）。不要把 `wxfile` 路径直接传给 `loadFontFace`，那个调用在真机上经常不回调。Data URL 失败时再用云存储临时 https 链接。注册之后用新画布画「永」和系统字体比像素，对得上才算楷体生效；带引号和不带引号的字体名都会试。基础库 3.17 的离屏画布没有 `loadFont`，而且不吃 WOFF，所以必须是 TTF。离屏画布仍然不用这套字体时，改画页面里那张隐藏的 canvas。还是失败就退回系统字体，并提示想用楷体请用电脑版微信打开再生成。

没填 `VITE_CLOUD_STORAGE_*`、文件没上传或下载失败时，字帖退回手机系统字体，功能不受影响。生成前如果楷体没挂上，会提示用电脑版微信再生成，也可以继续用系统字体生成。

**云存储文件（3D 人体模型）**

「3D 人体器官」的写实人体是 `cloud-storage/body/body-v1.bin`（约 1MB，BodyParts3D 和 HuBMAP 肺，CC BY 4.0），和字体一样在**测试和正式两个环境**里各新建 `body` 文件夹上传，文件夹名和文件名不要改。用的是同一个 `VITE_CLOUD_STORAGE_*`，不用再填别的。

第一次打开工具时用 `wx.cloud.downloadFile` 下载，存到用户目录，之后直接读。下载期间画面上显示「正在准备人体模型…」，超过 20 秒或下载失败就先显示代码画的简化人体，下次打开再试。模型用 `node scripts/build-body-model.mjs` 重新生成；改了模型要换文件名（`body-v2.bin`，同时改 `src/subsolar/body/realistic.ts` 里的 `FILE`），不然用户手机上的旧缓存不会更新。

**云存储文件（拼音读音）**

「拼音听写」的读音是 `cloud-storage/pinyin/pinyin-v3.bin`（Chen Wang 录的标准音节，CC BY-SA，`node scripts/build-pinyin-audio.mjs` 打包）。录音里没有单独的 ong，v3 用 hong 去掉开头的 h 当作 ong。同样在**测试和正式两个环境**里各新建 `pinyin` 文件夹上传，文件夹名和文件名不要改。如果云上还是旧的 `pinyin-v1.bin` 或 `pinyin-v2.bin`，要再传这个 v3，否则手机还会放以前的声音。打开工具或点播放时下载一次，页面上有进度条；下完存到用户目录，之后直接读。没上传或下载失败时探索、测验、打印都能用，只是没有声音，点播放会提示重试。改了声音要换文件名（`pinyin-v4.bin`，同时改 `src/subpinyin/voice.ts` 里的 `FILE`）。

**云存储文件（工具分享图）**

工具页右上角转发的 5:4 卡片图是 `cloud-storage/share/*.jpg`（11 张约 370K，`node scripts/render-share-covers.mjs` 生成），放云存储是为了不占主包体积（代码质量扫描要求主包小于 1.5M）。同样在**测试和正式两个环境**里各新建 `share` 文件夹上传，文件名不要改。没上传或没配置云存储时，转发卡片退回主包里的通用推广图 `static/share-cover.jpg`，功能不受影响。

不做的现象：真机生成的字帖是宋体或黑体，模拟器正常。换了字体文件要改个文件名重新上传并同步改代码里的路径，手机上的旧缓存才会失效。

**代码包图片合计 200K（建议项）**

代码质量扫描的「图片和音频资源大小应不超过 200K」指的是代码包里所有图片、音频**加起来**，不是单个文件。这一项只是建议，不影响上传、审核和发布。

现在合计约 150K：工具图标（原图 PNG，约 62K）、界面图标（矢量 SVG，约 45K）、头像图和通用推广图。界面里展示的图标要保持高清，不要用有损压缩换体积，线条图标优先用 SVG。工具分享海报已经挪到 `cloud-storage/share/`；以后图片多了，大图也这样处理，代码里用 `cloudFile('路径')` 取 File ID（分享卡片从基础库 2.8.1 起支持云文件）。

## 5. 3D 太阳系和 3D 几何体

「3D 太阳系」在 `subsolar` 分包里。点星球弹出信息卡，讲解是文字，开发版和正式版一样，没有「听讲解」。

个人主体不能在「插件管理」里添加「微信同声传译」，所以代码里不要声明这个插件。声明了之后，正式包会报「插件未授权使用」，整个小程序打不开。

「3D 几何体」也在这个分包里（`subsolar/cube/`），同样不需要后台设置：面上的字和颜色由代码现场画，没有贴图文件；「打印题目」和其他工具一样走第 4 节的保存图片、保存 PDF。

其余部分不需要后台设置：3D 画面用 WebGL 画布，星球表面由代码现场生成，没有图片要上传，也不用配置下载域名；不用隐私接口，不用在隐私指引里勾选新项。编译时报 `INVALID_LOGIN, access_token expired`，是开发者工具登录过期，重新扫码登录即可。

## 6. 基本信息、类目和成员

- 「设置」→「基本设置」：名称、简称、头像、功能介绍按 [miniprogram-profile.md](miniprogram-profile.md) 填写。已上线后改功能介绍，以及对外宣传文案，按 [miniprogram-seo.md](miniprogram-seo.md)。
- 服务类目选个人主体可用、**不需要资质**的工具类（效率、备忘录一类）。不要选教育培训类，会要求办学资质。
- 「管理」→「成员管理」：
  - 要上传代码、部署云函数的人加为**开发者**。
  - 要提前试用的家人加为**体验成员**，才能打开体验版。

## 7. 代码里要和后台保持一致的地方

这些不在后台点，但改了后台就要同步改代码，反过来也一样：

| 文件 | 内容 |
| --- | --- |
| `apps/miniprogram/.env` | `WX_APPID`、`VITE_CLOUD_ENV_DEV`、`VITE_CLOUD_ENV_PROD`、`VITE_CLOUD_STORAGE_DEV`、`VITE_CLOUD_STORAGE_PROD`。只放公开标识，可以入库 |
| `apps/miniprogram/cloud-storage/` | 要原样上传到两个环境云存储的文件 |
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
- [ ] 两个云环境的存储里都有 `fonts/copybook-kai.ttf` 和 `pinyin/pinyin-v3.bin`，`.env` 已填 `VITE_CLOUD_STORAGE_DEV`、`VITE_CLOUD_STORAGE_PROD`
- [ ] 基础库最低版本 ≥ 2.32.3
- [ ] 服务类目是不需要资质的工具类
- [ ] 真机试过：登录选头像昵称、复制邀请码、设置提醒、生成字帖是楷体、保存练习图片、保存 PDF、3D 太阳系能拖动旋转、双指缩放、点星球能看到文字讲解；3D 几何体能拖动旋转、点棱和顶点会计数、每种几何体都能拖滑块展开、离开「打印题目」回来画面还在、打印题目能保存
