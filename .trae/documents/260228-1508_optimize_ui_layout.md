# 优化非 Tab 页面 UI 及修复全局播放器

## 任务说明
1.  **底部播放栏位置优化**：在非 Tab 页面（如歌单详情、播放页），由于没有底部 TabBar，悬浮的播放栏（NowPlayingBar）应该下移贴底，而不是保留原有的 TabBar 空位。
2.  **顶部状态栏沉浸式优化**：非 Tab 页面的顶部状态栏区域目前显示为背景色，与 Header 颜色不一致。需移除布局组件的强制顶部留白，改由 Header 组件自身处理安全区域（Safe Area），实现沉浸式效果。
3.  **修复异常文件**：检测到 `src/components/GlobalMusicPlayer.tsx` 内容异常（与 `PageHeader` 重复），需重写为正确的全局音频播放控制组件，确保音乐播放功能正常。

## 计划步骤

### 1. 修复 GlobalMusicPlayer 组件
*   **目标**：恢复 `src/components/GlobalMusicPlayer.tsx` 为真正的音频播放器组件。
*   **操作**：
    *   重写该文件，包含隐藏的 `<audio>` 标签。
    *   连接 `useMusicStore`，监听 `currentAudioUrl`、`isPlaying`、`volume`、`seekTargetTime` 等状态。
    *   实现音频事件处理（`onTimeUpdate`, `onEnded`, `onError`, `onCanPlay`）并同步回 store。

### 2. 优化 MusicLayout 布局
*   **目标**：使其支持“沉浸式”模式（无强制顶部 Padding）和自适应底部播放栏位置。
*   **文件**：`src/components/MusicLayout.tsx`
*   **操作**：
    *   新增 `isTab` (boolean) prop。
    *   **顶部逻辑**：如果 `isTab` 为 `false`，移除根容器的 `pt-11` 和 `pt-safe` 类，允许子组件（如 PageHeader）顶到屏幕最上方。
    *   **底部逻辑**：如果 `isTab` 为 `false`，将底部播放栏容器的 `bottom-16` 修改为 `bottom-0`（或 `bottom-4` 配合 safe-area），使其在无 TabBar 时自然贴底。

### 3. 适配 PageHeader 组件
*   **目标**：适配沉浸式布局，防止内容被状态栏/刘海遮挡。
*   **文件**：`src/components/PageHeader.tsx`
*   **操作**：
    *   给根 `div` 添加 `pt-safe` 类，利用 CSS 环境变量自动增加顶部内边距。
    *   调整高度样式，确保在增加 padding 后内容垂直居中且布局正常。

### 4. 更新 Router 配置
*   **目标**：将 `isTab` 状态传递给布局组件。
*   **文件**：`src/router.tsx`
*   **操作**：
    *   在 `RootLayout` 中，将已计算的 `isTab` 变量传递给 `<MusicLayout />`。
    *   确保 `<GlobalMusicPlayer />` 正常渲染。

## 验证计划
1.  **检查播放功能**：确保音乐能正常播放、暂停、切歌（验证 GlobalMusicPlayer 修复）。
2.  **检查非 Tab 页（如歌单详情）**：
    *   顶部：Header 是否延伸到状态栏区域？状态栏背景是否协调？
    *   底部：NowPlayingBar 是否贴底显示，且不遮挡内容（或内容有足够 padding）？
3.  **检查 Tab 页（如首页）**：
    *   确保原有布局（顶部留白、底部 TabBar 位置）未受影响。
