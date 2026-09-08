"use client";

import { useState } from "react";
import { Image } from "lucide-react";
import { SettingItem } from "./SettingItem";
import { Slider } from "@/components/ui/slider";
import {
  useMusicStore,
  type FullScreenBackgroundMode,
} from "@/store/music-store";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";

const BG_OPTIONS: { value: FullScreenBackgroundMode; label: string }[] = [
  { value: "theme", label: "动态" },
  { value: "cover", label: "模糊" },
  { value: "texture", label: "深色" },
];

export function FullScreenPlayerSetting() {
  const [expanded, setExpanded] = useState(false);

  const {
    fullScreenBackgroundMode,
    setFullScreenBackgroundMode,
    coverSize,
    setCoverSize,
    coverRadius,
    setCoverRadius,
  } = useMusicStore(
    useShallow((state) => ({
      fullScreenBackgroundMode: state.fullScreenBackgroundMode,
      setFullScreenBackgroundMode: state.setFullScreenBackgroundMode,
      coverSize: state.coverSize,
      setCoverSize: state.setCoverSize,
      coverRadius: state.coverRadius,
      setCoverRadius: state.setCoverRadius,
    }))
  );

  const bgLabel =
    BG_OPTIONS.find((opt) => opt.value === fullScreenBackgroundMode)?.label ??
    "动态";

  return (
    <SettingItem
      icon={Image}
      title="全屏播放器"
      subtitle={`${coverSize}px · ${bgLabel}`}
      onClick={() => setExpanded((v) => !v)}
      showChevron
      isExpanded={expanded}
      expandedContent={
        <div className="space-y-5">
          {/* 背景 */}
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">背景</span>

            <div className="flex rounded-lg bg-muted p-0.5">
              {BG_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFullScreenBackgroundMode(value)}
                  className={cn(
                    "min-w-12 rounded-md px-3 py-1.5 text-xs transition-all",
                    fullScreenBackgroundMode === value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 封面大小 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">封面大小</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {coverSize}px
              </span>
            </div>

            <Slider
              value={[coverSize]}
              onValueChange={([value]) => setCoverSize(value)}
              min={240}
              max={432}
              step={8}
            />
          </div>

          {/* 封面圆角 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">封面圆角</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {coverRadius}px
              </span>
            </div>

            <Slider
              value={[coverRadius]}
              onValueChange={([value]) => setCoverRadius(value)}
              min={0}
              max={180}
              step={3}
            />
          </div>
        </div>
      }
    />
  );
}
