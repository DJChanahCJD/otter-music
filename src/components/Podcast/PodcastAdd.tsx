import { useRef, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MusicCover } from "@/components/MusicCover";
import { searchPodcast, resolvePodcastUrl } from "@/lib/api";
import { usePodcastStore } from "@/store/podcast-store";
import type { PodcastRssSource, SearchPodcastItem } from "@/types/podcast";
import { parseOpml, type OpmlFeed } from "@/lib/utils/opml";
import { cn } from "@/lib/utils";
import { Loader2, Radio, Upload } from "lucide-react";
import toast from "react-hot-toast";

interface PodcastAddProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** OPML 导入状态，feeds 非空时进入预览确认阶段 */
interface OpmlImportState {
  text: string;
  showText: boolean;
  feeds: OpmlFeed[];
  skipped: number;
}

const EMPTY_OPML: OpmlImportState = {
  text: "",
  showText: false,
  feeds: [],
  skipped: 0,
};

/**
 * 读取本地文件文本内容
 * @param file 用户选择的文件
 */
const readFileText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsText(file);
  });

export function PodcastAdd({ open, onOpenChange }: PodcastAddProps) {
  const { rssSources, addRssSource, addRssSources, removeRssSource } =
    usePodcastStore();
  const [mode, setMode] = useState<"search" | "rss">("search");

  // 状态分组
  const [search, setSearch] = useState({
    kw: "",
    items: [] as SearchPodcastItem[],
    loading: false,
    searched: false,
  });
  const [rss, setRss] = useState({ url: "", name: "", loading: false });
  const [opml, setOpml] = useState<OpmlImportState>(EMPTY_OPML);
  const opmlInputRef = useRef<HTMLInputElement>(null);

  // 已订阅 RSS 映射：rssUrl -> 订阅源，用于搜索结果的订阅状态与取消订阅
  const activeRssMap = useMemo(
    () =>
      new Map(
        rssSources.filter((s) => !s.is_deleted).map((s) => [s.rssUrl, s])
      ),
    [rssSources]
  );
  const activeRssSet = useMemo(
    () => new Set(activeRssMap.keys()),
    [activeRssMap]
  );

  // OPML 中尚未订阅的条目
  const opmlNewFeeds = useMemo(
    () => opml.feeds.filter((f) => !activeRssSet.has(f.xmlUrl)),
    [opml.feeds, activeRssSet]
  );

  const resetState = () => {
    setMode("search");
    setSearch({ kw: "", items: [], loading: false, searched: false });
    setRss({ url: "", name: "", loading: false });
    setOpml(EMPTY_OPML);
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

  /**
   * 取消订阅已添加的播客
   * @param source 待移除的 RSS 订阅源
   */
  const handleRemoveSource = (source: PodcastRssSource) => {
    removeRssSource(source.id);
    toast.success("已取消订阅");
  };

  const handleAddRss = async () => {
    const urlStr = rss.url.trim();
    if (!urlStr) return toast("请输入 RSS 地址");

    // 小宇宙播客页链接：走详情页解析，自动补全标题/作者/封面
    if (urlStr.includes("xiaoyuzhoufm.com")) {
      if (activeRssSet.has(urlStr)) return toast("该播客已订阅");

      setRss((r) => ({ ...r, loading: true }));
      try {
        const item = await resolvePodcastUrl(urlStr);
        if (!item || !item.rssUrl) {
          return toast.error("未能解析该小宇宙播客，请确认链接是否正确");
        }
        if (activeRssSet.has(item.rssUrl)) return toast("该播客已订阅");

        addRssSource(
          rss.name.trim() || item.title,
          item.rssUrl,
          item.author || undefined,
          item.cover || undefined,
          item.description || undefined
        );
        toast.success("订阅成功");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "解析小宇宙播客失败");
      } finally {
        setRss((r) => ({ ...r, loading: false }));
      }
      return;
    }

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

  /**
   * 解析 OPML 文本并进入预览阶段
   * @param text OPML 文本内容
   */
  const handleOpmlParse = (text: string) => {
    try {
      const { feeds, skipped } = parseOpml(text);
      if (feeds.length === 0) {
        toast.error("未在 OPML 中找到可用的 RSS 地址");
        return;
      }
      setOpml((o) => ({ ...o, feeds, skipped }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "OPML 解析失败");
    }
  };

  /**
   * 读取并解析用户选择的 OPML 文件
   * @param file 选择的文件
   */
  const handleOpmlFile = async (file: File) => {
    try {
      handleOpmlParse(await readFileText(file));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "读取文件失败");
    }
  };

  /** 确认导入预览中的新播客 */
  const handleOpmlConfirm = () => {
    if (opmlNewFeeds.length === 0) return;
    addRssSources(
      opmlNewFeeds.map((f) => ({ name: f.title, rssUrl: f.xmlUrl }))
    );
    toast.success(`已订阅 ${opmlNewFeeds.length} 个播客`);
    setOpml(EMPTY_OPML);
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
                  // Apple 部分条目无 feedUrl，不能订阅，需与「已订阅」区分
                  const subscribed = item.rssUrl
                    ? activeRssMap.get(item.rssUrl)
                    : undefined;
                  const noRss = !item.rssUrl;
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
                        variant={subscribed ? "secondary" : "default"}
                        disabled={noRss}
                        className={cn("h-7 shrink-0 rounded-full text-xs")}
                        onClick={() =>
                          subscribed
                            ? handleRemoveSource(subscribed)
                            : handleAddSearchItem(item)
                        }
                      >
                        {noRss ? "无 RSS" : subscribed ? "已订阅" : "订阅"}
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
          <TabsContent
            value="rss"
            className="mt-3 min-h-0 space-y-2.5 overflow-y-auto"
          >
            <Input
              className="h-10 rounded-xl border-none bg-muted/50"
              placeholder="小宇宙播客链接或 RSS 地址"
              inputMode="url"
              value={rss.url}
              onChange={(e) => setRss((r) => ({ ...r, url: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && handleAddRss()}
            />
            <Input
              className="h-10 rounded-xl border-none bg-muted/50"
              placeholder="播客名称（可选，默认取标题）"
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

            {/* OPML 批量导入 */}
            <div className="flex items-center gap-3 pt-1">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[11px] text-muted-foreground">
                批量导入
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <Button
              variant="outline"
              className="w-full rounded-full"
              onClick={() => opmlInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              选择 OPML 文件
            </Button>
            <input
              ref={opmlInputRef}
              type="file"
              className="hidden"
              accept=".opml,.xml,text/xml,application/xml,text/x-opml"
              onChange={(e) => {
                const file = e.target.files?.[0];
                // 重置 value，保证同一个文件可重复选择
                e.target.value = "";
                if (file) void handleOpmlFile(file);
              }}
            />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              在小宇宙「设置 → 更多功能 → 导出订阅列表」下载 OPML，可拿到全量
              RSS 地址（免登录订阅不受 15 集限制）
            </p>

            {opml.showText ? (
              <>
                <Textarea
                  className="min-h-24 max-h-40 rounded-xl border-none bg-muted/50 font-mono text-xs"
                  placeholder="粘贴 OPML 文本内容"
                  value={opml.text}
                  onChange={(e) =>
                    // 文本变化后旧预览失效，清空待重新解析
                    setOpml((o) => ({
                      ...o,
                      text: e.target.value,
                      feeds: [],
                      skipped: 0,
                    }))
                  }
                />
                <div className="flex gap-2">
                  <Button
                    className="flex-1 rounded-full"
                    disabled={!opml.text.trim()}
                    onClick={() => handleOpmlParse(opml.text)}
                  >
                    解析
                  </Button>
                  <Button
                    variant="ghost"
                    className="rounded-full"
                    onClick={() => setOpml(EMPTY_OPML)}
                  >
                    取消
                  </Button>
                </div>
              </>
            ) : (
              <Button
                variant="ghost"
                className="w-full rounded-full text-xs text-muted-foreground"
                onClick={() => setOpml((o) => ({ ...o, showText: true }))}
              >
                或粘贴 OPML 文本
              </Button>
            )}

            {opml.feeds.length > 0 && (
              <div className="space-y-2 rounded-xl bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">
                  共 {opml.feeds.length} 个播客，可新增 {opmlNewFeeds.length} 个
                  {opml.feeds.length > opmlNewFeeds.length &&
                    `，${opml.feeds.length - opmlNewFeeds.length} 个已订阅`}
                  {opml.skipped > 0 && `，${opml.skipped} 条无 RSS 地址已跳过`}
                </p>
                <ul className="max-h-32 list-disc space-y-1 overflow-y-auto pl-4">
                  {opmlNewFeeds.map((feed) => (
                    <li key={feed.xmlUrl} className="truncate text-xs">
                      {feed.title}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full rounded-full"
                  disabled={opmlNewFeeds.length === 0}
                  onClick={handleOpmlConfirm}
                >
                  订阅 {opmlNewFeeds.length} 个播客
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DrawerContent>
    </Drawer>
  );
}
