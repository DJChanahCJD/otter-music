import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MusicLayoutProps {
  children: ReactNode;
  player: ReactNode;
  tabBar: ReactNode;
  header?: ReactNode;
  hidePlayer?: boolean;
  className?: string;
  isTab?: boolean;
}

export function MusicLayout({
  children,
  player,
  tabBar,
  header,
  hidePlayer,
  className,
  isTab = true,
}: MusicLayoutProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col h-dvh overflow-hidden bg-background",
        // tab 页的顶部内边距由 --tab-bar-top-offset 独占（max(44px, 安全区)）。
        // 不能与 pt-safe 并列：两者都在 utilities layer、特异性相同，
        // 后出现的 .pt-safe 会覆盖前面的任意值类，导致 44px 兜底失效
        isTab ? "pt-[var(--tab-bar-top-offset)]" : "pt-safe",
        className
      )}
    >
      {/* Header */}
      {header && <div className="shrink-0 px-5 pb-3">{header}</div>}

      {/* Main Content */}
      <div className="flex-1 min-h-0 relative">
        <div className={cn("h-full overflow-auto scrollbar-hide")}>
          {children}
        </div>
      </div>

      {/* Now Playing Bar (Floating Island) */}
      {!hidePlayer && (
        <div
          className={cn(
            "flex-none z-50 absolute left-0 right-0 transition-all duration-300",
            isTab ? "bottom-(--now-playing-safe-height)" : "bottom-0"
          )}
        >
          {player}
        </div>
      )}

      {/* Tab Bar */}
      {isTab && <div className="flex-none z-40">{tabBar}</div>}
    </div>
  );
}
