import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/app-store";
import { Download, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Footer } from "../footer";

interface UpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/* ====== 工具函数 ====== */
const formatDate = (dateStr: string) => {
  try {
    return format(new Date(dateStr), "yyyy年MM月dd日", { locale: zhCN });
  } catch {
    return dateStr;
  }
};

export function UpdateDialog({ open, onOpenChange }: UpdateDialogProps) {
  const {
    currentVersion,
    latestVersionInfo,
    isChecking,
    checkUpdate,
    hasNewVersion,
  } = useAppStore();

  const hasUpdate = hasNewVersion && latestVersionInfo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Header */}
        <DialogHeader className="items-center pt-4">
          <img
            src="/favicon.svg"
            alt="Otter Music"
            className="w-16 h-16 rounded-xl shadow"
          />
          <DialogTitle className="text-xl font-bold mt-2">
            Otter Music
          </DialogTitle>
          <div className="text-xs font-mono text-muted-foreground">
            {currentVersion}
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Update Card */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">版本更新</span>
              <Badge variant={hasUpdate ? "default" : "secondary"}>
                {hasUpdate
                  ? `新版本 ${latestVersionInfo.latestVersion}`
                  : "已是最新版本"}
              </Badge>
            </div>

            {hasUpdate ? (
              <>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>
                      {formatDate(latestVersionInfo.publishDate)}
                    </span>
                    <span>
                      {(latestVersionInfo.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>

                  <div className="max-h-32 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed bg-muted/40 p-2 rounded">
                    {latestVersionInfo.changelog}
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={() =>
                    window.open(latestVersionInfo.downloadUrl, "_system")
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  立即更新
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => checkUpdate(false)}
                disabled={isChecking}
              >
                {isChecking && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isChecking ? "检查中..." : "检查更新"}
              </Button>
            )}
          </div>

          <Footer />
        </div>
      </DialogContent>
    </Dialog>
  );
}
