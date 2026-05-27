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

- **多音源聚合与回退**：支持多源检索与播放失败回退（本地下载/直连/代理/下一首）。
- **智能音源自动匹配**：在可配置开关下自动切换到可用免费音源，并同步队列/歌单/喜欢状态。
- **歌单市场与播客**：支持网易云歌单、我的歌单，以及本地 RSS 播客入口。
- **歌单管理增强**：支持搜索、去重、导出、封面设置、URL 添加歌曲。
- **播放生态**：支持历史记录、喜欢列表、歌词显示、主题切换与数据同步配置。
- **移动端体验完整**：支持 PWA 安装、Android 打包与 Media Session 集成，网页端也能接近原生体验。

> 数据同步功能：通过管理员手动分配的 `SYNC_KEY` 接入。存储基于 Cloudflare KV（上限 25 MB），单用户理论可稳定同步 5 万首歌曲

## 音源支持

| 音源 | 搜索 | 播放 | 歌词 | 歌单导入 | 备注 |
|------|:----:|:----:|:----:|:--------:|------|
| 网易云音乐 | ✓ | ✓ | ✓ | ✓ | GD Studio API，聚合默认源 |
| Netease（官方） | ✓ | ✓ | ✓ | ✓ | 官方 API，变灰解锁、搜索建议 |
| Joox | ✓ | ✓ | ✓ | ✗ | 东南亚/港台风 |
| 酷我音乐 | ✓ | ✓ | ✓ | ✓ | |
| 咪咕音乐 | ✓ | ✓ | ✓ | ✓ | V3 接口 |
| B站 | ✓ | ✓ | ✗ | ✗ | 用户上传资源，无歌词 |
| QQ音乐 | ✗ | ✗ | ✗ | ✓ | 仅歌单导入 |
| 酷狗音乐 | ✗ | ✗ | ✗ | ✓ | 仅歌单导入 |
| 本地音乐 | ✗ | ✓ | ✓ | ✗ | 需 Capacitor 原生环境 |
| 播客 | ✓ | ✓ | ✗ | ✗ | RSS 播客订阅 |

> **聚合搜索**：选择"聚合搜索"时，默认并行搜索网易云、Joox、咪咕三个音源，智能去重后按音质排序。
>
> QQ音乐和酷狗音乐的搜索/播放能力由 GD Studio API 提供（对应 Joox/酷我），官方 API 仅用于歌单链接解析导入。

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

> 自建后端可在前端页面「设置 → API 地址」中填入自定义域名。
>
> `https://<你的域名>/admin` 路径用于管理 SYNC_KEY。

## TODO

- [ ] 媒体状态同步一致性（Web 与 Native MediaSession），移动端通过媒体控件进入APP会导致音频暂停，重新播放后再次点击媒体控件进入后，音频不会暂停，但UI上还是显示暂停按钮。
- [x] 支持「边听边缓存」功能
- [x] 支持主流音乐APP的歌单导入功能（网易云、酷我、酷狗、QQ音乐、咪咕等）
- [x] 下载设置优化，支持内嵌封面、内嵌歌词，支持选定下载目录。
- [x] 引入B站音源支持
- [ ] 评估是否学习 musicfree 那种插件化机制(CommonJS + 沙箱 VM)
- [x] 对应音源的歌手、专辑跳转应该走对应逻辑。当前咪咕音源的会聚合搜索。
- [ ] 咪咕音乐能够播放但不能下载
- [ ] 歌单导入文件导入tab不需要底部的确认按钮
调整聚合b站和咪咕的权重
B站能否直连流式播放？不要下载完整音频后再blob返回
咪咕VIP标识，看哪些歌曲不能播放
- [ ] FullScreenPlayer 支持长按封面预览，当前该组件点击更多按钮会导致Minifed React Error
- [ ] B站音源播放成功过一次，但后面又失败了，不太稳定？当前边听边缓存功能是否适用B站音源？能否不要base64和blob之间转换，太消耗时间了。
““
[2026-05-27 00:20:58] INFO system: App started at 2026-05-27 00:20:58
context: {
  "version": "2.3.0-preview",
  "platform": "native",
  "env": "production"
}

[2026-05-27 00:23:11] INFO index-B2jOEI2Q.js: bilibili-blob] typeof=data:string, len=83015, hasNewlines=true, first80="/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdC\nIFh"

[2026-05-27 00:23:11] INFO index-B2jOEI2Q.js: bilibili-blob] blob created, size=61450

[2026-05-27 00:23:11] INFO index-B2jOEI2Q.js: bilibili-blob] typeof=data:string, len=318071, hasNewlines=true, first80="/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdC\nIFh"

[2026-05-27 00:23:11] INFO index-B2jOEI2Q.js: bilibili-blob] blob created, size=235455

[2026-05-27 00:23:11] INFO index-B2jOEI2Q.js: bilibili-blob] typeof=data:string, len=215446, hasNewlines=true, first80="/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdC\nIFh"

[2026-05-27 00:23:11] INFO index-B2jOEI2Q.js: bilibili-blob] blob created, size=159484

[2026-05-27 00:23:11] INFO index-B2jOEI2Q.js: bilibili-blob] typeof=data:string, len=324126, hasNewlines=true, first80="/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdC\nIFh"

[2026-05-27 00:23:11] INFO index-B2jOEI2Q.js: bilibili-blob] blob created, size=239937

[2026-05-27 00:23:13] INFO index-B2jOEI2Q.js: bilibili-blob] typeof=data:string, len=148254, hasNewlines=true, first80="/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsK\nCws"

[2026-05-27 00:23:13] INFO index-B2jOEI2Q.js: bilibili-blob] blob created, size=109745

[2026-05-27 00:23:13] INFO index-B2jOEI2Q.js: bilibili-blob] typeof=data:string, len=394958, hasNewlines=true, first80="/9j/4AAQSkZJRgABAQAAAQABAAD/4gIoSUNDX1BST0ZJTEUAAQEAAAIYAAAAAAIQAABtbnRyUkdC\nIFh"

[2026-05-27 00:23:13] INFO index-B2jOEI2Q.js: bilibili-blob] blob created, size=292369

[2026-05-27 00:23:14] INFO index-B2jOEI2Q.js: bilibili-blob] typeof=data:string, len=882343, hasNewlines=true, first80="/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdC\nIFh"

[2026-05-27 00:23:14] INFO index-B2jOEI2Q.js: bilibili-blob] blob created, size=653162

[2026-05-27 00:23:15] INFO index-B2jOEI2Q.js: bilibili-blob] typeof=data:string, len=525282, hasNewlines=true, first80="/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAA\nA6A"

[2026-05-27 00:23:15] INFO index-B2jOEI2Q.js: bilibili-blob] blob created, size=388843

[2026-05-27 00:23:15] INFO index-B2jOEI2Q.js: bilibili-blob] typeof=data:string, len=754714, hasNewlines=true, first80="/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdC\nIFh"

[2026-05-27 00:23:15] INFO index-B2jOEI2Q.js: bilibili-blob] blob created, size=558683

[2026-05-27 00:23:16] INFO index-B2jOEI2Q.js: bilibili-blob] typeof=data:string, len=2819315, hasNewlines=true, first80="iVBORw0KGgoAAAANSUhEUgAABsAAAAQ4CAYAAAC35xkjAAAgAElEQVR4nOy9y5LkuLH3+XeQkbeq\n6ot"

[2026-05-27 00:23:16] INFO index-B2jOEI2Q.js: bilibili-blob] blob created, size=2087023
””

### Low Priority

- [ ] 倍速播放、定时关闭、音效选择
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
