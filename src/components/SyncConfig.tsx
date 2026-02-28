"use client";

import { useState } from "react";
import { Trash2, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { useSyncStore } from "@/store/sync-store";

export function SyncConfig() {
  const { syncKey, lastSyncTime, setSyncKey, clearSyncKey } = useSyncStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inputKey, setInputKey] = useState("");

  const formatLastSyncTime = (timestamp: number) => {
    if (!timestamp) return "暂未同步";
    const date = new Date(timestamp);
    return date.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return key;
    return `${key.slice(0, 4)}****${key.slice(-4)}`;
  };

  const handleConfirm = () => {
    if (!confirm("确认覆盖当前配置？")) return;
    if (inputKey.trim()) {
      setSyncKey(inputKey.trim());
      setInputKey("");
      setDialogOpen(false);
    }
  };

  const handleClear = () => {
    if (!confirm("确认清除当前配置吗？")) return;
    clearSyncKey();
    setDialogOpen(false);
  };

  return (
    <>
      <div
        className="flex items-center justify-between p-4 rounded-xl bg-card/50 border border-border/50 cursor-pointer hover:bg-muted/20 transition-colors min-h-[60px]"
        onClick={() => setDialogOpen(true)}
      >
        <div className="flex items-center gap-3 flex-1">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <RefreshCw className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <span className="text-foreground">数据同步</span>
            {syncKey && (
              <div className="text-xs text-muted-foreground mt-0.5">
                最后同步: {formatLastSyncTime(lastSyncTime)}
              </div>
            )}
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {syncKey ? maskKey(syncKey) : "未配置"}
        </span>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>配置同步密钥</DialogTitle>
            <DialogDescription>
              {syncKey
                ? `当前密钥: ${maskKey(syncKey)}`
                : "请输入您的 SYNC_KEY 用于数据同步"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="password"
              placeholder="请输入 SYNC_KEY"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
            />
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {syncKey && (
              <Button
                variant="outline"
                onClick={handleClear}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                清除密钥
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleConfirm} disabled={!inputKey.trim()}>
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
