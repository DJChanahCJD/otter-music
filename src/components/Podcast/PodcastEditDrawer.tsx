import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { usePodcastStore } from "@/store/podcast-store";
import type { PodcastRssSource } from "@/types/podcast";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";

interface PodcastEditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: PodcastRssSource;
}

export function PodcastEditDrawer({ open, onOpenChange, source }: PodcastEditDrawerProps) {
  const { updateRssSource } = usePodcastStore();
  const [name, setName] = useState(source.name);
  const [rssUrl, setRssUrl] = useState(source.rssUrl);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when source changes or drawer opens
  useEffect(() => {
    if (open) {
      setName(source.name);
      setRssUrl(source.rssUrl);
    }
  }, [open, source]);

  const handleSave = async () => {
    const normalizedName = name.trim();
    const normalizedUrl = rssUrl.trim();

    if (!normalizedName) {
      toast.error("名称不能为空");
      return;
    }
    if (!normalizedUrl) {
      toast.error("RSS 地址不能为空");
      return;
    }

    try {
      new URL(normalizedUrl);
    } catch {
      toast.error("RSS 地址格式不正确");
      return;
    }

    setIsSubmitting(true);
    try {
      updateRssSource(source.id, {
        name: normalizedName,
        rssUrl: normalizedUrl,
      });
      toast.success("更新成功");
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error("更新失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle>编辑播客信息</DrawerTitle>
            <DrawerDescription>修改播客名称或 RSS 订阅地址</DrawerDescription>
          </DrawerHeader>
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="podcast-name">名称</Label>
              <Input
                autoFocus
                id="podcast-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="输入播客名称"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="podcast-url">RSS 地址</Label>
              <Input
                id="podcast-url"
                value={rssUrl}
                onChange={(e) => setRssUrl(e.target.value)}
                placeholder="https://example.com/feed.xml"
              />
            </div>
          </div>
          <DrawerFooter>
            <Button onClick={handleSave} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
