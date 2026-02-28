# Android 权限适配及下载功能优化计划

## 1. 现状分析与适配评估

经过对 `AndroidManifest.xml` 和 `download.ts` 的分析，以及对 Android 权限变更（Android 10-14）的调研，结论如下：

### 1.1 是否适配旧版本 Android？
**是，已适配。**
*   **Manifest 配置正确**：
    *   针对 **Android 13+ (API 33+)**，正确声明了 `READ_MEDIA_AUDIO`。
    *   针对 **旧版本 (Android 9-12)**，声明了 `READ_EXTERNAL_STORAGE` 和 `WRITE_EXTERNAL_STORAGE`，并正确使用了 `android:maxSdkVersion="32"` 属性，避免在新系统上申请不必要的权限。
    *   针对 **全文件访问**，声明了 `MANAGE_EXTERNAL_STORAGE` (minSdkVersion="30")，这允许在 Android 11+ 设备上进行全盘扫描（需注意 Google Play 审核风险）。
*   **Java 插件适配**：`LocalMusicPlugin.java` 中包含完善的版本判断逻辑（`Build.VERSION.SDK_INT`），能够根据系统版本动态申请 `audio` 或 `storage` 权限。

### 1.2 存在的问题
虽然 Manifest 配置完善，但前端下载逻辑 (`src/lib/utils/download.ts`) 存在隐患：
*   **缺少运行时权限检查**：在调用下载前，未检查是否有写入存储的权限。
*   **崩溃风险**：在 Android 6.0+ (API 23+) 设备上，如果用户未授权，直接进行文件操作会导致应用崩溃或下载失败。

## 2. 实施计划

本计划旨在增强下载功能的健壮性，确保在不同 Android 版本上都能正确处理权限。

### 2.1 修改 `src/lib/utils/download.ts`
在 `downloadNative` 函数执行下载逻辑前，增加权限检查和请求流程。

**修改逻辑：**
1.  调用 `Filesystem.checkPermissions()` 检查 `publicStorage` 权限。
2.  如果权限状态不是 `granted`，调用 `Filesystem.requestPermissions()` 请求权限。
3.  如果用户拒绝权限，通过 `toast` 提示并终止下载，防止应用崩溃。

**代码变更预演：**
```typescript
import { Filesystem, Directory } from "@capacitor/filesystem";

// ... Inside downloadNative function ...

// 1. 权限检查
const permStatus = await Filesystem.checkPermissions();
if (permStatus.publicStorage !== 'granted') {
  const requestStatus = await Filesystem.requestPermissions();
  if (requestStatus.publicStorage !== 'granted') {
    toast.error("需要存储权限才能下载音乐", { id: toastId });
    return;
  }
}

// 2. 继续执行原有下载逻辑
// ...
```

### 2.2 验证与测试
*   **旧版本 (Android 10/11)**：验证是否弹出存储权限请求，授权后能否下载。
*   **新版本 (Android 13/14)**：验证是否能正常下载（通常不需要显式写权限即可写入 Download 目录，但 Capacitor 插件可能仍需校验）。

## 3. 补充说明
*   **Google Play 风险提示**：目前应用申请了 `MANAGE_EXTERNAL_STORAGE` 权限。如果应用的主要功能不是文件管理，上架 Google Play 时极大概率会被拒绝。如果仅为了扫描音乐，建议后续优化为仅使用 `MediaStore` API，移除该敏感权限。但本次任务仅关注“适配”和“下载修复”，暂不移除该权限。
