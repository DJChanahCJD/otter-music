import type { MusicSource, MusicTrack, MergedMusicTrack } from '@/types/music';
import { normalizeText, normalizeArtists, getExactKey } from './music-key';
import { useSourceQualityStore } from '@/store/source-quality-store';

/* 常量 */
const SOURCE_WEIGHT: Record<string, number> = {
  joox: 30,     //  稳定但版本参差不齐，且为繁体
  netease: 28,  //  稳定但周杰伦等版权缺失
  kuwo: 20,     //  酷我音源不稳定
  bilibili: 18, //  bilibili 质量一般
  _netease: 0, //  ! 搜索时推荐直接用 netease 而不是客户端 API
};

const SOURCE_PRIORITY: MusicSource[] = Object.entries(SOURCE_WEIGHT)
  .sort(([, a], [, b]) => b - a)
  .map(([source]) => source as MusicSource);

export const SOURCE_RANK = Object.fromEntries(
  SOURCE_PRIORITY.map((s, i) => [s, i])
);

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
      SOURCE_RANK[a.source] - SOURCE_RANK[b.source]
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

      for (let i = 0; i < clusters.length; i++) {
        const c = clusters[i];
        if (item.normalizedArtists.some(a => c.normalizedArtists.includes(a))) {
          // 选更好的主曲
          const better =
            item.name.length < c.name.length ||
            SOURCE_RANK[item.source] < SOURCE_RANK[c.source]
              ? item
              : c;

          const worse = better === item ? c : item;

          // 安全合并（不修改已有对象）
          clusters[i] = {
            ...better,
            variants: [
              ...(better.variants || []),
              worse,
              ...(worse.variants || [])
            ]
          };

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
  const uniqueSources = new Set(
    [t.source, ...(t.variants?.map(v => v.source) || [])]
  );
  s += Math.log2(uniqueSources.size + 1) * 18;

  // 静态权重（基础分，保留不变）
  s += SOURCE_WEIGHT[t.source] || 0;

  // 动态学习加成（0 ~ 40，基于实际播放数据）
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

  const scored = tracks.map((t, i) => ({
    track: t,
    base: score(t, q),
    index: i
  }));

  // 初始排序（保留 API 顺序）
  scored.sort((a, b) => b.base - a.base);

  const result: MergedMusicTrack[] = [];
  const sourceCount = new Map<MusicSource, number>();

  for (const item of scored) {
    const used = sourceCount.get(item.track.source) || 0;

    // 平台惩罚：越多出现越难再上
    item.base -= used * 6;

    result.push(item.track);
    sourceCount.set(item.track.source, used + 1);
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
