import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { storeKey } from './store-keys';
import { idbStorage } from '@/lib/storage-adapter';
import type { MusicTrack, MusicSource, Playlist, SearchIntent } from '@/types/music';
import { cleanTrack } from '@/lib/utils/music';
import { toastUtils } from '@/lib/utils/toast';

// --- Helpers ---
const cleanPlaylist = (p: Playlist): Playlist => ({ ...p, tracks: p.tracks.map(cleanTrack) });
const clamp = (val: number, max: number) => Math.min(Math.max(val, 0), Math.max(0, max));
const shuffleArray = <T>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);
const withMeta = (track: MusicTrack): MusicTrack => ({
  ...cleanTrack(track),
  update_time: Date.now(),
  is_deleted: track.is_deleted === true,
});
const updateList = <T extends { id: string }>(list: T[], id: string, updater: Partial<T> | ((item: T) => Partial<T>)) =>
  list.map(item => item.id === id ? { ...item, update_time: Date.now(), ...(typeof updater === 'function' ? updater(item) : updater) } : item);

export interface MusicState {
  favorites: MusicTrack[];
  playlists: Playlist[];
  addToFavorites: (track: MusicTrack) => string | null;
  removeFromFavorites: (trackId: string) => void;
  restoreFromFavorites: (trackId: string) => void;
  setFavorites: (tracks: MusicTrack[]) => void;
  isFavorite: (trackId: string) => boolean;
  createPlaylist: (name: string, coverUrl?: string) => string;
  deletePlaylist: (id: string) => void;
  restorePlaylist: (id: string) => void;
  renamePlaylist: (id: string, name: string) => void;
  updatePlaylist: (id: string, data: Partial<Playlist>) => void;
  addToPlaylist: (playlistId: string, track: MusicTrack) => void;
  removeFromPlaylist: (playlistId: string, trackId: string) => void;
  setPlaylistTracks: (playlistId: string, tracks: MusicTrack[]) => void;
  updateTrackInPlaylists: (trackId: string, newTrack: MusicTrack) => number;

  quality: string;
  searchSource: MusicSource;
  aggregatedSources: MusicSource[];
  lastPlaylistCategory: string;
  lastMineTab: "recommend" | "created" | "subscribed" | "podcast";
  lastFeaturedTab: string;
  enableAutoMatch: boolean;
  setQuality: (quality: string) => void;
  setSearchSource: (source: MusicSource) => void;
  setAggregatedSources: (sources: MusicSource[]) => void;
  setLastPlaylistCategory: (category: string) => void;
  setLastMineTab: (tab: "recommend" | "created" | "subscribed" | "podcast") => void;
  setLastFeaturedTab: (tab: string) => void;
  setEnableAutoMatch: (enable: boolean) => void;

  searchQuery: string;
  searchIntent: SearchIntent | null;
  searchResults: MusicTrack[];
  searchLoading: boolean;
  searchHasMore: boolean;
  searchPage: number;
  setSearchQuery: (query: string) => void;
  setSearchIntent: (intent: SearchIntent | null) => void;
  setSearchResults: (results: MusicTrack[]) => void;
  setSearchLoading: (loading: boolean) => void;
  setSearchHasMore: (hasMore: boolean) => void;
  setSearchPage: (page: number) => void;
  resetSearch: () => void;

  isFullScreenPlayer: boolean;
  setIsFullScreenPlayer: (isFullScreen: boolean) => void;

  volume: number;
  isRepeat: boolean;
  isShuffle: boolean;
  currentAudioTime: number;
  isPlaying: boolean;
  isLoading: boolean;
  seekTimestamp: number;
  seekTargetTime: number;
  duration: number;
  currentAudioUrl: string | null;
  hasUserGesture: boolean;
  consecutiveFailures: number;
  maxConsecutiveFailures: number;
  setVolume: (volume: number) => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  setAudioCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  togglePlay: () => void;
  setIsLoading: (isLoading: boolean) => void;
  seek: (time: number) => void;
  clearSeekTargetTime: () => void;
  setCurrentAudioUrl: (url: string | null) => void;
  setUserGesture: () => void;
  incrementFailures: () => number;
  resetFailures: () => void;

