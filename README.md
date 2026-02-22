# 🦦 Otter Music

基于 GDStudio API的移动端音乐播放器APP，支持多音源聚合搜索。当前仅支持 Android。

<img src="https://github.com/user-attachments/assets/a20b5785-c4b3-4f44-86d9-f07350caf873" width="45%" />
<img src="https://github.com/user-attachments/assets/475cb456-ed0f-40e9-829d-a746dffd2688" width="45%" />



## 功能

- **多音源搜索**：网易云音乐、酷我音乐、Joox 聚合搜索
- **本地音乐**：扫描播放本地音乐文件
- **播放管理**：播放队列、喜欢、历史、自定义歌单
- **歌词显示**：支持滚动歌词、实时跳转
- **其他**：明/暗主题切换、数据定期同步

> API 来自GD音乐台(https://music.gdstudio.xyz)
> 
> 数据同步功能依赖主项目 OtterHub: (https://github.com/DJChanahCJD/otterhub)

## 技术栈

React 19 + TypeScript + Vite + Tailwind CSS + Capacitor + Zustand

## 开发

```bash
# 安装依赖
npm install --legacy-peer-deps

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```
> ⚠ Required: --legacy-peer-deps
@jofr/capacitor-media-session 与 Capacitor 8 存在 peer 版本冲突

## Android 构建

```bash
# 添加 Android 平台
npm run cap:add:android

# 同步并构建 Debug 版本
npm run build:android:debug
```

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

## License

MIT
