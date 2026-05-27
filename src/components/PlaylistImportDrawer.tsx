import { useState, useEffect, useRef } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Link2, Loader2, Upload, ListMusic } from "lucide-react";
import { MusicCover } from "@/components/MusicCover";
import { useMusicStore } from "@/store/music-store";
import { toastUtils } from "@/lib/utils/toast";
import { logger } from "@/lib/logger";
import { detectPlatform, type Platform } from "@/lib/platform-detector";
import { readClipboardText } from "@/lib/clipboard";

// 聚合各平台 API 导入
import * as netease from "@/lib/netease/netease-api";
import * as qqmusic from "@/lib/qqmusic/qqmusic-api";
import * as kugou from "@/lib/kugou/kugou-api";
import * as kuwo from "@/lib/kuwo/kuwo-api";
import * as migu from "@/lib/migu/migu-api";

import { importPlaylist } from "@/lib/utils/playlist-backup";
import type { MusicTrack } from "@/types/music";

function parseInput(text: string) {
  return text.trim().match(/https?:\/\/[^\s]+/i)?.[0] || "";
}

const PLATFORM_LABELS: Record<Platform, string> = {
  netease: "网易云音乐",
  qq: "QQ音乐",
  kugou: "酷狗音乐",
  kuwo: "酷我音乐",
  migu: "咪咕音乐",
};

// 平台解析策略配置
const platformStrategies: Record<
  Platform,
  {
    resolveId: (url: string) => any;
    getDetail: (id: any) => Promise<any>;
    convert: (song: any) => MusicTrack;
  }
> = {
  netease: {
    resolveId: (url) => {
      const res = netease.resolveUrl(url);
      if (!res || res.type !== "playlist")
        throw new Error(
          res ? "此链接为单曲或专辑，暂仅支持歌单导入" : "无法解析此链接"
        );
      return res.id;
    },
    getDetail: netease.getPlaylistDetail,
    convert: netease.convertSongToMusicTrack,
  },
  qq: {
    resolveId: (url) =>
      qqmusic.parseQqMusicUrl(url) ||
      (() => {
        throw new Error("无法从此链接提取歌单ID");
      })(),
    getDetail: qqmusic.getQqPlaylistDetail,
    convert: qqmusic.convertQqSongToMusicTrack,
  },
  kugou: {
    resolveId: async (url) =>
      (await kugou.resolveKugouPlaylistId(url)) ||
      (() => {
        throw new Error("无法从此链接提取歌单ID");
      })(),
    getDetail: kugou.getKugouPlaylistDetail,
    convert: kugou.convertKugouSongToMusicTrack,
  },
  kuwo: {
    resolveId: (url) =>
      kuwo.parseKuwoPlaylistUrl(url) ||
      (() => {
        throw new Error("无法从此链接提取歌单ID");
      })(),
    getDetail: kuwo.getKuwoPlaylistDetail,
    convert: kuwo.convertKuwoSongToMusicTrack,
  },
  migu: {
    resolveId: async (url) =>
      (await migu.resolveMiguPlaylistId(url)) ||
      (() => {
        throw new Error("无法从此链接提取歌单ID");
      })(),
    getDetail: migu.getMiguPlaylistDetail,
    convert: migu.convertMiguSongToMusicTrack,
  },
};

type Phase = "input" | "loading" | "preview" | "error" | "importing";

interface PlaylistPreview {
  name: string;
  coverUrl: string;
  trackCount: number;
  tracks: MusicTrack[];
  platform: Platform;
}

