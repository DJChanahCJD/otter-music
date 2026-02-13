// lib/utils/index.ts
import clsx, { type ClassValue } from "clsx";
import pLimit from "p-limit";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 异步重试工具
 * @param fn 异步函数
 * @param times 重试次数
 * @param delay 间隔(ms)
 */
export async function retry<T>(
  fn: () => Promise<T>,
  times = 2,
  delay = 500
): Promise<T> {
  let error: unknown;
  for (let i = 0; i <= times; i++) {
    try {
      return await fn();
    } catch (e) {
      error = e;
      if (i < times) await new Promise(r => setTimeout(r, delay));
    }
  }
  throw error;
}

/**
 * 并发 I/O 处理器
 * @param items 任务项
 * @param worker 执行器
 * @param onProgress 进度回调
 * @param concurrency 并发数
 */
export async function processBatchIO<T>(
  items: T[],
  worker: (item: T, index: number) => Promise<void>,
  onProgress?: (done: number, total: number) => void,
  concurrency = 6
  
): Promise<void> {
  const total = items.length;
  if (!total) return;
  const limit = pLimit(concurrency);
  let done = 0;
  await Promise.all(
    items.map((item, index) =>
      limit(async () => {
        await worker(item, index);
        onProgress?.(++done, total);
      })
    )
  );
}

/** 帧让位 */
const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

/**
 * CPU 密集型分帧处理器
 * @param items 数据项
 * @param worker 执行器
 * @param onProgress 进度回调
 * @param slice 每帧处理数量
 */
export async function processBatchCPU<T>(
  items: T[],
  worker: (item: T, index: number) => void | Promise<void>,
  onProgress?: (done: number, total: number) => void,
  slice = 50
): Promise<void> {
  const total = items.length;
  if (!total) return;
  let done = 0;
  for (let i = 0; i < total; i += slice) {
    const chunk = items.slice(i, i + slice);
    for (const [idx, item] of chunk.entries()) {
      await worker(item, i + idx);
    }
    done += chunk.length;
    onProgress?.(done, total);
    await nextFrame();
  }
}