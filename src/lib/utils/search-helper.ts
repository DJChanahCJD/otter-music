import type { MusicSource, MusicTrack, MergedMusicTrack } from '@/types/music';
import { normalizeText, normalizeArtists, getExactKey } from './music-key';
import { useSourceQualityStore } from '@/store/source-quality-store';

/* 常量 */
const SOURCE_WEIGHT: Record<string, number> = {
  joox: 30,     //  稳定但版本参差不齐，且为繁体
  netease: 28,  //  稳定但周杰伦等版权缺失
  bilibili: 22, //  稳定但质量不高
  kuwo: 20,     //  酷我音源不稳定
};

const SOURCE_PRIORITY: MusicSource[] = Object.entries(SOURCE_WEIGHT)
  .sort(([, a], [, b]) => b - a)
  .map(([source]) => source as MusicSource);

/* 内部预处理结构（缓存所有可复用信息） */
type PreparedTrack = MusicTrack & {
  normalizedName: string;
  normalizedArtists: string[];
  artistKey: string;
  exactKey: string;
  nameKey: string;
};

function prepareTracks(tracks: MusicTrack[]): PreparedTrack[] {
  return tracks.map(t => {
    const normalizedName = normalizeText(t.name);
    const normalizedArtists = normalizeArtists(t.artist);

    return {
      ...t,
      normalizedName,
      normalizedArtists,
      artistKey: normalizedArtists.join('/'),
      exactKey: getExactKey(t),
      nameKey: normalizedName
    };
  });
}


/* 1. 精确去重 */
function dedupeExact(tracks: PreparedTrack[]): (MergedMusicTrack & PreparedTrack)[] {
  const map = new Map<string, PreparedTrack[]>();

  for (const t of tracks) {
    if (!map.has(t.exactKey)) map.set(t.exactKey, []);
    map.get(t.exactKey)!.push(t);
  }

  const result: (MergedMusicTrack & PreparedTrack)[] = [];

  for (const group of map.values()) {
    // 选主曲：短名 + 源优先
    group.sort((a, b) =>
      a.name.length - b.name.length ||
      SOURCE_PRIORITY.indexOf(a.source) - SOURCE_PRIORITY.indexOf(b.source)
    );

    const [main, ...vars] = group;

    result.push({
      ...main,
      variants: vars
    });
  }

  return result;
}

/* 2. 模糊聚类（同歌名 + 艺人重叠） */
function clusterTracks(tracks: (MergedMusicTrack & PreparedTrack)[]): (MergedMusicTrack & PreparedTrack)[] {
  const groups = new Map<string, (MergedMusicTrack & PreparedTrack)[]>();

  for (const t of tracks) {
    if (!groups.has(t.nameKey)) groups.set(t.nameKey, []);
    groups.get(t.nameKey)!.push(t);
  }

  const result: (MergedMusicTrack & PreparedTrack)[] = [];

  for (const list of groups.values()) {
    const clusters: (MergedMusicTrack & PreparedTrack)[] = [];

    for (const item of list) {
      let merged = false;

      for (const c of clusters) {
        if (item.normalizedArtists.some(a => c.normalizedArtists.includes(a))) {
          // 选更好的主曲
          const better =
            item.name.length < c.name.length ||
            SOURCE_PRIORITY.indexOf(item.source) < SOURCE_PRIORITY.indexOf(c.source)
              ? item
              : c;

          const worse = better === item ? c : item;

          Object.assign(better, {
            variants: [...(better.variants || []), worse, ...(worse.variants || [])]
          });

          Object.assign(c, better);
          merged = true;
          break;
        }
      }

      if (!merged) clusters.push(item);
    }

    result.push(...clusters);
  }

  return result;
}

/* 3. 评分模型 */
function score(t: MergedMusicTrack & PreparedTrack, q: string): number {
  if (!q) return SOURCE_WEIGHT[t.source] || 0;

  let s = 0;

  // 歌名匹配
  if (t.normalizedName === q) s += 100;
  else if (t.normalizedName.startsWith(q)) s += 80;
  else if (t.normalizedName.includes(q)) s += 50;

  // 艺人匹配
  if (t.artistKey.includes(q)) s += 40;

  // 多来源 = 热门
  s += Math.min((t.variants?.length || 0) * 15, 60);

  // 静态权重（基础分，保留不变）
  s += SOURCE_WEIGHT[t.source] || 0;

  // 动态学习加成（0 ~ 50，基于实际播放数据）
  s += useSourceQualityStore.getState().getSourceDynamicScore(t.source);

  // 原版通常更短
  s -= t.name.length * 0.3;

  return s;
}

/* 4. 多源排序（避免重复 + 平台偏好） */
function diversifiedSort(
  tracks: (MergedMusicTrack & PreparedTrack)[],
  query: string
): MergedMusicTrack[] {

  const q = normalizeText(query);

  // 1️⃣ 初始评分
  const pool = tracks.map(t => ({
    track: t,
    base: score(t, q)
  }));

  const result: MergedMusicTrack[] = [];
  const sourceCount = new Map<MusicSource, number>();

  while (pool.length) {

    let bestIndex = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < pool.length; i++) {
      const { track, base } = pool[i];

      // 平台惩罚：越多出现越难再上
      const used = sourceCount.get(track.source) || 0;

      // 关键公式（非常重要）
      const diversityPenalty = used * 10;

      // 最终排序分
      const finalScore = base - diversityPenalty;

      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestIndex = i;
      }
    }

    const chosen = pool.splice(bestIndex, 1)[0].track;

    result.push(chosen);
    sourceCount.set(chosen.source, (sourceCount.get(chosen.source) || 0) + 1);
  }

  return result;
}

/* 主入口 */
export function mergeAndSortTracks(tracks: MusicTrack[], query = ''): MergedMusicTrack[] {
  const prepared = prepareTracks(tracks);
  const unique = dedupeExact(prepared);
  const clustered = clusterTracks(unique);
  return diversifiedSort(clustered, query);
}
