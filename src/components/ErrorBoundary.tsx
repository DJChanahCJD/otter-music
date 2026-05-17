import React, { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

const dynamicImportErrorPatterns = [
  "failed to fetch dynamically imported module",
  "importing a module script failed",
  "chunkloaderror",
  "loading chunk",
];

/** 判断错误是否来自构建产物更新后的动态导入资源失效。 */
export function isDynamicImportError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  const lowerMessage = message.toLowerCase();
  return dynamicImportErrorPatterns.some((pattern) => lowerMessage.includes(pattern));
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  /** 初始化全局错误边界状态。 */
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  /** 捕获子组件渲染阶段抛出的错误并切换到兜底 UI。 */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  /** 记录 React 错误边界捕获到的异常上下文。 */
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error("ErrorBoundary", error.message || "React render error", error, {
      componentStack: errorInfo.componentStack,
    });
  }

  /** 渲染正常内容或异常恢复界面。 */
  render() {
    if (this.state.hasError) {
      const isImportError = isDynamicImportError(this.state.error);
      const title = isImportError ? "应用已更新" : "应用异常";
      const message = isImportError
        ? "当前版本资源已刷新，请重新加载应用"
        : this.state.error?.message || "未知错误";

      return (
        <div className="flex items-center justify-center h-screen bg-background">
          <div className="text-center p-6">
            <div className="text-6xl mb-4">😵</div>
            <h1 className="text-xl font-semibold mb-2 text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground mb-4">
              {message}
            </p>
            <Button onClick={() => window.location.reload()}>
              重新加载
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
