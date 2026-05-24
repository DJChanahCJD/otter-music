## 1. 依赖与基础设施

- [x] 1.1 安装 `browser-id3-writer` 依赖：`npm install browser-id3-writer --legacy-peer-deps`
- [x] 1.2 新建 `src/lib/utils/id3-embed.ts`：导出 `embedCoverArt(blob, coverUrl)` 和 `embedLyrics(blob, lyricText)` 两个核心函数，基于 `browser-id3-writer` 实现

## 2. Store 扩展

- [x] 2.1 在 `src/store/music-store.ts` 的 `MusicState` 接口中新增字段：`downloadQuality: string`（默认 `"320"`）、`embedCover: boolean`（默认 `true`）、`embedLyric: boolean`（默认 `true`）、`downloadDirectory: string`（默认 `""`）
- [x] 2.2 在 `create` 初始状态中添加对应默认值，并添加 setter 方法：`setDownloadQuality`、`setEmbedCover`、`setEmbedLyric`、`setDownloadDirectory`

## 3. 下载核心流程改造

- [x] 3.1 修改 `src/lib/utils/download.ts` 的 `performDownloadOne`：签名增加可选的 `br` 参数，从 `useMusicStore` 读取 `downloadQuality`（优先级高于默认值 320）
- [x] 3.2 修改 `downloadWeb`：在 `triggerBlobDownload` 前插入后处理管道 —— 若 `embedCover` 启用则 fetch 封面并调用 `embedCoverArt`，若 `embedLyric` 启用则 fetch 歌词并调用 `embedLyrics`，处理期间 toast 显示"正在写入元数据..."
- [x] 3.3 修改 `downloadNative`：在 `FileTransfer.downloadFile` 完成后，若元数据嵌入启用，则 `Filesystem.readFile` → 后处理管道 → `Filesystem.writeFile` 写回
- [x] 3.4 修改 `downloadMusicTrackBatch`：批量下载时统一跳过元数据嵌入（传标志位），减少批处理总耗时
- [x] 3.5 增加大文件保护：文件大小超过 50MB 时跳过元数据嵌入并记录 logger.warn

## 4. 下载目录支持

- [x] 4.1 修改 `src/lib/storage-manager.ts` 的 `AppPaths.Music`：支持从外部传入自定义目录路径，当 `downloadDirectory` 非空时使用自定义路径，否则回退默认 `Download/OtterMusic`
- [x] 4.2 修改 `downloadNative`：使用 `storage-manager` 提供的动态路径创建目录并写入文件
- [x] 4.3 添加路径验证函数 `validateDownloadPath(path)`：拒绝包含 `..`、非法字符的路径，验证目录可写入

## 5. 下载设置 UI 组件

- [x] 5.1 新建 `src/components/settings/DownloadQualitySelect.tsx`：复刻 `QualitySelect` 结构，但读写 `downloadQuality` 而非 `quality`，默认显示"极高 (320kbps)"
- [x] 5.2 新建 `src/components/settings/DownloadSettingToggles.tsx`：内嵌封面开关（`Download` icon + "内嵌封面" + subtitle "下载时写入歌曲封面图"）和内嵌歌词开关（`FileText` icon + "内嵌歌词" + subtitle "下载时写入同步歌词信息"），均使用 `Switch` 组件
- [x] 5.3 新建 `src/components/settings/DownloadDirectorySelect.tsx`：Native 平台专用，文本输入框 + "重置为默认"按钮，使用 `SettingItem` 包裹，icon 为 `FolderOpen`；Web 平台时返回 null（不渲染）

## 6. 设置页集成

- [x] 6.1 修改 `src/components/SettingsPage.tsx`：在"偏好设置"和"账号数据"之间新增"下载设置" Section，依次排列 `DownloadQualitySelect`、`DownloadSettingToggles`、`DownloadDirectorySelect`（条件渲染）
- [x] 6.2 确保 `DownloadDirectorySelect` 仅在 `Capacitor.isNativePlatform()` 时渲染

## 7. 验证

- [x] 7.1 运行 `npm run typecheck` 确保类型无错误
- [x] 7.2 运行 `npm run build` 确保构建成功
- [ ] 7.3 Web 端手动测试：下载一首歌，验证元数据嵌入后的 MP3 在本地播放器中显示封面和歌词
- [ ] 7.4 Web 端手动测试：切换下载音质、关闭封面/歌词嵌入，验证设置持久化（刷新页面后设置保留）
- [ ] 7.5 验证批量下载时跳过元数据嵌入的行为
