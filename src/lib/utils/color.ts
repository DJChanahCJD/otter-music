import { colord } from "colord";

export type HSL = [h: number, s: number, l: number];

/**
 * 从颜色候选列表中选择并优化最适合暗色模式播放器的颜色
 */
export function pickBestColor(candidates: (string | { hex: string })[]): HSL | null {
  if (!candidates?.length) return null;

  let bestScore = -Infinity;
  let bestHsl: HSL | null = null;

  for (const item of candidates) {
    const hex = typeof item === "string" ? item : item?.hex;
    if (!hex) continue;

    const color = colord(hex);
    if (!color.isValid()) continue;

    const { h, s, l } = color.toHsl();

    // 1. 基础过滤：排除极极端颜色
    if (l > 88 || l < 8 || s < 12) continue;

    // 2. 计算评分
    let score = 0;
    score += (s >= 35 && s <= 80) ? 16 : (s >= 20 ? 8 : -10);
    score += (l >= 25 && l <= 65) ? 12 : -6;

    // 色相偏好
    if ((h >= 200 && h <= 280) || (h >= 300 && h <= 345)) score += 20; // 蓝紫
    else if (h >= 160 && h <= 199) score += 12; // 青
    else if (h <= 20 || h >= 345) score += 8;  // 红

    // 脏色惩罚 (35-95度区间)
    const isMud = h >= 35 && h <= 75;
    if ((isMud || (h > 75 && h <= 95)) && s >= 18 && l >= 20 && l <= 70) {
      score -= 20;
    }

    // 3. 更新最优解并进行归一化
    if (score > bestScore) {
      bestScore = score;
      
      // 针对“泥土色”偏移色相并压制饱和度，强制低亮度适配暗色模式
      const finalH = isMud ? Math.max(18, h - 18) : h;
      const limitS = isMud ? Math.max(28, Math.min(s, 55)) : s;
      
      bestHsl = [
        Math.round(finalH),
        Math.round(Math.max(24, Math.min(limitS, 68))),
        Math.round(Math.max(18, Math.min(28, l)))
      ];
    }
  }

  return bestHsl;
}