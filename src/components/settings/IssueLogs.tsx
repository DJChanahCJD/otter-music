"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Copy, Trash2 } from "lucide-react";
import { Clipboard } from "@capacitor/clipboard";
import { Capacitor } from "@capacitor/core";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
import { SettingItem } from "./SettingItem";
import { logger } from "@/lib/logger";
import { toastUtils } from "@/lib/utils/toast";

async function copyText(text: string) {
  if (!text.trim()) throw new Error("EMPTY_LOGS");
  if (Capacitor.isNativePlatform()) {
    await Clipboard.write({ string: text });
    return;
  }

  await navigator.clipboard.writeText(text);
}

export function IssueLogs() {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(0);

  const logText = useMemo(() => logger.exportText(), [version, open]);
  const logCount = useMemo(() => logger.getLogs().length, [version, open]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setVersion((value) => value + 1);
    setOpen(nextOpen);
  };

  const handleCopy = async () => {
    try {
      await copyText(logText);
      toastUtils.success("日志已复制");
    } catch {
      toastUtils.error("复制失败");
    }
  };

  const handleClear = () => {
    logger.clear();
    setVersion((value) => value + 1);
    toastUtils.success("日志已清空");
  };

  return (
    <>
      <SettingItem
        icon={AlertTriangle}
        title="问题日志"
        subtitle="复制日志用于问题反馈"
        action={
          <span className="text-xs text-muted-foreground">
            {logCount ? `${logCount} 条` : "无"}
          </span>
        }
        onClick={() => handleOpenChange(true)}
        showChevron
      />

      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>问题日志</DrawerTitle>
            <DrawerDescription>
              复制后粘贴到 GitHub issue，仅保留最近 100 条
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-4">
            <Textarea
              readOnly
              value={logText || "暂无日志"}
              className="min-h-64 font-mono text-xs"
            />
          </div>

          <DrawerFooter className="gap-2 pt-0">
            <Button onClick={handleCopy} disabled={!logText}>
              <Copy className="h-4 w-4 mr-2" />
              复制
            </Button>
            <Button variant="outline" onClick={handleClear} disabled={!logText}>
              <Trash2 className="h-4 w-4 mr-2" />
              清空
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
