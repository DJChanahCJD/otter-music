# Plan: 修改安装 APP 时显示的版本号

当前应用在安装时显示的版本号固定为 v1.0.0，这是因为 Android 项目配置中的 `versionName` 默认为 1.0，且 `package.json` 中的版本号为 0.0.0。在 Capacitor 项目中，修改版本号通常涉及以下几个关键位置。

## 修改步骤

### 1. 修改 Android 原生配置
这是决定安装包在系统应用管理中显示版本号的核心文件。
- **文件**: [build.gradle](file:///c:/Users/DJCHAN/SE/2_GithubProject/otter-music/android/app/build.gradle)
- **修改内容**:
  - `versionCode`: 这是一个整数，每次发布新版本时都必须递增（例如从 1 改为 2）。
  - `versionName`: 这是用户看到的字符串版本号（例如从 "1.0" 改为 "1.1.0"）。

### 2. 修改项目全局配置
保持 web 项目和 Capacitor 配置一致。
- **文件**: [package.json](file:///c:/Users/DJCHAN/SE/2_GithubProject/otter-music/package.json)
- **修改内容**: 更新 `"version"` 字段（例如从 "0.0.0" 改为 "1.1.0"）。

### 3. 修改 Cordova 兼容配置 (可选)
某些插件或构建工具可能会读取此文件。
- **文件**: [config.xml](file:///c:/Users/DJCHAN/SE/2_GithubProject/otter-music/android/app/src/main/res/xml/config.xml)
- **修改内容**: 更新 `<widget version="1.0.0">` 中的版本号。

## 验证方法
1. 修改上述文件后，运行 `npx cap sync android` 同步配置。
2. 重新构建 APK/Bundle 并在 Android 设备上查看安装时的版本信息。
