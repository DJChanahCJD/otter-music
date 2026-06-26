import { useState, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { Download, RotateCcw } from "lucide-react";
import { useMusicStore } from "@/store/music-store";
import { useShallow } from "zustand/react/shallow";
import { SettingItem } from "./SettingItem";
import { Switch } from "@/components/ui/switch";
import { LocalMusicPlugin } from "@/plugins/local-music";
import { AppPaths } from "@/lib/storage-manager";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const QUALITY_LABELS: Record<string, string> = {
  "128": "标准",
  "192": "高品",
  "320": "极高",
  "999": "无损",
};

const IS_NATIVE = Capacitor.isNativePlatform();

function buildSummary(
  quality: string,
  embedCover: boolean,
  embedLyric: boolean,
  downloadDirectory: string
): string {
  const parts: string[] = [];
  parts.push(QUALITY_LABELS[quality] ?? "标准");
  if (embedCover && embedLyric) parts.push("封面&歌词");
  else if (embedCover) parts.push("封面");
  else if (embedLyric) parts.push("歌词");
  else parts.push("无嵌入");
  if (IS_NATIVE && downloadDirectory) {
    parts.push(downloadDirectory);
  }
  return parts.join(" · ");
}

export function DownloadSetting() {
  const {
    downloadQuality,
    setDownloadQuality,
    embedCover,
    setEmbedCover,
    embedLyric,
    setEmbedLyric,
    downloadDirectory,
    setDownloadDirectory,
  } = useMusicStore(
    useShallow((state) => ({
      downloadQuality: state.downloadQuality,
      setDownloadQuality: state.setDownloadQuality,
      embedCover: state.embedCover,
      setEmbedCover: state.setEmbedCover,
      embedLyric: state.embedLyric,
      setEmbedLyric: state.setEmbedLyric,
      downloadDirectory: state.downloadDirectory,
      setDownloadDirectory: state.setDownloadDirectory,
    }))
  );

  const [expanded, setExpanded] = useState(false);
  const [picking, setPicking] = useState(false);

  const handlePick = useCallback(async () => {
    setPicking(true);
    try {
      const result = await LocalMusicPlugin.pickDownloadDirectory();
      if (result.success && result.path !== undefined) {
        setDownloadDirectory(result.path);
      }
    } catch (err) {
      console.warn("pickDownloadDirectory failed:", err);
    } finally {
      setPicking(false);
    }
  }, [setDownloadDirectory]);

  const handleResetDirectory = useCallback(() => {
    setDownloadDirectory("");
  }, [setDownloadDirectory]);

  const summary = buildSummary(
    downloadQuality,
    embedCover,
    embedLyric,
    downloadDirectory
  );

  return (
    <SettingItem
      icon={Download}
      title="下载设置"
      subtitle={summary}
      onClick={() => setExpanded(!expanded)}
      showChevron
      isExpanded={expanded}
      expandedContent={
        <div className="space-y-3">
          <Row label="下载音质">
            <Select value={downloadQuality} onValueChange={setDownloadQuality}>
              <SelectTrigger className="h-7 px-2 bg-transparent border-muted hover:bg-muted/20 w-40">
                <SelectValue placeholder="音质" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="128">标准 (128kbps)</SelectItem>
                <SelectItem value="192">高品 (192kbps)</SelectItem>
                <SelectItem value="320">极高 (320kbps)</SelectItem>
                <SelectItem value="999">无损 (999kbps)</SelectItem>
              </SelectContent>
            </Select>
          </Row>

          <Row label="内嵌封面">
            <Switch checked={embedCover} onCheckedChange={setEmbedCover} />
          </Row>

          <Row label="内嵌歌词">
            <Switch checked={embedLyric} onCheckedChange={setEmbedLyric} />
          </Row>

          {IS_NATIVE && (
            <Row
              label="下载目录"
              hint={downloadDirectory || `默认目录（${AppPaths.Music}）`}
            >
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePick();
                  }}
                  disabled={picking}
                  className="h-7 px-3 text-xs bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors disabled:opacity-50"
                >
                  {picking ? "选择中..." : "选择目录"}
                </button>
                {downloadDirectory && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResetDirectory();
                    }}
                    className="p-1 text-muted-foreground hover:text-foreground"
                    title="重置为默认"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </Row>
          )}
        </div>
      }
    />
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-col min-w-0">
        <span className="text-sm text-foreground">{label}</span>
        {hint && (
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
            {hint}
          </span>
        )}
      </div>
      <div onClick={(e) => e.stopPropagation()} className="shrink-0">
        {children}
      </div>
    </div>
  );
}
