
import { describe, it, expect } from 'vitest';
import { formatMediaTime, cleanTrack, deduplicateTracks } from './music';
import { MusicTrack, MergedMusicTrack, MusicSource } from '@/types/music';

// Mock MusicTrack data helper
const createTrack = (id: string, name: string, artist: string[] = ['Test Artist'], source: MusicSource = 'netease'): MusicTrack => ({
  id,
  name,
  artist,
  album: 'Test Album',
  pic_id: 'pic1',
  url_id: 'url1',
  lyric_id: 'lrc1',
  source,
});

describe('music utils', () => {
  describe('formatMediaTime', () => {
    it('should format seconds correctly', () => {
      expect(formatMediaTime(0)).toBe('0:00');
      expect(formatMediaTime(9)).toBe('0:09');
      expect(formatMediaTime(59)).toBe('0:59');
      expect(formatMediaTime(60)).toBe('1:00');
      expect(formatMediaTime(65)).toBe('1:05');
      expect(formatMediaTime(125)).toBe('2:05');
    });

    it('should handle NaN gracefully', () => {
      expect(formatMediaTime(NaN)).toBe('0:00');
    });
  });

  describe('cleanTrack', () => {
    it('should remove variants from MergedMusicTrack', () => {
      const track: MergedMusicTrack = {
        ...createTrack('1', 'Song 1'),
        variants: [createTrack('1-v1', 'Song 1 Variant')]
      };

      const cleaned = cleanTrack(track);
      expect('variants' in cleaned).toBe(false);
      expect(cleaned.id).toBe('1');
    });

    it('should remove privilege from _netease track', () => {
      const track: MusicTrack = {
        ...createTrack('299116', '约定', ['王菲'], '_netease'),
        privilege: { id: 299116, fee: 1, payed: 1, st: 0, pl: 999000, maxbr: 999000, plLevel: 'lossless', freeTrialPrivilege: {} },
      };

      const cleaned = cleanTrack(track);
      expect('privilege' in cleaned).toBe(false);
      expect(cleaned.id).toBe('299116');
    });

    it('should remove both variants and privilege together', () => {
      const track: MergedMusicTrack = {
        ...createTrack('1', 'Song 1', ['Artist'], '_netease'),
        variants: [createTrack('1-v1', 'Variant')],
        privilege: { id: 1, fee: 1, payed: 0, st: 0, pl: 0, maxbr: 999000, plLevel: 'lossless', freeTrialPrivilege: {} },
      };

      const cleaned = cleanTrack(track);
      expect('variants' in cleaned).toBe(false);
      expect('privilege' in cleaned).toBe(false);
      expect(cleaned.id).toBe('1');
    });
  });

  describe('deduplicateTracks', () => {
    it('should remove exact duplicates', () => {
      const tracks = [
        createTrack('1', 'Song A'),
        createTrack('1', 'Song A'),
        createTrack('2', 'Song B')
      ];

      const isFavorite = () => false;
      const isDownloaded = () => false;

      const result = deduplicateTracks(tracks, isFavorite, isDownloaded);

      expect(result.removedCount).toBe(1);
      expect(result.trackIdsToDelete).toEqual(['1']);
    });

    it('should group tracks by normalized name and artist', () => {
      const tracks = [
        createTrack('1', 'Song A'),
        createTrack('2', 'Song A (Live)'), // Should normalize to same key
        createTrack('3', 'Song B')
      ];

      const isFavorite = () => false;
      const isDownloaded = () => false;

      const result = deduplicateTracks(tracks, isFavorite, isDownloaded);

      expect(result.removedCount).toBe(1);
      // New logic: earlier index wins when all else equal, so '1' (index 0) stays, '2' (index 1) is removed
      expect(result.trackIdsToDelete).toEqual(['2']);
    });

    it('should prioritize downloaded tracks', () => {
      const t1 = createTrack('1', 'Song A'); // Not downloaded
      const t2 = createTrack('2', 'Song A'); // Downloaded (different ID)

      const tracks = [t1, t2];

      const isFavorite = () => false;
      const isDownloaded = (t: MusicTrack) => t.id === '2';

      const result = deduplicateTracks(tracks, isFavorite, isDownloaded);

      expect(result.trackIdsToDelete).toEqual(['1']); // Should keep the downloaded one
    });

    it('should prioritize favorite tracks', () => {
      const t1 = createTrack('1', 'Song A'); // Not favorite
      const t2 = createTrack('2', 'Song A'); // Favorite

      const tracks = [t1, t2];

      const isFavorite = (id: string) => id === '2';
      const isDownloaded = () => false;

      const result = deduplicateTracks(tracks, isFavorite, isDownloaded);

      expect(result.trackIdsToDelete).toEqual(['1']);
    });

    it('liked track wins over downloaded track (liked has higher priority)', () => {
      // New priority: Liked > Downloaded. So the liked track always wins.
      const t1 = createTrack('1', 'Song A'); // Liked
      const t2 = createTrack('2', 'Song A'); // Downloaded but not liked

      const tracks = [t1, t2];

      const isFavorite = (id: string) => id === '1'; // t1 is liked
      const isDownloaded = (t: MusicTrack) => t.id === '2'; // t2 is downloaded

      const result = deduplicateTracks(tracks, isFavorite, isDownloaded);

      expect(result.trackIdsToDelete).toEqual(['2']); // t1 wins (liked priority)
      expect(result.tracksToLike).toHaveLength(0); // Winner is already liked
    });
  });
});
