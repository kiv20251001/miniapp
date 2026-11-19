# 第三方素材与许可清单

小程序里每一张图片、每一个字体、每一份数据都要能说清楚「从哪来、什么许可、能不能商用」。规则写在根目录 `AGENTS.md` 的「版权」一节，这份是清单。新增素材时在这里加一行；说不清来源的素材不要上线。

## 正在使用

| 素材 | 用在哪里 | 来源 | 许可 | 注意 |
| --- | --- | --- | --- | --- |
| 霞鹜文楷 GB（`fonts/copybook-kai.woff`） | 字帖楷体，放云存储 | [lxgw/LxgwWenkaiGB](https://github.com/lxgw/LxgwWenkaiGB) | SIL OFL 1.1，可商用 | 子集化时保留 name 表里的版权和许可（`build-copybook-font.mjs` 已加 `--name-IDs=*`）；不能单独售卖字体 |
| 思源黑体 Noto Sans SC | 生成分享图、工具图标时的文字 | [notofonts/noto-cjk](https://github.com/notofonts/noto-cjk) | SIL OFL 1.1，可商用 | 只在生成脚本里用（`scripts/open-fonts.mjs`），字体文件不随包发布 |
| hanzi-writer-data（Make Me a Hanzi） | 字帖笔顺、工具图标和分享图里的「米」等汉字笔画 | [chanind/hanzi-writer-data](https://github.com/chanind/hanzi-writer-data) | Arphic Public License，可商用、可再分发 | 派生数据（`subpages/copybook/strokes.ts`）沿用同一许可，文件头已写明 |
| pinyin-pro | 字帖读音表（生成后只引用结果） | npm | MIT | — |
| Natural Earth 1:110m 陆地 | 「3D 太阳系」地球的海陆轮廓 `subsolar/earth-mask.ts` | [naturalearthdata.com](https://www.naturalearthdata.com/about/terms-of-use/) | 公有领域 | 不需要署名 |
| three.js r162 | 「3D 太阳系」3D 渲染 | npm `three` | MIT | 打包后的 `subsolar/vendor/three.js` 保留了文件头的版权声明，不要删 |
| dayjs、vue、pinia、uni-app | 运行时 | npm | MIT / Apache-2.0 | — |

## 项目自己画或自己写的

这些没有第三方版权，但要保证以后改动时不混进别人的东西：

- `src/static/icons/`：`scripts/render-icons.mjs` 里手写的 SVG 路径。
- `src/static/tools/`、`src/static/share/`、`src/static/share-cover.jpg`：`render-tool-icons.mjs`、`render-share-covers.mjs`、`render-share-cover.mjs` 生成，文字用思源黑体。
- `src/static/logo-u.svg`、`src/static/brand/yimu-logo.svg`：本项目品牌标识，源文件在 `docs/prd/UI/`。
- 「3D 太阳系」的星球表面：`src/subsolar/textures.ts` 用着色器现场生成，没有贴图文件；天体讲解文字为本项目原创，数字取自公开天文常数。
- 页面文字：小程序运行时用手机系统字体显示，不随包带字体文件。

## 待确认

- `src/static/user_icon.jpg`（孩子头像四宫格雪碧图，网页端对应 `apps/web/src/assets/user_icon.png`）：仓库里没有记录来源。请确认是自己绘制、AI 生成后有商用权，或购买了授权；确认不了就换成自绘或可商用的头像，并在上表补一行。
