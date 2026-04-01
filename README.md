# Otter Music

[网页端](https://github.com/DJChanahCJD/otter-music-web)

<p align="center">
  <img width="100" alt="Otter Music icon" src="public/favicon.svg">
</p>
<p align="center"><strong>Stream your music like an otter</strong></p>

<p align="center">
  基于 GD Studio API 的多音源聚合音乐播放器
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-7.x-646CFF?logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/Capacitor-8-119EFF?logo=capacitor&logoColor=white" />
  <img src="https://img.shields.io/badge/State-Zustand-orange" />
</p>

## 项目简介

- 多源聚合播放，覆盖在线播放与本地文件。
- 移动端优先，使用 Capacitor 打包 Android 应用。
- 重点关注播放稳定性：失败重试、备用线路、自动换源。
***

<p align="center">
  <img src="https://github.com/user-attachments/assets/a20b5785-c4b3-4f44-86d9-f07350caf873" width="45%" />
  <img src="https://github.com/user-attachments/assets/475cb456-ed0f-40e9-829d-a746dffd2688" width="45%" />
</p>

## 核心功能

- **多音源聚合与回退**：支持多源检索与播放失败回退（本地下载/直连/代理/下一首）。
- **智能音源自动匹配**：在可配置开关下自动切换到可用免费音源，并同步队列/歌单/喜欢状态。
- **歌单市场与播客**：支持网易云主题歌单、我的歌单，以及本地 RSS 播客入口。
- **URL 快速添加**：支持粘贴“标题 + URL”自动识别，支持剪贴板自动填充。
- **歌单管理增强**：支持搜索、去重、导出、封面设置、URL 添加歌曲。
- **播放生态**：支持历史记录、喜欢列表、歌词显示、主题切换与数据同步配置。

> API 来自GD音乐台(<https://music.gdstudio.xyz>)
>
> 数据同步由 [Otter Music Web](https://github.com/DJChanahCJD/otter-music-web) 驱动，通过管理员手动分配的 `SYNC_KEY` 接入。存储基于 Cloudflare KV（上限 25 MB），单用户理论可稳定同步 4 万首歌曲
>
> 最低支持版本：minSdkVersion = 24 (Android 7.0)
>
> **注意**：在 Android 13（API 33）以下的设备上，部分 CSS 特性（如 `color-mix()`）可能不受支持，导致主题色失效或界面样式异常。建议升级至 Android 13 以上以获得最佳体验。

## 快速开始

```bash
npm install --legacy-peer-deps
npm run dev
```

> 必须使用 `--legacy-peer-deps`，原因是 `@jofr/capacitor-media-session` 与 Capacitor 8 存在 peer 版本冲突。

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
│   ├── netease/                # 网易云 API 适配层
│   ├── music-provider/         # Provider 抽象与实现（netease/kuwo/joox/local/podcast/aggregate）
│   ├── sync.ts                 # 数据同步核心逻辑
│   ├── storage-*.ts            # 存储适配与统一存储管理
│   └── utils/                  # 缓存、下载、检索、歌名匹配等工具
├── store/                      # Zustand 全局状态
└── types/                      # 类型定义
```

## TODO

- [ ] 用 Tauri 开发桌面端？

### Low Priority

- [ ] 媒体状态同步一致性（Web 与 Native MediaSession）
- [ ] UI 重构（极简高效，打开即听）
- [ ] 随机歌单功能：从热门歌单池随机，耗尽后自动补充

## 参考资料

- [GD Studio](https://music-api.gdstudio.xyz/api.php)：免费音源 API 服务支持
- [Listen1](https://github.com/listen1/listen1_chrome_extension/blob/master/js/provider/netease.js)：网易云接口实现参考

## License

MIT
