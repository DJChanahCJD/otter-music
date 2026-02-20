"use client";

import { PageLayout } from "./PageLayout";
import { ThemeToggle } from "./ThemeToggle";
import { SyncConfig } from "./SyncConfig";
import { useMusicStore } from "@/store/music-store";
import { aggregatedSourceOptions } from "@/types/music";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Checkbox } from "./ui/checkbox";
import { useState } from "react";
import { ChevronRight } from "lucide-react";

interface SettingsPageProps {
  onBack: () => void;
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const { quality, setQuality, aggregatedSources, setAggregatedSources } = useMusicStore();
  const [showSourcePicker, setShowSourcePicker] = useState(false);

  const toggleSource = (value: string) => {
    const current = aggregatedSources;
    if (current.includes(value as any)) {
      if (current.length > 1) {
        setAggregatedSources(current.filter(s => s !== value));
      }
    } else {
      setAggregatedSources([...current, value as any]);
    }
  };

  const selectedLabels = aggregatedSources
    .map(s => aggregatedSourceOptions.find(o => o.value === s)?.label)
    .filter(Boolean)
    .join('、');

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

        <div
          className="p-4 rounded-xl bg-card/50 border border-border/50 cursor-pointer"
          onClick={() => setShowSourcePicker(!showSourcePicker)}
        >
          <div className="flex items-center justify-between">
            <span className="text-foreground">聚合音源</span>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-sm truncate max-w-[180px]">{selectedLabels}</span>
              <ChevronRight className={`h-4 w-4 transition-transform ${showSourcePicker ? 'rotate-90' : ''}`} />
            </div>
          </div>
          {showSourcePicker && (
            <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
              {aggregatedSourceOptions.map(opt => (
                <label
                  key={opt.value}
                  className="flex items-center gap-3 py-1 cursor-pointer"
                  onClick={e => e.stopPropagation()}
                >
                  <Checkbox
                    checked={aggregatedSources.includes(opt.value)}
                    onCheckedChange={() => toggleSource(opt.value)}
                  />
                  <span className="text-sm text-foreground">{opt.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <SyncConfig />
      </div>
    </PageLayout>
  );
}
