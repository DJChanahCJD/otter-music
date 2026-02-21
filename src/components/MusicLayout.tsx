import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MusicLayoutProps {
  children: ReactNode;
  player: ReactNode;
  tabBar: ReactNode;
  header?: ReactNode;
  hidePlayer?: boolean;
  className?: string;
}


export function MusicLayout({ children, player, tabBar, header, hidePlayer, className }: MusicLayoutProps) {
  return (
    <div className={cn("relative flex flex-col h-dvh overflow-hidden bg-background pt-safe pt-11", className)}>
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
        <div className="flex-none z-50 absolute bottom-16 left-0 right-0">
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
