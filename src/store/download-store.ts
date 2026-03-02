import { create } from 'zustand'
import {
  saveDownloadRecordsToDisk,
  loadDownloadRecordsFromDisk,
} from '@/lib/utils/download'

interface DownloadStoreState {
  /**
   * key -> uri
   */
  records: Record<string, string>

  /** 初始化：从磁盘恢复 */
  init: () => Promise<void>

  hasRecord: (key: string) => boolean
  getUri: (key: string) => string | undefined
  addRecord: (key: string, uri: string) => Promise<void>
  removeRecord: (key: string) => Promise<void>
  clear: () => Promise<void>
}

export const useDownloadStore = create<DownloadStoreState>((set, get) => ({
  records: {},

  /**
   * App 启动时调用
   * 只从磁盘恢复一次
   */
  init: async () => {
    try {
      const diskRecords = await loadDownloadRecordsFromDisk()
      console.log('从磁盘加载下载记录:', diskRecords)

      if (diskRecords && typeof diskRecords === 'object') {
        set({ records: diskRecords })
      }
    } catch (error) {
      console.error('恢复下载记录失败:', error)
    }
  },

  hasRecord: (key) => !!get().records[key],

  getUri: (key) => get().records[key],

  /**
   * 添加记录
   * 1. 更新内存
   * 2. 同步写入磁盘
   */
  addRecord: async (key, uri) => {
    const records = {
      ...get().records,
      [key]: uri,
    }

    set({ records })

    try {
      await saveDownloadRecordsToDisk(records)
    } catch (error) {
      console.error('保存下载记录失败:', error)
    }
  },

  /**
   * 删除记录
   */
  removeRecord: async (key) => {
    const records = { ...get().records }
    delete records[key]

    set({ records })

    try {
      await saveDownloadRecordsToDisk(records)
    } catch (error) {
      console.error('删除下载记录失败:', error)
    }
  },

  /**
   * 清空记录
   */
  clear: async () => {
    set({ records: {} })

    try {
      await saveDownloadRecordsToDisk({})
    } catch (error) {
      console.error('清空下载记录失败:', error)
    }
  },
}))