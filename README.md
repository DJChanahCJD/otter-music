# Otter Music

<p align="center">
  <img width="100" alt="Otter Music icon" src="public/favicon.svg">
</p>
<p align="center"><strong>水獭音乐</strong></p>

<p align="center">
  基于 <a href="https://music-api.gdstudio.xyz/api.php">GD Studio's API</a> 的多音源聚合音乐播放器
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-7.x-646CFF?logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/Capacitor-8-119EFF?logo=capacitor&logoColor=white" />
</p>

<p align="center">
  <img src="https://github.com/user-attachments/assets/a20b5785-c4b3-4f44-86d9-f07350caf873" width="45%" />
  <img src="https://github.com/user-attachments/assets/475cb456-ed0f-40e9-829d-a746dffd2688" width="45%" />
</p>

## 核心功能

- **多音源聚合与回退**：支持多源检索与播放失败回退（本地下载/缓存/直连/代理/下一首）。
- **智能音源自动匹配**：可自动切换到可用免费音源，并同步队列/歌单/喜欢状态。
- **歌单广场**：支持网易云歌单、RSS 播客订阅、Alist 站点配置，以及 Billboard、台湾金曲奖、格莱美奖榜单查询。
- **歌单管理增强**：支持搜索、去重、导出、封面设置、URL 添加歌曲，支持主流音乐平台的歌单导入。
- **下载管理**: 支持选择下载音质、下载目录、是否嵌入歌词或封面（FLAC 无损按原生流式重写标签，不占 JS 内存）
- **播放生态**：支持播放列表、最近播放、个人歌单、歌词显示、音质选择、倍速调节、睡眠定时、横屏播放模式、车载蓝牙歌词、桌面歌词（Android 悬浮窗）与主题切换。
- **数据备份**：支持导出/导入本地 JSON 文件，以及配置 WebDAV 手动上传和恢复备份。
- **移动端体验完整**：支持 PWA 安装、Android 打包与 Media Session 集成，网页端也能接近原生体验。

> 数据同步功能：通过管理员手动分配的 `SYNC_KEY` 接入。存储基于 Cloudflare KV（上限 25 MB），单用户理论可稳定同步 5 万首歌曲

## 音源支持

