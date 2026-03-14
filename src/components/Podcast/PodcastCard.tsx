import { useState } from "react";
import { MusicCover } from "@/components/MusicCover";
import type { PodcastRssSource } from "@/types/podcast";
import { Button } from "@/components/ui/button";
import { PodcastActionDrawer } from "./PodcastActionDrawer";
import { PodcastEditDrawer } from "./PodcastEditDrawer";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Podcast } from "lucide-react";

interface PodcastCardProps {
  rssSource: PodcastRssSource;
}

export function PodcastCard({ rssSource }: PodcastCardProps) {
  const navigate = useNavigate();
  const [actionOpen, setActionOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const handleCardClick = () => {
    navigate(`/podcast/${rssSource.id}`);
  };

  return (
    <>
      <div
        className="group flex flex-col gap-2.5 transition-all hover:translate-y-[-4px] relative"
        onClick={handleCardClick}
      >
        <div className="relative aspect-square rounded-md overflow-hidden shadow-md ring-1 ring-black/5 hover:shadow-xl transition-shadow cursor-pointer">
          <MusicCover
            src={rssSource.coverUrl || ""}
            alt={rssSource.name}
            className="transition-transform duration-500 group-hover:scale-110"
            fallbackIcon={<Podcast className="h-8 w-8 text-muted-foreground/50" />}
          />
          <div 
            className="absolute top-1 right-1 z-10 transition-opacity duration-200"
            onClick={(e) => e.stopPropagation()}
          >
             <Button
               variant="ghost"
               size="icon"
               className="h-6 w-6 rounded-md bg-black/20 hover:bg-black/40 text-white backdrop-blur-sm"
               onClick={() => setActionOpen(true)}
             >
               <MoreHorizontal className="h-4 w-4" />
             </Button>
          </div>
        </div>
        <div className="px-0.5">
          <h3 className="text-[13px] font-medium leading-snug line-clamp-2 text-foreground/80 group-hover:text-primary transition-colors cursor-pointer">
            {rssSource.name}
          </h3>
        </div>
      </div>

      <PodcastActionDrawer
        open={actionOpen}
        onOpenChange={setActionOpen}
        rssSource={rssSource}
        onEdit={() => setEditOpen(true)}
      />

      <PodcastEditDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        source={rssSource}
      />
    </>
  );
}
