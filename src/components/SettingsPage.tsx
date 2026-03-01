"use client";

import { PageLayout } from "./PageLayout";
import { ThemeToggle } from "./ThemeToggle";
import { QualitySelect } from "./settings/QualitySelect";
import { AggregatedSourceSelect } from "./settings/AggregatedSourceSelect";
import { SyncConfig } from "./settings/SyncConfig";
import { useMusicStore } from "@/store/music-store";
import { Slider } from "./ui/slider";
import { useState } from "react";
import { Palette, Volume2, Server } from "lucide-react";
import { LoadBalanceDialog } from "./settings/LoadBalanceDialog";
import { PlaylistImport } from "./settings/PlaylistImport";
import { SettingItem } from "./settings/SettingItem";
import { UpdateCheck } from "./settings/UpdateCheck";


interface SettingsPageProps {
  onBack?: () => void;
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const { volume, setVolume } = useMusicStore();
  const [showLoadBalance, setShowLoadBalance] = useState(false);

  return (
    <PageLayout title="系统设置" onBack={onBack}>
      <div className="flex-1 p-4 space-y-3 pb-28">
        <SettingItem
          icon={Palette}
          title="主题切换"
          action={<ThemeToggle />}
        />

        <SettingItem
          icon={Volume2}
          title="音量调节"
          action={
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
          }
        />

        <QualitySelect />

        <AggregatedSourceSelect />


        <PlaylistImport />
        
        <UpdateCheck />

        {/* <SettingItem
          icon={Server}
          title="负载均衡"
          onClick={() => setShowLoadBalance(true)}
          showChevron
        />
        <LoadBalanceDialog open={showLoadBalance} onOpenChange={setShowLoadBalance} /> */}

        <SyncConfig /> 
      </div>
    </PageLayout>
  );
}
