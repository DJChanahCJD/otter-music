import { Bluetooth } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { Switch } from "@/components/ui/switch";
import { SettingItem } from "./SettingItem";
import { useMusicStore } from "@/store/music-store";
import { IS_NATIVE } from "@/lib/api/config";

export function CarLyricSetting() {
  const { carLyricEnabled, setCarLyricEnabled } = useMusicStore(
    useShallow((state) => ({
      carLyricEnabled: state.carLyricEnabled,
      setCarLyricEnabled: state.setCarLyricEnabled,
    }))
  );

  // 依赖 Android 原生插件，Web 端没有对应实现
  if (!IS_NATIVE) return null;

  return (
    <SettingItem
      icon={Bluetooth}
      title="车载歌词"
      subtitle="蓝牙连接车机后显示逐行歌词"
      action={
        <Switch
          checked={carLyricEnabled}
          onCheckedChange={setCarLyricEnabled}
        />
      }
    />
  );
}
