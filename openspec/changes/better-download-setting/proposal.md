## Why

当前下载功能缺少独立的设置入口：下载音质与流播音质共用同一配置、下载目录无法自定义、下载的 MP3 文件不含内嵌封面与歌词元数据。用户下载到本地的音乐文件在第三方播放器中体验割裂，且无法按需调整下载参数。现在下载功能已稳定运行，是时候补上这些体验短板。

## What Changes

- 新增独立的下载设置区块（SettingsPage 内），与流播音质解耦
- 新增下载音质独立选择（默认 320kbps，可选 128/192/320/999）
- 新增「内嵌封面」开关：下载时将封面图片写入 MP3 ID3v2 APIC 帧
- 新增「内嵌歌词」开关：下载时将歌词写入 MP3 ID3v2 USLT 帧
- 新增「下载目录」选择（仅 Native）：允许用户通过系统文件选择器自定义下载路径
- 修改下载核心逻辑 `performDownloadOne`：支持后处理流程（封面/歌词嵌入）
- 修改 `downloadNative`：使用用户自定义下载目录（若有）

## Capabilities

### New Capabilities
- `download-settings`: 下载设置 UI —— 独立的下载音质、内嵌封面、内嵌歌词、下载目录选择
- `metadata-embedding`: MP3 ID3v2 元数据嵌入 —— 封面图片写入 APIC 帧、歌词写入 USLT 帧
- `download-directory-select`: Native 平台下载目录选择 —— 使用系统文件选择器，持久化路径偏好

### Modified Capabilities
<!-- No existing specs to modify -->

## Impact

- **受影响文件**:
  - `src/components/SettingsPage.tsx` — 新增下载设置 Section
  - `src/components/settings/` — 新增 `DownloadQualitySelect.tsx`、`DownloadDirectorySelect.tsx`（Native only）等组件
  - `src/lib/utils/download.ts` — 核心下载流程增加后处理步骤（封面/歌词嵌入）；`downloadNative` 支持自定义目录
  - `src/lib/storage-manager.ts` — 下载目录配置支持可动态设置
  - `src/store/music-store.ts` — 新增下载相关状态字段（downloadQuality、embedCover、embedLyric、downloadDirectory）
  - `src/store/download-store.ts` — 可能需扩展以记录嵌入元数据的文件状态
- **新增依赖**: `music-metadata`（或类似库）用于读写 MP3 ID3v2 标签
- **平台差异**: 自定义下载目录仅 Native 平台可用，Web 端仍使用浏览器默认下载行为
- **无 Breaking Change**: 现有下载行为作为默认值保留
