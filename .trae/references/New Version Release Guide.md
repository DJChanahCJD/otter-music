# Android 发布手册（Release Guide）

完整流程：**改版本 → 构建 → 签名 → 生成 APK**

---

## 1️⃣ 修改版本号（每次发布必须）

确保三处版本保持一致：

| 文件                         | 字段            | 要求                 |
| -------------------------- | ------------- | ------------------ |
| `android/app/build.gradle` | `versionCode` | 必须递增（整数）           |
| `android/app/build.gradle` | `versionName` | 用户可见版本，如 `"1.1.0"` |
| `package.json`             | `version`     | 项目版本号              |

> 修改完 package.json 后，运行 `npm install --legacy-peer-deps` 同步到 package-lock.json。
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

# ✅ 最终产物

签名后的 APK 位于：

```
android/app/build/outputs/apk/release/
```

---

# 🚀 发布前检查清单

* [ ] versionCode 已递增
* [ ] versionName 正确
* [ ] package.json 已同步
* [ ] 使用正确的 `.jks`
* [ ] 签名成功
* [ ] 本地安装测试通过