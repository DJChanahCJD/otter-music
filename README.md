# Otter Music

[网页端](https://github.com/DJChanahCJD/otter-music-web)

<p align="center">
  <img width="100" alt="Otter Music icon" src="public/favicon.svg">
</p>
<p align="center"><strong>Stream your music like an otter</strong></p>

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
- **歌单广场与播客**：支持网易云歌单、我的歌单，以及本地 RSS 播客入口。
- **歌单管理增强**：支持搜索、去重、导出、封面设置、URL 添加歌曲，支持主流音乐平台的歌单导入。
- **下载管理**: 支持选择下载音质、下载目录、是否嵌入歌词或封面
- **播放生态**：支持播放列表、最近播放、个人歌单、歌词显示、音质选择、倍速调节、睡眠定时、主题切换与数据同步配置。
- **移动端体验完整**：支持 PWA 安装、Android 打包与 Media Session 集成，网页端也能接近原生体验。

> 数据同步功能：通过管理员手动分配的 `SYNC_KEY` 接入。存储基于 Cloudflare KV（上限 25 MB），单用户理论可稳定同步 5 万首歌曲

## 音源支持

| 音源             | 搜索 | 播放 | 歌词 | 歌单导入 | 备注                               |
| ---------------- | :--: | :--: | :--: | :------: | ---------------------------------- |
| 网易云音乐🌟     |  ✅  |  ✅  |  ✅  |    ✅    | GD Studio API                      |
| Netease          |  ✅  |  ✅  |  ✅  |    ✅    | 网易云官方，搜索建议/专辑/歌手详情 |
| Joox             |  ✅  |  ✅  |  ✅  |    ❌    | GD Studio API                      |
| 酷我音乐         |  ✅  |  ✅  |  ✅  |    ✅    | GD Studio API                      |
| 咪咕音乐         |  ✅  |  ✅  |  ✅  |    ✅    | 仅移动端                           |
| B站🌟            |  ✅  |  ✅  |  ❌  |    ❌    | 仅移动端，支持视频分P/合集         |
| QQ音乐           |  ✅  |  ✅  |  ✅  |    ✅    | QQ音乐官方                         |
| 酷狗音乐         |  ❌  |  ❌  |  ❌  |    ✅    |                                    |
| 小蜗音乐         |  ✅  |  ✅  |  ✅  |    ❌    | 酷我音源（洛雪），URL 走 LX API    |
| 小秋音乐         |  ✅  |  ✅  |  ✅  |    ❌    | QQ音源（洛雪），URL 走 LX API      |
| 本地音乐         |  ❌  |  ✅  |  ✅  |    ❌    | 仅移动端支持                       |
| 播客（歌单广场） |  ✅  |  ✅  |  ❌  |    ❌    | RSS 播客订阅                       |

> [!NOTE]
> 最低支持版本：minSdkVersion = 24 (Android 7.0)

> [!IMPORTANT]
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
├── hooks/                      # 音频加载相关 Hook
├── lib/                        # 核心能力（重点）
│   ├── music-api.ts            # 统一音乐能力入口（搜索/URL/歌词/封面）
│   ├── audio-match.ts          # 自动换源与匹配结果回写
│   ├── api/                    # 服务端配置、同步、更新、播客接口
│   ├── bilibili/               # B站 API 客户端与播放适配
│   ├── kugou/                  # 酷狗 API 客户端
│   ├── kuwo/                   # 酷我 API 客户端
│   ├── migu/                   # 咪咕 API 客户端
│   ├── netease/                # 网易云 API 适配层
│   ├── qqmusic/                # QQ音乐 API 客户端
│   ├── music-provider/         # Provider 抽象与实现
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

## 📦 部署指南 (Cloudflare Pages)

1. **创建项目**：Fork 本仓库，在 [Cloudflare Dashboard](https://dash.cloudflare.com/) 创建 Pages 项目。
2. **构建配置**：
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
3. **环境变量**：
   - `PASSWORD`: 设置你的管理员密码，用于管理`SYNC_KEY`（必须）
4. **KV 绑定**：
   - 创建 KV Namespace 命名为 `oh_file_url`
   - 在 Pages 设置中绑定该 KV，变量名设为 `oh_file_url`

> 自建后端可在前端页面「设置 → API 地址」中填入自定义域名。
>
> `https://<你的域名>/admin` 路径用于管理 SYNC_KEY。

## TODO

...

### Not TODO

- 不接入 JOOX、KUWO 等官方接口：当前网易云官方接口够用，无需增加复杂度；接入 JOOX 还需要做代理
- 不接入 musicfree/洛雪 的插件生态（可以手动维护其音源）
- 不做网易云「每日推荐」（已有「私人雷达」）
- 不做 B 站 UP 主歌手页（风控校验容易失败）
- 不做视频 MV 模式（避免臃肿，专注于听歌）
- 不做自定义缓存功能（开关、歌曲缓存最大占用/个数、缓存过期时间），因为难以控制 Web View 默认的 Disk Cache
- 不实现音效选择：Web 端限制多，且收益低

## 参考资料

- [GD Studio](https://music-api.gdstudio.xyz/api.php)：免费音源 API 服务支持
- [洛雪音乐音源](https://github.com/Huibq/keep-alive)
- [Listen1](https://github.com/listen1/listen1_chrome_extension/blob/master/js/provider)：网易云/咪咕/B站官方接口实现参考

## 🤝 贡献

欢迎提交 Issue 或 Pull Request！

## 免责声明

本项目不存储任何音频资源，接口均来自互联网公开技术资料，仅供技术交流。

严禁商业用途，由此产生的版权风险由使用者自行承担。

## License

MIT
