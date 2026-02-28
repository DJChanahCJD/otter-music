"use client";

import { Search, Heart, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "react-router-dom";

export type TabId = "search" | "favorites" | "mine";

interface TabItem {
  id: TabId;
  label: string;
  icon: typeof Search;
  path: string;
}

const tabs: TabItem[] = [
  { id: "search", label: "发现", icon: Search, path: "/search" },
  { id: "favorites", label: "喜欢", icon: Heart, path: "/favorites" },
  { id: "mine", label: "我的", icon: User, path: "/mine" },
];

export function MusicTabBar() {
  const location = useLocation();
  
  // Determine active tab based on current path
  const getActiveTab = (pathname: string): TabId => {
    if (pathname.startsWith("/search")) return "search";
    if (pathname.startsWith("/favorites")) return "favorites";
    if (pathname.startsWith("/mine")) return "mine";
    return "search"; // Default
  };

  const activeTab = getActiveTab(location.pathname);

  return (
    <nav className="flex items-center justify-around bg-card/95 backdrop-blur-xl border-t border-border/50 px-2 pt-2 pb-2 pb-safe">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.id}
            to={tab.path}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1 transition-colors min-w-[56px]",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
            aria-label={tab.label}
          >
            <Icon
              className={cn(
                "h-5 w-5 transition-all",
                isActive && tab.id === "favorites" && "fill-current"
              )}
            />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
