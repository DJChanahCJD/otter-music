
import { describe, it, expect } from 'vitest';
import { formatMediaTime, cleanTrack, deduplicateTracks } from './music';
import { MusicTrack, MergedMusicTrack } from '@/types/music';

// Mock MusicTrack data helper
const createTrack = (id: string, name: string, artist: string[] = ['Test Artist'], source: any = 'netease'): MusicTrack => ({
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
      expect((cleaned as any).variants).toBeUndefined();
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
      
      expect(result.tracks).toHaveLength(2);
      expect(result.removedCount).toBe(1);
      expect(result.tracks.map(t => t.id)).toEqual(['1', '2']);
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
      
      expect(result.tracks).toHaveLength(2);
      expect(result.removedCount).toBe(1);
      // Logic prefers later index if everything else equal, so '2' (Song A Live) should win over '1'
      expect(result.tracks.map(t => t.id)).toContain('2');
      expect(result.tracks.map(t => t.id)).toContain('3');
    });

    it('should prioritize downloaded tracks', () => {
      const t1 = createTrack('1', 'Song A'); // Not downloaded
      const t2 = createTrack('2', 'Song A'); // Downloaded (different ID)
      
      const tracks = [t1, t2];
      
      const isFavorite = () => false;
      const isDownloaded = (t: MusicTrack) => t.id === '2';
      
      const result = deduplicateTracks(tracks, isFavorite, isDownloaded);
      
      expect(result.tracks).toHaveLength(1);
      expect(result.tracks[0].id).toBe('2'); // Should keep the downloaded one
    });

    it('should prioritize favorite tracks', () => {
      const t1 = createTrack('1', 'Song A'); // Not favorite
      const t2 = createTrack('2', 'Song A'); // Favorite
      
      const tracks = [t1, t2];
      
      const isFavorite = (id: string) => id === '2';
      const isDownloaded = () => false;
      
      const result = deduplicateTracks(tracks, isFavorite, isDownloaded);
      
      expect(result.tracks).toHaveLength(1);
      expect(result.tracks[0].id).toBe('2');
    });

    it('should mark winner to like if loser was liked', () => {
      // Scenario: t1 is liked but t2 is downloaded. t2 wins due to download priority.
      // t2 should be added to tracksToLike because we don't want to lose the "liked" status of the song group.
      const t1 = createTrack('1', 'Song A'); // Liked
      const t2 = createTrack('2', 'Song A'); // Downloaded
      
      const tracks = [t1, t2];
      
      const isFavorite = (id: string) => id === '1'; // t1 is liked
      const isDownloaded = (t: MusicTrack) => t.id === '2'; // t2 is downloaded
      
      const result = deduplicateTracks(tracks, isFavorite, isDownloaded);
      
      expect(result.tracks).toHaveLength(1);
      expect(result.tracks[0].id).toBe('2'); // t2 wins
      expect(result.tracksToLike).toHaveLength(1);
      expect(result.tracksToLike[0].id).toBe('2'); // t2 should be liked
    });
  });
});
