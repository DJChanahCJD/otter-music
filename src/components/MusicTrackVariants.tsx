import { cn } from "@/lib/utils";
import { downloadMusicTrack } from "@/lib/utils/download";
import { useMusicStore } from "@/store/music-store";
import { MusicTrack, sourceBadgeStyles, sourceLabels } from "@/types/music";
import { Layers, Play } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useShallow } from "zustand/react/shallow";
import { AddToPlaylistDialog } from "./AddToPlaylistDialog";
import { MusicTrackMobileMenu } from "./MusicTrackMobileMenu";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";


interface MusicTrackVariantsProps {
  variants: MusicTrack[];
}

export function MusicTrackVariants({ variants }: MusicTrackVariantsProps) {
  const { 
    addToFavorites, 
    removeFromFavorites, 
    isFavorite, 
    addToQueue, 
    playNext
  } = useMusicStore(
    useShallow((state) => ({
      addToFavorites: state.addToFavorites,
      removeFromFavorites: state.removeFromFavorites,
      isFavorite: state.isFavorite,
      addToQueue: state.addToQueue,
      playNext: state.playNext
    }))
  );

  const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = useState(false);
  const [activeTrack, setActiveTrack] = useState<MusicTrack | null>(null);
  const [mobileMenuOpenId, setMobileMenuOpenId] = useState<string | null>(null);

  if (!variants || variants.length === 0) return null;

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Badge 
            variant="secondary" 
            className="shrink-0 text-[10px] px-1 py-0 h-4 leading-none font-normal cursor-pointer hover:bg-secondary/80 gap-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            <Layers className="h-2.5 w-2.5" />
            +{variants.length}
          </Badge>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start" onClick={(e) => e.stopPropagation()}>
          <div className="p-2 bg-muted/50 border-b text-xs font-medium text-muted-foreground">
            更多版本 ({variants.length})
          </div>
          <div className="max-h-[300px] overflow-y-auto p-1">
            {variants.map((variant) => (
              <div 
                key={`${variant.source}-${variant.id}`}
                className="flex items-center gap-2 p-2 hover:bg-secondary/30 rounded-sm group"
              >
                <Badge 
                  variant="outline" 
                  className={cn(
                    "shrink-0 text-[10px] px-1 py-0 h-4 leading-none font-normal border",
                    sourceBadgeStyles[variant.source] || sourceBadgeStyles.default
                  )}
                >
                  {sourceLabels[variant.source] || variant.source}
                </Badge>
                <div className="flex-1 min-w-0 flex flex-col">
                   <span className="text-sm font-medium truncate" title={variant.name}>{variant.name}</span>
                   <span className="text-xs text-muted-foreground truncate" title={variant.artist.join(" / ") + (variant.album ? ` • ${variant.album}` : "")}>
                     {variant.artist.join(" / ")}
                     {variant.album && ` • ${variant.album}`}
                   </span>
                </div>
                <div className="flex items-center gap-1">
                   <Button
                     size="icon"
                     variant="ghost"
                     className="h-6 w-6"
                     onClick={() => {
                       playNext(variant);
                     }}
                     title="播放"
                   >
                     <Play className="h-3 w-3" />
                   </Button>
                   <MusicTrackMobileMenu
                      track={variant}
                      open={mobileMenuOpenId === `${variant.source}-${variant.id}`}
                      onOpenChange={(open) => setMobileMenuOpenId(open ? `${variant.source}-${variant.id}` : null)}
                      onAddToQueue={() => {
                          addToQueue(variant);
                          toast.success("已加入播放列表");
                      }}
                      onAddToPlaylistTrigger={() => {
                          setActiveTrack(variant);
                          setIsAddToPlaylistOpen(true);
                      }}
                      onDownload={() => downloadMusicTrack(variant)}
                      onToggleLike={() => {
                          if (isFavorite(variant.id)) {
                              removeFromFavorites(variant.id);
                              toast.success("已取消喜欢");
                          } else {
                              addToFavorites(variant);
                              toast.success("已喜欢");
                          }
                      }}
                      isFavorite={isFavorite(variant.id)}
                      triggerClassName="h-6 w-6"
                   />
                </div>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <AddToPlaylistDialog 
        open={isAddToPlaylistOpen} 
        onOpenChange={setIsAddToPlaylistOpen} 
        track={activeTrack || undefined} 
      />
    </>
  );
}
