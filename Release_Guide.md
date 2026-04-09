# 移动端发布手册（Release Guide）

完整流程：**写 Release Note → 改版本号 → 推送 Tag → 自动构建与发布**

---

## 0️⃣ 添加 Release Note

在 `assets/release/` 目录下添加对应版本的 Markdown 文件，要求文件名与新 Tag 一致（例如 `v2.0.2.md`）。
*注：若未找到对应文件，GitHub Actions 将自动生成默认简易文案。*

> 建议先运行 `npm run ci-test` 完成本地测试

## 1️⃣ 修改版本号并打 Tag

确保 Git 工作区干净（无未提交更改），使用 npm 一键完成版本号更新、Android 版本同步和自动生成 Tag：

```bash
# 补丁更新 (1.0.0 -> 1.0.1)
npm version patch

# 小版本更新 (1.0.0 -> 1.1.0)
npm version minor

# 大版本更新 (1.0.0 -> 2.0.0)
npm version major

```

## 2️⃣ 触发 GitHub Actions 自动发布（主流程）

执行完版本更新后，推送代码和标签即可触发云端自动构建、签名和 Release 发布：

```bash
git push && git push --tags

```

**产物获取**：构建完成后，签名好的 APK 会自动附加在 GitHub Release 页面中。

---

## 3️⃣ 前置要求：配置 CI 自动签名（仅首次需配置）

CI 流程依赖 GitHub Secrets 进行自动签名。若尚未配置，请按以下步骤操作：

1. **生成签名证书（若无 `.jks`）**：
```bash
keytool -genkeypair -v -keystore otter-music-release.jks -alias otter-music -keyalg RSA -keysize 2048 -validity 10000

```


2. **获取 Keystore 的 Base64 编码**：
```powershell
# Windows PowerShell 示例
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("android/otter-music-release.jks"))
Set-Clipboard $b64

```


3. **在 GitHub 仓库添加 Secrets** (`Settings` -> `Secrets and variables` -> `Actions`)：
| Name | Value | 说明 |
| :--- | :--- | :--- |
| `SIGNING_KEY` | *(粘贴上述 Base64)* | Keystore 文件内容 |
| `ALIAS` | `otter-music` | 密钥别名 |
| `KEY_STORE_PASSWORD` | *(你的密码)* | Keystore 密码 |
| `KEY_PASSWORD` | *(你的密码)* | 密钥密码 |

---

## 4️⃣ 本地手动构建（仅供本地验证/备用）

若需在本地测试构建和签名：

```bash
# 1. 构建 Release 包
npm run build:android:release

# 2. 执行本地签名脚本
./sign-apk.ps1

```

*本地产物路径：`android/app/build/outputs/apk/release/*`

---

# 🚀 发布前检查清单

* [ ] Release Note 文件已就绪 (`assets/release/v*.md`)
* [ ] Git 工作区干净，已使用 `npm version` 同步各项版本号
* [ ] GitHub Secrets (`SIGNING_KEY` 等 4 项) 均已正确配置
* [ ] 已执行 `git push --tags` 触发 CI