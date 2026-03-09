import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { searchPodcast } from "@/lib/api";
import { usePodcastStore } from "@/store/podcast-store";
import type { SearchPodcastItem } from "@/types/podcast";
import { Loader2, Search, Radio, Link2 } from "lucide-react";
import toast from "react-hot-toast";

type AddMode = "search" | "rss";

interface PodcastAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PodcastAddDialog({ open, onOpenChange }: PodcastAddDialogProps) {
  const { rssSources, addRssSource } = usePodcastStore();
  const [mode, setMode] = useState<AddMode>("search");

  const [keyword, setKeyword] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchItems, setSearchItems] = useState<SearchPodcastItem[]>([]);
  const [rssName, setRssName] = useState("");
  const [rssUrl, setRssUrl] = useState("");
  const [isSubmittingRss, setIsSubmittingRss] = useState(false);

  const activeSources = useMemo(
    () => rssSources.filter((item) => !item.is_deleted),
    [rssSources],
  );

  const normalizedKeyword = keyword.trim();
  const normalizedRssUrl = rssUrl.trim();
  const normalizedRssName = rssName.trim();

  const resetDialogState = () => {
    setMode("search");
    setKeyword("");
    setSearchItems([]);
    setRssName("");
    setRssUrl("");
    setIsSearching(false);
    setIsSubmittingRss(false);
  };

  const handleSearch = async () => {
    if (!normalizedKeyword) {
      toast("请输入搜索关键词");
      return;
    }

    try {
      setIsSearching(true);
      const result = await searchPodcast(normalizedKeyword);
      setSearchItems(result);
      if (result.length === 0) toast("未找到相关播客");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "搜索失败");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddSearchItem = (item: SearchPodcastItem) => {
    if (!item.rssUrl) {
      toast.error("该播客缺少 RSS 地址");
      return;
    }
    if (activeSources.some((source) => source.rssUrl === item.rssUrl)) {
      toast("已在订阅列表");
      return;
    }
    // Pass cover and description to store
    addRssSource(
      item.title, 
      item.rssUrl, 
      item.cover || undefined, 
      item.description || undefined
    );
    toast.success("订阅成功");
  };

  const handleAddRss = async () => {
    if (!normalizedRssUrl) {
      toast("请输入 RSS 地址");
      return;
    }
    let url: URL;
    try {
      url = new URL(normalizedRssUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        toast.error("RSS 地址需为 http/https");
        return;
      }
    } catch {
      toast.error("RSS 地址格式不正确");
      return;
    }
    const existed = activeSources.some((source) => source.rssUrl === normalizedRssUrl);
    if (existed) {
      toast("该 RSS 已订阅");
      return;
    }
    setIsSubmittingRss(true);
    try {
      const displayName = normalizedRssName || url.hostname;
      // For manual RSS, we don't have cover/desc yet. 
      // Ideally we should fetch it, but for now passing undefined.
      addRssSource(displayName, normalizedRssUrl);
      toast.success("订阅成功");
      // onOpenChange(false);
      // resetDialogState();
    } finally {
      setIsSubmittingRss(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        onOpenChange(val);
        if (!val) resetDialogState();
      }}
    >
      <DialogContent className="p-6 sm:max-w-[380px]">
        <DialogHeader className="mb-1">
          <DialogTitle className="text-center text-lg">添加播客订阅</DialogTitle>
          <DialogDescription className="text-center text-xs">
            {mode === "search" ? "先搜索，再一键订阅" : "手动填写 RSS 地址订阅"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {mode === "search" ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="搜索播客名称..."
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void handleSearch()}
                  />
                </div>
                <Button
                  onClick={() => void handleSearch()}
                  disabled={isSearching}
                  className="min-w-[72px]"
                >
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "搜索"}
                </Button>
              </div>
              <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {searchItems.map((item) => {
                  const existed = !item.rssUrl || activeSources.some((s) => s.rssUrl === item.rssUrl);
                  return (
                    <div
                      key={`${item.source}-${item.id}-${item.rssUrl}`}
                      className="flex items-center gap-3 rounded-lg border p-2.5"
                    >
                      <div className="w-11 h-11 rounded-md border bg-muted/40 overflow-hidden shrink-0">
                        {item.cover ? (
                          <img src={item.cover} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Radio className="w-4 h-4 text-muted-foreground/60" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium line-clamp-1">{item.title}</p>
                        <p className="text-[11px] text-muted-foreground line-clamp-1">
                          {item.author || "未知作者"}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={existed ? "secondary" : "default"}
                        disabled={existed}
                        className="h-7 rounded-full px-3 text-xs"
                        onClick={() => handleAddSearchItem(item)}
                      >
                        {existed ? "已订阅" : "订阅"}
                      </Button>
                    </div>
                  );
                })}
                {!isSearching && searchItems.length === 0 && (
                  <div className="py-8 text-center text-xs text-muted-foreground/70">
                    输入关键词搜索可订阅的播客
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Input
                placeholder="播客名称（可选）"
                value={rssName}
                onChange={(e) => setRssName(e.target.value)}
              />
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="https://example.com/feed.xml"
                  value={rssUrl}
                  onChange={(e) => setRssUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void handleAddRss()}
                />
              </div>
              <Button
                className="w-full rounded-full"
                onClick={() => void handleAddRss()}
                disabled={isSubmittingRss}
              >
                {isSubmittingRss && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                验证并订阅
              </Button>
            </div>
          )}

          <Button
            variant="link"
            className="h-auto px-0 text-xs text-muted-foreground/70 hover:text-muted-foreground w-full"
            onClick={() => setMode((prev) => (prev === "search" ? "rss" : "search"))}
          >
            {mode === "search" ? "改用手动 RSS 订阅" : "返回搜索订阅"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
