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
import { ChevronRight, DatabaseZap, Trash2, Volume2, Music, Radio, Palette, Loader2 } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";


interface SettingsPageProps {
  onBack: () => void;
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const { volume, setVolume, quality, setQuality, aggregatedSources, setAggregatedSources, cacheSize, cacheCount, updateCacheStats, clearCache } = useMusicStore();
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);

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
    setIsClearingCache(true);
    try {
      await clearCache();
    } finally {
      setIsClearingCache(false);
    }
  };

  return (
    <PageLayout title="系统设置" onBack={onBack}>
      <div className="flex-1 p-4 space-y-3 pb-28">
        <div className="flex items-center justify-between p-4 rounded-xl bg-card/50 border border-border/50 min-h-[60px]">
          <div className="flex items-center gap-3 flex-1">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Palette className="h-4 w-4 text-primary" />
            </div>
            <span className="text-foreground">主题切换</span>
          </div>
          <ThemeToggle />
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl bg-card/50 border border-border/50 min-h-[60px]">
          <div className="flex items-center gap-3 flex-1">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Volume2 className="h-4 w-4 text-primary" />
            </div>
            <span className="text-foreground">音量调节</span>
          </div>
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

        <div className="flex items-center justify-between p-4 rounded-xl bg-card/50 border border-border/50 min-h-[60px]">
          <div className="flex items-center gap-3 flex-1">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Music className="h-4 w-4 text-primary" />
            </div>
            <span className="text-foreground">音质设置</span>
          </div>
          <Select value={quality} onValueChange={setQuality}>
            <SelectTrigger className="h-7 px-2 bg-transparent border-muted hover:bg-muted/20 w-32">
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
          className="p-4 rounded-xl bg-card/50 border border-border/50 cursor-pointer hover:bg-muted/20 transition-colors"
          onClick={() => setShowSourcePicker(!showSourcePicker)}
        >
          <div className="flex items-center justify-between min-h-[60px]">
            <div className="flex items-center gap-3 flex-1">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Radio className="h-4 w-4 text-primary" />
              </div>
              <span className="text-foreground">聚合音源</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-sm truncate max-w-[140px]">{selectedLabels}</span>
              <ChevronRight className={`h-4 w-4 transition-transform ${showSourcePicker ? 'rotate-90' : ''}`} />
            </div>
          </div>
          <div className={`overflow-hidden transition-all duration-200 ease-in-out ${showSourcePicker ? 'max-h-48 opacity-100 mt-3 pt-3 border-t border-border/50' : 'max-h-0 opacity-0'}`}>
            <div className="space-y-2">
              {aggregatedSourceOptions.map(opt => (
                <label
                  key={opt.value}
                  className="flex items-center gap-3 py-2 cursor-pointer"
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
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card/50 border border-border/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <DatabaseZap className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">缓存管理</p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(cacheSize)} · {cacheCount} 首
              </p>
            </div>
          </div>
          <button
            onClick={handleClearCache}
            disabled={cacheSize === 0 || isClearingCache}
            className={cn(
              "flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-all min-h-[44px]",
              cacheSize > 0 && !isClearingCache
                ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                : "bg-muted/50 text-muted-foreground cursor-not-allowed"
            )}
          >
            {isClearingCache ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                清空中...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                {cacheSize > 0 ? "清空缓存" : "暂无缓存"}
              </>
            )}
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
