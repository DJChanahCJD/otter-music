import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMusicStore } from './music-store';
import type { MusicTrack } from '@/types/music';

// Mock dependencies
vi.mock('@/lib/storage-adapter', () => ({
  idbStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock('@/lib/utils/toast', () => ({
  toastUtils: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Helper to create a dummy track
const createTrack = (id: string, title: string): MusicTrack => ({
  id,
  name: title,
  artist: ['Artist'],
  album: 'Album',
  pic_id: id,
  url_id: id,
  lyric_id: id,
  source: 'netease',
});

describe('MusicStore', () => {
  beforeEach(() => {
    // Reset store state
    useMusicStore.setState({
      favorites: [],
      playlists: [],
      queue: [],
      originalQueue: [],
      currentIndex: 0,
      isShuffle: false,
      isPlaying: false,
      currentAudioTime: 0,
    });
    vi.clearAllMocks();
  });

  describe('Favorites', () => {
    it('should add a track to favorites', () => {
      const track = createTrack('1', 'Song 1');
      const result = useMusicStore.getState().addToFavorites(track);
      
      expect(result).toBeNull();
      expect(useMusicStore.getState().favorites).toHaveLength(1);
      expect(useMusicStore.getState().favorites[0].id).toBe('1');
    });

    it('should not add duplicate track to favorites', () => {
      const track = createTrack('1', 'Song 1');
      useMusicStore.getState().addToFavorites(track);
      const result = useMusicStore.getState().addToFavorites(track);
      
      expect(result).toBe('已在「我的喜欢」中');
      expect(useMusicStore.getState().favorites).toHaveLength(1);
    });

    it('should handle local tracks (not supported)', () => {
      const track = { ...createTrack('local1', 'Local Song'), source: 'local' as const };
      const result = useMusicStore.getState().addToFavorites(track);
      
      expect(result).toBe('本地音乐不支持喜欢');
      expect(useMusicStore.getState().favorites).toHaveLength(0);
    });

    it('should remove and restore favorites', () => {
      const track = createTrack('1', 'Song 1');
      useMusicStore.getState().addToFavorites(track);
      
      useMusicStore.getState().removeFromFavorites('1');
      expect(useMusicStore.getState().favorites[0].is_deleted).toBe(true);
      expect(useMusicStore.getState().isFavorite('1')).toBe(false);

      useMusicStore.getState().restoreFromFavorites('1');
      expect(useMusicStore.getState().favorites[0].is_deleted).toBe(false);
      expect(useMusicStore.getState().isFavorite('1')).toBe(true);
    });
  });

  describe('Playlists', () => {
    it('should create a playlist', () => {
      const id = useMusicStore.getState().createPlaylist('My Playlist');
      expect(id).toBeDefined();
      
      const playlists = useMusicStore.getState().playlists;
      expect(playlists).toHaveLength(1);
      expect(playlists[0].name).toBe('My Playlist');
      expect(playlists[0].id).toBe(id);
    });

    it('should delete and restore playlist', () => {
      const id = useMusicStore.getState().createPlaylist('My Playlist');
      
      useMusicStore.getState().deletePlaylist(id);
      expect(useMusicStore.getState().playlists[0].is_deleted).toBe(true);

      useMusicStore.getState().restorePlaylist(id);
      expect(useMusicStore.getState().playlists[0].is_deleted).toBe(false);
    });

    it('should add track to playlist', () => {
      const pid = useMusicStore.getState().createPlaylist('My Playlist');
      const track = createTrack('1', 'Song 1');
      
      useMusicStore.getState().addToPlaylist(pid, track);
      
      const playlist = useMusicStore.getState().playlists.find(p => p.id === pid);
      expect(playlist?.tracks).toHaveLength(1);
      expect(playlist?.tracks[0].id).toBe('1');
    });
  });

  describe('Queue Management', () => {
    const tracks = [
      createTrack('1', 'Song 1'),
      createTrack('2', 'Song 2'),
      createTrack('3', 'Song 3'),
    ];

    it('playContext should set queue correctly in normal mode', () => {
      useMusicStore.getState().playContext(tracks, 1); // Play starting from index 1 (Song 2)
      
      const state = useMusicStore.getState();
      expect(state.queue).toHaveLength(3);
      expect(state.currentIndex).toBe(1);
      expect(state.queue[1].id).toBe('2');
      expect(state.isShuffle).toBe(false);
    });

    it('playContext should set queue correctly in shuffle mode', () => {
      useMusicStore.setState({ isShuffle: true });
      useMusicStore.getState().playContext(tracks, 1); // Play Song 2
      
      const state = useMusicStore.getState();
      expect(state.queue).toHaveLength(3);
      expect(state.queue[0].id).toBe('2'); // Current played song is always first in shuffled queue (impl detail) or handled by currentIndex=0
      expect(state.currentIndex).toBe(0);
      expect(state.originalQueue).toHaveLength(3);
    });

    it('toggleShuffle should shuffle queue but keep current track playing', () => {
      // Setup: [1, 2, 3], playing 2 (index 1)
      useMusicStore.setState({ 
        queue: tracks, 
        originalQueue: tracks, 
        currentIndex: 1, 
        isShuffle: false 
      });

      useMusicStore.getState().toggleShuffle();

      const state = useMusicStore.getState();
      expect(state.isShuffle).toBe(true);
      expect(state.queue[0].id).toBe('2'); // Current track moved to top
      expect(state.currentIndex).toBe(0);
      expect(state.queue).toHaveLength(3);
      // Original queue should be preserved
      expect(state.originalQueue).toEqual(tracks);
    });

    it('toggleShuffle off should restore original queue order', () => {
      // Setup: Shuffle mode, queue might be [2, 1, 3] (shuffled), playing 2
      useMusicStore.setState({
        isShuffle: true,
        queue: [tracks[1], tracks[0], tracks[2]],
        originalQueue: tracks,
        currentIndex: 0 // Playing tracks[1] (Song 2)
      });

      useMusicStore.getState().toggleShuffle();

      const state = useMusicStore.getState();
      expect(state.isShuffle).toBe(false);
      expect(state.queue).toEqual(tracks); // Back to original order
      expect(state.currentIndex).toBe(1); // Still pointing to Song 2
    });

    it('addToNextPlay should insert track after current index', () => {
      // Setup: [1, 2], playing 1 (index 0)
      const initialQueue = [tracks[0], tracks[1]];
      useMusicStore.setState({ 
        queue: initialQueue, 
        originalQueue: initialQueue,
        currentIndex: 0 
      });

      const newTrack = createTrack('3', 'Song 3');
      useMusicStore.getState().addToNextPlay(newTrack);

      const state = useMusicStore.getState();
      expect(state.queue).toHaveLength(3);
      expect(state.queue[1].id).toBe('3'); // Inserted at index 1
      expect(state.queue[2].id).toBe('2'); // Previous next song pushed down
    });

    it('should remove track from queue and adjust index', () => {
      // Setup: [1, 2, 3], playing 2 (index 1)
      useMusicStore.setState({ 
        queue: tracks, 
        originalQueue: tracks, 
        currentIndex: 1,
        isPlaying: true
      });

      // Remove current song (Song 2)
      useMusicStore.getState().removeFromQueue('2');
      
      const state = useMusicStore.getState();
      expect(state.queue).toHaveLength(2);
      expect(state.queue[0].id).toBe('1');
      expect(state.queue[1].id).toBe('3');
      // Should point to next song (Song 3 which is now at index 1) or stay at index 1?
      // Logic: if removing current, index stays same (pointing to next) unless it was last
      // Here: removed index 1. Array shifts. Old index 2 becomes 1. So index 1 is now Song 3.
      expect(state.currentIndex).toBe(1); 
      expect(state.queue[state.currentIndex].id).toBe('3');

      // Remove previous song (Song 1)
      useMusicStore.getState().removeFromQueue('1');
      const state2 = useMusicStore.getState();
      expect(state2.queue).toHaveLength(1);
      // Index should decrease
      expect(state2.currentIndex).toBe(0);
      expect(state2.queue[0].id).toBe('3');
    });
  });
});
