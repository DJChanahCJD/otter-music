import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MusicCover } from "@/components/MusicCover";
import { searchPodcast } from "@/lib/api";
import { usePodcastStore } from "@/store/podcast-store";
import type { SearchPodcastItem } from "@/types/podcast";
import { cn } from "@/lib/utils";
import { Loader2, Radio } from "lucide-react";
import toast from "react-hot-toast";

interface PodcastAddProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PodcastAdd({ open, onOpenChange }: PodcastAddProps) {
  const { rssSources, addRssSource } = usePodcastStore();
  const [mode, setMode] = useState<"search" | "rss">("search");

  // 状态分组
  const [search, setSearch] = useState({
    kw: "",
    items: [] as SearchPodcastItem[],
    loading: false,
    searched: false,
  });
  const [rss, setRss] = useState({ url: "", name: "", loading: false });

  // 已订阅 RSS 集合（O(1) 匹配）
  const activeRssSet = useMemo(
    () => new Set(rssSources.filter((s) => !s.is_deleted).map((s) => s.rssUrl)),
    [rssSources]
  );

  const resetState = () => {
    setMode("search");
    setSearch({ kw: "", items: [], loading: false, searched: false });
    setRss({ url: "", name: "", loading: false });
  };

  const handleSearch = async () => {
    const kw = search.kw.trim();
    if (!kw) return toast("请输入搜索关键词");

    setSearch((s) => ({ ...s, loading: true }));
    try {
      const items = await searchPodcast(kw);
      setSearch((s) => ({ ...s, items, searched: true }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "搜索失败");
    } finally {
      setSearch((s) => ({ ...s, loading: false }));
    }
  };

  const handleAddSearchItem = (item: SearchPodcastItem) => {
    if (!item.rssUrl) return toast.error("该播客缺少 RSS 地址");
    if (activeRssSet.has(item.rssUrl)) return toast("已在订阅列表");

    addRssSource(
      item.title,
      item.rssUrl,
      item.author || undefined,
      item.cover || undefined,
      item.description || undefined
    );
    toast.success("订阅成功");
  };

  const handleAddRss = async () => {
    const urlStr = rss.url.trim();
    if (!urlStr) return toast("请输入 RSS 地址");

    try {
      const url = new URL(urlStr);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      if (activeRssSet.has(urlStr)) return toast("该 RSS 已订阅");

      setRss((r) => ({ ...r, loading: true }));
      addRssSource(rss.name.trim() || url.hostname, urlStr);
      toast.success("订阅成功");
    } catch {
      toast.error("请输入有效的 HTTP/HTTPS RSS 地址");
    } finally {
      setRss((r) => ({ ...r, loading: false }));
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(val) => (onOpenChange(val), !val && resetState())}
    >
      <DrawerContent
        className={cn(
          "flex flex-col outline-none",
          mode === "search" && "h-[80vh]"
        )}
      >
        <DrawerHeader className="px-5 pb-3">
          <DrawerTitle className="text-center text-base font-semibold">
            添加播客订阅
          </DrawerTitle>
        </DrawerHeader>

        <Tabs
          value={mode}
          onValueChange={(v) => setMode(v as typeof mode)}
          className="flex-1 flex flex-col min-h-0 px-5 pb-5"
        >
          <TabsList className="grid h-9 w-full grid-cols-2 rounded-full">
            <TabsTrigger value="search" className="rounded-full">
              搜索播客
            </TabsTrigger>
            <TabsTrigger value="rss" className="rounded-full">
              RSS 链接
            </TabsTrigger>
          </TabsList>

          {/* 搜索 Tab */}
          <TabsContent
            value="search"
            className="mt-3 flex-1 flex flex-col gap-3 min-h-0"
          >
            <div className="flex gap-2">
              <Input
                autoFocus
                className="h-10 flex-1 rounded-xl border-none bg-muted/50"
                placeholder="输入播客名称"
                value={search.kw}
                onChange={(e) =>
                  setSearch((s) => ({ ...s, kw: e.target.value }))
                }
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button
                onClick={handleSearch}
                disabled={search.loading || !search.kw.trim()}
                className="min-w-[72px]"
              >
                {search.loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "搜索"
                )}
              </Button>
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto min-h-0">
              {search.loading ? (
                <div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> 正在搜索
                </div>
              ) : search.items.length > 0 ? (
                search.items.map((item) => {
                  const existed = !item.rssUrl || activeRssSet.has(item.rssUrl);
                  return (
                    <div
                      key={`${item.source}-${item.id}-${item.rssUrl}`}
                      className="flex items-center gap-3 rounded-xl p-2 active:bg-muted/60"
                    >
                      <MusicCover
                        src={item.cover}
                        alt={item.title}
                        className="h-11 w-11 shrink-0 rounded-lg bg-muted/50"
                        fallbackIcon={
                          <Radio className="h-4 w-4 text-muted-foreground/60" />
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {item.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {item.author || "未知作者"}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={existed ? "ghost" : "default"}
                        disabled={existed}
                        className={cn(
                          "h-7 shrink-0 rounded-full text-xs",
                          existed && "text-muted-foreground"
                        )}
                        onClick={() => handleAddSearchItem(item)}
                      >
                        {existed ? "已订阅" : "订阅"}
                      </Button>
                    </div>
                  );
                })
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground/70">
                  <Radio className="h-7 w-7 opacity-50" />
                  {search.searched
                    ? "未找到相关播客"
                    : "搜索并订阅你喜欢的播客"}
                </div>
              )}
            </div>
          </TabsContent>

          {/* RSS Tab */}
          <TabsContent value="rss" className="mt-3 space-y-2.5">
            <Input
              className="h-10 rounded-xl border-none bg-muted/50"
              placeholder="RSS 链接，如 https://example.com/feed.xml"
              inputMode="url"
              value={rss.url}
              onChange={(e) => setRss((r) => ({ ...r, url: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && handleAddRss()}
            />
            <Input
              className="h-10 rounded-xl border-none bg-muted/50"
              placeholder="播客名称（可选，默认取域名）"
              value={rss.name}
              onChange={(e) => setRss((r) => ({ ...r, name: e.target.value }))}
            />
            <Button
              className="w-full rounded-full"
              onClick={handleAddRss}
              disabled={rss.loading || !rss.url.trim()}
            >
              {rss.loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              订阅
            </Button>
          </TabsContent>
        </Tabs>
      </DrawerContent>
    </Drawer>
  );
}
