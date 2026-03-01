# Plan: 重构 addToFavorites 移除内部 Toast

## 目标
修改 `MusicStore` 中的 `addToFavorites` 方法，不再在内部直接调用 `toast`，而是返回操作结果（成功或失败原因），由调用者决定如何进行 UI 反馈。

## 原因
1. **解耦 UI 与逻辑**：Store 应专注于状态管理，UI 反馈（如 Toast）应由组件层控制。
2. **灵活控制**：批量操作时避免弹出大量 Toast，或在特定场景下（如数据合并）静默处理。
3. **响应用户需求**：用户明确希望保持精简并返回状态。

## 修改步骤

### 1. 修改 `src/store/music-store.ts`
- 更新 `MusicState` 接口定义：
  - `addToFavorites: (track: MusicTrack) => string | null;`
- 重构 `addToFavorites` 实现：
  - 使用 `get()` 获取当前状态进行检查。
  - 如果 `track.source === 'local'`，返回 `"本地音乐不支持喜欢"`。
  - 如果已在收藏中，返回 `"已在「我的喜欢」中"`。
  - 如果成功，更新状态并返回 `null`。
  - 移除原有的 `toast.success` 和 `toastUtils.info` 调用。

### 2. 更新调用处

#### A. 全屏播放器 (`src/router.tsx`)
- 修改 `handleToggleLike` 函数：
  - 接收 `addToFavorites` 的返回值。
  - 如果返回值不为空（失败），调用 `toastUtils.info(error)`。
  - 如果返回值为 `null`（成功），调用 `toast.success("已喜欢")`。
  - 同时为 `removeFromFavorites` 添加 `toast.success("已取消喜欢")`（保持交互一致性）。

#### B. 歌曲列表项 (`src/components/MusicTrackItem.tsx`)
- 修改 `onToggleLike` 回调：
  - 逻辑同上，根据返回值显示 Toast。

#### C. 歌曲变体列表 (`src/components/MusicTrackVariants.tsx`)
- 修改 `onToggleLike` 回调：
  - 逻辑同上。

#### D. 批量操作 (`src/components/MusicTrackList.tsx`)
- 修改批量“喜欢”按钮的 `onClick` 事件：
  - 传入提示文本给 `handleBatch`，以便在批量操作完成后显示统一的成功提示。
  - 代码：`onClick={() => handleBatch((t) => addToFavorites(t), "已添加到喜欢")}`。
  - 这样即使部分歌曲因“已存在”而返回错误，也会被忽略，最终只提示“已添加到喜欢”（符合批量操作的期望）。

#### E. 歌单去重 (`src/components/MusicPlaylistView.tsx`)
- 维持现状。
- 该文件在去重合并逻辑中调用 `addToFavorites`，此时不需要针对每首歌曲弹窗，也不需要处理返回值。修改后的 `addToFavorites` 不再弹窗，正好符合需求。

## 验证
- 验证单曲“喜欢”操作是否正常弹出成功/失败提示。
- 验证本地音乐是否提示不支持。
- 验证重复添加是否提示已存在。
- 验证批量操作是否只在最后弹出一个提示。
