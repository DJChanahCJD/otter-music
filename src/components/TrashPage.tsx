"use client";

import { PageLayout } from "@/components/PageLayout";
import { useMusicStore } from "@/store/music-store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCcw, Music, ListMusic, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";
import { format } from "date-fns";

// 统一的列表项组件
function DeletedItem({ 
  icon: Icon, title, subtitle, date, onRestore 
}: { 
  icon: React.ElementType, title: string, subtitle: string, date?: number, onRestore: () => void 
}) {
  return (
    <div className="group flex items-center p-3 rounded-xl hover:bg-muted/40 transition-all">
      <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center mr-3 shrink-0 text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0 mr-4">
        <div className="font-medium truncate text-[14px]">{title}</div>
        <div className="text-[12px] text-muted-foreground/80 truncate">{subtitle}</div>
      </div>
      <div className="text-[12px] text-muted-foreground/50 mr-4 hidden sm:block tracking-wide">
        {date ? format(date, "yyyy-MM-dd HH:mm") : "-"}
      </div>
      <Button 
        variant="ghost" 
        size="icon" 
        className="text-muted-foreground/60 hover:text-primary hover:bg-muted transition-colors"
        onClick={() => {
          onRestore();
        }}
        title="恢复"
      >
        <RefreshCcw className="h-4 w-4" />
      </Button>
    </div>
  );
}

// 统一的空状态组件
function EmptyState({ icon: Icon, text }: { icon: React.ElementType, text: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50 py-16">
      <Icon className="h-12 w-12 mb-3 stroke-[1.5]" />
      <p className="text-[13px]">{text}</p>
    </div>
  );
}

export function TrashPage() {
  const { favorites, playlists, restoreFromFavorites, restorePlaylist } = useMusicStore();
  
  const deletedTracks = favorites.filter((t) => t.is_deleted);
  const deletedPlaylists = playlists.filter((p) => p.is_deleted);

  return (
    <PageLayout title="回收站">
      <div className="flex-1 flex flex-col overflow-hidden max-w-4xl mx-auto w-full">
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 text-muted-foreground/80 text-[13px]">
            <Info className="h-4 w-4" />
            <span>内容将保留 7 天，逾期后将永久移除。</span>
          </div>
        </div>
        
        <Tabs defaultValue="tracks" className="flex-1 flex flex-col overflow-hidden px-4 pb-4">
          <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted/30 rounded-lg p-1">
            <TabsTrigger value="tracks" className="rounded-md">我的喜欢 ({deletedTracks.length})</TabsTrigger>
            <TabsTrigger value="playlists" className="rounded-md">我的歌单 ({deletedPlaylists.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="tracks" className="flex-1 overflow-y-auto mt-0 outline-none">
            {deletedTracks.length === 0 ? (
              <EmptyState icon={Music} text="暂无删除的歌曲" />
            ) : (
              <div className="space-y-0.5 pb-4">
                {deletedTracks.map((track) => (
                  <DeletedItem 
                    key={track.id}
                    icon={Music}
                    title={track.name}
                    subtitle={track.artist?.join(", ") || "未知歌手"}
                    date={track.update_time}
                    onRestore={() => {
                      restoreFromFavorites(track.id);
                      toast.success("已恢复至「我的喜欢」");
                    }}
                  />
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="playlists" className="flex-1 overflow-y-auto mt-0 outline-none">
            {deletedPlaylists.length === 0 ? (
              <EmptyState icon={ListMusic} text="暂无删除的歌单" />
            ) : (
              <div className="space-y-0.5 pb-4">
                {deletedPlaylists.map((playlist) => (
                  <DeletedItem 
                    key={playlist.id}
                    icon={ListMusic}
                    title={playlist.name}
                    subtitle={`${playlist.tracks.length} 首歌曲`}
                    date={playlist.update_time}
                    onRestore={() => {
                      restorePlaylist(playlist.id);
                      toast.success("歌单已恢复");
                    }}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
}