import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface PageErrorProps {
  title?: string;
  message?: string;
  icon?: ReactNode;
  onRetry?: () => void;
  onBack?: () => void;
  className?: string;
  children?: ReactNode;
}

export function PageError({
  title = "出错了",
  message = "加载失败",
  icon = "😵",
  onRetry,
  onBack,
  className,
  children,
}: PageErrorProps) {
  return (
    <div className={cn("flex flex-1 flex-col items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-500", className)}>
      <div className="mb-8 flex h-24 w-24 select-none items-center justify-center rounded-3xl bg-secondary/40 text-5xl">
        {icon}
      </div>

      <h1 className="mb-2 text-xl font-bold tracking-tight text-foreground text-center">
        {title}
      </h1>
      <p className="mb-10 text-sm leading-relaxed text-muted-foreground text-center max-w-xs wrap-break-word">
        {message}
      </p>

      <div className="flex w-full max-w-xs gap-3 justify-center">
        {children ? (
          children
        ) : (
          <>
            {onBack && (
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl"
                onClick={onBack}
              >
                返回
              </Button>
            )}
            {onRetry && (
              <Button
                className="flex-1 h-11 rounded-xl shadow-lg shadow-primary/20"
                onClick={onRetry}
              >
                重试
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
