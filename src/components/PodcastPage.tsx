"use client";

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageLayout } from "./PageLayout";
import { searchPodcast } from "@/lib/api";
import { usePodcastStore } from "@/store/podcast-store";
import type { SearchPodcastItem } from "@/types/podcast";
import { Loader2, Plus, Search, Trash2, Podcast, Radio } from "lucide-react";
import toast from "react-hot-toast";

export function PodcastPage() {
  const navigate = useNavigate();
  const { rssSources, addRssSource, removeRssSource, resetDefaultRssSources } = usePodcastStore();

  const [keyword, setKeyword] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchItems, setSearchItems] = useState<SearchPodcastItem[]>([]);
  
  // 独立控制 Tab 状态，提升交互体验
  const [activeTab, setActiveTab] = useState<"subscribed" | "search">("subscribed");

  const activeSources = useMemo(
    () => rssSources.filter((item) => !item.is_deleted),
    [rssSources]
  );
  
  const normalizedKeyword = keyword.trim();

  const handleSearch = async () => {
    if (!normalizedKeyword) {
      toast("请输入搜索关键词");
      return;
    }

    try {
      setActiveTab("search");
      setIsSearching(true);
      setHasSearched(true);
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
    addRssSource(item.title, item.rssUrl);
    toast.success("订阅成功");
    setActiveTab("subscribed"); // 订阅后自动跳回列表
    setKeyword("");
  };

  return (
    <PageLayout title="发现播客">
      <div className="flex-1 p-4 pb-28 overflow-y-auto space-y-6">
        
        {/* 搜索区域 */}
        <section className="bg-card rounded-xl border p-4 shadow-sm">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9 bg-muted/50 border-transparent focus-visible:bg-background"
                placeholder="搜索播客名称或 RSS..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} disabled={isSearching} className="min-w-[80px]">
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "搜索"}
            </Button>
          </div>
        </section>

        {/* 导航 Tabs */}
        <Tabs 
          value={activeTab} 
          onValueChange={(v) => setActiveTab(v as "subscribed" | "search")} 
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="subscribed">我的订阅 ({activeSources.length})</TabsTrigger>
            <TabsTrigger value="search" disabled={!hasSearched && searchItems.length === 0}>
              搜索结果
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* 内容展示区 */}
        <section className="min-h-[300px]">
          {activeTab === "subscribed" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <p className="text-sm font-semibold text-muted-foreground">已订阅播客</p>
                {/* {activeSources.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={resetDefaultRssSources} className="h-8 text-xs">
                    恢复默认
                  </Button>
                )} */}
              </div>
              
              {activeSources.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border-2 border-dashed rounded-xl">
                  <Podcast className="w-10 h-10 opacity-20 mb-3" />
                  <p className="text-sm">还没有订阅任何播客</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {activeSources.map((source) => (
                    // 修复了嵌套 Button 的问题，改为 div 容器
                    <div
                      key={source.id}
                      onClick={() => navigate(`/podcast/${source.id}`)}
                      className="group flex flex-col justify-between p-4 rounded-xl border bg-card hover:border-primary/40 hover:shadow-md transition-all cursor-pointer"
                    >
                      <div>
                        <h3 className="text-base font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                          {source.name}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate mt-1.5 opacity-80">
                          {source.rssUrl}
                        </p>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 text-xs hover:bg-destructive group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation(); // 阻止点击事件冒泡到外层容器
                            removeRssSource(source.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          取消订阅
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {searchItems.map((item) => (
                <div 
                  key={`${item.source}-${item.id}-${item.rssUrl}`} 
                  className="flex gap-4 p-3 rounded-xl border bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="w-16 h-16 rounded-lg bg-muted shrink-0 overflow-hidden shadow-sm border">
                    {item.cover ? (
                      <img src={item.cover} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Radio className="w-6 h-6 text-muted-foreground opacity-30" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 py-0.5">
                    <p className="text-sm font-bold line-clamp-1">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                      {item.description || item.author || "暂无简介"}
                    </p>
                  </div>
                  <div className="flex items-center">
                    <Button
                      size="sm"
                      onClick={() => handleAddSearchItem(item)}
                      disabled={!item.rssUrl || activeSources.some(s => s.rssUrl === item.rssUrl)}
                      className={cn(
                        "rounded-full px-4",
                        activeSources.some(s => s.rssUrl === item.rssUrl) && "bg-muted text-muted-foreground"
                      )}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      {activeSources.some(s => s.rssUrl === item.rssUrl) ? "已订阅" : "订阅"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </PageLayout>
  );
}