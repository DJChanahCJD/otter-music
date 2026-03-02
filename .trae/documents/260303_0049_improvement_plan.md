# Otter Music 改进计划与分析报告

## 1. 现状分析
通过对代码库的全面扫描，项目整体代码质量极高，具有以下特点：
- **类型安全**：全项目仅发现 5 处 `any` 使用，类型定义严谨。
- **架构清晰**：API 逻辑集中在 `src/lib/api`，状态管理清晰。
- **无明显债务**：除 README 中的一项 TODO 外，代码中几乎没有未完成的 `TODO` 或 `FIXME`。

然而，仍存在一些文档与实际代码不一致、API 容错机制较弱以及潜在的性能瓶颈问题。

## 2. 改进建议 (按优先级排序)

### 2.1 文档与结构修正 (High Priority)
- **问题**：`README.md` 中提到的目录结构包含 `src/services`，但实际代码中并不存在该目录（逻辑已迁移至 `src/lib/api`）。
- **行动**：
  - 更新 `README.md` 的目录结构说明，使其与实际代码保持一致。
  - 检查并移除其他过时的文档描述。

### 2.2 代码质量提升 (High Priority)
- **问题**：项目中仍残留 5 处 `any` 类型使用，主要集中在错误处理 (`catch(err: any)`) 和数据标准化 (`normalizeTrack`) 中。
- **行动**：
  - 将 `catch(err: any)` 替换为 `catch(err: unknown)` 并配合类型守卫（Type Guard）进行安全访问。
  - 为 `normalizeTrack` 函数定义明确的 `RawApiTrack` 接口，替代 `any`，进一步增强类型安全性。

### 2.3 API 健壮性增强 (Medium Priority)
- **问题**：目前的 API 负载均衡策略仅为简单的随机选择 (`src/lib/api/config.ts`)，缺乏对节点健康状态的感知。
- **行动**：
  - 引入简单的健康检查或错误计数机制。
  - 当某个 API 节点连续请求失败时，自动将其标记为不可用，并切换到其他节点。
  - 实现“熔断”机制，避免在网络不稳定时频繁重试失效节点。

### 2.4 持久化性能优化 (Medium Priority)
- **问题**：状态管理（Zustand）默认使用 `localStorage` 进行持久化。`localStorage` 是同步且阻塞主线程的，且存储容量有限（通常 5MB）。随着用户歌单和历史记录的增加，可能会导致 UI 卡顿。
- **行动**：
  - 引入 `idb-keyval` 或 `localforage`。
  - 配置 Zustand 的 `persist` 中间件使用异步存储引擎（IndexedDB）。
  - 这将显著提升大数据量下的应用性能和响应速度。

### 2.5 新功能建议：睡眠定时器 (Low Priority, High Value)
- **价值**：作为音乐播放器，睡眠定时是用户高频需求之一。
- **实现**：
  - 在 `SettingsPage` 或播放器菜单中添加“睡眠定时”选项（如 15min, 30min, 60min）。
  - 使用 `setTimeout` 在倒计时结束时调用 `audioRef.current.pause()`。
  - 实现简单，用户体验提升明显。

### 2.6 长期规划：音频增强 (Future)
- **现状**：目前仅使用 `HTMLAudioElement`，不支持高级音频效果。
- **建议**：未来可考虑引入 Web Audio API (`AudioContext`)，实现：
  - 10 段均衡器 (Equalizer)。
  - 音频可视化 (Visualizer)。
  - 无缝播放 (Gapless Playback)。

## 3. 执行计划 (本阶段)
我们将首先执行 **2.1** 和 **2.2**，即文档修正和代码类型清理，作为本次会话的立即执行项。后续功能增强可根据您的反馈决定是否继续。

### 具体步骤
1.  **修正 README**：更新目录结构描述。
2.  **类型清理**：
    -   修复 `src/components/LocalMusicPage.tsx` 中的 `any`。
    -   修复 `src/lib/utils/download.ts` 中的 `any`。
    -   修复 `src/components/settings/PlaylistImport.tsx` 中的 `any`。
    -   修复 `src/lib/music-api.ts` 中的 `any` (定义 `RawApiTrack` 接口)。
    -   修复 `src/lib/utils/playlist-backup.ts` 中的 `any`。
