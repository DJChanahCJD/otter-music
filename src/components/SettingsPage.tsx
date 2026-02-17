"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "./ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { SyncConfig } from "./SyncConfig";
import { useBackButton } from "@/hooks/use-back-button";
import { useMusicStore } from "@/store/music-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface SettingsPageProps {
  onBack: () => void;
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  useBackButton(onBack);
  const { quality, setQuality } = useMusicStore();

  return (
    <div className="h-full flex flex-col">
      <div className="sticky top-0 z-10 px-4 py-3 bg-background border-b border-border/50">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">系统设置</h1>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4">
        <div className="flex items-center justify-between p-4 rounded-xl bg-card/50 border border-border/50">
          <span className="text-foreground">主题切换</span>
          <ThemeToggle />
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl bg-card/50 border border-border/50">
          <span className="text-foreground">音质设置</span>
          <Select value={quality} onValueChange={setQuality}>
            <SelectTrigger className="h-7 px-2 bg-transparent border-muted hover:bg-muted/20">
              <SelectValue placeholder="音质" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="128">标准 (128kbps)</SelectItem>
              <SelectItem value="192">高品 (192kbps)</SelectItem>
              <SelectItem value="320">极高 (320kbps)</SelectItem>
              <SelectItem value="999">无损 (999kbps)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <SyncConfig />
      </div>
    </div>
  );
}
