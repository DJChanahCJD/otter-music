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
# 运行测试
npm run test
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
├── lib/api/        # API 服务
├── store/          # Zustand 状态管理
├── types/          # TypeScript 类型定义
└── lib/utils/      # 工具函数
```

## TODO

### v2.0.1 规划

- [ ] 0. 修复网易云QR登录失效问题
- [ ] 1. 支持网易云官方搜索（拦截请求，走自己的后端）
- [ ] 2. _netease 歌曲做歌手、专辑跳转，直接复用歌单页面组件
- [ ] 3. 在歌单市场添加（我的）分类，加载用户自己的网易云歌单
- [ ] 4. 在歌单市场（全部）里添加个人推荐歌单（如果登录了网易云）
- [ ] 5. 网易云歌单更多按钮那里添加分享按钮
- [ ] 6. 「我的」页面下的歌单列表显示 cover
- [ ] 7. 解锁完整版不能单纯看排名，必须歌名和歌手相同才匹配成功
- [ ] 8. 全局手势是适配的，但是经典手势会存在遮挡，播放栏也有可能遮挡底部tab，考虑样式解决还是允许用户拖动改变y轴
- [ ] 9. 添加 Listen1 的致谢
- [ ] 10. 添加逻辑：把个人歌单中的付费版本，点击匹配后直接改为免费版本，而不仅仅是下一首播放
- [ ] 11. 在设置页面添加自动匹配功能按钮开关，即加载歌曲时如果需要付费，则自动匹配为免费音源。

## License

MIT
