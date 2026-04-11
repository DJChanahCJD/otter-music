# Otter Music

[网页端](https://github.com/DJChanahCJD/otter-music-web)

<p align="center">
  <img width="100" alt="Otter Music icon" src="public/favicon.svg">
</p>
<p align="center"><strong>Stream your music like an otter</strong></p>

<p align="center">
  基于 [GD Studio's API](https://music.gdstudio.xyz/api.php) 的多音源聚合音乐播放器
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

- **多音源聚合与回退**：支持多源检索与播放失败回退（本地下载/直连/代理/下一首）。
- **智能音源自动匹配**：在可配置开关下自动切换到可用免费音源，并同步队列/歌单/喜欢状态。
- **歌单市场与播客**：支持网易云歌单、我的歌单，以及本地 RSS 播客入口。
- **歌单管理增强**：支持搜索、去重、导出、封面设置、URL 添加歌曲。
- **播放生态**：支持历史记录、喜欢列表、歌词显示、主题切换与数据同步配置。
- **移动端体验完整**：支持 PWA 安装、Android 打包与 Media Session 集成，网页端也能接近原生体验。

>
> 数据同步功能：通过管理员手动分配的 `SYNC_KEY` 接入。存储基于 Cloudflare KV（上限 25 MB），单用户理论可稳定同步 5 万首歌曲

> [!NOTE]
> 最低支持版本：minSdkVersion = 24 (Android 7.0)
> 
> Android 13（API 33）以下设备可能存在部分 CSS 样式兼容问题，建议升级系统。

> [!IMPORTANT]
> 在线体验：[Otter Music](https://otter-music.pages.dev/)
> 
> 支持 PWA，可添加到主屏幕（iOS 请使用 Safari）

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

> 你可以将 [src/lib/api/config.ts](/src/lib/api/config.ts) 中的 `API_URL` 替换为你自己的 Pages 域名。例如：`https://otter-music.pages.dev`。


## TODO

- [ ] 媒体状态同步一致性（Web 与 Native MediaSession）
- [ ] 播放时断网后有时无法正常切换到有本地下载的歌曲

### Low Priority

- [ ] 适配平板端，优化移动端体验
- [ ] UI 重构（极简高效，打开即听）
- [ ] 随机歌单功能：从热门歌单池随机，耗尽后自动补充

### Not TODO

- 不接入 JOOX、KUWO 等官方接口：当前网易云官方接口够用，无需增加复杂度；接入 JOOX 还需要做代理


## 参考资料

- [GD Studio](https://music-api.gdstudio.xyz/api.php)：免费音源 API 服务支持
- [Listen1](https://github.com/listen1/listen1_chrome_extension/blob/master/js/provider/netease.js)：网易云接口实现参考

## 🤝 贡献

欢迎提交 Issue 或 Pull Request！

## License

MIT
