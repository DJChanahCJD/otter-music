# 架构优化计划：音乐源适配器模式重构

## 1. 现状分析
当前 `src/lib/music-api.ts` 和 UI 组件中存在大量基于 `source` 的条件判断（`if/else` 或 `switch`），导致代码耦合度高、扩展性差。
主要痛点：
- **核心逻辑分散**：`music-api.ts` 中混合了 HTTP 请求、本地文件处理、网易云特定逻辑等。
- **UI 逻辑硬编码**：组件（如 `MusicTrackMobileMenu`）直接判断 `isNetease` 或 `source === 'podcast'` 来决定显示哪些菜单项。
- **扩展困难**：新增音源需要修改多处代码。

## 2. 架构设计：策略模式 + 工厂模式
引入 **Strategy Pattern**（策略模式）来封装不同音源的行为，并使用 **Factory Pattern**（工厂模式）来管理这些策略。

### 2.1 核心接口 `IMusicProvider`
定义统一的音源提供者接口，包含搜索、获取链接、歌词、图片等核心能力，以及 **Capabilities**（能力描述）用于 UI 驱动。

```typescript
// src/lib/music-provider/interface.ts
import { MusicTrack, SearchPageResult, SongLyric, SearchIntent } from "@/types/music";

export interface ProviderCapabilities {
  hasComments: boolean;      // 是否支持评论
  hasArtistDetail: boolean;  // 是否支持歌手详情跳转
  hasAlbumDetail: boolean;   // 是否支持专辑详情跳转
  isLocal: boolean;          // 是否为本地资源
  canUnlock: boolean;        // 是否支持解锁（网易云专用）
}

export interface IMusicProvider {
  // 核心能力
  search(query: string, page: number, count: number, signal?: AbortSignal, intent?: SearchIntent): Promise<SearchPageResult<MusicTrack>>;
  getUrl(track: MusicTrack, br?: number): Promise<string | null>;
  getPic(track: MusicTrack, size?: number): Promise<string | null>;
  getLyric(track: MusicTrack): Promise<SongLyric | null>;
  
  // 元数据与能力
  getCapabilities(): ProviderCapabilities;
}
```

### 2.2 具体策略实现
将现有逻辑拆分为独立的 Provider 类：

1.  **`NeteaseProvider`** (`source: '_netease'`):
    - 封装 `src/lib/netease/netease-api.ts` 的调用。
    - 能力：`hasComments: true`, `hasArtistDetail: true`, `canUnlock: true`。
2.  **`LocalProvider`** (`source: 'local'`):
    - 封装 `LocalMusicPlugin` 和 `Capacitor` 逻辑。
    - 能力：`isLocal: true`。
3.  **`GenericProvider`** (`source: 'joox', 'kuwo', ...`):
    - 封装 `requestMusicApiJSON` 通用请求逻辑。
    - 能力：基础能力。
4.  **`AggregateProvider`** (`source: 'all'`):
    - 聚合多个 Provider 的搜索结果（仅实现 `search`，其他方法抛错或返回空）。

### 2.3 工厂类 `MusicProviderFactory`
负责根据 `source` 字符串返回对应的 `IMusicProvider` 实例。

## 3. 实施步骤

### 阶段一：基础架构搭建
- [ ] 创建目录 `src/lib/music-provider/`。
- [ ] 定义接口 `src/lib/music-provider/interface.ts`。
- [ ] 实现工厂 `src/lib/music-provider/factory.ts`。

### 阶段二：策略迁移 (Refactoring)
- [ ] 实现 `NeteaseProvider` (`src/lib/music-provider/netease.ts`) - 迁移 `_netease` 相关逻辑。
- [ ] 实现 `LocalProvider` (`src/lib/music-provider/local.ts`) - 迁移 `local` 相关逻辑。
- [ ] 实现 `GenericProvider` (`src/lib/music-provider/generic.ts`) - 迁移通用 API 逻辑。
- [ ] 实现 `AggregateProvider` (`src/lib/music-provider/aggregate.ts`) - 迁移 `searchAll` 逻辑。

### 阶段三：核心 API 重构
- [ ] 重构 `src/lib/music-api.ts`：
    - 移除所有 `if (source === ...)` 逻辑。
    - 改为调用 `MusicProviderFactory.getProvider(source).method(...)`。

### 阶段四：UI 组件适配
- [ ] 重构 `src/components/MusicTrackMobileMenu.tsx`：
    - 移除 `isNetease` 等硬编码判断。
    - 使用 `MusicProviderFactory.getProvider(track.source).getCapabilities()` 获取能力标志（如 `hasComments`）。
- [ ] (可选) 检查 `LocalMusicPage.tsx` 是否可以利用 `LocalProvider` 简化逻辑（如获取 URL）。

## 4. 验证计划
- 验证搜索功能：测试网易云、聚合搜索、通用源（Joox）搜索是否正常。
- 验证播放功能：测试各源音乐（含本地）能否正常获取 URL 和播放。
- 验证 UI 菜单：检查不同源的歌曲菜单项（评论、歌手跳转等）是否正确显示。
