import { useEffect, useRef, useState } from "react";
import {
  extractFromPixels,
  type SodaColors,
} from "@/lib/utils/soda-color";

/** 取色降采样尺寸（与算法标定时使用的 96×96 输入一致） */
const SAMPLE_SIZE = 96;

interface UseCoverColorsResult {
  colors: SodaColors | null;
  error: Error | null;
}

/** 以 crossOrigin 加载图片，跨域封面无 CORS 头时由 getImageData 抛错走 error 分支 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("封面加载失败"));
    img.src = url;
  });
}

/**
 * 从封面图片提取汽水算法背景色方案：
 * 将封面绘制到 96×96 离屏 canvas 取像素，再交给 soda-color 的 k-means 取色流程。
 */
export function useCoverColors(url: string | null): UseCoverColorsResult {
  const [colors, setColors] = useState<SodaColors | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const latestUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!url) return;

    let cancelled = false;
    latestUrlRef.current = url;

    /** 绘制降采样 canvas 并执行取色算法 */
    async function extract(imageUrl: string): Promise<SodaColors> {
      const img = await loadImage(imageUrl);
      const canvas = document.createElement("canvas");
      canvas.width = SAMPLE_SIZE;
      canvas.height = SAMPLE_SIZE;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Canvas 2D 上下文不可用");
      ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
      const data = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
      return extractFromPixels(data);
    }

    extract(url)
      .then((result) => {
        if (!cancelled && latestUrlRef.current === url) {
          setColors(result);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled && latestUrlRef.current === url) {
          setColors(null);
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return { colors, error };
}
