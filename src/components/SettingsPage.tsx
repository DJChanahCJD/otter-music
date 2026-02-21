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
import { Slider } from "./ui/slider";
import { useState, useEffect } from "react";
import { ChevronRight, DatabaseZap, Trash2 } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";


interface SettingsPageProps {
  onBack: () => void;
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const { volume, setVolume, quality, setQuality, aggregatedSources, setAggregatedSources, cacheSize, cacheCount, updateCacheStats, clearCache } = useMusicStore();
  const [showSourcePicker, setShowSourcePicker] = useState(false);

  useEffect(() => {
    updateCacheStats();
  }, [updateCacheStats]);

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

  const handleClearCache = async () => {
    if (!confirm(`确定清空所有缓存？\n当前缓存：${formatBytes(cacheSize)} (${cacheCount} 首)`)) {
      return;
    }
    await clearCache();
  };

  return (
    <PageLayout title="系统设置" onBack={onBack}>
      <div className="flex-1 p-4 space-y-4 pb-28">
        <div className="flex items-center justify-between p-4 rounded-xl bg-card/50 border border-border/50">
          <span className="text-foreground">主题切换</span>
          <ThemeToggle />
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl bg-card/50 border border-border/50">
          <span className="text-foreground">音量调节</span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-10 text-right">{Math.round(volume * 100)}%</span>
            <Slider
              value={[volume * 100]}
              onValueChange={([value]) => setVolume(value / 100)}
              min={0}
              max={100}
              step={1}
              className="w-32"
            />
          </div>
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

        <div className="p-4 rounded-xl bg-card/50 border border-border/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <DatabaseZap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">缓存管理</p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(cacheSize)} · {cacheCount} 首
              </p>
            </div>
          </div>
          <button
            onClick={handleClearCache}
            disabled={cacheSize === 0}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all",
              cacheSize > 0
                ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                : "bg-muted/50 text-muted-foreground cursor-not-allowed"
            )}
          >
            <Trash2 className="h-4 w-4" />
            清空缓存
          </button>
          <div className="text-xs text-muted-foreground/70 mt-3 px-1">
            仅「我的喜欢」中的歌曲会自动缓存
          </div>
        </div>

        <SyncConfig /> 
      </div>
    </PageLayout>
  );
}
