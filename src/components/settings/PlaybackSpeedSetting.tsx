"use client";

import { useState } from "react";
import { Gauge } from "lucide-react";
import { SettingItem } from "./SettingItem";
import { Slider } from "@/components/ui/slider";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useMusicStore } from "@/store/music-store";

export function PlaybackSpeedSetting() {
  const playbackSpeed = useMusicStore((s) => s.playbackSpeed);
  const setPlaybackSpeed = useMusicStore((s) => s.setPlaybackSpeed);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleOpenDrawer = () => {
    setIsDrawerOpen(true);
  };

  const handleSliderChange = ([value]: number[]) => {
    setPlaybackSpeed(value / 10);
  };

  const subtitle = `当前 ${playbackSpeed.toFixed(1)}x`;

  return (
    <>
      <SettingItem
        icon={Gauge}
        title="倍速模式"
        subtitle={subtitle}
        showChevron
        onClick={handleOpenDrawer}
      />

      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent className="outline-none">
          <DrawerHeader className="px-5 pt-6 pb-2">
            <DrawerTitle className="text-lg font-semibold text-center">
              倍速：{playbackSpeed.toFixed(1)}x
            </DrawerTitle>
          </DrawerHeader>

          <div className="px-5 py-6 space-y-6">
            <Slider
              value={[playbackSpeed * 10]}
              onValueChange={handleSliderChange}
              min={5}
              max={20}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0.5x</span>
              <span>1.0x</span>
              <span>1.5x</span>
              <span>2.0x</span>
            </div>
          </div>

          <div className="h-6" />
        </DrawerContent>
      </Drawer>
    </>
  );
}
