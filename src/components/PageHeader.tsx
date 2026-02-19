"use client";

import { ArrowLeft } from "lucide-react";
import { useBackButton } from "@/hooks/use-back-button";

interface PageHeaderProps {
  title: string;
  onBack: () => void;
  subtitle?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, onBack, subtitle, action }: PageHeaderProps) {
  useBackButton(onBack);

  return (
    <div className="sticky top-0 z-10 px-4 py-3 bg-background border-b border-border/50">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50"
          aria-label="返回"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-foreground truncate">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground/80 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
    </div>
  );
}