interface PlaylistImportDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlaylistImportDrawer({
  open,
  onOpenChange,
}: PlaylistImportDrawerProps) {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [preview, setPreview] = useState<PlaylistPreview | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"link" | "file">("link");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setUrl("");
    setPhase("input");
    setPreview(null);
    setErrorMsg("");
  };

  const handleClose = () => {
    onOpenChange(false);
    reset();
  };

  // 自动读取剪贴板
  useEffect(() => {
    if (!open || url) return;
    readClipboardText()
      .then((text) => {
        const extractedUrl = parseInput(text);
        const platform = detectPlatform(extractedUrl);
        if (extractedUrl && platform) {
          setUrl(extractedUrl);
          toastUtils.success(`已识别${PLATFORM_LABELS[platform]}歌单链接`, {
            id: "clipboard-import",
          });
        }
      })
      .catch(() => {});
  }, [open, url]);

  // 统一的核心获取逻辑
  const handleFetch = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    const platform = detectPlatform(trimmed);
    if (!platform) {
      setErrorMsg(
        "不支持的链接格式，目前支持网易云、QQ、酷狗、酷我和咪咕音乐的歌单链接"
      );
      setPhase("error");
      return;
    }

    setPhase("loading");

    try {
      const strategy = platformStrategies[platform];
      const playlistId = await strategy.resolveId(trimmed);
      const detail = await strategy.getDetail(playlistId);
      const songs = detail?.tracks || detail?.songs;

      if (!detail || !songs?.length) {
        throw new Error(!detail ? "获取歌单信息失败" : "歌单为空，无法导入");
      }

      const tracks = songs.map(strategy.convert);
      setPreview({
        name: detail.name,
        coverUrl: detail.coverImgUrl || detail.coverUrl || "",
        trackCount: detail.trackCount || tracks.length,
        tracks,
        platform,
      });
      setPhase("preview");
    } catch (e: any) {
      logger.error("PlaylistImportDrawer", "Fetch failed", e);
      const msg = e?.message || "获取歌单失败";
      setErrorMsg(msg.includes("timeout") ? "请求超时，请检查网络后重试" : msg);
      setPhase("error");
    }
  };

  const savePlaylistToStore = (
    name: string,
    coverUrl: string | undefined,
    tracks: MusicTrack[]
  ) => {
    const playlistId = useMusicStore.getState().createPlaylist(name, coverUrl);
    useMusicStore.getState().setPlaylistTracks(playlistId, tracks);
    toastUtils.success(`成功导入歌单「${name}」\n共 ${tracks.length} 首歌曲`);
    handleClose();
  };

  const handleUrlImport = async () => {
    if (!preview) return;
    setPhase("importing");
    try {
      savePlaylistToStore(preview.name, preview.coverUrl, preview.tracks);
    } catch (e) {
      logger.error("PlaylistImportDrawer", "Import failed", e);
      toastUtils.error("导入失败，请重试");
      setPhase("preview");
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { name, tracks } = await importPlaylist(file);
      savePlaylistToStore(name, undefined, tracks);
    } catch (error: any) {
      logger.error("PlaylistImportDrawer", "File import failed", error);
      toastUtils.error(error?.message || "导入失败");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DrawerContent className="max-h-[92vh] outline-none">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-center text-lg font-bold">
            导入歌单
          </DrawerTitle>
        </DrawerHeader>

        <Tabs
          defaultValue="link"
          className="px-5"
          onValueChange={(v) => setActiveTab(v as "link" | "file")}
        >
          <TabsList className="w-full">
            <TabsTrigger value="link" className="flex-1">
              <Link2 className="h-4 w-4 mr-1.5" />
              链接导入
            </TabsTrigger>
            <TabsTrigger value="file" className="flex-1">
              <Upload className="h-4 w-4 mr-1.5" />
              文件导入
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="mt-4 space-y-4">
            {phase === "input" && (
              <>
                <div className="relative">
                  <Link2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9 h-11 bg-muted/40 border-none rounded-xl focus-visible:ring-1 font-mono text-sm"
                    placeholder="输入歌单链接..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleFetch()}
                    autoFocus
                  />
                </div>
                <p className="text-xs text-muted-foreground px-1">
                  「在官方 APP 打开歌单」 → 「分享」 → 「复制链接」
                </p>
              </>
            )}

            {phase === "loading" && (
              <div className="flex flex-col items-center py-12 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  正在获取歌单信息...
                </p>
              </div>
            )}

            {phase === "preview" && preview && (
              <div className="space-y-4">
                <div className="bg-muted/30 rounded-2xl p-4 flex items-center gap-4">
                  <MusicCover
                    src={preview.coverUrl}
                    alt={preview.name}
                    className="w-20 h-20 rounded-xl shadow-lg"
                    fallbackIcon={
                      <ListMusic className="h-8 w-8 text-muted-foreground" />
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base truncate">
                      {preview.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {PLATFORM_LABELS[preview.platform]} · {preview.trackCount}{" "}
                      首歌曲
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
          </TabsContent>

          <TabsContent value="file" className="mt-4">
            <div
              className="border-2 border-dashed border-muted-foreground/25 rounded-2xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">
                点击选择 JSON 文件
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                仅支持本应用导出的 .json 格式歌单文件
              </p>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".json"
                onChange={handleFileImport}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DrawerFooter className="px-5 pt-2 pb-8">
          {activeTab === "link" && (
            <div className="mt-2 w-full space-y-2">
              {phase === "error" && (
                <Button
                  variant="outline"
                  className="h-12 rounded-2xl w-full"
                  onClick={() => setPhase("input")}
                >
                  返回修改链接
                </Button>
              )}
              {(phase === "input" || phase === "error") && (
                <Button
                  className="h-12 rounded-2xl shadow-lg w-full"
                  disabled={!url.trim()}
                  onClick={handleFetch}
                >
                  {phase === "error" ? "重试" : "获取歌单"}
                </Button>
              )}
              {phase === "loading" && (
                <Button className="h-12 rounded-2xl w-full" disabled>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  获取中...
                </Button>
              )}
              {phase === "preview" && (
                <>
                  <Button
                    className="h-12 rounded-2xl shadow-lg w-full"
                    onClick={handleUrlImport}
                  >
                    确认导入
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-12 rounded-2xl w-full"
                    onClick={() => setPhase("input")}
                  >
                    返回
                  </Button>
                </>
              )}
              {phase === "importing" && (
                <Button className="h-12 rounded-2xl w-full" disabled>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  导入中...
                </Button>
              )}
            </div>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
