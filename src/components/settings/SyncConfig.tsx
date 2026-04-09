"use client";

import { useState, useRef } from "react";
import { Trash2, RefreshCw } from "lucide-react";
import { Button } from "../ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "../ui/drawer";
import { Input } from "../ui/input";
import { useSyncStore } from "@/store/sync-store";
import { SettingItem } from "./SettingItem";

export function SyncConfig() {
  const { syncKey, lastSyncTime, setSyncKey, clearSyncConfig } = useSyncStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inputKey, setInputKey] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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
    clearSyncConfig();
    setDialogOpen(false);
  };

  return (
    <>
      <SettingItem
        icon={RefreshCw}
        title="数据同步"
        subtitle={
          syncKey ? `最后同步: ${formatLastSyncTime(lastSyncTime)}` : null
        }
        action={
          <span className="text-xs text-muted-foreground">
            {syncKey ? maskKey(syncKey) : "未配置"}
          </span>
        }
        onClick={() => setDialogOpen(true)}
      />

      <Drawer
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (open && !syncKey) {
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }}
      >
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>配置同步密钥</DrawerTitle>
            <DrawerDescription>
              {syncKey
                ? `当前密钥: ${maskKey(syncKey)}`
                : "请输入您的 SYNC_KEY 用于数据同步"}
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4">
            <Input
              ref={inputRef}
              type="password"
              placeholder="请输入 SYNC_KEY"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
            />
          </div>
          <DrawerFooter className="gap-2 pt-0">
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
            <Button onClick={handleConfirm} disabled={!inputKey.trim()} className="h-11">
              确认
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
