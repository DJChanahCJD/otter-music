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

/* -------------------------------------------------- */
/* 稳定 Key（全局唯一规则） */
/* -------------------------------------------------- */

export const getExactKey = (t: MusicTrack): string => {
  return `${normalizeText(t.name)}|${normalizeArtists(t.artist).join('/')}`;
};
