import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import {
  Download,
  Heart,
  ListPlus,
  MoreVertical,
  Trash2,
  CornerDownRight,
  User,
  Disc,
  MessageSquareQuote,
  Link2,
  Check,
  Folder,
} from "lucide-react";
import { ReactNode, useState, useMemo } from "react";
import { MusicCover } from "./MusicCover";
import { useMusicCover } from "@/hooks/useMusicCover";
import {
  MusicTrack,
  SearchIntent,
  sourceLabels,
  searchOptions,
} from "@/types/music";
import { useNavigate, useLocation } from "react-router-dom";
import { useMusicStore } from "@/store/music-store";
import {
  MusicProviderFactory,
  resolveFallbackSearchSource,
} from "@/lib/music-provider";
import { IS_NATIVE } from "@/lib/api/config";
import { MusicCommentsDrawer } from "./MusicCommentsDrawer";
import { handleAutoMatch } from "@/lib/audio-match";
import {
  EXCLUDED_FOR_SEARCH,
  getAllVisibleSourcesForSwitch,
} from "@/hooks/use-aggregated-sources";
import { parseAlistTrackId } from "@/lib/alist/alist-api";
import { resolveQqAlbumMid } from "@/lib/qqmusic/qqmusic-api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildBilibiliSeriesAlbumId,
  buildBilibiliMultiPAlbumId,
  parseBilibiliTrackId,
} from "@otter-music/shared";
import { logger } from "@/lib/logger";

interface MusicTrackMobileMenuProps {
  track: MusicTrack;
  playlistId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToNextPlay?: () => void;
  onAddToPlaylist: () => void;
  onDownload?: () => void;
  onToggleLike?: () => void;
  isFavorite?: boolean;
  onRemove?: () => void;
  removeLabel?: string;
  confirmRemove?: boolean;
  customActions?: ReactNode;
  triggerClassName?: string;
  onNavigate?: () => void;
}

const ActionButton = ({
  onClick,
  icon: Icon,
  children,
  className,
}: {
  onClick?: () => void;
  icon: React.ElementType;
  children: ReactNode;
  className?: string;
}) => (
  <Button
    variant="ghost"
    className={cn("justify-start w-full", className)}
    onClick={onClick}
  >
    <Icon className="mr-2 h-4 w-4 shrink-0" />
    <span className="truncate">{children}</span>
  </Button>
);

