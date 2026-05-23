import { useState, useEffect } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link2, Loader2, Music4 } from "lucide-react";
import { useMusicStore } from "@/store/music-store";
import { toastUtils } from "@/lib/utils/toast";
import { SettingItem } from "./SettingItem";
import { logger } from "@/lib/logger";
import { detectPlatform, type Platform } from "@/lib/platform-detector";
import { resolveUrl } from "@/lib/netease/netease-api";
import { getPlaylistDetail } from "@/lib/netease/netease-api";
import { convertSongToMusicTrack } from "@/lib/netease/netease-api";
import { parseQqMusicUrl, getQqPlaylistDetail, convertQqSongToMusicTrack } from "@/lib/qqmusic/qqmusic-api";
import type { MusicTrack } from "@/types/music";

const PLATFORM_LABELS: Record<Platform, string> = {
  netease: "网易云音乐",
  qq: "QQ音乐",
};

type Phase = "input" | "loading" | "preview" | "error" | "importing";

interface PlaylistPreview {
  name: string;
  coverUrl: string;
  trackCount: number;
  tracks: MusicTrack[];
  platform: Platform;
}

export function PlaylistUrlImport() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [preview, setPreview] = useState<PlaylistPreview | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const reset = () => {
    setUrl("");
    setPhase("input");
    setPreview(null);
    setErrorMsg("");
  };

  const handleClose = () => {
    setOpen(false);
    reset();
  };

  // 自动读取剪贴板
  useEffect(() => {
    if (!open) return;
    navigator.clipboard
      ?.readText?.()
      .then((text) => {
        const trimmed = text.trim();
        if (detectPlatform(trimmed) && !url) {
          setUrl(trimmed);
        }
      })
      .catch(() => {});
  }, [open, url]);

  const handleFetch = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    const platform = detectPlatform(trimmed);
    if (!platform) {
      setErrorMsg("不支持的链接格式，目前支持网易云音乐和QQ音乐的歌单链接");
      setPhase("error");
      return;
    }

    setPhase("loading");

    try {
      if (platform === "netease") {
        const resolved = resolveUrl(trimmed);
        if (!resolved) {
          setErrorMsg("无法解析此链接");
          setPhase("error");
          return;
        }
        if (resolved.type !== "playlist") {
          setErrorMsg("此链接为单曲或专辑，暂仅支持歌单导入");
          setPhase("error");
          return;
        }

        const detail = await getPlaylistDetail(resolved.id);
        if (!detail) {
          setErrorMsg("获取歌单信息失败");
          setPhase("error");
          return;
        }
        if (!detail.tracks?.length) {
          setErrorMsg("歌单为空，无法导入");
          setPhase("error");
          return;
        }

        const tracks = detail.tracks.map(convertSongToMusicTrack);
        setPreview({
          name: detail.name,
          coverUrl: detail.coverImgUrl || "",
          trackCount: detail.trackCount || tracks.length,
          tracks,
          platform,
        });
      } else {
        const playlistId = parseQqMusicUrl(trimmed);
        if (!playlistId) {
          setErrorMsg("无法从此链接提取歌单ID");
          setPhase("error");
          return;
        }

        const detail = await getQqPlaylistDetail(playlistId);
        if (!detail.songs?.length) {
          setErrorMsg("歌单为空，无法导入");
          setPhase("error");
          return;
        }

        const tracks = detail.songs.map(convertQqSongToMusicTrack);
        setPreview({
          name: detail.name,
          coverUrl: detail.coverUrl || "",
          trackCount: detail.trackCount || tracks.length,
          tracks,
          platform,
        });
      }
      setPhase("preview");
    } catch (e: unknown) {
      logger.error("PlaylistUrlImport", "Fetch failed", e);
      const msg = e instanceof Error ? e.message : "获取歌单失败";
      setErrorMsg(msg.includes("timeout") ? "请求超时，请检查网络后重试" : msg);
      setPhase("error");
    }
  };

  const handleImport = async () => {
    if (!preview) return;
    setPhase("importing");

    try {
      const playlistId = useMusicStore.getState().createPlaylist(preview.name, preview.coverUrl);
      useMusicStore.getState().setPlaylistTracks(playlistId, preview.tracks);
      toastUtils.success(`成功导入歌单「${preview.name}」\n共 ${preview.trackCount} 首歌曲`);
      handleClose();
    } catch (e: unknown) {
      logger.error("PlaylistUrlImport", "Import failed", e);
      toastUtils.error("导入失败，请重试");
      setPhase("preview");
    }
  };

  return (
    <>
      <SettingItem
        icon={Link2}
        title="链接导入歌单"
        subtitle="粘贴网易云/QQ音乐歌单链接"
        onClick={() => setOpen(true)}
        showChevron
      />

      <Drawer open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
        <DrawerContent className="max-h-[92vh] outline-none">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-center text-lg font-bold">
              通过链接导入歌单
            </DrawerTitle>
          </DrawerHeader>

          <div className="px-5 space-y-5">
            {phase === "input" && (
              <>
                <div className="relative">
                  <Link2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9 h-11 bg-muted/40 border-none rounded-xl focus-visible:ring-1 font-mono text-sm"
                    placeholder="粘贴网易云或QQ音乐歌单分享链接"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleFetch()}
                    autoFocus
                  />
                </div>
                <p className="text-xs text-muted-foreground px-1">
                  支持 music.163.com / y.qq.com 歌单链接
                </p>
              </>
            )}

            {phase === "loading" && (
              <div className="flex flex-col items-center py-12 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">正在获取歌单信息...</p>
              </div>
            )}

            {phase === "preview" && preview && (
              <div className="space-y-4">
                <div className="bg-muted/30 rounded-2xl p-4 flex items-center gap-4">
                  {preview.coverUrl ? (
                    <img
                      src={preview.coverUrl}
                      alt={preview.name}
                      className="w-20 h-20 rounded-xl object-cover shadow-lg"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center">
                      <Music4 className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base truncate">{preview.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {PLATFORM_LABELS[preview.platform]} · {preview.trackCount} 首歌曲
                    </p>
                  </div>
                </div>
              </div>
            )}

            {phase === "error" && (
              <div className="text-center py-8 space-y-4">
                <p className="text-sm text-destructive">{errorMsg}</p>
              </div>
            )}
          </div>

          <DrawerFooter className="px-5 pt-2 pb-8">
            {(phase === "input" || phase === "error") && (
              <>
                {phase === "error" && (
                  <Button variant="outline" className="h-12 rounded-2xl" onClick={() => setPhase("input")}>
                    返回修改链接
                  </Button>
                )}
                <Button
                  className="h-12 rounded-2xl shadow-lg shadow-primary/20"
                  disabled={!url.trim()}
                  onClick={phase === "error" ? () => { setPhase("input"); handleFetch(); } : handleFetch}
                >
                  {phase === "error" ? "重试" : "获取歌单"}
                </Button>
              </>
            )}
            {phase === "loading" && (
              <Button className="h-12 rounded-2xl" disabled>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                获取中...
              </Button>
            )}
            {phase === "preview" && (
              <>
                <Button
                  className="h-12 rounded-2xl shadow-lg shadow-primary/20"
                  onClick={handleImport}
                >
                  确认导入
                </Button>
                <Button
                  variant="ghost"
                  className="h-12 rounded-2xl"
                  onClick={() => setPhase("input")}
                >
                  返回
                </Button>
              </>
            )}
            {phase === "importing" && (
              <Button className="h-12 rounded-2xl" disabled>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                导入中...
              </Button>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