  queue: MusicTrack[];
  originalQueue: MusicTrack[];
  currentIndex: number;
  contextId: string | null;
  playContext: (tracks: MusicTrack[], startIndex?: number, contextId?: string) => void;
  addToNextPlay: (track: MusicTrack) => void;
  playTrackAsNext: (track: MusicTrack) => void;
  skipToNext: () => void;
  removeFromQueue: (trackId: string) => void;
  clearQueue: () => void;
  reshuffle: () => void;
  setCurrentIndex: (index: number, resetTime?: boolean) => void;
  setCurrentIndexAndPlay: (index: number) => void;
  updateTrackInQueue: (trackId: string, newTrack: MusicTrack) => void;
}

export const useMusicStore = create<MusicState>()(
  persist(
    (set, get) => ({
      // --- Library ---
      favorites: [],
      addToFavorites: (track) => {
        if (track.source === 'local') return "本地音乐不支持喜欢";
        const { favorites } = get();
        const existing = favorites.find((t) => t.id === track.id);
        if (existing && !existing.is_deleted) return "已在「我的喜欢」中";
        const nextTrack = { ...withMeta(track), is_deleted: false };
        // 即使已存在(但在回收站)，也将其移到最前面，模拟"新添加"的感觉
        set({ favorites: [nextTrack, ...favorites.filter(t => t.id !== track.id)] });
        return null;
      },
      removeFromFavorites: (id) => set(s => ({ favorites: updateList(s.favorites, id, { is_deleted: true }) })),
      restoreFromFavorites: (id) => set(s => ({ favorites: updateList(s.favorites, id, { is_deleted: false }) })),
      setFavorites: (favorites) => set({ favorites: favorites.map(withMeta) }),
      isFavorite: (id) => get().favorites.some(t => t.id === id && !t.is_deleted),

      playlists: [],
      createPlaylist: (name, coverUrl) => {
        const id = uuidv4();
        set(s => ({ playlists: [{ id, name, coverUrl, tracks: [], createdAt: Date.now(), update_time: Date.now(), is_deleted: false }, ...s.playlists] }));
        return id;
      },
      deletePlaylist: (id) => set(s => ({ playlists: updateList(s.playlists, id, { is_deleted: true }) })),
      restorePlaylist: (id) => set(s => ({ playlists: updateList(s.playlists, id, { is_deleted: false }) })),
      renamePlaylist: (id, name) => set(s => ({ playlists: updateList(s.playlists, id, { name, is_deleted: false }) })),
      updatePlaylist: (id, data) => set(s => ({ playlists: updateList(s.playlists, id, { ...data, is_deleted: false }) })),
      addToPlaylist: (pid, track) => set(s => {
        if (track.source === 'local') { toastUtils.info("本地音乐不支持添加歌单"); return s; }
        return {
          playlists: updateList(s.playlists, pid, p => {
            const nextTrack = { ...withMeta(track), is_deleted: false };
            const exists = p.tracks.find(t => t.id === track.id);
            return { tracks: exists ? updateList(p.tracks, track.id, nextTrack) : [nextTrack, ...p.tracks], is_deleted: false };
          })
        };
      }),
      removeFromPlaylist: (pid, tid) => set(s => ({ playlists: updateList(s.playlists, pid, p => ({ tracks: updateList(p.tracks, tid, { is_deleted: true }) })) })),
      setPlaylistTracks: (pid, tracks) => set(s => ({ playlists: updateList(s.playlists, pid, { tracks: tracks.map(withMeta), is_deleted: false }) })),
      updateTrackInPlaylists: (tid, newTrack) => {
        let count = 0;
        set(s => ({
          playlists: s.playlists.map(p => {
            if (!p.tracks.some(t => t.id === tid)) return p;
            count++;
            return { ...p, update_time: Date.now(), tracks: updateList(p.tracks, tid, { ...withMeta(newTrack), is_deleted: false }) };
          })
        }));
        return count;
      },

      // --- Settings ---
      quality: "192", searchSource: "all", aggregatedSources: ['joox', 'netease'],
      lastPlaylistCategory: "", lastMineTab: "recommend", lastFeaturedTab: "", enableAutoMatch: true,
      setQuality: (quality) => set({ quality }), setSearchSource: (searchSource) => set({ searchSource }),
      setAggregatedSources: (aggregatedSources) => set({ aggregatedSources }), setLastPlaylistCategory: (lastPlaylistCategory) => set({ lastPlaylistCategory }),
      setLastMineTab: (lastMineTab) => set({ lastMineTab }), setLastFeaturedTab: (lastFeaturedTab) => set({ lastFeaturedTab }), setEnableAutoMatch: (enableAutoMatch) => set({ enableAutoMatch }),

      // --- Search State ---
      searchQuery: "", searchIntent: null, searchResults: [], searchLoading: false, searchHasMore: false, searchPage: 0,
      setSearchQuery: (searchQuery) => set({ searchQuery }), setSearchIntent: (searchIntent) => set({ searchIntent }),
      setSearchResults: (searchResults) => set({ searchResults }), setSearchLoading: (searchLoading) => set({ searchLoading }),
      setSearchHasMore: (searchHasMore) => set({ searchHasMore }), setSearchPage: (searchPage) => set({ searchPage }),
      resetSearch: () => set({ searchQuery: "", searchIntent: null, searchResults: [], searchLoading: false, searchHasMore: false, searchPage: 0 }),

      // --- UI & Playback Base ---
      isFullScreenPlayer: false, setIsFullScreenPlayer: (isFullScreenPlayer) => set({ isFullScreenPlayer }),
      volume: 1.0, isRepeat: false, isShuffle: false, currentAudioTime: 0, isPlaying: false, isLoading: false,
      seekTimestamp: 0, seekTargetTime: -1, duration: 0, currentAudioUrl: null, hasUserGesture: false, consecutiveFailures: 0, maxConsecutiveFailures: 3,
      setVolume: (volume) => set({ volume }), toggleRepeat: () => set(s => ({ isRepeat: !s.isRepeat })),
      setAudioCurrentTime: (currentAudioTime) => set({ currentAudioTime }), setDuration: (duration) => set({ duration }),
      setIsPlaying: (isPlaying) => set({ isPlaying }), togglePlay: () => set(s => ({ hasUserGesture: true, isPlaying: !s.isPlaying })),
      setIsLoading: (isLoading) => set({ isLoading }), seek: (time) => set({ seekTargetTime: time, seekTimestamp: Date.now(), isPlaying: true, hasUserGesture: true }),
      clearSeekTargetTime: () => set({ seekTargetTime: -1 }), setCurrentAudioUrl: (currentAudioUrl) => set({ currentAudioUrl }),
      setUserGesture: () => set({ hasUserGesture: true }), resetFailures: () => set({ consecutiveFailures: 0 }),
      incrementFailures: () => { const f = get().consecutiveFailures + 1; set({ consecutiveFailures: f }); return f; },

      // --- Queue Management ---
      queue: [], originalQueue: [], currentIndex: 0, contextId: null,

      toggleShuffle: () => set(s => {
        const curIdx = clamp(s.currentIndex, Math.max(0, s.queue.length - 1));
        if (!s.isShuffle) {
          if (s.queue.length <= 1) return { isShuffle: true, originalQueue: s.queue };
          const curTrack = s.queue[curIdx];
          const rest = s.queue.filter((_, i) => i !== curIdx);
          return { isShuffle: true, originalQueue: s.queue, queue: [curTrack, ...shuffleArray(rest)], currentIndex: 0 };
        }
        const newIdx = s.originalQueue.findIndex(t => t.id === s.queue[curIdx]?.id);
        return { isShuffle: false, queue: s.originalQueue.length ? s.originalQueue : s.queue, currentIndex: Math.max(0, newIdx), originalQueue: [] };
      }),

      playContext: (tracks, startIdx = 0, contextId) => set(s => {
        if (!tracks.length) return { queue: [], originalQueue: [], currentIndex: 0, currentAudioTime: 0, isPlaying: false, contextId: null };
        const idx = clamp(startIdx, tracks.length - 1);
        if (s.isShuffle) {
          if (contextId && s.contextId === contextId && startIdx !== undefined) {
            const targetIdx = s.queue.findIndex(t => t.id === tracks[startIdx].id);
            if (targetIdx !== -1) return { currentIndex: targetIdx, currentAudioTime: 0, hasUserGesture: true };
          }
          const realIdx = startIdx !== undefined ? idx : Math.floor(Math.random() * tracks.length);
          const rest = shuffleArray(tracks.filter((_, i) => i !== realIdx));
          return { queue: [tracks[realIdx], ...rest], originalQueue: tracks, currentIndex: 0, currentAudioTime: 0, hasUserGesture: true, contextId: contextId ?? null };
        }
        return { queue: tracks, originalQueue: tracks, currentIndex: idx, currentAudioTime: 0, hasUserGesture: true, contextId: contextId ?? null };
      }),

      addToNextPlay: (track) => set(s => insertNext(s, track, false)),
      playTrackAsNext: (track) => set(s => insertNext(s, track, true)),

      removeFromQueue: (tid) => set(s => {
        const idx = s.queue.findIndex(t => t.id === tid);
        if (idx === -1) return {};
        const q = s.queue.filter(t => t.id !== tid);
        if (!q.length) return { queue: [], originalQueue: [], currentIndex: 0, currentAudioTime: 0, isPlaying: false };
        return { queue: q, originalQueue: s.isShuffle ? (s.originalQueue || []).filter(t => t.id !== tid) : s.originalQueue, currentIndex: idx < s.currentIndex ? s.currentIndex - 1 : Math.min(s.currentIndex, q.length - 1) };
      }),

      clearQueue: () => set({ queue: [], originalQueue: [], currentIndex: 0, currentAudioTime: 0, isPlaying: false, duration: 0, contextId: null }),
      reshuffle: () => set(s => s.isShuffle && s.queue.length > 1 ? { queue: [s.queue[s.currentIndex], ...shuffleArray((s.originalQueue?.length ? s.originalQueue : s.queue).filter(t => t.id !== s.queue[s.currentIndex].id))], currentIndex: 0 } : {}),

      setCurrentIndex: (idx, resetTime = true) => set(s => ({ currentIndex: s.queue.length ? clamp(idx, s.queue.length - 1) : 0, currentAudioTime: resetTime ? 0 : s.currentAudioTime })),
      setCurrentIndexAndPlay: (idx) => set(s => ({ currentIndex: s.queue.length ? clamp(idx, s.queue.length - 1) : 0, currentAudioTime: 0, hasUserGesture: true, isPlaying: true })),
      skipToNext: () => set(s => s.queue.length ? { currentIndex: (s.currentIndex + 1) % s.queue.length, currentAudioTime: 0 } : {}),

      updateTrackInQueue: (tid, newTrack) => set(s => ({
        queue: s.queue.map(t => t.id === tid ? newTrack : t),
        originalQueue: s.originalQueue?.map(t => t.id === tid ? newTrack : t),
        currentAudioUrl: s.queue[s.currentIndex]?.id === tid ? null : s.currentAudioUrl,
      })),
    }),
    {
      name: storeKey.MusicStore,
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        favorites: state.favorites.map(cleanTrack), playlists: state.playlists.map(cleanPlaylist),
        queue: state.queue.map(cleanTrack), currentIndex: state.currentIndex, volume: state.volume,
        isRepeat: state.isRepeat, isShuffle: state.isShuffle, currentAudioTime: state.currentAudioTime, 
        duration: state.duration, quality: state.quality, searchSource: state.searchSource,
        aggregatedSources: state.aggregatedSources, lastPlaylistCategory: state.lastPlaylistCategory,
        lastMineTab: state.lastMineTab, lastFeaturedTab: state.lastFeaturedTab, enableAutoMatch: state.enableAutoMatch,
      }),
    }
  )
);

