"use client";

import { PageLayout } from "./PageLayout";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";
import { QualitySelect } from "./settings/QualitySelect";
import { AggregatedSourceSelect } from "./settings/AggregatedSourceSelect";
import { SyncConfig } from "./settings/SyncConfig";
import { NeteaseLogin } from "./settings/NeteaseLogin";
import { useMusicStore } from "@/store/music-store";
import { Slider } from "./ui/slider";
import { Palette, Volume2, Wand2, Trash2 } from "lucide-react";
import { Switch } from "./ui/switch";
import { PlaylistImport } from "./settings/PlaylistImport";
import { SettingItem } from "./settings/SettingItem";
import { UpdateCheck } from "./settings/UpdateCheck";

interface SettingsPageProps {
  onBack?: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-2 px-1">{title}</h3>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const navigate = useNavigate();
  const { volume, setVolume, enableAutoMatch, setEnableAutoMatch } = useMusicStore();

  return (
    <PageLayout title="系统设置" onBack={onBack}>
      <div className="flex-1 p-4 pb-28 overflow-y-auto">
        <Section title="偏好设置">
          <SettingItem
            icon={Wand2}
            title="智能音源"
            subtitle="🧙‍♀️自动切换到可用的免费音源"
            action={
              <Switch
                checked={enableAutoMatch}
                onCheckedChange={setEnableAutoMatch}
              />
            }
          />
          <SettingItem
            icon={Palette}
            title="主题切换"
            action={<ThemeToggle />}
          />
          <QualitySelect />
          <AggregatedSourceSelect />
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
        </Section>

        <Section title="账号数据">
          <NeteaseLogin />
          <SyncConfig />
          <PlaylistImport />
          <SettingItem
            icon={Trash2}
            title="回收站"
            subtitle="恢复误删的歌曲和歌单"
            onClick={() => navigate("/settings/trash")}
            showChevron
          />
        </Section>

        <Section title="关于系统">
          <UpdateCheck />
        </Section>
      </div>
    </PageLayout>
  );
}
