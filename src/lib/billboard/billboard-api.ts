import type { BillboardChartEntry } from "@otter-music/shared";
import { fetchWithTimeout, getApiUrl, unwrap } from "@/lib/api/config";
import { cachedFetch } from "@/lib/utils/cache";
import { logger } from "@/lib/logger";

const BILLBOARD_API_TIMEOUT_MS = 15000;
const BILLBOARD_CHART_TTL = 6 * 60 * 60 * 1000; // 6 小时

/**
 * 拉取指定 Billboard 榜单（走后端 /music-api/billboard?chart=<slug> 代理）。
 * date 为历史周榜日期（YYYY-MM-DD），缺省为最新一期。
 * 统一拼 getApiUrl() 前缀。
 * 走 cachedFetch：缓存优先；网络失败（无缓存时）照常抛出，交由页面错误态处理。
 */
export async function fetchBillboardChart(
  chartId: string,
  date?: string
): Promise<BillboardChartEntry[]> {
  const base = getApiUrl();
  const params = new URLSearchParams({ chart: chartId });
  if (date) params.set("date", date);
  const url = `${base}/music-api/billboard?${params.toString()}`;

  const cacheKey = date
    ? `billboard:${chartId}:${date}`
    : `billboard:${chartId}`;
  const data = await cachedFetch<BillboardChartEntry[]>(
    cacheKey,
    async () => {
      try {
        const res = await fetchWithTimeout(url, {}, BILLBOARD_API_TIMEOUT_MS);
        return await unwrap<BillboardChartEntry[]>(res);
      } catch (e) {
        logger.error(
          "Billboard",
          `Fetch chart ${chartId}${date ? ` at ${date}` : ""} failed`,
          e instanceof Error ? e : undefined
        );
        throw e;
      }
    },
    BILLBOARD_CHART_TTL
  );

  return data ?? [];
}
