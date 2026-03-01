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

---

<p align="center">
  <img src="https://github.com/user-attachments/assets/a20b5785-c4b3-4f44-86d9-f07350caf873" width="45%" />
  <img src="https://github.com/user-attachments/assets/475cb456-ed0f-40e9-829d-a746dffd2688" width="45%" />
</p>



## 功能

- **多音源搜索**：网易云音乐、酷我音乐、Joox 聚合搜索
- **本地音乐**：扫描播放本地音乐文件
- **播放管理**：播放队列、喜欢、历史、自定义歌单
- **歌词显示**：支持滚动歌词、实时跳转
- **其他**：明/暗主题切换、数据定期同步

> API 来自GD音乐台(https://music.gdstudio.xyz)
>
> 数据同步功能依赖主项目 [Otter Music Web](https://github.com/DJChanahCJD/otter-music-web)
>
> ⚠️ 当前仅支持 Android，欢迎 PR



## 开发

```bash
# 安装依赖
npm install --legacy-peer-deps

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```
> ⚠ 必须加 `--legacy-peer-deps`，因为`@jofr/capacitor-media-session` 与 Capacitor 8 存在 peer 版本冲突



## Android 构建

```bash
# 生成资源文件
npm run resources

# 添加 Android 平台
npm run cap:add:android

# 同步并构建 Debug 版本
npm run build:android:debug
```
> 构建完成后，APK 文件位于 `android/app/build/outputs/apk/debug/app-debug.apk`



## 目录结构

```
src/
├── components/     # UI 组件
├── hooks/          # 自定义 Hooks
├── services/       # API 服务
├── store/          # Zustand 状态管理
├── types/          # TypeScript 类型定义
└── lib/utils/      # 工具函数
```

## TODO

- [x] **版本更新**：集成 GitHub Releases 检查与下载（支持代理加速）。
- [] 研究 GD Studio API 的原理，如何实现自搭建后端 API。

## License

MIT
