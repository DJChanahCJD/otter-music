import { cn } from "@/lib/utils";
import { Music, Disc, ListMusic, User, ChevronUp } from "lucide-react";
import type { SearchSuggestionItem } from "@/types/music";

const TYPE_CONFIG = {
  artist:   { icon: User,      label: "歌手" },
  song:     { icon: Music,     label: "单曲" },
  album:    { icon: Disc,      label: "专辑" },
  playlist: { icon: ListMusic, label: "歌单" },
} as const;

interface SearchSuggestionsProps {
  suggestions: SearchSuggestionItem[];
  onSelect: (item: SearchSuggestionItem) => void;
  activeIndex: number;
  onClose: () => void;
}

export function SearchSuggestions({ suggestions, onSelect, activeIndex, onClose }: SearchSuggestionsProps) {
  if (!suggestions?.length) return null;

  // Group items by type
  const groups = suggestions.reduce((acc, item) => {
    if (!acc[item.type]) acc[item.type] = [];
    acc[item.type].push(item);
    return acc;
  }, {} as Record<string, SearchSuggestionItem[]>);

  // Define display order (matches API return order)
  const displayOrder: (keyof typeof TYPE_CONFIG)[] = ['artist', 'song', 'album', 'playlist'];

  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
      <div className="py-1 max-h-[60vh] overflow-y-auto">
        {displayOrder.map((type) => {
          const items = groups[type];
          if (!items?.length) return null;
          
          const { icon: Icon, label } = TYPE_CONFIG[type];

          return (
            <div key={type}>
              <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground/70">
                {label}
              </div>
              <div>
                {items.map((item) => {
                  const originalIndex = suggestions.indexOf(item);
                  const isActive = originalIndex === activeIndex;

                  return (
                    <button
                      key={`${item.type}-${item.id ?? item.text}`}
                      type="button"
                      onClick={() => onSelect(item)}
                      onMouseDown={(e) => e.preventDefault()} // 防止点击时输入框失焦
                      className={cn(
                        "flex w-full items-center px-3 py-2 text-sm transition-colors text-left",
                        isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 truncate">{item.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      
      <button 
        type="button"
        onClick={onClose}
        className="flex w-full justify-center border-t p-1 text-muted-foreground transition-colors hover:bg-accent"
      >
        <ChevronUp className="h-4 w-4" />
      </button>
    </div>
  );
}