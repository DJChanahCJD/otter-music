# 路由重构计划

本计划旨在引入 `react-router-dom`，将现有的基于状态的页面切换重构为基于 URL 的路由导航，并实现移动端物理返回键的正确处理。

## 1. 准备工作

- [ ] **安装依赖**
  - 安装 `react-router-dom`。

- [ ] **提取公共组件**
  - 将 `src/App.tsx` 中的 `PageLoader` 组件提取到 `src/components/PageLoader.tsx`。

## 2. 组件路由化改造

为了适应路由导航，需要对部分组件进行修改，使其不再依赖外部传入的 `onBack` 或数据 Props，而是自行从路由参数或 Store 获取。

- [ ] **MusicLayout 改造**
  - 修改 `src/components/MusicLayout.tsx`，使其支持渲染 `<Outlet />` 作为子内容（如果适用），或者保持作为 Wrapper 组件。

- [ ] **MusicTabBar 改造**
  - 修改 `src/components/MusicTabBar.tsx`。
  - 移除 `onTabChange` 和 `activeTab` props。
  - 使用 `useLocation` 判断当前激活的 Tab。
  - 使用 `useNavigate` 或 `<Link>` 进行页面跳转。

- [ ] **MusicPlaylistView 改造**
  - 修改 `src/components/MusicPlaylistView.tsx`。
  - 支持从 URL 参数 (`useParams`) 获取 `playlistId`。
  - 如果是 `/favorites` 路由，则自动使用收藏列表数据。
  - 移除 `tracks` prop（改为从 Store 获取）。
  - 移除 `onBack` prop（改为内部使用 `useNavigate(-1)`）。

- [ ] **其他页面组件改造**
  - `SettingsPage`, `LocalMusicPage`, `QueuePage`, `HistoryPage`。
  - 移除 `onBack` prop，改为内部使用 `useNavigate(-1)`。

- [ ] **MinePage 改造**
  - 修改 `src/components/MinePage.tsx`。
  - 将原本的回调函数（如 `onOpenSettings`）改为直接使用 `navigate('/settings')`。

## 3. 路由配置与集成

- [ ] **创建路由配置**
  - 创建 `src/router.tsx`。
  - 定义路由表：
    - `/`: 根布局（包含 TabBar 和 PlayerBar）
      - `/`: 重定向到 `/search` 或作为发现页。
      - `/search`: `MusicSearchView`
      - `/mine`: `MinePage`
      - `/favorites`: `MusicPlaylistView` (type="favorites")
      - `/playlist/:id`: `MusicPlaylistView` (type="playlist")
    - 全屏/独立页面（视交互设计而定，也可作为子路由）：
      - `/settings`: `SettingsPage`
      - `/local`: `LocalMusicPage`
      - `/queue`: `QueuePage`
      - `/history`: `HistoryPage`

- [ ] **App.tsx 重构**
  - 移除 `currentTab`, `activePlaylistId`, `isSettingsPage` 等用于页面切换的状态。
  - 保留 `isFullScreenPlayer` 状态（用于全屏播放器 Overlay）。
  - 使用 `RouterProvider` 渲染路由。
  - 引入全局返回键处理逻辑。

## 4. 返回键处理 (Back Button Handling)

- [ ] **实现全局返回键监听**
  - 在 `App` 或 `Router` 根组件中监听 Capacitor `backButton` 事件。
  - 逻辑优先级：
    1. 如果 `isFullScreenPlayer` 为 true -> 关闭全屏播放器。
    2. 如果当前路由不是根路径（如 `/search`, `/mine`） -> 执行 `navigate(-1)`。
    3. 如果是根路径 -> 执行 `App.exitApp()`。

## 5. 验证与清理

- [ ] **验证功能**
  - 测试 Tab 切换是否正常。
  - 测试从“我的”页面进入子页面（设置、本地音乐等）是否正常。
  - 测试进入歌单详情页是否正常。
  - 测试浏览器后退按钮和移动端物理返回键是否符合预期。
  - 检查全屏播放器的打开和关闭。

- [ ] **代码清理**
  - 删除未使用的 Props 和 State。
