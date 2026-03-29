"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Copy, Trash2, ExternalLink } from "lucide-react";
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
import { GithubUrl } from "@/types";

async function copyToClipboard(text: string) {
  if (!text.trim()) throw new Error("EMPTY");
  Capacitor.isNativePlatform()
    ? await Clipboard.write({ string: text })
    : await navigator.clipboard.writeText(text);
}

export function IssueLogs() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState({ count: 0, all: "", recent: "" });

  useEffect(() => {
    setLogs((prev) => ({ ...prev, count: logger.getLogs().length }));
  }, []);

  const handleOpen = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setLogs({
        count: logger.getLogs().length,
        all: logger.exportText(),
        recent: logger.exportText({ recent: true }),
      });
    }
  };

  const handleAction = async (action: "copy-recent" | "copy-all" | "clear") => {
    try {
      if (action === "clear") {
        logger.clear();
        setLogs({ count: 0, all: "", recent: "" });
        toastUtils.success("日志已清空");
        return;
      }

      const isRecent = action === "copy-recent";
      await copyToClipboard(isRecent ? logs.recent : logs.all);
      toastUtils.success(`${isRecent ? "本次" : "全部"}日志已复制`);
    } catch {
      toastUtils.error("操作失败或无内容");
    }
  };

  return (
    <>
      <SettingItem
        icon={AlertTriangle}
        title="诊断日志"
        subtitle="用于排查运行异常或提交反馈"
        action={
          <span className="text-xs text-muted-foreground">
            {logs.count ? `${logs.count} 条` : "无"}
          </span>
        }
        onClick={() => handleOpen(true)}
        showChevron
      />

      <Drawer open={isOpen} onOpenChange={handleOpen}>
        <DrawerContent className="max-h-[85vh] flex flex-col">
          <DrawerHeader>
            <DrawerTitle>诊断日志</DrawerTitle>
            <DrawerDescription>
              复制后粘贴到 GitHub issue，仅保留最近 100 条
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-4 overflow-hidden">
            <Textarea
              readOnly
              value={logs.all || "暂无日志记录"}
              className="h-[45vh] w-full resize-none overflow-y-auto bg-muted/30 font-mono text-[11px] leading-relaxed"
            />
          </div>

          <DrawerFooter className="grid grid-cols-2 gap-2 pt-0 sm:flex sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => window.open(`${GithubUrl}/issues`, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              去反馈
            </Button>
            <Button
              variant="outline"
              onClick={() => handleAction("clear")}
              disabled={!logs.all}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              清空
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleAction("copy-all")}
              disabled={!logs.all}
            >
              <Copy className="h-4 w-4 mr-2" />
              复制全部
            </Button>
            <Button
              variant="default"
              onClick={() => handleAction("copy-recent")}
              disabled={!logs.recent}
            >
              <Copy className="h-4 w-4 mr-2" />
              复制本次
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}