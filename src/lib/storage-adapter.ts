import { StateStorage } from 'zustand/middleware'
import { get, set, del } from 'idb-keyval'

/**
 * 基于 idb-keyval 的异步存储适配器
 * 用于替代 localStorage，解决容量限制和主线程阻塞问题
 * 
 * 包含自动迁移逻辑：
 * 如果 IndexedDB 中没有数据，尝试从 localStorage 读取并迁移
 */
export const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    // 1. 尝试从 IndexedDB 读取
    const value = await get(name)
    if (value) {
      return value
    }

    // 2. 如果 IndexedDB 为空，尝试从 localStorage 读取（迁移逻辑）
    const localValue = localStorage.getItem(name)
    if (localValue) {
      try {
        // 迁移数据到 IndexedDB
        await set(name, localValue)
        // 迁移成功后清理 localStorage
        localStorage.removeItem(name)
        console.log(`[Storage] Migrated ${name} from localStorage to IndexedDB`)
        return localValue
      } catch (error) {
        console.error(`[Storage] Failed to migrate ${name}:`, error)
        // 如果写入失败，仍返回 localStorage 的值，确保应用可用
        return localValue
      }
    }

    return null
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value)
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name)
    // 同时也清理 localStorage，确保彻底删除
    localStorage.removeItem(name)
  },
}