// --- Queue Helper ---
function insertNext(state: MusicState, track: MusicTrack, playImmediately: boolean): Partial<MusicState> {
  if (!state.queue.length) return { queue: [track], originalQueue: state.isShuffle ? [track] : [], currentIndex: 0, ...(playImmediately && { currentAudioTime: 0 }) };
  
  const q = [...state.queue];
  const existIdx = q.findIndex(t => t.id === track.id);
  if (existIdx === state.currentIndex) return playImmediately ? { currentAudioTime: 0 } : {};

  let targetIdx = state.currentIndex + 1;
  let curIdx = state.currentIndex;

  if (existIdx !== -1) {
    q.splice(existIdx, 1);
    if (existIdx < state.currentIndex) { targetIdx--; curIdx--; }
  }
  q.splice(targetIdx, 0, track);

  let oq = state.originalQueue;
  if (state.isShuffle) {
    oq = [...(state.originalQueue || [])];
    const curId = state.queue[state.currentIndex]?.id;
    const oqExistIdx = oq.findIndex(t => t.id === track.id);
    if (oqExistIdx !== -1) oq.splice(oqExistIdx, 1);
    const oqCurIdx = curId ? oq.findIndex(t => t.id === curId) : -1;
    oq.splice(oqCurIdx !== -1 ? oqCurIdx + 1 : oq.length, 0, track);
  }

  return { queue: q, originalQueue: oq, currentIndex: playImmediately ? targetIdx : curIdx, ...(playImmediately && { currentAudioTime: 0 }) };
}