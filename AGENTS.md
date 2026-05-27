# Repository Guidelines

Otter Music 是一款 Capacitor 混合架构音乐播放器——同一套 React 代码库同时服务于 Web 端和 Android 原生端。

## 架构概览

| 层               | 说明                                                         |
| ---------------- | ------------------------------------------------------------ |
| `src/components` | UI 与页面组件，Web/Android 共享                              |
| `src/hooks`      | 播放控制与应用行为钩子                                       |
| `src/lib`        | 共享逻辑：API 客户端、音乐提供方、存储、工具函数             |
| `src/store`      | Zustand store 层，通过 `partialize` 选择性持久化至 IndexedDB |
| `src/plugins`    | 自定义 Capacitor 插件（如 `LocalMusicPlugin`）的 TS 接口定义 |
| `android/`       | Capacitor Android 项目，自定义插件原生实现在此               |
| `shared/`        | 前后端共享代码，包含类型定义、工具函数                       |
| `functions/`     | Cloudflare functions, 基于 Hono 框架             |

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
- **原生插件**：修改 `LocalMusicPlugin.java` 或新增 Capacitor 插件方法后，必须同步更新 `src/plugins/local-music/index.ts` 的接口定义。运行 `npm run cap:sync:android` 同步 Web 资源到 Android 项目后才能真机验证。
- **新增依赖**：优先用 JS/TS 方案解决。只有涉及文件系统、蓝牙、通知等必须原生 API 的场景才引入 Capacitor 插件。
- **音乐API**：在 Android 端，APP 优先直连，Web端才需要做functions代理。严禁自己实现加密算法，优先使用已有的加密库`node-forge`。

## 编码约定

- 使用 TypeScript，`@/` 路径别名指向 `src/`
- Zustand store 放在 `src/store/`，新增持久化字段需在 `partialize` 中声明
- 测试文件与源文件同目录，命名 `*.test.ts` 或 `*.test.tsx`
- 保持改动最小，不引入无必要的抽象或依赖
- 修改播放、同步、Store 逻辑时，补充或更新对应测试
- 重要业务逻辑应使用 `src/lib/logger.ts` 记录日志 info、error、warn 等
