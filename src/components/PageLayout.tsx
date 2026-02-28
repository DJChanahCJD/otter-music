"use client";

import { PageHeader } from "./PageHeader";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface PageLayoutProps {
  title: string;
  onBack?: () => void;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function PageLayout({ title, onBack, subtitle, action, children, className }: PageLayoutProps) {
  const navigate = useNavigate();
  
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <PageHeader title={title} onBack={handleBack} subtitle={subtitle} action={action} />
      {children}
    </div>
  );
}
