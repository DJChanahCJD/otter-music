"use client";

import { PageLayout } from "./PageLayout";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";
import { QualitySelect } from "./settings/QualitySelect";
import { AggregatedSourceSelect } from "./settings/AggregatedSourceSelect";
import { SyncConfig } from "./settings/SyncConfig";
import { NeteaseLogin } from "./settings/NeteaseLogin";
import { QqMusicLogin } from "./settings/QqMusicLogin";
import { BilibiliLogin } from "./settings/BilibiliLogin";
import { ApiUrlConfig } from "./settings/ApiUrlConfig";
import { useMusicStore } from "@/store/music-store";
import { useShallow } from "zustand/react/shallow";
import { Slider } from "./ui/slider";
import {
  Palette,
  Volume2,
  Wand2,
  Trash2,
  Tag,
  Database,
  Shield,
  Bell,
  Music4,
} from "lucide-react";
import { Switch } from "./ui/switch";
import { useAppStore } from "@/store/app-store";
import { DownloadSetting } from "./settings/DownloadSetting";
import { SettingItem } from "./settings/SettingItem";
import { UpdateCheck } from "./settings/UpdateCheck";
import { IssueLogs } from "./settings/IssueLogs";
import { StreamCacheSetting } from "./settings/StreamCacheSetting";
import { SleepTimerSetting } from "./settings/SleepTimerSetting";
import { PlaybackSpeedSetting } from "./settings/PlaybackSpeedSetting";
import { AutoMatchSuffixSetting } from "./settings/AutoMatchSuffixSetting";
import { AutoMatchSetting } from "./settings/AutoMatchSetting";
import { FullScreenPlayerSetting } from "./settings/FullScreenPlayerSetting";
import { DataBackup } from "./settings/DataBackup";
import { WebDavBackup } from "./settings/WebDavBackup";
import { LyricStyleSetting } from "./settings/LyricStyleSetting";
import { CarLyricSetting } from "./settings/CarLyricSetting";
import { useState } from "react";
import { IS_NATIVE } from "@/lib/api/config";

interface SettingsPageProps {
  onBack?: () => void;
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <h3 className="text-xs font-medium text-muted-foreground mb-1.5 px-1">
        {title}
      </h3>
      <div className="rounded-xl bg-card/50 border border-border/50 divide-y divide-border/50 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const navigate = useNavigate();
  const [dataBackupOpen, setDataBackupOpen] = useState(false);
  const {
    enableUpdateNotify,
    setEnableUpdateNotify,
    allowSimultaneousPlayback,
    setAllowSimultaneousPlayback,
  } = useAppStore();
  const {
    volume,
    setVolume,
    enableAutoMatch,
    enableProxyFallback,
    setEnableProxyFallback,
    bilibiliKeepOriginalMeta,
    setBilibiliKeepOriginalMeta,
    showSourceBadge,
    setShowSourceBadge,
  } = useMusicStore(
    useShallow((state) => ({
      volume: state.volume,
      setVolume: state.setVolume,
      enableAutoMatch: state.enableAutoMatch,
      enableProxyFallback: state.enableProxyFallback,
      setEnableProxyFallback: state.setEnableProxyFallback,
      bilibiliKeepOriginalMeta: state.bilibiliKeepOriginalMeta,
      setBilibiliKeepOriginalMeta: state.setBilibiliKeepOriginalMeta,
      showSourceBadge: state.showSourceBadge,
      setShowSourceBadge: state.setShowSourceBadge,
    }))
  );

  return (
    <PageLayout title="系统设置" onBack={onBack}>
      <div className="flex-1 p-4 pb-bottom-stack overflow-y-auto">
        <SettingsSection title="常用设置">
          <AggregatedSourceSelect />
          <SettingItem
            icon={Volume2}
            title="音量调节"
            action={
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-10 text-right">
                  {Math.round(volume * 100)}%
                </span>
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
          {IS_NATIVE && (
            <SettingItem
              icon={Music4}
              title="与其他应用同时播放"
              action={
                <Switch
                  checked={allowSimultaneousPlayback}
                  onCheckedChange={setAllowSimultaneousPlayback}
                />
              }
            />
          )}
          <SleepTimerSetting />
          <PlaybackSpeedSetting />
          <DownloadSetting />
        </SettingsSection>

        <SettingsSection title="界面设置">
          <SettingItem
            icon={Palette}
            title="主题切换"
            action={<ThemeToggle />}
          />
          <SettingItem
            icon={Tag}
            title="显示音源标签"
            subtitle="在歌曲列表中始终显示音源平台标签"
            action={
              <Switch
                checked={showSourceBadge}
                onCheckedChange={setShowSourceBadge}
              />
            }
          />
          <FullScreenPlayerSetting />
          <LyricStyleSetting />
          <CarLyricSetting />
        </SettingsSection>

        <SettingsSection title="账号数据">
          <NeteaseLogin />
          <QqMusicLogin />
          <BilibiliLogin />
          <SyncConfig />
          <SettingItem
            icon={Database}
            title="数据备份"
            subtitle="导出或导入全部收藏、歌单与设置"
            onClick={() => setDataBackupOpen(true)}
            showChevron
          />
          <SettingItem
            icon={Trash2}
            title="回收站"
            subtitle="恢复误删的歌曲和歌单"
            onClick={() => navigate("/settings/trash")}
            showChevron
          />
        </SettingsSection>

        <SettingsSection title="B站设置">
          <SettingItem
            icon={Wand2}
            title="换源保留原信息"
            subtitle="自动换源到B站时保留原标题和歌手"
            action={
              <Switch
                checked={bilibiliKeepOriginalMeta}
                onCheckedChange={setBilibiliKeepOriginalMeta}
                disabled={!enableAutoMatch}
              />
            }
          />
          <AutoMatchSuffixSetting />
        </SettingsSection>

        <SettingsSection title="高级设置">
          <ApiUrlConfig />
          <SettingItem
            icon={Shield}
            title="代理回退"
            subtitle="自动切换代理线路（但容易卡顿）"
            action={
              <Switch
                checked={enableProxyFallback}
                onCheckedChange={setEnableProxyFallback}
              />
            }
          />
          <AutoMatchSetting />
          <StreamCacheSetting />
          <WebDavBackup />
        </SettingsSection>

        <SettingsSection title="关于系统">
          <SettingItem
            icon={Bell}
            title="更新提醒"
            subtitle="启动时自动检查新版本"
            action={
              <Switch
                checked={enableUpdateNotify}
                onCheckedChange={setEnableUpdateNotify}
              />
            }
          />
          <UpdateCheck />
          <IssueLogs />
        </SettingsSection>
      </div>
      <DataBackup open={dataBackupOpen} onOpenChange={setDataBackupOpen} />
    </PageLayout>
  );
}
