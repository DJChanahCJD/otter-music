# 歌单去重功能实现计划

## 目标
在 `MusicPlaylistView.tsx` 组件的歌单更多菜单中添加“去重”功能。
根据 `MusicTrack` 的名称和歌手（经过繁简体转换和标准化）判断重复。
保留优先级：已喜欢 > 已下载 > 序号较大（位置靠后）。

## 步骤

### 1. 修改 Music Store (`src/store/music-store.ts`)
- 在 `MusicState` 接口中添加 `setPlaylistTracks` 方法，用于批量更新歌单曲目。
- 在 `useMusicStore` 实现中添加 `setPlaylistTracks` 逻辑。

### 2. 修改 MusicPlaylistView 组件 (`src/components/MusicPlaylistView.tsx`)
- 引入必要的依赖：
  - `useMusicStore` (获取喜欢状态、更新歌单)
  - `useDownloadStore` (获取下载状态)
  - `getExactKey` (获取标准化唯一键)
  - `buildDownloadKey` (构建下载 Key)
  - `toast` (提示用户)
- 在 `DropdownMenu` 中添加“歌单去重”选项。
- 实现 `handleDeduplicate` 函数：
  1. 获取当前歌单所有歌曲。
  2. 使用 `getExactKey` 对歌曲进行分组。
  3. 对每组重复歌曲进行排序，选出保留者（Survivor）。
     - 优先级 1: `isFavorite` (True > False)
     - 优先级 2: `isDownloaded` (True > False)
     - 优先级 3: `index` (Desc, 较大者优先)
  4. 收集所有需要移除的歌曲索引。
  5. 生成新的歌曲列表（过滤掉被标记移除的索引）。
  6. 调用 `setPlaylistTracks` 更新歌单。
  7. 显示操作结果 Toast（如“已移除 X 首重复歌曲”）。

## 验证
- 创建包含重复歌曲的测试歌单（不同来源、不同繁简写法）。
- 点击去重，验证保留的歌曲是否符合优先级规则。
- 验证歌单列表是否正确更新。
