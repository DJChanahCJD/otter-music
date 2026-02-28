更新时间：2026-02-28 14:51（Asia/Shanghai）

# 目标
修复 Android Debug 构建失败（AAPT: `mipmap/ic_launcher`、`mipmap/ic_launcher_round` not found），并解释/处理 `-Xlint:unchecked` 的编译提示来源与应对方式。

# 已知事实（来自日志与工程现状）
- 构建失败点：`:app:processDebugResources` → Android resource linking failed
  - 报错位置：[AndroidManifest.xml](file:///c:/Users/DJCHAN/SE/2_GithubProject/otter-music/android/app/src/main/AndroidManifest.xml#L22-L28)
  - 引用资源：`android:icon="@mipmap/ic_launcher"`、`android:roundIcon="@mipmap/ic_launcher_round"`
- 工程当前资源目录中不存在 `mipmap-*` 目录与上述资源文件
  - 资源目录清单：`android/app/src/main/res/` 仅有 `drawable/values/xml`（无 mipmap）
- 终端提示的 `-Xlint:unchecked` 属于 Java 编译警告，出现在 `:capacitor-android:compileDebugJavaWithJavac` 阶段；它不是失败原因（失败发生在资源链接阶段）。

# 结论（根因）
根因是 AndroidManifest 引用了应用图标资源 `@mipmap/ic_launcher` / `@mipmap/ic_launcher_round`，但这些资源没有被生成或被误删，导致 AAPT2 资源链接失败。

# 处理方案（最小改动优先）
## 方案 A（推荐）：用 Capacitor Assets 生成 Android 图标资源
原因：项目已配置脚本 `npm run resources`（`capacitor-assets generate`），这是 Capacitor 官方推荐生成 `mipmap-*` 图标的方式；不需要手工维护多套尺寸资源。

实施步骤（执行阶段将按此顺序操作）：
1. 检查图标源文件是否存在且符合要求
   - 现状：项目根目录存在 `assets/icon.png`
   - 若 `capacitor-assets` 需要的源文件路径/命名与当前不一致，则按其约定调整（会在执行阶段先确认当前 `assets/README.md` 的要求）。
2. 执行 `npm run resources`
   - 期望结果：生成 `android/app/src/main/res/mipmap-*/ic_launcher*` 等资源（含 round/adaptive），并可能更新 `drawable` 的启动图资源。
3. 重新执行 `npm run build:android:debug`
   - 期望结果：`processDebugResources` 通过；若仍失败，进入“兜底排查”。

兜底排查（仍然缺资源时才做）：
- 确认生成后的资源路径与 Manifest 引用一致（是否生成在 `mipmap-anydpi-v26`、是否资源名不同）
- 若资源名不同：以生成的资源名为准，调整 Manifest 的 `android:icon` / `android:roundIcon` 引用

## 方案 B（兜底）：临时改 Manifest 指向已有 drawable
原因：用于快速 unblock（例如先验证其他构建问题），但不推荐长期使用，因为 launcher icon 通常应为 mipmap/adaptive icon。

实施步骤（执行阶段才会修改）：
1. 将 `android:icon`/`android:roundIcon` 改为指向一个真实存在的资源（例如 `@drawable/splash` 或新增的占位图标）
2. 构建验证通过后，再回到方案 A 生成规范图标

# 关于 “某些输入文件使用了未经检查或不安全的操作 / -Xlint:unchecked”
## 判定
- 这是 `javac` 对第三方/依赖模块的泛型未检查转换等问题的警告，当前日志显示来源在 `:capacitor-android` 模块编译阶段（Capacitor Android 依赖）。
- 它不会导致本次构建失败；除非工程显式把 warning 当 error（当前日志未体现）。

## 处理策略（按需求选择）
1. 默认建议：忽略该警告
   - 原因：警告来自依赖模块代码（如 Capacitor），应用侧无需为其负责，且不影响产物正确性。
2. 若你想“看到更具体的位置/类型”：开启 `-Xlint:unchecked`
   - 在 Gradle 的 `compileOptions`/`tasks.withType(JavaCompile)` 增加 compilerArgs（执行阶段会根据现有 `build.gradle` 写法选择最小改动位置）。
3. 若你想“隐藏该警告”：显式关闭 `-Xlint:unchecked`
   - 在同一位置加入 `-Xlint:-unchecked`（只影响提示，不改变字节码）

# 验证标准
- `android/app/src/main/res/` 存在 `mipmap-*` 且包含 `ic_launcher` / `ic_launcher_round`（或 Manifest 引用的实际资源名）
- `npm run build:android:debug` 可完整通过（至少 `:app:processDebugResources` 不再失败）
- `-Xlint:unchecked` 相关信息要么被明确解释为“可忽略”，要么按选择项启用“更详细日志”或“静默”

