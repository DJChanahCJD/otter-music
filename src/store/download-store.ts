import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { storeKey } from './store-keys'
import { saveDownloadRecordsToDisk, loadDownloadRecordsFromDisk } from '@/lib/utils/download'

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

      hasRecord: (key) => !!get().records[key],

      getUri: (key) => get().records[key],

      addRecord: (key, uri) =>
        set((state) => {
          const records = {
            ...state.records,
            [key]: uri,
          }
          saveDownloadRecordsToDisk(records)
          return { records }
        }),

      removeRecord: (key) =>
        set((state) => {
          const records = { ...state.records }
          delete records[key]
          saveDownloadRecordsToDisk(records)
          return { records }
        }),

      clear: () => {
        saveDownloadRecordsToDisk({})
        set({ records: {} })
      },
    }),
    {
      name: storeKey.DownloadStore,
      partialize: (state) => ({
        records: state.records,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && Object.keys(state.records).length === 0) {
          setTimeout(async () => {
            const diskRecords = await loadDownloadRecordsFromDisk()
            if (diskRecords && Object.keys(diskRecords).length > 0) {
              useDownloadStore.setState({ records: diskRecords })
            }
          }, 0)
        }
      },
    }
  )
)