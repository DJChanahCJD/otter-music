import type { MusicTrack } from '@/types/music';
import zhT2SMap from './zh-t2s-map.json';

/* -------------------------------------------------- */
/* normalize（唯一实现，全项目统一） */
/* -------------------------------------------------- */

const tMap = new Map<string, string>(Object.entries(zhT2SMap));

export const normalizeText = (v: string): string => {
  if (!v) return '';

  let base = v.toLowerCase().normalize('NFKC');

  base = base.replace(/[([{【（].*?[)\]}】）]/g, ' ');             //  去括号内容
  base = base.replace(/[\u4e00-\u9fa5]/g, c => tMap.get(c) ?? c);    //  繁简转换
  base = base.replace(/[^\w\u4e00-\u9fa5]/g, '');                    //  去符号

  return base.trim() || v.toLowerCase().replace(/\s+/g, '');
};


export const normalizeArtists = (artists: string[]) =>
  artists.map(normalizeText).filter(Boolean).sort();

/**
 * 提取括号内容作为别名（已标准化）
 */
export const getAlias = (s: string): string => {
  const match = s.match(/[([{【（](.*?)[)\]}】）]/);
  return match ? normalizeText(match[1]) : '';
};

/**
 * 判断两个名称是否匹配（主名全等 或 别名交叉匹配）
 */
export const isNameMatch = (name1: string, name2: string): boolean => {
  const n1 = normalizeText(name1);
  const n2 = normalizeText(name2);
  const a1 = getAlias(name1);
  const a2 = getAlias(name2);

  // 1. 标准化名称全等
  if (n1 === n2) return true;

  // 2. 别名交叉匹配 (Name1 vs Alias2 或 Alias1 vs Name2)
  if (a1 && a1 === n2) return true;
  if (a2 && a2 === n1) return true;

  return false;
};

/**
 * 判断歌手列表是否匹配（归一化后有交集）
 */
export const isArtistMatch = (artists1: string[], artists2: string[]): boolean => {
  const set1 = new Set(artists1.map(normalizeText).filter(Boolean));
  const set2 = new Set(artists2.map(normalizeText).filter(Boolean));
  
  // 只要有任意一个歌手相同，即视为匹配
  for (const a of set1) {
    if (set2.has(a)) return true;
  }
  return false;
};

const includesEither = (left: string, right: string): boolean => {
  if (!left || !right) return false;
  return left.includes(right) || right.includes(left);
};

export const isNameContainsMatch = (name1: string, name2: string): boolean => {
  const n1 = normalizeText(name1);
  const n2 = normalizeText(name2);
  const a1 = getAlias(name1);
  const a2 = getAlias(name2);

  if (includesEither(n1, n2)) return true;
  if (a1 && includesEither(a1, n2)) return true;
  if (a2 && includesEither(a2, n1)) return true;

  return false;
};

export const isArtistContainsMatch = (artists1: string[], artists2: string[]): boolean => {
  const normalized1 = artists1.map(normalizeText).filter(Boolean);
  const normalized2 = artists2.map(normalizeText).filter(Boolean);

  for (const a1 of normalized1) {
    for (const a2 of normalized2) {
      if (includesEither(a1, a2)) return true;
    }
  }

  return false;
};

/* -------------------------------------------------- */
/* 稳定 Key（全局唯一规则） */
/* -------------------------------------------------- */

export const getExactKey = (t: MusicTrack): string => {
  return `${normalizeText(t.name)}|${normalizeArtists(t.artist).join('/')}`;
};
