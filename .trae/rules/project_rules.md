---
alwaysApply: true
---
OtterMusic 是一个基于 React + Vite + Shadcn-ui + Capacitor 的移动端音乐应用 APP

# 核心原则
1. **Mobile-First**: 样式与交互无条件优先适配移动端触控，Web 仅作为辅助容器。

# 开发规范
1. **组件重构**: 单文件 >300行 且存在独立子模块时，必须抽离为独立组件。(模块化子目录，如 `src/components/settings/`)
2. **图标导入**: 仅允许 `lucide-react` 按需导入。

# 平台与性能 (Native Bridge)
1. **路径转换**: 处理本地 `file://` 资源必须调用 `Capacitor.convertFileSrc()`。
2. **并发控制**: 
   - 密集计算（元数据解析等）使用 `processBatchCPU`。
   - I/O 操作（文件读写等）使用 `processBatchIO`。

# 依赖管理
1. **构建兼容**: 因 `@jofr/capacitor-media-session` 跨版本兼容需求，安装依赖必须带 `--legacy-peer-deps`。
