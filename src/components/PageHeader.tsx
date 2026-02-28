"use client";

import { ChevronLeft } from "lucide-react";
import { Button } from "./ui/button";

interface PageHeaderProps {
  title: string;
  onBack: () => void;
  subtitle?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, onBack, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2 h-8 w-8 rounded-full hover:bg-muted/50"
          onClick={onBack}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex flex-col min-w-0">
          <h1 className="text-lg font-semibold tracking-tight truncate">{title}</h1>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
      </div>
      {action && (
        <div className="flex-none pl-4">
          {action}
        </div>
      )}
    </div>
  );
}
