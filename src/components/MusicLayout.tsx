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


export function MusicLayout({ children, player, tabBar, header, hidePlayer, className, isTab = true }: MusicLayoutProps) {
  return (
    <div className={cn(
      "relative flex flex-col h-dvh overflow-hidden bg-background",
      isTab && "pt-safe pt-11",
      className
    )}>
      {/* Header */}
      {header && (
        <div className="shrink-0 px-5 pb-3">
          {header}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-h-0 relative">
        <div className={cn(
          "h-full overflow-auto scrollbar-hide",
        )}>
          {children}
        </div>
      </div>

      {/* Now Playing Bar (Floating Island) */}
      {!hidePlayer && (
        <div className={cn(
          "flex-none z-50 absolute left-0 right-0 bottom-16"
        )}>
          {player}
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex-none z-40">
        {tabBar}
      </div>
    </div>
  );
}
