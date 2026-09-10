# Repository Guidelines

Otter Music 是一款 Capacitor 混合架构音乐播放器。当前仅面向 Android 原生端；代码中的 Web 分支（`IS_NATIVE` 判断）属历史遗留，新增功能只考虑 Android 端。

## 架构概览

| 层               | 说明                                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `src/components` | UI 与页面组件，Web/Android 共享                                                                                            |
| `src/hooks`      | 播放控制与应用行为钩子                                                                                                     |
| `src/lib`        | 共享逻辑：API 客户端、音乐提供方、存储、工具函数                                                                           |
| `src/store`      | Zustand store 层，通过 `partialize` 选择性持久化至 IndexedDB                                                               |
| `src/plugins`    | 自定义 Capacitor 插件（`LocalMusicPlugin`、`BilibiliProxyPlugin`、`AudioRoutePlugin`、`WebViewLoginPlugin`）的 TS 接口定义 |
| `src/routes`     | react-router-dom 路由层定义                                                                                                |
| `src/types`      | 共享 TypeScript 类型定义                                                                                                   |
| `android/`       | Capacitor Android 项目，自定义插件原生实现在此                                                                             |
| `shared/`        | 前后端共享代码，包含类型定义、工具函数                                                                                     |
| `functions/`     | Cloudflare functions, 基于 Hono 框架                                                                                       |

`shared/` 和 `functions/` 是 npm workspaces，`shared/` 以 `@otter-music/shared` 导入。

## 常用命令

- 安装：`npm install`
- 开发：`npm run dev`
- 类型检查：`npm run typecheck`
- 代码检查：`npm run lint`
- 测试：`npm run test`
- Android 同步：`npm run cap:sync:android`
- 构建：`npm run build`

## 多端适配规则

平台检测入口为 `src/lib/api/config.ts` 中的 `IS_NATIVE = Capacitor.isNativePlatform()`。

- **UI 层**：组件优先写共享代码。仅在 Web 端完全不需要某个 UI（如 `DownloadDirectorySelect`）时，用 `if (!IS_NATIVE) return null` 守卫，而非拆成两个组件。
- **逻辑层**：用 `IS_NATIVE` 做条件分支，而非创建两套实现。例如：下载用 `@capacitor/filesystem`（原生）vs 浏览器 download API（Web）；网络请求原生优先直连 API，Web 走代理。
- **API 层**：`src/lib/api/config.ts` 已封装平台感知的 URL 选择和超时逻辑，新增 API 调用应复用该层而非自行判断平台。
- **原生插件**：修改 `android/` 下的插件 Java 实现或新增 Capacitor 插件方法后，必须同步更新 `src/plugins/` 下对应的 TS 接口定义。运行 `npm run cap:sync:android` 同步 Web 资源到 Android 项目后才能真机验证。
- **第三方插件改造（patch-package）**：需要改动 `node_modules` 下第三方 Capacitor 插件的原生实现时，**不要直接改完就算**，必须用 `patch-package` 固化：
  1. 直接修改 `node_modules/<pkg>/` 下的文件（Java、`res/`、`.d.ts` 等）；
  2. 先移走插件目录里的 gradle 构建产物（如 `android/build`，否则会被打进补丁；Windows 上这些产物路径过长，会让 `git add` 直接失败，`--exclude` 无法规避，必须移走）；
  3. 执行 `npx patch-package <pkg>`，补丁落在 `patches/`（已由 `postinstall: patch-package` 在每次 `npm install` 后自动应用）。
     生成后务必检查补丁里没有混入 `.gradle/`、`.settings/`、`.classpath` 等本地垃圾文件（可用 `--exclude` 或手工清理补丁文本），并用 `npx patch-package` 验证能干净应用。
