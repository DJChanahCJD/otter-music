import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MusicCover } from "@/components/MusicCover";
import { getArtistAlbums } from "@/lib/netease/netease-api";
import { ArtistAlbum } from "@/lib/netease/netease-raw-types";
import { format } from "date-fns";

interface ArtistAlbumSheetProps {
  artistId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  artistName?: string;
}

export function ArtistAlbumSheet({
  artistId,
  isOpen,
  onOpenChange,
  artistName,
}: ArtistAlbumSheetProps) {
  const navigate = useNavigate();
  const [albums, setAlbums] = useState<ArtistAlbum[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (isOpen && artistId && !hasLoaded) {
      const fetchAlbums = async () => {
        setLoading(true);
        try {
          const res = await getArtistAlbums(artistId, 50);
          if (res?.hotAlbums) setAlbums(res.hotAlbums);
          setHasLoaded(true);
        } catch (error) {
          console.error("Failed to fetch artist albums:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchAlbums();
    }
  }, [isOpen, artistId, hasLoaded]);

  useEffect(() => {
    setHasLoaded(false);
    setAlbums([]);
  }, [artistId]);

  const handleAlbumClick = (albumId: number | string) => {
    onOpenChange(false);
    navigate(`/netease-album/${albumId}`);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col h-full border-none bg-background/95 backdrop-blur-xl"
      >
        <SheetHeader className="px-6 py-6 pb-2 border-none shrink-0 text-left">
          <div className="flex flex-col gap-1">
            <SheetTitle className="text-xl font-bold tracking-tight">
              {artistName ? artistName : "专辑"}
            </SheetTitle>
            {albums.length > 0 && (
              <span className="text-[13px] text-muted-foreground/60 font-medium">
                共 {albums.length} 张专辑
              </span>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 min-h-0 relative mt-2">
          <ScrollArea className="h-full">
            <div className="px-6 pb-12">
              {loading && albums.length === 0 ? (
                /* 精致的骨架屏 */
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-8 animate-pulse pt-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex flex-col gap-3">
                      <div className="aspect-square rounded-xl bg-muted/50" />
                      <div className="space-y-1.5 px-1">
                        <div className="h-3.5 w-3/4 bg-muted/50 rounded-md" />
                        <div className="h-3 w-1/2 bg-muted/30 rounded-md" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : albums.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-8">
                  {albums.map((album) => (
                    <div
                      key={album.id}
                      className="group flex flex-col cursor-pointer transition-all active:scale-95 sm:hover:translate-y-[-2px]"
                      onClick={() => handleAlbumClick(album.id)}
                    >
                      <div className="relative aspect-square rounded-xl overflow-hidden border border-border/30 shadow-sm bg-muted/10">
                        <MusicCover
                          src={album.picUrl}
                          alt={album.name}
                          className="w-full h-full object-cover transition-transform duration-700 sm:group-hover:scale-105"
                        />
                      </div>
                      <div className="flex flex-col gap-0.5 mt-3 px-1">
                        <h3 className="text-[14px] font-medium leading-snug line-clamp-2 text-foreground/90 sm:group-hover:text-primary transition-colors">
                          {album.name}
                        </h3>
                        <p className="text-[11px] text-muted-foreground/60 tracking-wider">
                          {format(album.publishTime, "yyyy-MM-dd")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-32 text-muted-foreground/40 text-sm tracking-widest">
                  暂无专辑数据
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}