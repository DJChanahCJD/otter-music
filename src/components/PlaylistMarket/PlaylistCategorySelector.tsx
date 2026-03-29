import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { NETEASE_CATS } from "@/lib/netease/netease-cats";
import { cn } from "@/lib/utils";
import { LayoutGrid } from "lucide-react";

interface PlaylistCategorySelectorProps {
  activeCategory: string;
  onSelect: (id: string) => void;
  trigger?: React.ReactNode;
}

export function PlaylistCategorySelector({ activeCategory, onSelect, trigger }: PlaylistCategorySelectorProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (id: string) => {
    onSelect(id);
    setOpen(false);
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-secondary">
            <LayoutGrid className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
      </DrawerTrigger>
      
      <DrawerContent className="max-h-[80vh]">
        <DrawerHeader className="px-6 py-4">
          <DrawerTitle className="text-lg font-semibold tracking-tight">歌单分类</DrawerTitle>
        </DrawerHeader>

        <ScrollArea className="px-6 pb-12 overflow-y-auto">
          <div className="space-y-6">
            {NETEASE_CATS.map((group) => (
              <section key={group.category} className="space-y-3">
                <h4 className="sticky top-0 z-10 py-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 bg-background/95 backdrop-blur-sm">
                  {group.category}
                </h4>
                <div className="grid grid-cols-4 gap-2">
                  {group.filters.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => handleSelect(f.id)}
                      className={cn(
                        "h-10 px-1 rounded-lg text-[13px] transition-all duration-200 border flex items-center justify-center",
                        activeCategory === f.id
                          ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 font-medium scale-[1.02]"
                          : "bg-secondary/40 border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary active:scale-95"
                      )}
                    >
                      <span className="truncate">{f.name}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}