- **新增依赖**：优先用 JS/TS 方案解决。只有涉及文件系统、蓝牙、通知等必须原生 API 的场景才引入 Capacitor 插件。
- **音乐API**：默认直连 GD 音乐台 API，失败自动回退后端 functions 代理（`/music-api`、`/proxy`，见 `src/lib/api/config.ts` 的 `getOrderedMusicApiUrls`）。严禁自己实现加密算法，优先使用已有的加密库`node-forge`。
- **Lucide 图标 Android 兼容**：在低版本 Android WebView 下，被 `bg-*` + Flex 容器包裹的 `<Icon />` 可能被压缩至 0 像素。直接在 SVG 上加 `shrink-0` 无效（低版本 WebView 对 SVG 的 `flex-shrink: 0` 支持有 bug），因此 `shrink-0` 必须加在外层 `div` 上。修复方案：用外层 `div` 包裹 SVG，`div` 固定尺寸 + `shrink-0`，并建议显式声明 `flex-[0_0_Npx]` 与 `min-w-* min-h-*` 作为兜底，内层 SVG 用 `h-full w-full` 继承尺寸。示例：`<div className="h-6 w-6 shrink-0 flex-[0_0_24px] min-w-6 min-h-6"><Icon size={24} className="h-full w-full" /></div>`

## 编码约定

- 使用 TypeScript，`@/` 路径别名指向 `src/`
- Zustand store 放在 `src/store/`，新增持久化字段需在 `partialize` 中声明
- 保持改动最小，不引入无必要的抽象或依赖
- 修改播放、同步、Store 逻辑时，补充或更新对应测试
- 重要业务逻辑应使用 `src/lib/logger.ts` 记录日志 info、error、warn 等
- 使用 Tailwind CSS 4 + shadcn/ui (New York)，UI 原语位于 `src/components/ui/`
- 移动端优先，极简主义。当前 apk 大小仅 2 MB，包体积和性能需要优先考虑。

## 统一退出栈（useExitLayer）

Android 原生返回键与 Web 端 Esc 由 `RootLayout` 统一拦截，转发到 `useExitLayerStore`。所有"占用屏幕的浮层"（Drawer、全屏播放器、封面预览等）都应通过 `src/hooks/useExitLayer` 接入同一个 LIFO 栈，**最后打开的层最先响应 back/Esc**。

- API：`useExitLayer()` 返回 `{ push, pop, handleExit, isEmpty }`。`push({ close })` 在层打开时入栈，`pop(id)` 在层关闭时出栈；`handleExit` 关闭栈顶。
- 接入模式（与现有 `ui/drawer.tsx`、`RootLayout.tsx`、`MusicCover.tsx` 一致）：
  ```ts
  useEffect(() => {
    if (!isOpen) return;
    const id = push({ close: () => setOpen(false) });
    return () => pop(id);
  }, [isOpen, push, pop]);
  ```
- **不要**用 `priority` 数字或硬编码串联关闭顺序——栈序就是用户的"打开时间"直觉，新接入的层应直接走 `push/pop`。
- **不要**把"导航跳转"（如点击按钮跳路由）当成退出行为。back/Esc 走栈；主动跳路由是业务动作，不归栈管。
- 修改退出栈或新增接入点时，补充或更新 `src/hooks/useExitLayer.test.ts` 及对应组件单测。

## 音源 Provider 能力规范

`IMusicProvider` 定义了核心能力（`search`/`getUrl`/`getPic`/`getLyric`）和可选扩展能力。新增音源时：

- **必须**实现 `searchArtist` 和 `searchAlbum`（最低限度委托给 `this.search`）。`MusicTrackMobileMenu` 据此决定歌手/专辑搜索是否限定在当前音源（`searchSource = track.source`）还是回退到聚合搜索（`"all"`）。
- `getArtistDetail`/`getAlbumDetail`/`getSongDetail` 为可选能力，仅在音源有独立详情页路由时才需实现。当前详情页（`NeteaseDetail`）耦合网易云 API，其他音源无需实现这些方法，走搜索回退即可。

## 其他

- dnd-kit拖拽排序需要确保`touch-none select-none`,避免移动端选中逻辑拦截了拖拽逻辑
- 避免把 store 都放到 music-store
