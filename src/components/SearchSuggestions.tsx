import { cn } from "@/lib/utils";
import { Music, Disc, ListMusic, User, ChevronUp } from "lucide-react";
import { SearchSuggestionItem } from "@/types/music";

const TYPE_MAP = {
  playlist: { icon: ListMusic, label: "歌单", color: "text-blue-500" },
  artist:   { icon: User,      label: "歌手", color: "text-purple-500" },
  album:    { icon: Disc,      label: "专辑", color: "text-orange-500" },
  song:     { icon: Music,     label: "单曲", color: "" },
};

export function SearchSuggestions({ suggestions, onSelect, activeIndex, onClose }: {
  suggestions: SearchSuggestionItem[];
  onSelect: (item: SearchSuggestionItem) => void;
  activeIndex: number;
  onClose: () => void;
}) {
  if (!suggestions?.length) return null;

  return (
    <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover shadow-md animate-in fade-in-0 zoom-in-95">
      <div className="p-1">
        {suggestions.map((item, i) => {
          const { icon: Icon, label, color } = TYPE_MAP[item.type as keyof typeof TYPE_MAP] || TYPE_MAP.song;
          return (
            <div
              key={`${item.type}-${i}`}
              className={cn(
                "flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                i === activeIndex && "bg-accent text-accent-foreground"
              )}
              onClick={() => onSelect(item)}
              onMouseDown={e => e.preventDefault()}
            >
              <Icon className={cn("mr-2 h-4 w-4 opacity-50", color)} />
              <span className="flex-1 truncate">{item.text}</span>
              <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground/50">{label}</span>
            </div>
          );
        })}
      </div>
      <button 
        className="flex w-full justify-center border-t p-1 text-muted-foreground hover:bg-accent transition-colors"
        onClick={onClose}
      >
        <ChevronUp className="h-4 w-4" />
      </button>
    </div>
  );
}