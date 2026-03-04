import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { storeKey } from './store-keys';
import { idbStorage } from '@/lib/storage-adapter';
import type { MusicTrack, MusicSource, Playlist, SearchIntent } from '@/types/music';
import { cleanTrack } from '@/lib/utils/music';
import { toastUtils } from '@/lib/utils/toast';

const cleanPlaylist = (p: Playlist): Playlist => ({ ...p, tracks: p.tracks.map(cleanTrack) });
const clamp = (val: number, max: number) => Math.min(Math.max(val, 0), Math.max(0, max));
const shuffleArray = <T>(arr: T[]): T[] => {
  const res = [...arr];
  for (let i = res.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [res[i], res[j]] = [res[j], res[i]];
  }
  return res;
};

interface MusicState {
  // --- Library (Persisted) ---
  favorites: MusicTrack[];
  playlists: Playlist[];

  addToFavorites: (track: MusicTrack) => string | null;
  removeFromFavorites: (trackId: string) => void;
  setFavorites: (tracks: MusicTrack[]) => void;
  isFavorite: (trackId: string) => boolean;

  createPlaylist: (name: string) => string;
  deletePlaylist: (id: string) => void;
  renamePlaylist: (id: string, name: string) => void;
  addToPlaylist: (playlistId: string, track: MusicTrack) => void;
  removeFromPlaylist: (playlistId: string, trackId: string) => void;
  setPlaylistTracks: (playlistId: string, tracks: MusicTrack[]) => void;

  // --- Settings (Persisted) ---
  quality: string;
  searchSource: MusicSource;
  aggregatedSources: MusicSource[];
  lastPlaylistCategory: string;
  setQuality: (quality: string) => void;
  setSearchSource: (source: MusicSource) => void;
  setAggregatedSources: (sources: MusicSource[]) => void;
  setLastPlaylistCategory: (category: string) => void;

  // --- Search State (Not Persisted) ---
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

  // --- UI State (Not Persisted) ---
  isFullScreenPlayer: boolean;
  setIsFullScreenPlayer: (isFullScreen: boolean) => void;

  // --- Playback State (Persisted) ---
  volume: number;
  isRepeat: boolean;
  isShuffle: boolean;
  currentAudioTime: number; // Persisted playback progress
  isPlaying: boolean;
  isLoading: boolean;
  seekTimestamp: number; // Used to trigger seek
  seekTargetTime: number; // 用户 seek 的目标位置（与 currentAudioTime 分离）
  duration: number;
  currentAudioUrl: string | null; // Current audio source URL
  hasUserGesture: boolean; // 标记用户是否有过真正的交互（阻止自动播放）
  consecutiveFailures: number; // 连续加载失败计数
  maxConsecutiveFailures: number; // 最大允许连续失败次数

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

  // --- Playback (Queue) ---
  queue: MusicTrack[];
  originalQueue: MusicTrack[];
  currentIndex: number;
  contextId: string | null;

  /** 
   * Play a context (list of tracks). 
   * Replaces the current queue with this list and starts playing from startIndex.
   * contextId is used to identify the same context for shuffle mode optimization.
   */
  playContext: (tracks: MusicTrack[], startIndex?: number, contextId?: string) => void;

  /** 添加到下一首播放 */
  addToNextPlay: (track: MusicTrack) => void;
  /** Insert a track next to current and switch to it */
  playTrackAsNext: (track: MusicTrack) => void;
  /** Skip to next track and start playing */
  skipToNext: () => void;

  /** Remove a track from the current queue */
  removeFromQueue: (trackId: string) => void;

  clearQueue: () => void;
  reshuffle: () => void;
  setCurrentIndex: (index: number, resetTime?: boolean) => void;
  /** Switch to track at index and start playing */
  setCurrentIndexAndPlay: (index: number) => void;

  /** Update a track in the queue (e.g. replacing a trial version with a full version) */
  updateTrackInQueue: (trackId: string, newTrack: MusicTrack) => void;
}

