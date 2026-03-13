# 缓存管理功能设计方案

## 1. 目标
在设置页面提供优雅的缓存清理功能，支持按类型（播放链接、歌词、封面、其他）分类查看和清理，同时覆盖 Web CacheStorage 和本地文件缓存。

## 2. 核心分析
### 2.1 缓存来源
根据代码分析，系统主要包含两类缓存：
1.  **Web CacheStorage (`otter-cache-v1`)**:
    -   由 `src/lib/utils/cache.ts` 管理。
    -   **播放链接 (URLs)**: `url:*` (失效快，清理可强制刷新)
    -   **歌词 (Lyrics)**: `lyric:*`, `netease:lyric:*` (文本数据)
    -   **封面 (Covers)**: `pic:*` (图片 URL 映射，非图片文件本身，但清理可触发重新解析)
    -   **API 数据 (Others)**: `netease:*`, `market-playlist:*` 等元数据。
2.  **文件系统缓存 (`AppPaths.Cache`)**:
    -   由 `src/lib/storage-manager.ts` 定义路径 `Download/OtterMusic/.cache`。
    -   虽然当前 TS 代码未主动写入，但作为标准缓存目录，可能包含原生插件或未来产生的临时文件，应纳入清理范围。

### 2.2 交互设计
- **入口**: 在 `SettingsPage.tsx` 的“系统”或“存储”区域添加“缓存管理”项。
- **形式**: 点击后弹出 `Dialog` (桌面) 或 `Drawer` (移动端)，展示各类缓存的统计信息（条目数/大小）及清理按钮。
- **反馈**: 清理时显示 Loading，完成后提示 Toast。

## 3. 实施步骤

### 3.1 扩展缓存工具库
**文件**: `src/lib/utils/cache.ts`
- 新增 `CacheCategory` 类型定义。
- 实现 `getCacheStats()`: 遍历 `CacheStorage` 统计各 Key 前缀的数量。
- 实现 `clearCache(categories: CacheCategory[])`: 根据前缀批量删除 Key。

**文件**: `src/lib/storage-manager.ts`
- 实现 `getCacheDirSize()`: 使用 `Capacitor Filesystem` 统计 `.cache` 目录大小。
- 实现 `clearCacheDir()`: 清空 `.cache` 目录。

### 3.2 开发 UI 组件
**文件**: `src/components/settings/CacheManagerDialog.tsx` (新建)
- 使用 `Dialog` 组件作为容器。
- 包含分类列表：
    - 🎵 **播放链接** (URLs)
    - 📝 **歌词数据** (Lyrics)
    - 🖼️ **封面索引** (Covers)
    - 💾 **系统缓存** (API Data + File Cache)
- 每个分类显示预估条目数/大小，提供独立的“清理”按钮。
- 提供“一键清理”按钮。

### 3.3 集成入口
**文件**: `src/components/SettingsPage.tsx`
- 引入 `CacheManagerDialog`。
- 在“关于系统”或新建“存储空间” Section 中添加入口。

## 4. 验证计划
- **功能验证**:
    1. 浏览 App 产生各类缓存。
    2. 打开缓存管理，确认统计数字不为 0。
    3. 点击清理歌词，确认 `lyric:` 相关 Key 被移除，且再次查看歌词需重新加载。
    4. 点击清理系统缓存，确认 `.cache` 目录被清空。
- **UI 验证**: 检查 Dialog 在移动端和桌面的适配效果。
