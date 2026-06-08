import { PageLayout } from "@/components/PageLayout";
import { CommonDetailHeader } from "@/components/CommonDetailHeader";
import { DetailSkeleton } from "@/components/skeletons/DetailSkeleton";
import { PageError } from "@/components/PageError";
import type { ReactNode, RefObject } from "react";
import type { MusicTrack } from "@/types/music";

export interface GenericDetailData {
  title: string;
  coverUrl: string;
  description?: string;
  creator?: string;
  countDesc: string;
  publishTime?: number;
  fallbackIcon: ReactNode;
}

interface GenericDetailPageProps {
  loading: boolean;
  error: boolean;
  title: string;
  onBack: () => void;
  onRetry?: () => void;
  action?: ReactNode;
  detail?: GenericDetailData;
  scrollRef?: RefObject<HTMLDivElement | null>;
  isShuffle?: boolean;
  tracks?: MusicTrack[];
  onPlayTrack?: (track: MusicTrack) => void;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  children: ReactNode;
}

export function GenericDetailPage({
  loading,
  error,
  title,
  onBack,
  onRetry,
  action,
  detail,
  scrollRef,
  isShuffle,
  tracks,
  onPlayTrack,
  searchQuery,
  onSearchChange,
  children,
}: GenericDetailPageProps) {
  if (loading) return <DetailSkeleton onBack={onBack} />;

  if (error) {
    return (
      <PageLayout title={title} onBack={onBack}>
        <PageError onBack={onBack} onRetry={onRetry} />
      </PageLayout>
    );
  }

  return (
    <PageLayout title={detail?.title ?? title} onBack={onBack} action={action}>
      <div ref={scrollRef} className="h-full overflow-y-auto custom-scrollbar">
        <div className="pb-24">
          {detail && (
            <CommonDetailHeader
              title={detail.title}
              coverUrl={detail.coverUrl}
              description={detail.description}
              creator={detail.creator}
              countDesc={detail.countDesc}
              publishTime={detail.publishTime}
              fallbackIcon={detail.fallbackIcon}
              isShuffle={isShuffle}
              tracks={tracks}
              onPlayTrack={onPlayTrack}
              searchQuery={searchQuery}
              onSearchChange={onSearchChange}
            />
          )}
          {children}
        </div>
      </div>
    </PageLayout>
  );
}
