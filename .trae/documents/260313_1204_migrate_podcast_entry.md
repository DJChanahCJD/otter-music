# 播客功能入口迁移计划

## 1. 目标
解决用户提出的“播客功能位置不合理”问题：
- **现状**：播客位于“发现页 -> 歌单广场 -> 我的”Tab 下，与网易云歌单混杂，定位模糊。
- **目标**：将播客入口迁移至“我的”页面（底栏 Mine Tab），作为独立的个人媒体库入口。同时优化“我的”页面布局，使其更符合常规 App 的设计（将设置功能移动至右上角，腾出宫格位置给播客）。

## 2. 现状分析
- **Route**: `/podcast` 目前重定向到 `/search` 并设置 Filter，导致体验不连贯。
- **UI**: `MinePage` 目前包含 [历史, 列表, 本地, 设置] 4 个宫格按钮。
- **Logic**: `MineSection.tsx` 包含播客列表的获取和渲染逻辑（依赖 `usePodcastStore`）。

## 3. 实施方案

### 3.1 创建独立的播客列表页
- **文件**: `src/components/Podcast/PodcastLibrary.tsx`
- **内容**: 
  - 迁移原 `MineSection.tsx` 中的播客 Grid 渲染逻辑。
  - 包含“添加播客”的 Dialog 触发逻辑。
  - 使用 `PageLayout` 包装，标题为“我的播客”。

### 3.2 优化“我的”页面布局
- **文件**: `src/components/MinePage.tsx`
- **改动**:
  - **Header**: 增加页面顶部标题栏，左侧显示“我的”，右侧放置“设置”图标按钮（替代原有的设置大按钮）。
  - **Grid**: 将原“设置”按钮位置替换为“播客”按钮。
  - **Navigation**: 点击“播客”按钮跳转至 `/podcast`。

### 3.3 更新路由配置
- **文件**: `src/routes/RouteWrappers.tsx`
- **改动**:
  - 引入 `PodcastLibrary` 组件。
  - 修改 `PodcastRoute` 定义，移除重定向逻辑，直接渲染 `<PodcastLibrary />`。

### 3.4 清理旧代码
- **文件**: `src/components/PlaylistMarket/MineSection.tsx`
- **改动**:
  - 移除 `podcast` 相关的 Tab 定义。
  - 移除 `usePodcastStore` 引用及相关组件导入（`PodcastAdd`, `PodcastCard`）。

## 4. 验证步骤
1. **布局检查**: 确认“我的”页面顶部有设置图标，宫格区域显示 [历史, 列表, 本地, 播客]。
2. **导航检查**: 点击“播客”按钮能否正确进入新的播客列表页。
3. **功能检查**: 在新播客页能否正常查看订阅源、添加新播客、点击进入详情。
4. **回归检查**: 确认“发现页 -> 歌单广场 -> 我的”中不再出现播客 Tab。
