import { Skeleton } from "@/components/ui/skeleton";
import { PageLayout } from "@/components/PageLayout";

interface DetailSkeletonProps {
  onBack: () => void;
}

const LIST_COUNT = 10;

export function DetailSkeleton({ onBack }: DetailSkeletonProps) {
  return (
    <PageLayout title="加载中..." onBack={onBack}>
      <div className="flex h-full min-h-0 flex-col">
        {/* Header */}
        <div className="bg-muted/30 p-5 flex items-center gap-4">
          <Skeleton className="h-24 w-24 shrink-0 rounded-xl" />

          <div className="flex flex-1 flex-col gap-2 min-w-0">
            <Skeleton className="h-6 w-1/2" />

            <div className="flex gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-24" />
            </div>

            <Skeleton className="h-10 w-full mt-1" />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 min-h-0 px-4 py-2 space-y-1">
          {Array.from({ length: LIST_COUNT }).map((_, i) => (
            <div
              key={i}
              className="flex h-14 items-center gap-4 border-b border-border/50 last:border-0"
            >
              <Skeleton className="ml-2 h-4 w-6 shrink-0" />

              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageLayout>
  );
}