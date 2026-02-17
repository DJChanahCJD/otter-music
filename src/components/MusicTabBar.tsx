"use client";

import { Search, Heart, User } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabId = "search" | "favorites" | "mine";

interface TabItem {
  id: TabId;
  label: string;
  icon: typeof Search;
}

const tabs: TabItem[] = [
  { id: "search", label: "发现", icon: Search },
  { id: "favorites", label: "喜欢", icon: Heart },
  { id: "mine", label: "我的", icon: User },
];

interface MusicTabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function MusicTabBar({ activeTab, onTabChange }: MusicTabBarProps) {
  return (
    <nav className="flex items-center justify-around bg-card/95 backdrop-blur-xl border-t border-border/50 px-2 pt-2 pb-2 pb-safe">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
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
          </button>
        );
      })}
    </nav>
  );
}
