import { describe, expect, it } from 'vitest';
import type { MergedMusicTrack, MusicSource, SearchIntent } from '@/types/music';
import { applySearchIntentSort } from './search-helper';
import {
  isNameMatch,
  isArtistMatch,
  isNameContainsMatch,
  isArtistContainsMatch
} from './music-key';

const createTrack = (
  id: string,
  name: string,
  artist: string[],
  album: string,
  source: MusicSource = 'netease'
): MergedMusicTrack => ({
  id,
  name,
  artist,
  album,
  pic_id: `pic-${id}`,
  url_id: `url-${id}`,
  lyric_id: `lyric-${id}`,
  source
});

describe('music-key match helpers', () => {
  it('matches name by alias rule', () => {
    expect(isNameMatch('夜曲（Live）', 'Live')).toBe(true);
  });

  it('matches artist by intersection', () => {
    expect(isArtistMatch(['周杰伦', '方文山'], ['周杰伦'])).toBe(true);
  });

  it('supports name contains match', () => {
    expect(isNameContainsMatch('告白氣球', '告白')).toBe(true);
  });

  it('supports artist contains match', () => {
    expect(isArtistContainsMatch(['周杰伦JayChou'], ['周杰伦'])).toBe(true);
  });
});

describe('applySearchIntentSort', () => {
  it('prioritizes album and artist exact match', () => {
    const tracks = [
      createTrack('1', '夜曲', ['周杰伦'], '十一月的萧邦'),
      createTrack('2', '夜曲', ['周杰伦'], '十一月'),
      createTrack('3', '夜曲', ['五月天'], '十一月的萧邦')
    ];

    const intent: SearchIntent = { type: 'album', artist: '周杰伦' };
    const sorted = applySearchIntentSort(tracks, intent, '十一月的萧邦');

    expect(sorted[0].id).toBe('1');
  });

  it('keeps exact match above contains match', () => {
    const tracks = [
      createTrack('1', '夜曲', ['周杰伦'], '十一月的萧邦'),
      createTrack('2', '夜曲', ['周杰伦'], '十一月')
    ];

    const intent: SearchIntent = { type: 'album', artist: '周杰伦' };
    const sorted = applySearchIntentSort(tracks, intent, '十一月的萧邦');

    expect(sorted.map(t => t.id)).toEqual(['1', '2']);
  });

  it('gives contains match non-zero priority when no exact match', () => {
    const tracks = [
      createTrack('1', '夜曲', ['周杰伦'], '十一月'),
      createTrack('2', '夜曲', ['五月天'], '演唱会精选')
    ];

    const intent: SearchIntent = { type: 'album', artist: '周杰伦' };
    const sorted = applySearchIntentSort(tracks, intent, '十一月的萧邦');

    expect(sorted[0].id).toBe('1');
  });

  it('keeps original order when scores tie', () => {
    const tracks = [
      createTrack('1', '夜曲', ['周杰伦'], 'A专辑'),
      createTrack('2', '晴天', ['林俊杰'], 'B专辑')
    ];

    const intent: SearchIntent = { type: 'artist', artist: '王力宏' };
    const sorted = applySearchIntentSort(tracks, intent, '王力宏');

    expect(sorted.map(t => t.id)).toEqual(['1', '2']);
  });
});
