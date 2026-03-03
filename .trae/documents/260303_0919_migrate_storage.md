# 迁移存储引擎至 IndexedDB (idb-keyval)

## 1. 现状分析
当前项目主要使用 Zustand 的 `persist` 中间件进行状态持久化，默认使用 `localStorage`。
- **优点**：简单，同步读取（无闪烁）。
- **缺点**：
  - **容量限制**：`localStorage` 仅约 5MB。`LocalMusicStore` (元数据) 和 `MusicStore` (歌单) 容易超限。
  - **性能瓶颈**：同步读写阻塞主线程，影响 UI 响应。
  - **数据类型**：仅支持字符串，需要频繁序列化/反序列化。

## 2. 建议方案
建议迁移至 **`idb-keyval`**。
- **理由**：
  - 基于 `IndexedDB`，容量大（GB级），支持二进制存储。
  - API 极简（< 1KB），基于 Promise，适合移动端。
  - 相比 `localforage` 更轻量，且本项目不需要降级兼容（Capacitor 环境支持 IndexedDB）。

## 3. 实施计划

### Step 1: 引入依赖
- 安装 `idb-keyval`。

### Step 2: 封装 Storage Adapter
- 创建 `src/lib/storage-adapter.ts`。
- 实现 Zustand 的 `PersistStorage` 接口。
- **关键点**：由于 `idb-keyval` 支持存储对象，我们可以配置 `persist` 的 `serialize`/`deserialize` 为恒等函数，直接存储 JS 对象，避免 JSON 序列化的性能开销。或者为了稳妥，先保持默认 JSON 序列化，仅替换存储引擎。
  - *决策*：使用 `createJSONStorage` 配合自定义的异步 storage 适配器，这是 Zustand 推荐的标准做法，兼容性最好。

### Step 3: 数据迁移策略 (Migration)
- 创建 `src/lib/storage-migration.ts`。
- 实现 `migrateFromLocalStorage` 函数：
  - 遍历所有 Store 的 key (如 `music-store`, `local-music-store` 等)。
  - 检查 `localStorage` 中是否有数据。
  - 如果有，读取并写入 `idb-keyval`。
  - 写入成功后，删除 `localStorage` 中的旧数据。
- 在 `App.tsx` 初始化阶段调用此迁移函数。

### Step 4: 改造 Store
修改以下文件，配置 `persist` 使用新的 `idbStorage`：
- `src/store/music-store.ts`
- `src/store/history-store.ts`
- `src/store/local-music-store.ts`
- `src/store/source-quality-store.ts`
- `src/store/sync-store.ts`
- `src/store/app-store.ts`
- *注*：`download-store.ts` 保持不变（已使用文件系统）。

### Step 5: 处理 Hydration (UI 闪烁)
- 异步存储会导致组件首次渲染时 Store 为空（默认值）。
- 对于关键 UI（如播放列表），需要检查 `useMusicStore.persist.hasHydrated()`。
- 如果未完成 Hydration，显示 Loading 或骨架屏（视情况而定，暂不强制所有组件加 Loading，优先保证功能可用）。

## 4. 验证
- 检查 `Application` -> `Storage` -> `IndexedDB` 是否有数据。
- 检查 `localStorage` 是否被清理。
- 重启应用，确认状态能从 IndexedDB 恢复。