export const useMusicStore = create<MusicState>()(
  persist(
    (set, get) => ({
      // --- Library ---
      favorites: [],
      playlists: [],
      addToFavorites: (track) => {
        if (track.source === 'local') return "本地音乐不支持喜欢";
        const { favorites } = get();
        if (favorites.some((t) => t.id === track.id)) return "已在「我的喜欢」中";
        set({ favorites: [track, ...favorites] });
        return null;
      },
      removeFromFavorites: (id) => set((s) => ({ favorites: s.favorites.filter(t => t.id !== id) })),
      setFavorites: (favorites) => set({ favorites }),
      isFavorite: (id) => get().favorites.some(t => t.id === id),

      createPlaylist: (name) => {
        const id = uuidv4();
        set((s) => ({ playlists: [{ id, name, tracks: [], createdAt: Date.now() }, ...s.playlists] }));
        return id;
      },
      deletePlaylist: (id) => set((s) => ({ playlists: s.playlists.filter(p => p.id !== id) })),
      renamePlaylist: (id, name) => set((s) => ({ playlists: s.playlists.map(p => p.id === id ? { ...p, name } : p) })),
      addToPlaylist: (pid, track) => set((s) => {
        if (track.source === 'local') {
          toastUtils.info("本地音乐不支持添加歌单");
          return s;
        }
        return {
          playlists: s.playlists.map(p => p.id === pid && !p.tracks.some(t => t.id === track.id) 
            ? { ...p, tracks: [track, ...p.tracks] } : p)
        };
      }),
      removeFromPlaylist: (pid, tid) => set((s) => ({
        playlists: s.playlists.map(p => p.id === pid ? { ...p, tracks: p.tracks.filter(t => t.id !== tid) } : p)
      })),
      setPlaylistTracks: (pid, tracks) => set((s) => ({
        playlists: s.playlists.map(p => p.id === pid ? { ...p, tracks } : p)
      })),

      // --- Settings ---
      quality: "192",
      searchSource: "all",
      aggregatedSources: ['joox', 'netease'],
      lastPlaylistCategory: "",
      setQuality: (quality) => set({ quality }),
      setSearchSource: (searchSource) => set({ searchSource }),
      setAggregatedSources: (aggregatedSources) => set({ aggregatedSources }),
      setLastPlaylistCategory: (lastPlaylistCategory) => set({ lastPlaylistCategory }),

      // --- Search State ---
      searchQuery: "", searchIntent: null, searchResults: [], searchLoading: false, searchHasMore: false, searchPage: 0,
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setSearchIntent: (searchIntent) => set({ searchIntent }),
      setSearchResults: (searchResults) => set({ searchResults }),
      setSearchLoading: (searchLoading) => set({ searchLoading }),
      setSearchHasMore: (searchHasMore) => set({ searchHasMore }),
      setSearchPage: (searchPage) => set({ searchPage }),
      resetSearch: () => set({ searchQuery: "", searchIntent: null, searchResults: [], searchLoading: false, searchHasMore: false, searchPage: 0 }),

      // --- UI & Playback Base ---
      isFullScreenPlayer: false, setIsFullScreenPlayer: (isFullScreenPlayer) => set({ isFullScreenPlayer }),
      volume: 1.0, isRepeat: false, isShuffle: false, currentAudioTime: 0, isPlaying: false, isLoading: false,
      seekTimestamp: 0, seekTargetTime: -1, duration: 0, currentAudioUrl: null, hasUserGesture: false, consecutiveFailures: 0, maxConsecutiveFailures: 3,
      setVolume: (volume) => set({ volume }),
      toggleRepeat: () => set((s) => ({ isRepeat: !s.isRepeat })),
      setAudioCurrentTime: (currentAudioTime) => set({ currentAudioTime }),
      setDuration: (duration) => set({ duration }),
      setIsPlaying: (isPlaying) => set({ isPlaying }),
      togglePlay: () => set((s) => ({ hasUserGesture: true, isPlaying: !s.isPlaying })),
      setIsLoading: (isLoading) => set({ isLoading }),
      seek: (time) => set({ seekTargetTime: time, seekTimestamp: Date.now() }),
      clearSeekTargetTime: () => set({ seekTargetTime: -1 }),
      setCurrentAudioUrl: (currentAudioUrl) => set({ currentAudioUrl }),
      setUserGesture: () => set({ hasUserGesture: true }),
      incrementFailures: () => { const f = get().consecutiveFailures + 1; set({ consecutiveFailures: f }); return f; },
      resetFailures: () => set({ consecutiveFailures: 0 }),

      // --- Queue Management ---
      queue: [], originalQueue: [], currentIndex: 0, contextId: null,

      toggleShuffle: () => set((s) => {
        const newShuffle = !s.isShuffle;
        const curIdx = clamp(s.currentIndex, s.queue.length - 1);
        if (newShuffle) { // Turn ON
          if (s.queue.length <= 1) return { isShuffle: true, originalQueue: s.queue, currentIndex: curIdx };
          const curTrack = s.queue[curIdx];
          const rest = s.queue.filter((_, i) => i !== curIdx);
          return { isShuffle: true, originalQueue: s.queue, queue: [curTrack, ...shuffleArray(rest)], currentIndex: 0 };
        } else { // Turn OFF
          const curTrack = s.queue[curIdx];
          const newIdx = s.originalQueue.findIndex(t => t.id === curTrack?.id);
          return { isShuffle: false, queue: s.originalQueue.length ? s.originalQueue : s.queue, currentIndex: Math.max(0, newIdx), originalQueue: [] };
        }
      }),

      playContext: (tracks, startIdx = 0, contextId) => set((s) => {
        if (!tracks.length) return { queue: [], originalQueue: [], currentIndex: 0, currentAudioTime: 0, isPlaying: false, duration: 0, contextId: null };
        const idx = clamp(startIdx, tracks.length - 1);
        
        if (s.isShuffle) {
          if (contextId && s.contextId === contextId && startIdx !== undefined) {
            const targetIdx = s.queue.findIndex(t => t.id === tracks[startIdx].id);
            if (targetIdx !== -1) return { currentIndex: targetIdx, currentAudioTime: 0, hasUserGesture: true };
          }
          const realIdx = startIdx !== undefined ? idx : Math.floor(Math.random() * tracks.length);
          const first = tracks[realIdx];
          const rest = shuffleArray(tracks.filter((_, i) => i !== realIdx));
          return { queue: [first, ...rest], originalQueue: tracks, currentIndex: 0, currentAudioTime: 0, hasUserGesture: true, contextId: contextId ?? null };
        }
        return { queue: tracks, originalQueue: tracks, currentIndex: idx, currentAudioTime: 0, hasUserGesture: true, contextId: contextId ?? null };
      }),

      // 提取核心插入逻辑，复用于 addToNextPlay 和 playTrackAsNext
      addToNextPlay: (track) => set((s) => insertNext(s, track, false)),
      playTrackAsNext: (track) => set((s) => insertNext(s, track, true)),

      removeFromQueue: (tid) => set((s) => {
        const idx = s.queue.findIndex(t => t.id === tid);
        if (idx === -1) return {};
        const q = s.queue.filter(t => t.id !== tid);
        if (!q.length) return { queue: [], originalQueue: [], currentIndex: 0, currentAudioTime: 0, isPlaying: false };
        
        return {
          queue: q,
          originalQueue: s.isShuffle ? (s.originalQueue || []).filter(t => t.id !== tid) : s.originalQueue,
          currentIndex: idx < s.currentIndex ? s.currentIndex - 1 : (idx === s.currentIndex ? Math.min(s.currentIndex, q.length - 1) : s.currentIndex)
        };
      }),

      clearQueue: () => set({ queue: [], originalQueue: [], currentIndex: 0, currentAudioTime: 0, isPlaying: false, duration: 0, contextId: null }),
      
      reshuffle: () => set((s) => {
        if (!s.isShuffle || s.queue.length <= 1) return s;
        const curTrack = s.queue[s.currentIndex];
        const srcQueue = s.originalQueue?.length ? s.originalQueue : s.queue;
        return { queue: [curTrack, ...shuffleArray(srcQueue.filter(t => t.id !== curTrack.id))], currentIndex: 0 };
      }),

      setCurrentIndex: (idx, resetTime = true) => set((s) => ({
        currentIndex: s.queue.length ? clamp(idx, s.queue.length - 1) : 0,
        currentAudioTime: resetTime ? 0 : s.currentAudioTime,
      })),

      setCurrentIndexAndPlay: (idx) => set((s) => ({
        currentIndex: s.queue.length ? clamp(idx, s.queue.length - 1) : 0,
        currentAudioTime: 0, hasUserGesture: true, isPlaying: true,
      })),

      skipToNext: () => set((s) => s.queue.length ? { currentIndex: (s.currentIndex + 1) % s.queue.length, currentAudioTime: 0 } : {}),

      updateTrackInQueue: (tid, newTrack) => set((s) => ({
        queue: s.queue.map(t => t.id === tid ? newTrack : t),
        originalQueue: s.originalQueue?.map(t => t.id === tid ? newTrack : t),
        // 如果当前播放的就是这首歌，强制刷新播放状态（保留进度或重置视需求而定，这里假设是为了听完整版，重置较好，但也可能想无缝）
        // 若 id 相同，播放器可能不会重新加载 url。需要触发 url 更新。
        // 由于 currentAudioUrl 是 store 状态，我们将其置空强制重新获取
        currentAudioUrl: s.queue[s.currentIndex]?.id === tid ? null : s.currentAudioUrl,
      })),
    }),
    {
      name: storeKey.MusicStore,
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        favorites: state.favorites.map(cleanTrack),
        playlists: state.playlists.map(cleanPlaylist),
        queue: state.queue.map(cleanTrack),
        currentIndex: state.currentIndex,
        volume: state.volume,
        isRepeat: state.isRepeat,
        isShuffle: state.isShuffle,
        currentAudioTime: state.currentAudioTime,
        duration: state.duration,
        quality: state.quality,
        searchSource: state.searchSource,
        aggregatedSources: state.aggregatedSources,
        lastPlaylistCategory: state.lastPlaylistCategory,
      }),
    }
  )
);

// --- 独立抽离的插入队列逻辑 ---
function insertNext(state: MusicState, track: MusicTrack, playImmediately: boolean): Partial<MusicState> {
  if (!state.queue.length) {
    return { queue: [track], originalQueue: state.isShuffle ? [track] : [], currentIndex: 0, ...(playImmediately && { currentAudioTime: 0 }) };
  }
  
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

  return {
    queue: q,
    originalQueue: oq,
    currentIndex: playImmediately ? targetIdx : curIdx,
    ...(playImmediately && { currentAudioTime: 0 })
  };
}
