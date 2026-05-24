## Context

当前下载流程：`performDownloadOne` → 获取 URL → `downloadNative`（直接写文件）/ `downloadWeb`（Blob 触发浏览器下载）。下载的 MP3 文件不含任何元数据，在第三方播放器中使用体验割裂。

项目使用 Capacitor 8 支持 Android 平台，`@capacitor/filesystem` 和 `@capacitor/file-transfer` 负责文件操作。全局设置存储在 Zustand `music-store` 中（通过 IndexedDB 持久化）。

## Goals / Non-Goals

**Goals:**
- 下载音质与流播音质独立配置
- 下载时可选择是否内嵌封面图（写入 ID3v2 APIC 帧）
- 下载时可选择是否内嵌歌词（写入 ID3v2 USLT 帧）
- Native 平台支持自定义下载目录（通过文本输入指定相对路径）
- Web 平台元数据嵌入正常工作（在 Blob 阶段处理）

**Non-Goals:**
- 不实现 Native 平台的图形化目录浏览器（SAF 集成复杂，后续迭代考虑）
- 不支持 FLAC/OGG 等其他格式的元数据写入（仅 MP3 ID3v2）
- 不修改已下载文件的元数据（仅影响新下载）
- 不实现批量下载时的并发数配置

## Decisions

### 1. ID3 写入库选择：`browser-id3-writer`

**选择**: 使用 `browser-id3-writer`（~6KB gzipped）作为 ID3v2 标签写入库。

**理由**: 
- 极轻量，纯 JS 实现，无需 WASM 或 native 模块
- 支持 ID3v2.3 标准，包含 APIC（封面）、TXXX/USLT（歌词）帧
- 在浏览器和 Web Worker 中均可运行
- 不增加 Capacitor 原生依赖复杂度

**备选方案**:
- `taglib-wasm`: 功能完整但 WASM 体积大（~2MB），对移动端 PWA 不友好
- 手写 ID3v2 二进制拼接: 维护成本高，边界 case 多

### 2. 下载后处理流程

**选择**: 下载完成后统一进入后处理管道（fetch cover → fetch lyric → embed → save）。

Web 流程:
```
fetch MP3 → Blob → [embed metadata] → triggerBlobDownload
```

Native 流程:
```
FileTransfer.downloadFile → Filesystem.readFile → [embed metadata in memory] → Filesystem.writeFile
```

**理由**: 元数据嵌入必须在完整文件上操作，无法流式处理。Native 侧增加一次读写开销可接受（典型 MP3 文件 5-15MB）。

### 3. 下载设置存储位置

**选择**: 扩展 `src/store/music-store.ts`，新增字段:

```ts
downloadQuality: string       // 默认 "320"，独立于流播 quality
embedCover: boolean           // 默认 true
embedLyric: boolean           // 默认 true
downloadDirectory: string     // 默认 "" (空表示使用默认路径)
```

**理由**: 遵循项目现有模式，所有用户设置集中在 `music-store` 中通过 Zustand + IndexedDB 自动持久化。无需新建独立 store。

### 4. 下载目录选择 UI

**选择**: Native 平台使用文本输入框（用户手动输入 ExternalStorage 下的相对路径），配合一个"重置为默认"按钮。路径经过 `Filesystem.stat` 验证。

**理由**: Capacitor 无内置目录选择器。实现 SAF picker 需要编写自定义 Capacitor 插件，复杂度高且对 Android 版本敏感。文本输入简单可靠，满足核心需求。后续可迭代为图形化选择器。

**格式**: 相对于 `ExternalStorage` 的路径，例如 `Music/OtterDownloads`。为空或无效时回退到默认 `Download/OtterMusic`。

## Risks / Trade-offs

- **[体积] Native 嵌入元数据需额外读写**: 下载完成后将文件读入内存、写入标签再写回。对于 320kbps 的 5 分钟歌曲（~12MB），额外耗时约 200-500ms。→ 在后处理期间显示"正在写入元数据..."提示
- **[兼容性] `browser-id3-writer` 可能不支持某些旧版 ID3 解析器**: 写入的是 ID3v2.3 标准标签，主流播放器（AIMP、Poweramp、VLC）均完整支持。→ 可接受
- **[权限] 自定义下载目录可能无写入权限**: Android 11+ 的分区存储限制可能影响 ExternalStorage 子目录写入。→ 写入前通过 `Filesystem.stat` + 试写入验证路径可用性；失败时回退到默认路径
- **[内存] 大文件元数据嵌入**: 无损格式文件可达 30MB+，在内存中处理可能影响低端设备。→ 对大文件（>50MB）跳过元数据嵌入并提示

## Open Questions

- 是否需要"仅 Wi-Fi 下载"开关？（当前未规划，后续可加）
- 歌词嵌入格式：是否同步歌词（SYLT 帧）还是仅非同步歌词（USLT 帧）？当前仅使用 USLT（非同步），与项目歌词展示一致
