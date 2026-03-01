# 优化歌单去重逻辑计划

## 目标
将歌单去重逻辑从组件提取到 `src/lib/utils/music.ts`，并优化去重策略。
**优化策略**：优先保留“已下载”的歌曲，并合并“已喜欢”状态。即：如果一组重复歌曲中有一首已下载，则保留该首；如果其中有一首是已喜欢的，则确保保留下来的这首最终也变为“已喜欢”状态。

## 步骤

### 1. 修改工具库 (`src/lib/utils/music.ts`)
- 引入 `getExactKey` (可能需要从 `music-key.ts` 导入，或者作为参数传入以避免循环依赖，建议直接导入，因为 `music.ts` 看起来是通用工具)。
- 实现 `deduplicateTracks` 函数：
  - **参数**：
    - `tracks`: `MusicTrack[]`
    - `isFavorite`: `(id: string) => boolean`
    - `isDownloaded`: `(track: MusicTrack) => boolean`
  - **返回**：
    - `tracks`: `MusicTrack[]` (去重后的列表)
    - `removedCount`: `number`
    - `tracksToLike`: `MusicTrack[]` (需要补加到喜欢列表的歌曲，即“Winner”原本未喜欢，但“Loser”中有已喜欢的情况)
  - **逻辑**：
    1. 使用 `getExactKey` 分组。
    2. 遍历分组：
       - 标记组内是否包含已喜欢歌曲 (`hasLiked`).
       - 排序选出 Winner：
         - 优先级 1: `isDownloaded` (True)
         - 优先级 2: `isFavorite` (True)
         - 优先级 3: `originalIndex` (Desc, 较新的/靠后的)
       - 如果 `hasLiked` 为真且 Winner 未喜欢，将 Winner 加入 `tracksToLike`。
    3. 保持列表顺序：按 Winner 在原列表中的索引排序。

### 2. 更新组件 (`src/components/MusicPlaylistView.tsx`)
- 移除组件内的 `handleDeduplicate` 实现细节。
- 引入 `deduplicateTracks`。
- 更新 `handleDeduplicate` 调用：
  - 构造 `isFavorite` 和 `isDownloaded` 回调传入工具函数。
  - 获取结果后：
    - 批量调用 `addToFavorites` 处理 `tracksToLike`。
    - 调用 `setPlaylistTracks` 更新歌单。
    - 显示 Toast。

## 验证
- 场景 A：重复歌曲，一首已下载(未喜欢)，一首已喜欢(未下载)。
  - 预期：保留已下载的那首，并自动将其标记为喜欢。
- 场景 B：重复歌曲，都未下载，一首已喜欢。
  - 预期：保留已喜欢的那首。
- 场景 C：重复歌曲，都已下载。
  - 预期：保留位置靠后的那首。
