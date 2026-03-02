# =========================================================
# Otter Music APK 自动签名脚本
# 功能：对齐 → 签名 → 验证 → 清理
# =========================================================

# ---------- 通用错误退出函数 ----------
function Fail($msg) {
    Write-Error $msg
    exit 1
}

# ---------- 1. 读取 Android SDK 路径 ----------
$localProps = "android/local.properties"
if (-not (Test-Path $localProps)) { Fail "未找到 $localProps" }

$sdkDir = (Select-String "^sdk.dir=" $localProps).ToString().Split("=")[1].Trim() `
          -replace '\\:', ':' -replace '\\\\', '\'

if (-not (Test-Path $sdkDir)) { Fail "SDK 路径无效: $sdkDir" }

Write-Host "SDK: $sdkDir" -ForegroundColor Cyan

# ---------- 2. 获取最新 Build-Tools ----------
$buildTools = Get-ChildItem (Join-Path $sdkDir "build-tools") |
              Sort-Object Name -Descending |
              Select-Object -First 1

if (-not $buildTools) { Fail "未找到 build-tools" }

$zipalign  = Join-Path $buildTools.FullName "zipalign.exe"
$apksigner = Join-Path $buildTools.FullName "apksigner.bat"

Write-Host "BuildTools: $($buildTools.Name)" -ForegroundColor Cyan

# ---------- 3. 定义路径 ----------
$apkDir   = "android/app/build/outputs/apk/release"
$keystore = "android/otter-music-release.jks"

$rawFile = Get-ChildItem $apkDir -Filter "*-release.apk" |
           Where-Object { $_.Name -notmatch "-signed" } |
           Sort-Object LastWriteTime -Descending |
           Select-Object -First 1

if (-not $rawFile) {
    Fail "未找到待签名 APK，请先执行 npm run build:android:release"
}

$aligned = Join-Path $apkDir "app-temp-aligned.apk"
$final   = Join-Path $apkDir ($rawFile.Name -replace "-release.apk", "-signed.apk")

# ---------- 4. 读取密码 ----------
if (-not $env:KS_PASS) {
    $env:KS_PASS = Read-Host "请输入 Keystore 密码"
}

Write-Host "`n>>> 正在签名: $($rawFile.Name)" -ForegroundColor Magenta

# ---------- 5. ZipAlign ----------
& $zipalign -f -p 4 $rawFile.FullName $aligned
if ($LASTEXITCODE -ne 0) { Fail "ZipAlign 失败" }

# ---------- 6. 签名 ----------
& $apksigner sign `
    --ks $keystore `
    --ks-key-alias "otter-music" `
    --ks-pass "pass:$env:KS_PASS" `
    --out $final `
    $aligned

if ($LASTEXITCODE -ne 0) {
    Remove-Item $aligned -ErrorAction SilentlyContinue
    Fail "签名失败（请检查密码或 alias）"
}

# ---------- 7. 验证 ----------
& $apksigner verify -v $final
if ($LASTEXITCODE -ne 0) { Fail "签名验证失败" }

# ---------- 8. 清理 ----------
Remove-Item $aligned -ErrorAction SilentlyContinue

Write-Host "✔ 签名成功: $final" -ForegroundColor Green