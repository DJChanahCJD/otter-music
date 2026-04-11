import type { MusicSource, MusicTrack, MergedMusicTrack, SearchIntent } from '@/types/music';
import {
  normalizeText,
  normalizeArtists,
  getExactKey,
  isNameMatch,
  isArtistMatch,
  isNameContainsMatch,
  isArtistContainsMatch
} from './music-key';
import { useSourceQualityStore } from '@/store';

/* ================= 常量定义 ================= */
export const SOURCE_WEIGHT: Partial<Record<MusicSource, number>> = {
  joox: 30,
  netease: 28,
  kuwo: 20,
  _netease: 20,
};

export const SOURCE_RANK: Partial<Record<MusicSource, number>> = Object.fromEntries(
  Object.entries(SOURCE_WEIGHT)
    .sort(([, a], [, b]) => b - a)
    .map(([source], i) => [source, i])
) as Partial<Record<MusicSource, number>>;

type PreparedTrack = MusicTrack & {
  normalizedName: string;
  normalizedArtists: string[];
  artistKey: string;
  exactKey: string;
  nameKey: string;
  originalIndex: number;
};

/* ================= 核心处理逻辑 ================= */

/* 1. 预处理数据 */
function prepareTracks(tracks: MusicTrack[]): PreparedTrack[] {
  return tracks.map((t, i) => {
    const normalizedArtists = normalizeArtists(t.artist);
    return {
      ...t,
      normalizedName: normalizeText(t.name),
      normalizedArtists,
      artistKey: normalizedArtists.join('/'),
      exactKey: getExactKey(t),
      nameKey: normalizeText(t.name),
      originalIndex: i
    };
  });
}

/* 2. 精确去重 & 模糊聚类 */
function mergeAndCluster(tracks: PreparedTrack[]): (MergedMusicTrack & PreparedTrack)[] {
  // 1. 精确去重 (完全相同的音轨)
  const exactMap = new Map<string, PreparedTrack[]>();
  for (const t of tracks) {
    const list = exactMap.get(t.exactKey) || [];
    list.push(t);
    exactMap.set(t.exactKey, list);
  }

  const uniqueTracks = Array.from(exactMap.values()).map(group => {
    // 选出原始排名最高的作为主轨
    group.sort((a, b) => a.originalIndex - b.originalIndex);
    const [main, ...variants] = group;
    return { ...main, variants };
  });

  // 2. 模糊聚类 (同名且有共同艺人)
  const clusterMap = new Map<string, (MergedMusicTrack & PreparedTrack)[]>();
  for (const t of uniqueTracks) {
    const list = clusterMap.get(t.nameKey) || [];
    list.push(t);
    clusterMap.set(t.nameKey, list);
  }

  const finalClusters: (MergedMusicTrack & PreparedTrack)[] = [];

  for (const list of clusterMap.values()) {
    const clusters: (MergedMusicTrack & PreparedTrack)[] = [];

    for (const item of list) {
      const target = clusters.find(c =>
        item.normalizedArtists.some(a => c.normalizedArtists.includes(a))
      );

      if (target) {
        // 核心：永远让原始排名最靠前的做主曲
        const [main, sub] = item.originalIndex < target.originalIndex
          ? [item, target]
          : [target, item];

        target.id = main.id; // 原地更新以维持引用
        Object.assign(target, main, {
          variants: [...(main.variants || []), sub, ...(sub.variants || [])]
        });
      } else {
        clusters.push(item);
      }
    }
    finalClusters.push(...clusters);
  }

  return finalClusters;
}

/* 3. 极简综合评分 */
function score(t: MergedMusicTrack & PreparedTrack, q: string): number {
  let s = SOURCE_WEIGHT[t.source] || 0; // 基础评分
  if (!q) return s;

  // a. 原始排名指数衰减 (保护首位，平滑长尾)
  s += 100 * Math.pow(0.85, t.originalIndex);

  // b. 文本精准度
  if (t.normalizedName === q) s += 100;
  else if (t.normalizedName.startsWith(q)) s += 80;
  else if (t.normalizedName.includes(q)) s += 50;

  if (t.artistKey.includes(q)) s += 40;

  // c. 热门度估算 (多源加分)
  const sourcesCount = 1 + (t.variants?.length || 0);
  if (sourcesCount > 1) s += Math.log2(sourcesCount) * 15;

  // d. 动态学习加成
  s += useSourceQualityStore.getState().getSourceDynamicScore(t.source);

  return s;
}

/* ================= 导出接口 ================= */

export function mergeAndSortTracks(tracks: MusicTrack[], query = ''): MergedMusicTrack[] {
  if (!tracks?.length) return [];

  const q = normalizeText(query);
  const clustered = mergeAndCluster(prepareTracks(tracks));

  return clustered
    .map(t => ({ item: t, weight: score(t, q) }))
    .sort((a, b) => b.weight - a.weight || a.item.originalIndex - b.item.originalIndex)
    .map(v => v.item);
}

export function applySearchIntentSort(items: MergedMusicTrack[], intent: SearchIntent | null, query = ""): MergedMusicTrack[] {
  if (!intent || (!query && !intent.artist)) return items;

  const q = query;
  const artistTarget = intent.artist || q;

  const getWeight = (t: MergedMusicTrack): number => {
    let s = 0;
    const albumExact = q && isNameMatch(t.album, q);
    const artistExact = artistTarget && isArtistMatch(t.artist, [artistTarget]);

    if (intent.type === 'album') {
      if (albumExact) s += 60;
      else if (q && isNameContainsMatch(t.album, q)) s += 18;

      if (artistExact) s += 24;
      else if (artistTarget && isArtistContainsMatch(t.artist, [artistTarget])) s += 8;

      if (albumExact && artistExact) s += 16;
    }
    else if (intent.type === 'artist') {
      if (artistExact) s += 60;
      else if (artistTarget && isArtistContainsMatch(t.artist, [artistTarget])) s += 20;

      if (q && isNameMatch(t.name, q)) s += 12;
      else if (q && isNameContainsMatch(t.name, q)) s += 4;
    }
    return s;
  };

  return items
    .map((item, index) => ({ item, index, weight: getWeight(item) }))
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
    .map(v => v.item);
}
