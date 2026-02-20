"use client";

import { PageHeader } from "./PageHeader";
import { useBackButton } from "@/hooks/use-back-button";
import { cn } from "@/lib/utils";

interface PageLayoutProps {
  title: string;
  onBack: () => void;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function PageLayout({ title, onBack, subtitle, action, children, className }: PageLayoutProps) {
  useBackButton(onBack);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <PageHeader title={title} onBack={onBack} subtitle={subtitle} action={action} />
      {children}
    </div>
  );
}