| 音源              | 搜索 | 播放 | 歌词 | 歌单导入 | 备注                                                       |
| ----------------- | :--: | :--: | :--: | :------: | ---------------------------------------------------------- |
| 网易云音乐🌟      |  ✅  |  ✅  |  ✅  |    ✅    | GD Studio API                                              |
| Netease           |  ✅  |  ✅  |  ✅  |    ✅    | 网易云官方，搜索建议/专辑/歌手详情                         |
| Joox🌟            |  ✅  |  ✅  |  ✅  |    ❌    | GD Studio API                                              |
| B站🌟             |  ✅  |  ✅  |  ✅  |    ❌    | 支持视频分P/合集、账号登录（字幕歌词）                     |
| 酷我音乐          |  ✅  |  ✅  |  ✅  |    ✅    | GD Studio API                                              |
| 咪咕音乐          |  ✅  |  ✅  |  ✅  |    ✅    | 仅移动端                                                   |
| QQ音乐            |  ✅  |  ✅  |  ✅  |    ✅    | QQ音乐官方；需 Cookie 登录                                 |
| Higequ            |  ✅  |  ✅  |  ✅  |    ❌    | [Hi歌曲音乐网](https://higequ.com/)，仅标准音质            |
| Jamendo           |  ✅  |  ✅  |  ❌  |    ❌    | [独立音乐人 CC 曲库](https://www.jamendo.com/)，仅标准音质 |
| 酷狗音乐          |  ❌  |  ❌  |  ❌  |    ✅    |                                                            |
| 本地音乐          |  ❌  |  ✅  |  ✅  |    ❌    | 仅移动端支持                                               |
| 播客（歌单广场）  |  ✅  |  ✅  |  ❌  |    ❌    | RSS 播客订阅，支持小宇宙链接与 OPML 批量导入               |
| Alist（歌单广场） |  ✅  |  ✅  |  ❌  |    ❌    | 仅音频，如 ASMR 站                                         |

> [!NOTE]
>
> **兼容性说明**
>
> 最低支持版本：minSdkVersion = 24 (Android 7.0)
>
> 若出现界面排版错乱、图标异常等问题，请先更新 Android System WebView 至较新版本（建议 WebView 100+ 的版本）。

> [!IMPORTANT]
>
> 在线体验：[Otter Music](https://otter-music.pages.dev/)
>
> 支持 PWA，可添加到主屏幕（iOS 请使用 Safari）

## 快速开始

```bash
npm install
npm run dev
```

## 常用脚本

```bash
# 构建
npm run build

# 类型检查
npm run typecheck

# 代码检查
npm run lint

# 测试
npm run test
```

## Android 构建

```bash
# 生成资源
npm run resources

# 首次添加 Android 平台
npm run cap:add:android

# 同步 Android 工程
npm run cap:sync:android

# 构建 Debug APK
npm run build:android:debug
```

Debug APK 输出路径：

- `android/app/build/outputs/apk/debug/app-debug.apk`

## 项目结构

```text
src/
├── components/                 # 页面与业务组件
├── hooks/                      # 播放控制与应用行为 Hook
├── lib/                        # 核心能力（重点）
│   ├── music-api.ts            # 统一音乐能力入口（搜索/URL/歌词/封面）
│   ├── audio-match.ts          # 自动换源与匹配结果回写
│   ├── api/                    # 服务端配置、同步、更新、播客接口
│   ├── alist/                  # Alist 网盘 API 客户端
│   ├── apple-music/            # Apple Music 歌单导入
│   ├── awards/                 # 金曲奖/格莱美奖榜单数据与解析
│   ├── billboard/              # Billboard 榜单 API 客户端
│   ├── bilibili/               # B站 API 客户端与播放适配
│   ├── higequ/                 # Hi歌曲音乐网页面抓取与解析
│   ├── jamendo/                # Jamendo 网页接口客户端（免鉴权）
│   ├── kugou/                  # 酷狗 API 客户端
│   ├── kuwo/                   # 酷我 API 客户端
│   ├── migu/                   # 咪咕 API 客户端
│   ├── netease/                # 网易云 API 适配层
│   ├── qqmusic/                # QQ音乐 API 客户端
│   ├── webdav/                 # WebDAV 备份客户端
│   ├── music-provider/         # Provider 抽象与实现
│   ├── navigation/             # 详情页导航跳转逻辑
│   ├── sync.ts                 # 数据同步核心逻辑
│   ├── storage-*.ts            # 存储适配与统一存储管理
│   ├── clipboard.ts            # 跨平台剪贴板
│   ├── crypto-storage.ts       # 加密存储
│   └── utils/                  # 缓存、下载、检索、歌名匹配等工具
├── plugins/                    # Capacitor 插件封装
├── routes/                     # 路由定义
├── store/                      # Zustand 全局状态
└── types/                      # 类型定义
functions/                 # Cloudflare Workers 后端
shared/                     # 跨端共享类型
```

## 📦 部署指南 (Cloudflare Workers)

前端由 Workers Static Assets 托管，后端是同一个项目里的 Hono Worker，部署配置统一在根目录 `wrangler.jsonc`。

### 1. 一次性准备

1. **替换 KV namespace id**：把 `wrangler.jsonc` 中的 `REPLACE_WITH_EXISTING_KV_NAMESPACE_ID` 换成你账号下 `oh_file_url` 这个 namespace 的 id。
   - 查看：`npx wrangler kv namespace list`，或 Dashboard → Storage & Databases → KV。
   - 首次部署：`npx wrangler kv namespace create oh_file_url`。
   - ⚠️ 从 Pages 迁移时请**复用原 Pages 绑定的那个 namespace**，否则已分配的 SYNC_KEY 与同步数据会丢失。占位符未替换时 `wrangler deploy` 会直接报错。
2. **设置密钥**（不要提交到仓库）：`npx wrangler secret put PASSWORD`（必须）；`npx wrangler secret put GITHUB_TOKEN`（可选，用于版本更新检查）。也可在 Dashboard → Worker → Settings → Variables and Secrets 中添加。
3. 本地调试把 `.dev.vars.example` 复制为 `.dev.vars`；若 Worker 名不是 `otter-music`，修改 `wrangler.jsonc` 的 `name`。

### 2. Workers Builds（Git 集成，推荐）

| 配置项         | 值                                    |
| -------------- | ------------------------------------- |
| Build command  | `npm run build`                       |
| Deploy command | `npx wrangler deploy`                 |
| Root directory | 留空（`wrangler.jsonc` 在仓库根目录） |

> 构建会使用 `package.json` 里锁定的 `wrangler@4.162.0`。**不要移除这个 devDependency，也不要删 `wrangler.jsonc`**：仓库是 npm workspace 根目录，缺少 Wrangler 配置文件时新版 Wrangler 会进入自动配置，并在框架检测阶段直接失败。

手动部署：`npm run build && npm run deploy`。

### 3. 路由说明

- `assets.directory: ./dist` + `not_found_handling: single-page-application`：静态资源正常返回，SPA 深链接（如 `/admin`）回退到 `index.html`。
- `assets.run_worker_first` 只把 `/health`、`/auth`、`/proxy`、`/update`、`/music-api`、`/sync`、`/podcast-api` 这些后端前缀交给 Worker，其余请求直接由静态资源返回，不产生额外的 Worker 调用。
- `functions/worker.ts` 中，Hono 未命中路由的 404 会通过 `ASSETS` binding 回退，行为等价于原 Pages 的 `ctx.next()`。
- `functions/[[path]].ts` 保留，因此仍可用 Cloudflare Pages 部署（Build command `npm run build`、Build output directory `dist`，并绑定同名 KV 与 `PASSWORD`）。

> 自建后端可在前端页面「设置 → API 地址」中填入自定义域名。
>
> `https://<你的域名>/admin` 路径用于管理 SYNC_KEY。

## TODO

- 重构为仅安卓端，清理冗余 Web 适配代码（Web端使用Listen1插件即可，方便下载）
- 嵌入 AI DJ Claudio

### Not TODO

- 不接入 JOOX、KUWO 等官方接口
- 不接入 musicfree/洛雪 的插件生态（可以手动维护其音源）
- 不做网易云「每日推荐」（已有「私人雷达」）
- 不做视频 MV 模式（避免臃肿，专注于听歌）
- 不做自定义缓存功能（开关、歌曲缓存最大占用/个数、缓存过期时间），因为难以控制 Web View 默认的 Disk Cache
- 不实现音效选择：Web 端限制多，且收益低

## 参考资料

- [GD Studio](https://music-api.gdstudio.xyz/api.php)：免费音源 API 服务支持
- [Listen1](https://github.com/listen1/listen1_chrome_extension/blob/master/js/provider)：网易云/咪咕/B站官方接口实现参考
- [Chartly API](https://github.com/DJChanahCJD/Chartly)：金曲奖/格莱美奖 API

## 🤝 贡献

欢迎提交 Issue 或 Pull Request！

## 免责声明

本项目不存储任何音频资源，接口均来自互联网公开资料，仅供技术交流。

严禁商业用途，由此产生的版权风险由使用者自行承担。

## License

MIT
