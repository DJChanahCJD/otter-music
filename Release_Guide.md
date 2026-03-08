# 移动端发布手册（Release Guide）

完整流程：**改版本 → 本地验证 → Tag 发布 → 自动构建 APK**

---

## 1️⃣ 修改版本号（自动化流程）

使用 npm 命令一键完成版本号更新、Android 版本同步和 Git 提交：

```bash
# 补丁更新 (1.0.0 -> 1.0.1)
npm version patch

# 小版本更新 (1.0.0 -> 1.1.0)
npm version minor

# 大版本更新 (1.0.0 -> 2.0.0)
npm version major
```

此命令会自动：
1. 更新 `package.json` 和 `package-lock.json`
2. 更新 `android/app/build.gradle` 的 `versionName` 和 `versionCode` (自增)
3. 创建 Git Commit 和 Tag

> **注意**：执行前请确保 git 工作区是干净的（无未提交更改）。
---

## 2️⃣ 生成签名证书（仅首次执行）

若无 `.jks` 文件，执行：

```bash
keytool -genkeypair -v \
-keystore otter-music-release.jks \
-alias otter-music \
-keyalg RSA \
-keysize 2048 \
-validity 10000
```

### 重要事项

* 建议存放位置：`android/`
* 必须加入 `.gitignore`
* 丢失证书 = 无法更新应用（极其重要）

---

## 3️⃣ 正式构建流程（每次发布）

### Step 1 — 构建 Android Release

```bash
npm run build:android:release
```

---

### Step 2 — 执行自动签名

```powershell
./sign-apk.ps1
```

---

## 4️⃣ GitHub Actions 自动发布（推荐）

### 触发条件

- 推送 `v*` Tag（例如 `v2.0.2`）会自动触发：
  - Android APK 构建
  - GitHub Release 创建并上传产物

### 发布命令

执行完 `npm version` 后，推送代码和标签即可触发构建：

```bash
git push && git push --tags
```

### Release 文案来源

- 优先读取：`public/release/<tag>.md`
- 未找到对应文件时，工作流自动使用默认文案

---

## 5️⃣ GitHub CI 自动签名配置（可选）

若希望 GitHub Release 直接提供可安装的签名包，需配置 Secrets：

1. **获取 Keystore 的 Base64 编码**（在项目根目录运行）：
   ```powershell
   # Windows PowerShell
   $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("android/otter-music-release.jks"))
   Set-Clipboard $b64
   Write-Host "Base64 内容已复制到剪贴板！" -ForegroundColor Green
   ```

2. **在 GitHub 仓库添加 Secrets**：
   进入 `Settings` -> `Secrets and variables` -> `Actions` -> `New repository secret`，添加以下 4 项：

   | Name | Value | 说明 |
   | :--- | :--- | :--- |
   | `SIGNING_KEY` | (粘贴刚才复制的 Base64 内容) | Keystore 文件本身 |
   | `ALIAS` | `otter-music` | 密钥别名（生成证书时指定的 alias） |
   | `KEY_STORE_PASSWORD` | (你的密码) | Keystore 密码 |
   | `KEY_PASSWORD` | (你的密码) | 密钥密码（通常同上） |

---

# ✅ 最终产物

- 本地手动发布：签名后的 APK 位于

```
android/app/build/outputs/apk/release/
```

- CI 自动发布：在 GitHub Release 附件中获取 APK

---

# 🚀 发布前检查清单

* [ ] versionCode 已递增
* [ ] versionName 正确
* [ ] package.json 已同步
* [ ] 使用正确的 `.jks`
* [ ] 签名成功
* [ ] 本地安装测试通过
* [ ] 已推送 `v*` Tag 触发 CI