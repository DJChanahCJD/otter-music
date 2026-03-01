"use client";

import { ChevronLeft } from "lucide-react";
import { Button } from "./ui/button";

interface PageHeaderProps {
  title: string;
  onBack: () => void;
  action?: React.ReactNode;
}

export function PageHeader({ title, onBack, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 pb-1 pt-[calc(0.5rem+env(safe-area-inset-top))] border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2 h-8 w-8 rounded-full hover:bg-muted/50"
          onClick={onBack}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-col min-w-0">
          <h1 className="font-semibold tracking-tight truncate">{title}</h1>
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
