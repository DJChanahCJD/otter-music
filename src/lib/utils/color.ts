// src/lib/utils/color.ts

export type HSL = [h: number, s: number, l: number];

/** 核心颜色配置 */
const CONFIG = {
  MIN_S: 30, // 最低饱和度
  MIN_L: 20, // 最低亮度
  MAX_L: 90, // 最高亮度
  IDEAL_L: 26, // 理想背景亮度
  SAFE_S: [25, 65], // 最终安全饱和度范围
  SAFE_L: [18, 35], // 最终安全亮度范围
} as const;

/** Hex 转 RGB */
export function hexToRgb(hex: string): [number, number, number] | null {
  const s = hex.replace(/^#/, '');
  if (s.length !== 6) return null;
  return [
    parseInt(s.slice(0, 2), 16),
    parseInt(s.slice(2, 4), 16),
    parseInt(s.slice(4, 6), 16)
  ];
}

/** RGB 转 HSL */
export function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

/** 提取最佳背景色 */
export function pickBestColor(hexColors: string[]): HSL | null {
  if (!hexColors?.length) return null;

  let best: HSL | null = null;
  let bestScore = -Infinity;

  for (let i = 0; i < hexColors.length; i++) {
    const rgb = hexToRgb(hexColors[i]);
    if (!rgb) continue;

    const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);

    // 1. 硬性过滤：去灰、去极暗、去极亮
    if (s < CONFIG.MIN_S || l < CONFIG.MIN_L || l > CONFIG.MAX_L) continue;

    // 2. 核心评分机制
    let score = 0;
    
    // 面积权重（靠前的颜色面积更大）
    score += Math.max(0, 30 - i * 5); 
    
    // 饱和度加成
    score += s * 0.8;
    
    // 亮度贴近度
    score -= Math.abs(l - CONFIG.IDEAL_L) * 1.2;

    // 冷色偏好加成 (青、蓝、紫)
    if (h >= 160 && h <= 300) score += 10;

    // 肤色惩罚 (规避专辑封面上的人脸)
    const isSkinTone = h >= 10 && h <= 50 && s >= 15 && s <= 70 && l >= 20 && l <= 85;
    if (isSkinTone) score -= 40;

    if (score > bestScore) {
      bestScore = score;
      best = [h, s, l];
    }
  }

  if (!best) return null;

  // 3. 最终 UI 安全钳制 (Safe Clamp)
  return [
    best[0],
    Math.max(CONFIG.SAFE_S[0], Math.min(best[1], CONFIG.SAFE_S[1])),
    Math.max(CONFIG.SAFE_L[0], Math.min(best[2], CONFIG.SAFE_L[1]))
  ];
}