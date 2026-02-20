"use client";

import { PageLayout } from "./PageLayout";
import { ThemeToggle } from "./ThemeToggle";
import { SyncConfig } from "./SyncConfig";
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
  const { quality, setQuality } = useMusicStore();

  return (
    <PageLayout title="系统设置" onBack={onBack}>
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
    </PageLayout>
  );
}