export function MusicTrackMobileMenu({
  track,
  open,
  onOpenChange,
  onAddToNextPlay,
  onAddToPlaylist,
  onDownload,
  onToggleLike,
  isFavorite,
  onRemove,
  removeLabel = "删除",
  confirmRemove = true,
  customActions,
  triggerClassName,
  onNavigate,
}: MusicTrackMobileMenuProps) {
  const coverUrl = useMusicCover(track, open);
  const navigate = useNavigate();
  const location = useLocation();
  const [showArtistSelection, setShowArtistSelection] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showSourceSwitch, setShowSourceSwitch] = useState(false);

  // Zustand Store
  const setSearchQuery = useMusicStore((s) => s.setSearchQuery);
  const setSearchResults = useMusicStore((s) => s.setSearchResults);
  const setSearchIntent = useMusicStore((s) => s.setSearchIntent);
  const setSearchSource = useMusicStore((s) => s.setSearchSource);

  const provider = MusicProviderFactory.getProvider(track.source);

  // 音源切换可用性：仅本地/播客/Alist 这类无搜索能力的音源不可换源
  const canSwitchSource = useMemo(
    () => !EXCLUDED_FOR_SEARCH.includes(track.source),
    [track.source]
  );

  const handleSearch = async (
    keyword: string,
    type: SearchIntent["type"] = "",
    artist?: string,
    id?: string
  ) => {
    // 如果支持详情查询，但没有 ID，尝试获取详情
    if (
      (provider.getArtistDetail || provider.getAlbumDetail) &&
      (!id || id === "0") &&
      provider.getSongDetail
    ) {
      try {
        const detail = await provider.getSongDetail(track.id);
        if (detail) {
          if (type === "artist" && detail.ar?.[0]?.id) {
            id = String(detail.ar[0].id);
          } else if (type === "album" && detail.al?.id) {
            id = String(detail.al.id);
          }

          // B站音源：歌手取 UP 的 mid
          if (type === "artist" && track.source === "bilibili") {
            if (track.artist_ids?.[0]) {
              id = track.artist_ids[0];
            } else if (detail.owner?.mid) {
              id = String(detail.owner.mid);
            }
          }

          // B站音源：从详情中提取合集/分P 信息
          if (type === "album" && track.source === "bilibili") {
            // 优先使用已有的 album_id
            if (track.album_id?.startsWith("bilibili_")) {
              id = track.album_id;
            } else if (detail.ugc_season?.id) {
              // 从 ugc_season 构建专辑 ID
              const ownerMid = detail.owner?.mid;
              id = buildBilibiliSeriesAlbumId(detail.ugc_season.id, ownerMid);
            } else if (detail.pages && detail.pages.length > 1) {
              // 多分P 视频，构建分P 专辑 ID
              const parsed = parseBilibiliTrackId(track.id);
              if (parsed?.bvid) {
                id = buildBilibiliMultiPAlbumId(parsed.bvid);
              }
            }
          }
        }
      } catch (e) {
        logger.error("MusicTrackMobileMenu", "Failed to get song detail", e);
      }
    }

    if (
      (provider.getArtistDetail || provider.getAlbumDetail) &&
      id &&
      id !== "0"
    ) {
      if (type === "artist" && provider.getArtistDetail) {
        // B站音源：仅原生端支持 UP 主页，Web 端走搜索回退
        if (track.source === "bilibili" && !IS_NATIVE) {
          // fallthrough to search
        } else {
          const targetPath =
            track.source === "bilibili"
              ? `/bilibili-artist/${id}`
              : `/netease-artist/${id}`;
          navigate(targetPath);
          onOpenChange(false);
          setShowArtistSelection(false);
          onNavigate?.();
          return;
        }
      }
      if (type === "album" && provider.getAlbumDetail) {
        const isBilibiliAlbum =
          track.source === "bilibili" &&
          (id?.startsWith("bilibili_S_") ||
            id?.startsWith("bilibili_O_") ||
            id?.startsWith("bilibili_V_"));
        const isQqAlbum = track.source === "qq";
        const targetPath = isBilibiliAlbum
          ? `/bilibili-collection/${id}`
          : isQqAlbum
            ? `/qq-album/${id}`
            : `/netease-album/${id}`;
        // 带上专辑名与歌手，供网易云专辑页加载失败时回退到 QQ 音乐
        navigate(
          targetPath,
          isBilibiliAlbum || isQqAlbum
            ? undefined
            : { state: { albumFallback: { name: keyword, artist } } }
        );
        onOpenChange(false);
        onNavigate?.();
        return;
      }
    }

    // 网易云专辑跳转失败（缺专辑 ID 或详情获取异常）、
    // 或 QQ 歌曲缺少专辑 mid（旧数据）：用专辑名解析 albummid 后进 QQ 专辑页；
    // 解析不到时继续走默认的单音源搜索
    if (
      type === "album" &&
      (track.source === "netease" ||
        track.source === "_netease" ||
        track.source === "qq")
    ) {
      const qqAlbumMid = await resolveQqAlbumMid(keyword, artist);
      if (qqAlbumMid) {
        navigate(`/qq-album/${qqAlbumMid}`);
        onOpenChange(false);
        onNavigate?.();
        return;
      }
    }

    let searchKeyword = keyword;
    if (type === "album" && artist) {
      searchKeyword = `${artist} ${keyword}`;
    }

    setSearchQuery(searchKeyword);
    if (type) {
      setSearchIntent({
        type: type as SearchIntent["type"],
        artist,
        id,
        name: keyword,
      });
    } else {
      setSearchIntent(null);
    }
    // 回退搜索锁定单音源，避免聚合搜索等待全部音源返回
    setSearchSource(resolveFallbackSearchSource(track.source));
    setSearchResults([]);
    navigate("/search");
    onOpenChange(false);
    setShowArtistSelection(false);
    onNavigate?.();
  };

  return (
    <div>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className={cn("h-8 w-8", triggerClassName)}
            onClick={(e) => e.stopPropagation()}
            title="更多"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DrawerTrigger>
        <DrawerContent onClick={(e) => e.stopPropagation()}>
          <DrawerTitle className="sr-only">歌曲菜单</DrawerTitle>
          <div className="flex items-center gap-4 px-6 py-4">
            <MusicCover
              src={coverUrl}
              alt={track.name}
              className="h-16 w-16 rounded-lg shadow-md"
              iconClassName="h-8 w-8"
            />
            <div className="min-w-0">
              <div className="font-bold line-clamp-2 text-lg">{track.name}</div>
              <div className="text-sm text-muted-foreground truncate">
                {track.artist.join(" / ")}
                {track.album && ` • ${track.album}`}
              </div>
            </div>
          </div>
          <div className="p-4 flex flex-col gap-2">
            {onToggleLike && (
              <ActionButton
                icon={Heart}
                onClick={() => {
                  onToggleLike();
                  onOpenChange(false);
                }}
                className={
                  isFavorite ? "text-primary [&>svg]:fill-primary" : ""
                }
              >
                {isFavorite ? "取消喜欢" : "喜欢"}
              </ActionButton>
            )}
            {onDownload && (
              <ActionButton
                icon={Download}
                onClick={() => {
                  onDownload();
                  onOpenChange(false);
                }}
              >
                下载
              </ActionButton>
            )}
            {onAddToPlaylist && (
              <ActionButton
                icon={ListPlus}
                onClick={() => {
                  onAddToPlaylist();
                  onOpenChange(false);
                }}
              >
                添加到歌单
              </ActionButton>
            )}
            {onAddToNextPlay && (
              <ActionButton
                icon={CornerDownRight}
                onClick={() => {
                  onAddToNextPlay();
                  onOpenChange(false);
                }}
              >
                下一首播放
              </ActionButton>
            )}

            {/* 如果支持评论，显示评论入口 */}
            {provider.getComments && (
              <ActionButton
                icon={MessageSquareQuote}
                onClick={() => {
                  onOpenChange(false);
                  setShowComments(true);
                }}
              >
                评论
              </ActionButton>
            )}

            {/* 除播客/Alist 外，有歌手即显示歌手入口 */}
            {track.source !== "podcast" &&
              track.source !== "alist" &&
              track.artist?.length > 0 && (
                <ActionButton
                  icon={User}
                  onClick={() => {
                    if (track.artist.length > 1) {
                      setShowArtistSelection(true);
                    } else {
                      handleSearch(
                        track.artist[0],
                        "artist",
                        undefined,
                        track.artist_ids?.[0]
                      );
                    }
                  }}
                >
                  歌手：{track.artist.join(" / ")}
                </ActionButton>
              )}

            {/* 除播客/Alist 外，有专辑即显示专辑入口 */}
            {track.source !== "podcast" &&
              track.source !== "alist" &&
              track.album && (
                <ActionButton
                  icon={Disc}
                  onClick={() => {
                    handleSearch(
                      track.album!,
                      "album",
                      track.artist[0],
                      track.album_id
                    );
                  }}
                >
                  专辑：{track.album}
                </ActionButton>
              )}

            {/* Alist 音源：专辑入口跳转到所在目录 */}
            {track.source === "alist" && track.album && (
              <ActionButton
                icon={Folder}
                onClick={() => {
                  const parsed = parseAlistTrackId(track.id);
                  if (!parsed) return;
                  onOpenChange(false);
                  onNavigate?.();
                  navigate(
                    `/alist/${parsed.serverId}?path=${encodeURIComponent(
                      track.album
                    )}`
                  );
                }}
              >
                目录：
                {track.album.split("/").filter(Boolean).pop() || track.album}
              </ActionButton>
            )}

            {/* 音源显示：local/podcast/alist 无搜索能力，不可切换 */}
            <Button
              variant="ghost"
              className="justify-start w-full"
              disabled={!canSwitchSource}
              onClick={() => setShowSourceSwitch(true)}
            >
              <Link2 className="mr-2 h-4 w-4 shrink-0" />
              <span className="truncate">
                音源：{sourceLabels[track.source] || track.source}
              </span>
            </Button>

            {onRemove && (
              <ActionButton
                icon={Trash2}
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  onOpenChange(false);
                  if (
                    !confirmRemove ||
                    window.confirm(`确定${removeLabel}《${track.name}》吗？`)
                  ) {
                    onRemove();
                  }
                }}
              >
                {removeLabel}
              </ActionButton>
            )}

            {customActions && (
              <div className="flex flex-col gap-2">{customActions}</div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <Dialog open={showArtistSelection} onOpenChange={setShowArtistSelection}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>选择歌手</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {track.artist.map((artist, index) => (
              <Button
                key={artist}
                variant="ghost"
                className="justify-start w-full"
                onClick={() =>
                  handleSearch(
                    artist,
                    "artist",
                    undefined,
                    track.artist_ids?.[index]
                  )
                }
              >
                <User className="mr-2 h-4 w-4" />
                {artist}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSourceSwitch} onOpenChange={setShowSourceSwitch}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>切换音源</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {getAllVisibleSourcesForSwitch().map((source) => {
              const isCurrent = source === track.source;
              return (
                <Button
                  key={source}
                  variant="ghost"
                  className={cn(
                    "justify-start w-full",
                    isCurrent && "text-primary"
                  )}
                  disabled={isCurrent}
                  onClick={async () => {
                    setShowSourceSwitch(false);
                    onOpenChange(false);
                    // 换源后立即播放：不在队列时插入当前列表，已在队列时定位播放
                    await handleAutoMatch(
                      track,
                      source,
                      location.pathname,
                      undefined,
                      true
                    );
                  }}
                >
                  {isCurrent ? (
                    <Check className="mr-2 h-4 w-4" />
                  ) : (
                    <Link2 className="mr-2 h-4 w-4" />
                  )}
                  {searchOptions[source] || sourceLabels[source] || source}
                </Button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <MusicCommentsDrawer
        track={track}
        open={showComments}
        onOpenChange={setShowComments}
      />
    </div>
  );
}
