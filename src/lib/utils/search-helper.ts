import type { MusicSource, MusicTrack, MergedMusicTrack } from '@/types/music';
import { normalizeText, normalizeArtists, getExactKey } from './music-key';

/* 常量 */
const SOURCE_PRIORITY: MusicSource[] = ['kuwo', 'joox', 'netease'];

const SOURCE_WEIGHT: Record<string, number> = {
  kuwo: 30,
  joox: 25,
  netease: 20
};

/* 内部预处理结构（缓存所有可复用信息） */
type PreparedTrack = MusicTrack & {
  nName: string;
  nArtists: string[];
  artistKey: string;
  exactKey: string;
  nameKey: string;
};

function prepareTracks(tracks: MusicTrack[]): PreparedTrack[] {
  return tracks.map(t => {
    const nName = normalizeText(t.name);
    const nArtists = normalizeArtists(t.artist);

    return {
      ...t,
      nName,
      nArtists,
      artistKey: nArtists.join('/'),
      exactKey: getExactKey(t),
      nameKey: nName
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
        if (item.nArtists.some(a => c.nArtists.includes(a))) {
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
  if (t.nName === q) s += 100;
  else if (t.nName.startsWith(q)) s += 80;
  else if (t.nName.includes(q)) s += 50;

  // 艺人匹配
  if (t.artistKey.includes(q)) s += 40;

  // 多来源 = 热门
  s += Math.min((t.variants?.length || 0) * 15, 60);

  // 平台质量
  s += SOURCE_WEIGHT[t.source] || 0;

  // 原版通常更短
  s -= t.name.length * 0.3;

  return s;
}

/* 4. 混排（核心） */
function interleave(tracks: (MergedMusicTrack & PreparedTrack)[], query: string): MergedMusicTrack[] {
  const q = normalizeText(query);

  const buckets = new Map<MusicSource, (MergedMusicTrack & PreparedTrack)[]>();

  for (const t of tracks) {
    if (!buckets.has(t.source)) buckets.set(t.source, []);
    buckets.get(t.source)!.push(t);
  }

  // 每个平台内部按评分排序
  for (const arr of buckets.values()) {
    arr.sort((a, b) => score(b, q) - score(a, q));
  }

  // 轮询混排
  const result: MergedMusicTrack[] = [];
  let active = true;

  while (active) {
    active = false;
    for (const src of SOURCE_PRIORITY) {
      const item = buckets.get(src)?.shift();
      if (item) {
        result.push(item);
        active = true;
      }
    }
  }

  return result;
}

/* 主入口 */
export function mergeAndSortTracks(tracks: MusicTrack[], query = ''): MergedMusicTrack[] {
  const prepared = prepareTracks(tracks);
  const unique = dedupeExact(prepared);
  const clustered = clusterTracks(unique);
  return interleave(clustered, query);
}
