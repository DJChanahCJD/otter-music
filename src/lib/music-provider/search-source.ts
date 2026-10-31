import type { MusicSource } from "@/types/music";
import { MusicProviderFactory } from "./factory";

/** 默认回退音源：其它音源不可搜索时兜底（曲库最全）。 */
export const DEFAULT_FALLBACK_SEARCH_SOURCE: MusicSource = "netease";

/**
 * 专辑 / 歌手跳转回退到搜索页时使用的音源。
 *
 * 优先锁定条目自身音源，避免默认走聚合搜索——聚合需等待全部音源返回，明显更慢；
 * 音源不支持站内搜索（本地库 / 播客 / Alist / 酷狗占位）时回退到网易云。
 * 用户仍可在搜索页下拉切换为其它音源或聚合搜索。
 */
export function resolveFallbackSearchSource(source?: MusicSource): MusicSource {
  if (source && source !== "all") {
    try {
      if (MusicProviderFactory.getProvider(source).searchArtist) return source;
    } catch {
      // 未注册的音源按“不支持站内搜索”处理
    }
  }
  return DEFAULT_FALLBACK_SEARCH_SOURCE;
}
