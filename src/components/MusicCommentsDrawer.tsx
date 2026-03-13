import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MusicTrack } from "@/types/music";
import { useEffect, useState } from "react";
import { getHotComments } from "@/lib/netease/netease-api";
import { NeteaseComment } from "@/lib/netease/netease-raw-types";
import { format } from "date-fns";
import { MessageSquareQuote } from "lucide-react";

interface MusicCommentsDrawerProps {
  track: MusicTrack | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MusicCommentsDrawer({ track, open, onOpenChange }: MusicCommentsDrawerProps) {
  const [comments, setComments] = useState<NeteaseComment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !track) return;
    
    let isMounted = true;
    
    // 将 setState 放入内部异步函数中，避免同步触发渲染
    const fetchComments = async () => {
      setLoading(true);
      try {
        const res = await getHotComments(track.id, 30);
        if (isMounted) {
          setComments(res?.hotComments || []);
        }
      } catch (err) {
        console.error("Fetch comments error:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchComments();

    return () => { isMounted = false; };
  }, [open, track]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="h-[85vh] flex flex-col p-0 gap-0 rounded-t-3xl border-none bg-background/95 backdrop-blur-xl outline-none"
      >
        <DrawerHeader className="px-6 py-5 pb-2 border-none text-left">
          <DrawerTitle className="text-lg font-semibold tracking-tight">{track?.name ? `${track.name} · 评论` : "评论"}</DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 min-h-0 w-full">
          <ScrollArea className="h-full px-6">
            <div className="flex flex-col pb-12">
              {loading ? (
                <div className="flex flex-col gap-6 pt-4 animate-pulse">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="space-y-3">
                      <div className="h-3 w-20 bg-muted/60 rounded-full" />
                      <div className="h-4 w-full bg-muted/60 rounded-md" />
                      <div className="h-4 w-2/3 bg-muted/60 rounded-md" />
                    </div>
                  ))}
                </div>
              ) : comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-muted-foreground/40">
                  <MessageSquareQuote className="w-10 h-10 mb-4 opacity-20" strokeWidth={1.2} />
                  <p className="text-sm tracking-widest font-light">暂无评论</p>
                </div>
              ) : (
                <div className="flex flex-col">
                  {comments.map((comment) => (
                    <div 
                      key={comment.commentId} 
                      className="flex flex-col gap-2 py-3 px-0.5 border-b border-border/20 last:border-0 group"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-[13px] font-medium text-foreground/60 group-hover:text-foreground/80 transition-colors">
                          {comment.user.nickname}
                        </span>
                        <span className="text-[11px] text-muted-foreground/40 font-light tracking-wide">
                          {format(comment.time, "yyyy.MM.dd")}
                        </span>
                      </div>
                      
                      <p className="text-[15px] leading-relaxed text-foreground/90 whitespace-pre-wrap wrap-break-word font-normal">
                        {comment.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DrawerContent>
    </Drawer>
  );
}