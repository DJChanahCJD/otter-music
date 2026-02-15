import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { storeKey } from '.';
import type { MusicTrack, MusicSource } from '@/types/music';

/**
 * Fisher-Yates shuffle
 */
function shuffleArray<T>(array: T[]): T[] {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

export interface Playlist {
  id: string;
  name: string;
  tracks: MusicTrack[];
  createdAt: number;
}

interface MusicState {
  // --- Library (Persisted) ---
  favorites: MusicTrack[];
  playlists: Playlist[];

  addToFavorites: (track: MusicTrack) => void;
  removeFromFavorites: (trackId: string) => void;
  isFavorite: (trackId: string) => boolean;

  createPlaylist: (name: string) => string;
  deletePlaylist: (id: string) => void;
  renamePlaylist: (id: string, name: string) => void;
  addToPlaylist: (playlistId: string, track: MusicTrack) => void;
  removeFromPlaylist: (playlistId: string, trackId: string) => void;

  // --- Settings (Persisted) ---
  quality: string;
  searchSource: MusicSource;
  setQuality: (quality: string) => void;
  setSearchSource: (source: MusicSource) => void;

  // --- Playback State (Persisted) ---
  volume: number;
  isRepeat: boolean;
  isShuffle: boolean;
  currentAudioTime: number; // Persisted playback progress
  isPlaying: boolean;
  isLoading: boolean;
  seekTimestamp: number; // Used to trigger seek
  duration: number;

  setVolume: (volume: number) => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  setAudioCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  togglePlay: () => void;
  setIsLoading: (isLoading: boolean) => void;
  seek: (time: number) => void;

  // --- Playback (Queue) ---
  queue: MusicTrack[];
  originalQueue: MusicTrack[];
  currentIndex: number;

  /** 
   * Play a context (list of tracks). 
   * Replaces the current queue with this list and starts playing from startIndex.
   */
  playContext: (tracks: MusicTrack[], startIndex?: number) => void;

  /** 添加到下一首播放 */
  addToNextPlay: (track: MusicTrack) => void;
  /** Insert a track next to current and switch to it */
  playTrackAsNext: (track: MusicTrack) => void;

  /** Remove a track from the current queue */
  removeFromQueue: (trackId: string) => void;

  clearQueue: () => void;
  reshuffle: () => void;
  setCurrentIndex: (index: number, resetTime?: boolean) => void;
}

export const useMusicStore = create<MusicState>()(
  persist(
    (set, get) => ({
      favorites: [],
      playlists: [],

      addToFavorites: (track) => set((state) => {
        if (state.favorites.some(t => t.id === track.id)) return state;
        return { favorites: [track, ...state.favorites] };
      }),
      removeFromFavorites: (trackId) => set((state) => ({
        favorites: state.favorites.filter(t => t.id !== trackId)
      })),
      isFavorite: (trackId) => get().favorites.some(t => t.id === trackId),

      createPlaylist: (name) => {
        const id = uuidv4();
        set((state) => ({
          playlists: [
            { id, name, tracks: [], createdAt: Date.now() },
            ...state.playlists
          ]
        }));
        return id;
      },
      deletePlaylist: (id) => set((state) => ({
        playlists: state.playlists.filter(p => p.id !== id)
      })),
      renamePlaylist: (id, name) => set((state) => ({
        playlists: state.playlists.map(p =>
          p.id === id
            ? { ...p, name }
            : p
        )
      })),
      addToPlaylist: (pid, track) => set((state) => ({
        playlists: state.playlists.map(p =>
          p.id === pid
            ? { ...p, tracks: p.tracks.some(t => t.id === track.id) ? p.tracks : [track, ...p.tracks] }
            : p
        )
      })),
      removeFromPlaylist: (pid, tid) => set((state) => ({
        playlists: state.playlists.map(p =>
          p.id === pid
            ? { ...p, tracks: p.tracks.filter(t => t.id !== tid) }
            : p
        )
      })),

      quality: "320",
      searchSource: "all",
      setQuality: (quality) => set({ quality }),
      setSearchSource: (searchSource) => set({ searchSource }),

      volume: 0.7,
      isRepeat: false,
      isShuffle: false,
      currentAudioTime: 0,
      isPlaying: false,
      isLoading: false,
      seekTimestamp: 0,
      duration: 0,

      setVolume: (volume) => set({ volume }),
      toggleRepeat: () => set((state) => ({ isRepeat: !state.isRepeat })),
      toggleShuffle: () => set((state) => {
        const newIsShuffle = !state.isShuffle;
        const safeCurrentIndex =
          state.queue.length === 0
            ? 0
            : Math.min(Math.max(state.currentIndex, 0), state.queue.length - 1);

        if (newIsShuffle) {
          // 开启随机：备份 -> 打乱
          if (state.queue.length <= 1) {
            return {
              isShuffle: true,
              originalQueue: state.queue,
              currentIndex: safeCurrentIndex,
            };
          }

          const currentTrack = state.queue[safeCurrentIndex];
          // 排除当前歌曲，打乱剩余的
          const rest = state.queue.filter((_, i) => i !== safeCurrentIndex);
          const shuffledRest = shuffleArray(rest);
          const newQueue = [currentTrack, ...shuffledRest];

          return {
            isShuffle: true,
            originalQueue: state.queue,
            queue: newQueue,
            currentIndex: 0,
          };
        } else {
          // 关闭随机：恢复
          if (!state.originalQueue || state.originalQueue.length === 0) {
            return { isShuffle: false };
          }

          const currentTrack = state.queue[safeCurrentIndex];
          if (!currentTrack) {
            return {
              isShuffle: false,
              queue: state.originalQueue,
              currentIndex: 0,
              originalQueue: [],
            };
          }
          // 在原始队列中找到当前歌曲的新位置
          const newIndex = state.originalQueue.findIndex((t) => t.id === currentTrack.id);

          return {
            isShuffle: false,
            queue: state.originalQueue,
            currentIndex: newIndex !== -1 ? newIndex : 0,
            originalQueue: [], 
          };
        }
      }),
      setAudioCurrentTime: (currentTime) => set({ currentAudioTime: currentTime }),
      setDuration: (duration) => set({ duration }),
      setIsPlaying: (isPlaying) => set({ isPlaying }),
      togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
      setIsLoading: (isLoading) => set({ isLoading }),
      seek: (time) => set({ currentAudioTime: time, seekTimestamp: Date.now() }),

      queue: [],
      originalQueue: [],
      currentIndex: 0,

      playContext: (tracks, startIndex) => set((state) => {
        if (tracks.length === 0) {
          return {
            queue: [],
            originalQueue: [],
            currentIndex: 0,
            currentAudioTime: 0,
            isPlaying: false,
            isLoading: false,
            duration: 0,
          };
        }

        let actualIndex = startIndex ?? 0;
        actualIndex = Math.min(Math.max(actualIndex, 0), tracks.length - 1);

        // 始终保存原始队列
        const originalQueue = tracks;

        if (state.isShuffle && tracks.length > 0) {
          // 如果 startIndex 未定义，且是随机模式，随机选一首作为第一首
          if (startIndex === undefined) {
            actualIndex = Math.floor(Math.random() * tracks.length);
          }

          const firstTrack = tracks[actualIndex];
          const rest = tracks.filter((_, i) => i !== actualIndex);
          const shuffledRest = shuffleArray(rest);
          const newQueue = [firstTrack, ...shuffledRest];

          return {
            queue: newQueue,
            originalQueue,
            currentIndex: 0,
            currentAudioTime: 0,
            isPlaying: true,
          };
        }

        return {
          queue: tracks,
          originalQueue,
          currentIndex: actualIndex,
          currentAudioTime: 0,
          isPlaying: true,
        };
      }),

      addToNextPlay: (track) => set((state) => {
        // 如果队列为空，作为唯一一首
        if (state.queue.length === 0) {
          return {
            queue: [track],
            originalQueue: state.isShuffle ? [track] : [],
            currentIndex: 0,
            // 不自动播放
          };
        }

        const newQueue = [...state.queue];
        const existingIndex = newQueue.findIndex((t) => t.id === track.id);
        
        // 如果这首歌已经在当前播放，不做任何操作
        if (existingIndex === state.currentIndex) {
          return {};
        }

        let targetIndex = state.currentIndex + 1;
        let newCurrentIndex = state.currentIndex;

        if (existingIndex !== -1) {
          // 移除已存在的
          newQueue.splice(existingIndex, 1);
          // 如果移除的位置在当前位置之前，targetIndex 和 currentIndex 都需要减 1
          if (existingIndex < state.currentIndex) {
            targetIndex--;
            newCurrentIndex--;
          }
        }

        // 插入到 targetIndex
        newQueue.splice(targetIndex, 0, track);

        // 处理 originalQueue (随机模式下同步更新)
        let newOriginalQueue = state.originalQueue;
        if (state.isShuffle) {
          const oQueue = [...(state.originalQueue || [])];
          // 如果不在 originalQueue 中，添加进去（这里策略可以是加到最后，或者加到当前原始位置之后？）
          // 简单起见加到最后，因为随机模式下 originalQueue 的顺序不影响播放顺序（除了切回顺序播放时）
          if (!oQueue.some(t => t.id === track.id)) {
            oQueue.push(track);
          }
          newOriginalQueue = oQueue;
        }

        return {
          queue: newQueue,
          currentIndex: newCurrentIndex,
          originalQueue: newOriginalQueue,
        };
      }),


      playTrackAsNext: (track) => set((state) => {
        // 如果队列为空，直接播放
        if (state.queue.length === 0) {
          return {
            queue: [track],
            originalQueue: [track],
            currentIndex: 0,
            currentAudioTime: 0,
            isPlaying: true,
          };
        }

        const newQueue = [...state.queue];
        const existingIndex = newQueue.findIndex((t) => t.id === track.id);
        
        // 如果这首歌已经在当前播放，只需重置时间
        if (existingIndex === state.currentIndex) {
          return { currentAudioTime: 0 };
        }

        let targetIndex = state.currentIndex + 1;

        if (existingIndex !== -1) {
          // 移除已存在的
          newQueue.splice(existingIndex, 1);
          // 如果移除的位置在当前位置之前，targetIndex 需要减 1
          if (existingIndex < state.currentIndex) {
            targetIndex--;
          }
        }

        // 插入到 targetIndex
        newQueue.splice(targetIndex, 0, track);

        // 处理 originalQueue (随机模式下同步更新)
        let newOriginalQueue = state.originalQueue;
        if (state.isShuffle) {
          const oQueue = [...(state.originalQueue || [])];
          if (!oQueue.some(t => t.id === track.id)) {
            oQueue.push(track);
          }
          newOriginalQueue = oQueue;
        }

        return {
          queue: newQueue,
          currentIndex: targetIndex,
          currentAudioTime: 0,
          originalQueue: newOriginalQueue,
        };
      }),

      removeFromQueue: (trackId) => set((state) => {
        const removedIndex = state.queue.findIndex((t) => t.id === trackId);
        if (removedIndex === -1) return {};

        const nextQueue = state.queue.filter((t) => t.id !== trackId);
        const nextOriginalQueue = state.isShuffle
          ? (state.originalQueue || []).filter((t) => t.id !== trackId)
          : state.originalQueue;

        if (nextQueue.length === 0) {
          return {
            queue: [],
            originalQueue: [],
            currentIndex: 0,
            currentAudioTime: 0,
            isPlaying: false,
            isLoading: false,
            duration: 0,
          };
        }

        let nextIndex = state.currentIndex;
        if (removedIndex < state.currentIndex) {
          nextIndex = state.currentIndex - 1;
        } else if (removedIndex === state.currentIndex) {
          nextIndex = Math.min(state.currentIndex, nextQueue.length - 1);
        }

        return {
          queue: nextQueue,
          originalQueue: nextOriginalQueue,
          currentIndex: nextIndex,
        };
      }),

      clearQueue: () =>
        set({
          queue: [],
          originalQueue: [],
          currentIndex: 0,
          currentAudioTime: 0,
          isPlaying: false,
          isLoading: false,
          duration: 0,
        }),
      reshuffle: () => set((state) => {
        if (!state.isShuffle || state.queue.length <= 1) return state;

        // 使用 originalQueue 进行重新打乱
        const sourceQueue = (state.originalQueue && state.originalQueue.length > 0)
          ? state.originalQueue
          : state.queue;

        const currentTrack = state.queue[state.currentIndex];
        if (!currentTrack) return state;
        // 排除当前歌曲
        const rest = sourceQueue.filter((t) => t.id !== currentTrack.id);
        const shuffledRest = shuffleArray(rest);
        const newQueue = [currentTrack, ...shuffledRest];

        return {
          queue: newQueue,
          currentIndex: 0,
        };
      }),
      setCurrentIndex: (index, resetTime = true) =>
        set((state) => ({
          currentIndex:
            state.queue.length === 0
              ? 0
              : Math.min(Math.max(index, 0), state.queue.length - 1),
          currentAudioTime: resetTime ? 0 : state.currentAudioTime,
        })),
    }),
    {
      name: storeKey.MusicStore,
      partialize: (state) => ({
        favorites: state.favorites,
        playlists: state.playlists,
        queue: state.queue,
        currentIndex: state.currentIndex,
        volume: state.volume,
        isRepeat: state.isRepeat,
        isShuffle: state.isShuffle,
        currentAudioTime: state.currentAudioTime,
        quality: state.quality,
        searchSource: state.searchSource,
      }),
    }
  )
);
