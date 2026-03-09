import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { usePodcastStore } from "@/store/podcast-store";
import type { PodcastRssSource } from "@/types/podcast";
import toast from "react-hot-toast";
import { Copy, Edit, Trash2 } from "lucide-react";

interface PodcastActionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: PodcastRssSource;
  onEdit: () => void;
}

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
    // 简单的确认逻辑，实际项目中可以使用 Dialog 二次确认
    if (confirm(`确定要取消订阅 "${source.name}" 吗？`)) {
      removeRssSource(source.id);
      toast.success("已取消订阅");
      onOpenChange(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle className="truncate text-center">{source.name}</DrawerTitle>
            <DrawerDescription className="text-center">管理订阅</DrawerDescription>
          </DrawerHeader>
          <div className="p-4 flex flex-col gap-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-2 h-12"
              onClick={() => {
                onOpenChange(false);
                onEdit();
              }}
            >
              <Edit className="w-4 h-4" />
              编辑信息
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-2 h-12"
              onClick={handleCopy}
            >
              <Copy className="w-4 h-4" />
              复制 RSS 链接
            </Button>
            <Button
              variant="destructive"
              className="w-full justify-start gap-2 h-12"
              onClick={handleUnsubscribe}
            >
              <Trash2 className="w-4 h-4" />
              取消订阅
            </Button>
          </div>
          <DrawerFooter className="pt-0">
            <DrawerClose asChild>
              <Button variant="ghost">取消</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
