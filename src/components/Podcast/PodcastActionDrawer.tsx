import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { usePodcastStore } from "@/store/podcast-store";
import type { PodcastRssSource } from "@/types/podcast";
import toast from "react-hot-toast";
import { Copy, Edit, Trash2, Podcast } from "lucide-react";
import { cn } from "@/lib/utils";
import { MusicCover } from "@/components/MusicCover";
import { ReactNode } from "react";

interface PodcastActionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: PodcastRssSource;
  onEdit: () => void;
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
    <Icon className="mr-2 h-4 w-4" /> {children}
  </Button>
);

export function PodcastActionDrawer({
  open,
  onOpenChange,
  source,
  onEdit,
}: PodcastActionDrawerProps) {
  const { removeRssSource } = usePodcastStore();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(source.rssUrl);
      toast.success("RSS 链接已复制");
      onOpenChange(false);
    } catch {
      toast.error("复制失败");
    }
  };

  const handleUnsubscribe = () => {
    if (confirm(`确定要取消订阅 "${source.name}" 吗？`)) {
      removeRssSource(source.id);
      toast.success("已取消订阅");
      onOpenChange(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerTitle className="sr-only">{source.name}</DrawerTitle>
        
        {/* Header Section */}
        <div className="flex items-center gap-4 px-6 py-4">
          <MusicCover
            src={source.coverUrl}
            alt={source.name}
            className="h-16 w-16 rounded-lg shadow-md"
            iconClassName="h-8 w-8"
            fallbackIcon={<Podcast className="h-8 w-8 text-muted-foreground/50" />}
          />
          <div className="min-w-0 flex-1">
            <div className="font-bold line-clamp-2 text-lg">{source.name}</div>
            <div className="text-sm text-muted-foreground truncate">
              {source.description || source.rssUrl}
            </div>
          </div>
        </div>

        {/* Actions Section */}
        <div className="p-4 flex flex-col gap-2">
          <ActionButton
            icon={Edit}
            onClick={() => {
              onOpenChange(false);
              onEdit();
            }}
          >
            编辑
          </ActionButton>

          <ActionButton
            icon={Copy}
            onClick={handleCopy}
          >
            复制 RSS 链接
          </ActionButton>

          <ActionButton
            icon={Trash2}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleUnsubscribe}
          >
            取消订阅
          </ActionButton>
        </div>

        <DrawerClose asChild>
          <Button variant="outline" className="mx-4 mb-4">
            取消
          </Button>
        </DrawerClose>
      </DrawerContent>
    </Drawer>
  );
}
