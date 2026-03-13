import { MarketPlaylist } from "@/lib/netease/netease-types";
import { MusicCover } from "@/components/MusicCover";

interface PlaylistGridProps {
  list: MarketPlaylist[];
  onClick: (id: string) => void;
}

export const PlaylistGrid = ({ list, onClick }: PlaylistGridProps) => (
  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-x-3 gap-y-4">
    {list.map((item) => (
      <div 
        key={item.id} 
        className="group flex flex-col gap-2.5 transition-all hover:translate-y-[-4px]" 
        onClick={() => onClick(item.id)}
      >
        <div className="relative aspect-square rounded-md overflow-hidden shadow-md ring-1 ring-black/5 hover:shadow-xl transition-shadow cursor-pointer">
          <MusicCover 
            src={item.coverUrl} 
            alt={item.name} 
            className="transition-transform duration-500 group-hover:scale-110" 
          />
        </div>
        <div className="px-0.5">
          <h3 className="text-[13px] font-medium leading-snug line-clamp-2 text-foreground/80 group-hover:text-primary transition-colors cursor-pointer">
            {item.name}
          </h3>
        </div>
      </div>
    ))}
  </div>
);
