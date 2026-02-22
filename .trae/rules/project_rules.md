---
alwaysApply: true
---
OtterMusic 是一个基于 React + Vite + Shadcn-ui + Capacitor 的移动端音乐应用，要求移动端优先。
* 图标：lucide-react按需导入
* 批量处理：import { processBatchCPU, processBatchIO } from "@/lib/utils";
* Android WebView 无法直接加载本地 `file://` 文件，用 Capacitor 的 `convertFileSrc()` 转 URL。
* currentAudioTime 不应该放到 useEffect 依赖数组中，因为它会频繁变化。
* `@jofr/capacitor-media-session` 依赖 Capacitor 6，但 Capacitor 8 实测可用。因此安装依赖时需加 `--legacy-peer-deps` 避免安装失败
