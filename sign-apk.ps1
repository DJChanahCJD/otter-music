# ===== 1. 自动获取 SDK 路径 =====
$sdkDir = (
    Get-Content "android/local.properties" |
    Where-Object { $_ -match "^sdk.dir=" } |
    ForEach-Object { ($_ -split "=")[1].Trim() }
) -replace '\\:', ':' -replace '\\\\', '\'

if (-not (Test-Path $sdkDir)) {
    Write-Error "Android SDK 路径无效: $sdkDir"
    exit 1
}

Write-Host "SDK: $sdkDir" -ForegroundColor Cyan

# ===== 2. 获取最新 Build-Tools =====
$buildTools = Get-ChildItem (Join-Path $sdkDir "build-tools") |
              Sort-Object Name -Descending |
              Select-Object -First 1

if (-not $buildTools) {
    Write-Error "未找到 build-tools 目录"
    exit 1
}

$zipalign  = Join-Path $buildTools.FullName "zipalign.exe"
$apksigner = Join-Path $buildTools.FullName "apksigner.bat"

# ===== 3. 路径定义 =====
$apkDir   = "android/app/build/outputs/apk/release"
$raw      = Join-Path $apkDir "app-release-unsigned.apk"
$aligned  = Join-Path $apkDir "app-release-aligned.apk"
$final    = Join-Path $apkDir "app-release-signed.apk"
$keystore = "android/otter-music-release.jks"

# ===== 4. 执行流水线 =====
Write-Host "`n--- ZipAlign ---"
& $zipalign -f -p 4 $raw $aligned
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n--- Sign APK ---"
& $apksigner sign `
    --ks $keystore `
    --ks-key-alias "otter-music" `
    --ks-pass "pass:$env:KS_PASS" `
    --out $final `
    $aligned
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n--- Verify ---"
& $apksigner verify -v $final
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Remove-Item $aligned -ErrorAction SilentlyContinue
Write-Host "`n✔ $final" -ForegroundColor Green