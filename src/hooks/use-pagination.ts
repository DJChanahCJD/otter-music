import { useState, useRef, useCallback, useEffect } from "react";

interface FetchResult<T> {
  items: T[];
  hasMore: boolean;
}

interface PaginationAdapter<T> {
  fetch: (offset: number) => Promise<FetchResult<T> | null>;
}

interface UsePaginationOptions<T> {
  adapter: PaginationAdapter<T>;
  getId: (item: T) => string | number;
  pageSize: number;
  enabled: boolean;
  onError?: (err: unknown, offset: number) => void;
}

export interface UsePaginationResult<T> {
  items: T[];
  loading: boolean;
  fetching: boolean;
  hasMore: boolean;
  offset: number;
  observerTargetRef: React.RefObject<HTMLDivElement | null>;
  reset: () => void;
  restore: (data: { items: T[]; offset: number; hasMore: boolean }) => void;
}

export function usePagination<T>({
  adapter,
  getId,
  pageSize,
  enabled,
  onError,
}: UsePaginationOptions<T>): UsePaginationResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const observerTargetRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef(false);

  const fetchPage = useCallback(
    async (currentOffset: number) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;

      if (currentOffset === 0) {
        setLoading(true);
        setItems([]);
      }
      setFetching(true);

      try {
        const result = await adapter.fetch(currentOffset);
        if (result) {
          setItems((prev) => {
            const existingIds = new Set(prev.map(getId));
            const uniqueItems = result.items.filter(
              (item) => !existingIds.has(getId(item))
            );
            return currentOffset === 0
              ? result.items
              : [...prev, ...uniqueItems];
          });
          setHasMore(result.hasMore);
        } else {
          setHasMore(false);
        }
      } catch (err) {
        onError?.(err, currentOffset);
        setHasMore(false);
      } finally {
        setLoading(false);
        setFetching(false);
        fetchingRef.current = false;
      }
    },
    [adapter, getId, onError]
  );

  const reset = useCallback(() => {
    setOffset(0);
    setHasMore(true);
    fetchPage(0);
  }, [fetchPage]);

  const loadNext = useCallback(() => {
    const nextOffset = offset + pageSize;
    setOffset(nextOffset);
    fetchPage(nextOffset);
  }, [offset, pageSize, fetchPage]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const element = observerTargetRef.current;
    if (!enabled || !element || loading || fetching || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadNext();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, loading, fetching, hasMore, loadNext]);

  const restore = useCallback(
    (data: { items: T[]; offset: number; hasMore: boolean }) => {
      setItems(data.items);
      setOffset(data.offset);
      setHasMore(data.hasMore);
      setLoading(false);
      setFetching(false);
    },
    []
  );

  return {
    items,
    loading,
    fetching,
    hasMore,
    offset,
    observerTargetRef,
    reset,
    restore,
  };
}
