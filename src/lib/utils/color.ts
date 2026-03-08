export type HSL = [h: number, s: number, l: number];

const CONFIG = {
  MIN_S: 18,
  MIN_L: 12,
  MAX_L: 88,

  SAFE_S: [22, 58],
  SAFE_L: [16, 32],
} as const;

export function hexToRgb(hex: string): [number, number, number] | null {
  const s = hex.replace(/^#/, '');
  if (s.length !== 6) return null;
  return [
    parseInt(s.slice(0, 2), 16),
    parseInt(s.slice(2, 4), 16),
    parseInt(s.slice(4, 6), 16),
  ];
}

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

  return [
    Math.round(h * 360),
    Math.round(s * 100),
    Math.round(l * 100),
  ];
}

function scoreByDistance(value: number, ideal: number, tolerance: number, weight: number): number {
  return Math.max(0, weight - Math.abs(value - ideal) * (weight / tolerance));
}

function getIdealLightness(h: number): number {
  if (h >= 0 && h < 60) return 21;      // 红橙黄更深一点
  if (h >= 60 && h < 160) return 24;    // 绿中间
  if (h >= 160 && h <= 300) return 27;  // 青蓝紫可稍亮
  return 23;                            // 品红
}

function hueComfortBonus(h: number, s: number, l: number): number {
  if (h >= 170 && h <= 285) return 12; // 青蓝紫最稳
  if (h > 100 && h < 170) return 5;    // 绿也比较舒服

  // 暖色高饱和/偏亮时容易躁
  if (h < 60 || h >= 330) {
    if (s > 60 || l > 30) return -10;
    return -2;
  }

  return 0;
}

function isLikelySkinTone(h: number, s: number, l: number): boolean {
  return h >= 15 && h <= 38 && s >= 20 && s <= 55 && l >= 35 && l <= 75;
}

function softenToRange(value: number, min: number, max: number, strength = 0.35): number {
  if (value < min) return Math.round(value + (min - value) * strength);
  if (value > max) return Math.round(value - (value - max) * strength);
  return Math.round(value);
}

export function pickBestColor(hexColors: string[]): HSL | null {
  if (!hexColors?.length) return null;

  let best: HSL | null = null;
  let bestScore = -Infinity;

  for (let i = 0; i < hexColors.length; i++) {
    const rgb = hexToRgb(hexColors[i]);
    if (!rgb) continue;

    const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);

    // 基础过滤：允许更多“柔和深色”进来
    if (s < CONFIG.MIN_S || l < CONFIG.MIN_L || l > CONFIG.MAX_L) continue;

    let score = 0;

    // 面积权重：保留主色氛围，但别过分偏置第一项
    score += Math.max(8, 26 - i * 4);

    // 饱和度：中等最舒服，不是越高越好
    score += scoreByDistance(s, 40, 24, 24);

    // 亮度：按色相选择最舒服区间
    score += scoreByDistance(l, getIdealLightness(h), 12, 30);

    // 色相舒适度
    score += hueComfortBonus(h, s, l);

    // 太灰也不好，但不用一刀切
    if (s < 24) score -= 8;

    // 太亮的彩色背景容易浮躁
    if (l > 32 && s > 45) score -= 10;

    // 疑似肤色：弱惩罚
    if (isLikelySkinTone(h, s, l)) score -= 12;

    if (score > bestScore) {
      bestScore = score;
      best = [h, s, l];
    }
  }

  if (!best) return null;

  // 轻柔修正，不要硬夹死原色气质
  return [
    best[0],
    softenToRange(best[1], CONFIG.SAFE_S[0], CONFIG.SAFE_S[1]),
    softenToRange(best[2], CONFIG.SAFE_L[0], CONFIG.SAFE_L[1]),
  ];
}