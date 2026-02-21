import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { storeKey } from './store-keys'

interface DownloadStoreState {
  /**
   * key -> uri
   */
  records: Record<string, string>

  hasRecord: (key: string) => boolean
  getUri: (key: string) => string | undefined
  addRecord: (key: string, uri: string) => void
  removeRecord: (key: string) => void
  clear: () => void
}

export const useDownloadStore = create<DownloadStoreState>()(
  persist(
    (set, get) => ({
      records: {},
      lastCleanupTime: 0,

      hasRecord: (key) => !!get().records[key],

      getUri: (key) => get().records[key],

      addRecord: (key, uri) =>
        set((state) => ({
          records: {
            ...state.records,
            [key]: uri,
          },
        })),

      removeRecord: (key) =>
        set((state) => {
          const newRecords = { ...state.records }
          delete newRecords[key]
          return { records: newRecords }
        }),

      clear: () => set({ records: {} }),
    }),
    {
      name: storeKey.DownloadStore,
      partialize: (state) => ({
        records: state.records,
      }),
    }
  )
)