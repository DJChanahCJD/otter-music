import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  MoreHorizontal,
  Pencil,
  CopyMinus,
  Download,
  Trash2,
  type LucideIcon,
} from "lucide-react";

interface PlaylistOperationsProps {
  onRename?: () => void;
  onDeduplicate: () => void;
  onExport: () => void;
  onDelete?: () => void;
}

/**
 * 统一菜单项组件
 * 避免重复写 icon + span + className
 */
function MenuItem({
  icon: Icon,
  label,
  onClick,
  destructive = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <DropdownMenuItem
      onClick={onClick}
      className={`
        py-2 cursor-pointer
        ${destructive ? "text-red-500 focus:text-red-500 focus:bg-red-50" : ""}
      `}
    >
      <Icon className="h-4 w-4 mr-1" />
      <span>{label}</span>
    </DropdownMenuItem>
  );
}

export function PlaylistOperations({
  onRename,
  onDeduplicate,
  onExport,
  onDelete,
}: PlaylistOperationsProps) {
  // 普通操作项（配置驱动）
  const items = [
    onRename && {
      icon: Pencil,
      label: "重命名",
      onClick: onRename,
    },
    {
      icon: CopyMinus,
      label: "列表去重",
      onClick: onDeduplicate,
    },
    {
      icon: Download,
      label: "导出歌单",
      onClick: onExport,
    },
  ].filter(Boolean) as {
    icon: LucideIcon;
    label: string;
    onClick: () => void;
  }[];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" title="更多操作">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        {items.map((item, index) => (
          <MenuItem key={index} {...item} />
        ))}

        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <MenuItem
              icon={Trash2}
              label="删除歌单"
              onClick={onDelete}
              destructive
            />
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}