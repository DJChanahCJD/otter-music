import { LucideIcon, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface SettingItemProps {
  icon: LucideIcon;
  title: string;
  subtitle?: ReactNode; // 用于标题下方的描述
  action?: ReactNode; // 右侧的主要交互区域或显示区域
  showChevron?: boolean; // 是否显示右侧箭头
  expandedContent?: ReactNode; // 展开区域内容
  isExpanded?: boolean; // 展开状态
  className?: string;
  onClick?: () => void;
  children?: ReactNode; // 其他隐藏内容 (如 file input)
}

export function SettingItem({
  icon: Icon,
  title,
  subtitle,
  action,
  showChevron,
  expandedContent,
  isExpanded,
  className,
  onClick,
  children,
}: SettingItemProps) {
  return (
    <div
      className={cn(
        "p-4 rounded-xl bg-card/50 border border-border/50 transition-colors",
        onClick && "cursor-pointer hover:bg-muted/20",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between min-h-[28px]">
        <div className="flex items-center gap-3 flex-1 overflow-hidden">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-foreground truncate">{title}</span>
            {subtitle && (
              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                {subtitle}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground shrink-0 ml-2">
          {action}
          {showChevron && (
            <ChevronRight
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                isExpanded && "rotate-90"
              )}
            />
          )}
        </div>
      </div>

      {/* 展开内容区域 */}
      <div
        className={cn(
          "grid transition-all duration-200 ease-in-out",
          isExpanded ? "grid-rows-[1fr] opacity-100 mt-3 pt-3 border-t border-border/50" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          {expandedContent}
        </div>
      </div>
      
      {children}
    </div>
  );
}
