import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { type UpdateInfo } from "@/lib/api/update";
import { Download, X, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface UpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  updateInfo: UpdateInfo | null;
}

/* ================= 工具函数 ================= */

const formatSize = (bytes: number) =>
  `${(bytes / 1024 / 1024).toFixed(2)} MB`;

const formatDate = (dateStr: string) => {
  try {
    return format(new Date(dateStr), "yyyy年MM月dd日 HH:mm", {
      locale: zhCN,
    });
  } catch {
    return dateStr;
  }
};

export function UpdateDialog({
  open,
  onOpenChange,
  updateInfo,
}: UpdateDialogProps) {
  if (!updateInfo) return null;

  const handleUpdate = () => {
    if (updateInfo.downloadUrl) {
      window.open(updateInfo.downloadUrl, "_system");
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            发现新版本
            <Badge variant="secondary">
              {updateInfo.latestVersion}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 版本对比 */}
          <div className="flex items-center justify-center gap-4 py-4 bg-muted/30 rounded-lg">
            <div className="text-center">
              <div className="text-xs text-muted-foreground">当前版本</div>
              <div className="font-mono font-medium text-lg">
                {updateInfo.currentVersion || "v0.0.0"}
              </div>
            </div>

            <ArrowRight className="text-muted-foreground/50" />

            <div className="text-center">
              <div className="text-xs text-muted-foreground">最新版本</div>
              <div className="font-mono font-bold text-lg text-primary">
                {updateInfo.latestVersion}
              </div>
            </div>
          </div>

          {/* 基本信息 */}
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>发布时间: {formatDate(updateInfo.publishDate)}</span>
            <span>大小: {formatSize(updateInfo.size)}</span>
          </div>

          {/* 更新日志（高度受控） */}
          <div className="max-h-60 overflow-y-auto text-sm bg-muted/50 p-3 rounded-md border">
            <div className="font-semibold mb-2">更新日志</div>
            <div className="whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">
              {updateInfo.changelog}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="mr-2 h-4 w-4" />
            暂不更新
          </Button>

          <Button onClick={handleUpdate}>
            <Download className="mr-2 h-4 w-4" />
            立即更新
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}