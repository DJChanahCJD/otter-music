---
alwaysApply: false
---
# OtterMusic App 开发规范

## 1. 架构与依赖
- **核心栈**：React 19, Vite, TypeScript, React Router 7。
- **UI 生态**：Tailwind CSS 4, Shadcn UI。禁止内联样式，类名合并统一使用 `cn()`。
- **状态管理**：Zustand（全局，需持久化加 `partialize`），`useState`（局部）。
- **工具库**：`react-hot-toast` (反馈), `date-fns` (日期), `uuid`, `clsx`, `tailwind-merge`。

## 2. 移动端与 Capacitor 特性
- **UI 交互**：触控热区 ≥44px；菜单/弹窗强制优先使用 `Drawer` 或 `Sheet`。开发需首测移动端视口。
- **文件系统**：本地 `file://` 路径必须经 `Capacitor.convertFileSrc()` 转换。
- **性能优化**：
  - 长列表强制使用 `react-window` 虚拟化。
  - 并发控制严格区分：计算密集型用 `processBatchCPU`，文件 I/O 用 `processBatchIO`。

## 3. 编码与组件标准
- **结构**：全 Functional Component + Hooks。单文件 >300 行强制拆分。基础组件归入 `src/components/ui`。
- **命名与导入**：
  - 组件 `PascalCase`，变量/函数 `camelCase`。
  - 强制使用 `@/...` 绝对路径。
  - 图标必须从 `lucide-react` 单独导入（如 `import { Play }...`）以保证 Tree-shaking。