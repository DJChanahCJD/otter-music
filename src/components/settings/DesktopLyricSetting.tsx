import { useCallback, useState } from "react";
import { useLocation } from "react-router-dom";
import { PictureInPicture2 } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { SettingItem } from "./SettingItem";
import { useMusicStore } from "@/store/music-store";
import { IS_NATIVE } from "@/lib/api/config";
import { DesktopLyric } from "@/plugins/desktop-lyric";
import { toastUtils } from "@/lib/utils/toast";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

/** 桌面歌词字色预设：白 / 粉 / 蓝 / 绿 / 金 / 紫 */
const COLOR_PRESETS = [
  "#FFFFFF",
  "#FF8FB3",
  "#6FB7FF",
  "#7FE0A7",
  "#FFD479",
  "#C3A6FF",
];

/**
 * 桌面歌词开关与字号、字色。
 *
 * 依赖 Android 原生悬浮窗插件，Web 端没有对应实现。
 * 开启时先检查"显示在其他应用上层"权限：未授权则弹提示并跳系统授权页，
 * 用户授权回来后再点一次即可开启。
 * 悬浮药丸固定水平居中、默认紧贴状态栏，本应用前台自动隐藏，双击歌词进入本设置项。
 */
export function DesktopLyricSetting() {
  const location = useLocation();
  // 双击悬浮歌词跳转而来时（location.state 标记）默认展开
  const [expanded, setExpanded] = useState(
    () =>
      (location.state as { expandDesktopLyric?: boolean } | null)
        ?.expandDesktopLyric === true
  );

  const {
    desktopLyricEnabled,
    setDesktopLyricEnabled,
    desktopLyricFontSize,
    setDesktopLyricFontSize,
    desktopLyricColor,
    setDesktopLyricColor,
  } = useMusicStore(
    useShallow((state) => ({
      desktopLyricEnabled: state.desktopLyricEnabled,
      setDesktopLyricEnabled: state.setDesktopLyricEnabled,
      desktopLyricFontSize: state.desktopLyricFontSize,
      setDesktopLyricFontSize: state.setDesktopLyricFontSize,
      desktopLyricColor: state.desktopLyricColor,
      setDesktopLyricColor: state.setDesktopLyricColor,
    }))
  );

  const handleCheckedChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setDesktopLyricEnabled(false);
        return;
      }

      // 方法不存在（旧 APK 未同步原生改动）时直接同步抛 TypeError，
      // .catch 接不住，必须先探测
      if (typeof DesktopLyric.checkOverlayPermission !== "function") {
        toastUtils.error("当前版本暂不支持桌面歌词");
        return;
      }

      DesktopLyric.checkOverlayPermission()
        .then(({ granted }) => {
          if (granted) {
            setDesktopLyricEnabled(true);
          } else {
            toastUtils.warning(
              '需先授权"显示在其他应用上层"，已打开系统设置，授权后返回再次开启'
            );
            void DesktopLyric.requestOverlayPermission().catch((e: unknown) =>
              logger.error("DesktopLyric", "requestOverlayPermission failed", e)
            );
          }
        })
        .catch((e: unknown) => {
          toastUtils.error("开启桌面歌词失败");
          logger.error("DesktopLyric", "checkOverlayPermission failed", e);
        });
    },
    [setDesktopLyricEnabled]
  );

  // 依赖 Android 原生插件，Web 端没有对应实现
  if (!IS_NATIVE) return null;

  return (
    <SettingItem
      icon={PictureInPicture2}
      title="桌面歌词"
      subtitle="其他应用上方悬浮 · 本应用内自动隐藏 · 双击歌词进设置"
      onClick={() => setExpanded((v) => !v)}
      showChevron
      isExpanded={expanded}
      action={
        // 阻止冒泡：点开关不应触发整行的展开/收起
        <span onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={desktopLyricEnabled}
            onCheckedChange={handleCheckedChange}
          />
        </span>
      }
      expandedContent={
        // 阻止冒泡：点色板/拖滑杆不应触发整行的展开收起（否则一点就折叠）
        <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
          {/* 字色 */}
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">颜色</span>

            <div className="flex items-center gap-2.5">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`歌词颜色 ${color}`}
                  onClick={() => setDesktopLyricColor(color)}
                  style={{ backgroundColor: color }}
                  className={cn(
                    "h-5 w-5 rounded-full border border-black/10 transition-all",
                    desktopLyricColor === color &&
                      "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  )}
                />
              ))}
            </div>
          </div>

          {/* 字号 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">字号</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {desktopLyricFontSize}px
              </span>
            </div>

            <Slider
              value={[desktopLyricFontSize]}
              onValueChange={([value]) => setDesktopLyricFontSize(value)}
              min={12}
              max={28}
              step={1}
            />
          </div>
        </div>
      }
    />
  );
}
