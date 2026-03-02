# Android 移动端版本发布手册 (Release Guide)

本手册涵盖了从修改版本号到生成、签名正式版 APK 的完整流程。

---

## 1. 修改版本号

发布新版本前，必须同步更新以下三个配置，确保版本一致。

| 文件位置 | 关键字段 | 说明 |
| --- | --- | --- |
| `android/app/build.gradle` | `versionCode` | **必须递增**（整数，如 1 → 2），用于 Google Play 识别更新 |
| `android/app/build.gradle` | `versionName` | **用户可见版本**（字符串，如 "1.1.0"） |
| `package.json` | `version` | 全局项目版本号 |

**同步配置命令**:

```bash
npm version 1.1.0  # 自动更新 package.json 版本
npx cap sync android

```

---

## 2. 证书生成 (只需执行一次)

如果没有 `.jks` 证书，使用以下命令生成。请妥善保存该文件。

```bash
keytool -genkeypair -v -keystore otter-music-release.jks -alias otter-music -keyalg RSA -keysize 2048 -validity 10000

```

> **注意**: 建议将 `.jks` 文件放在 `android/` 目录下，并将其加入 `.gitignore`（防止密钥泄露）。

---

## 3. 完整构建工作流

每次发布新版本时，按以下顺序执行：

1. **Web 构建 + 同步 + 编译**: `npm run build:android:release`
2. **设置密码**: 在终端中执行`$env:KS_PASS="xxx"`。确保 `sign-apk.ps1` 脚本中的密码与 `.jks` 文件密码一致。
2. **调用自动化签名脚本**:
```powershell
./sign-apk.ps1
```
