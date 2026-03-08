// lib/utils/color.ts
export type HSL = [h: number, s: number, l: number];

export type CandidateColor = string | { hex: string; weight?: number };

const CONFIG = {
  MIN_S: 18, MIN_L: 12, MAX_L: 88,
  SAFE_S: [22, 58], SAFE_L: [16, 32],
} as const;

const normHue = (h: number) => (h % 360 + 360) % 360;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function hexToRgb(hex: string): [number, number, number] | null {
  let s = hex.trim().replace(/^#/, '');
  if (s.length === 3) s = s.split('').map(c => c + c).join('');
  if (s.length !== 6) return null;
  return [
    parseInt(s.slice(0, 2), 16),
    parseInt(s.slice(2, 4), 16),
    parseInt(s.slice(4, 6), 16),
  ];
}

export function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0, s = max === min ? 0 : (max + min > 1 ? d / (2 - max - min) : d / (max + min));
  
  if (max !== min) {
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return [Math.round(h * 60), Math.round(s * 100), Math.round((max + min) * 50)];
}

// 采用高斯型打分，比线性衰减更平滑
function scoreByDistance(value: number, ideal: number, tolerance: number, weight: number): number {
  const x = (value - ideal) / tolerance;
  return weight * Math.exp(-(x * x));
}

// 连续亮度目标，避免色相跨区间时突变
function getIdealLightness(h: number): number {
  const hue = normHue(h);
  if (hue < 60) return lerp(21, 24, hue / 60); 
  if (hue < 160) return lerp(24, 27, (hue - 60) / 100);
  if (hue < 300) return 27; 
  return lerp(27, 23, (hue - 300) / 60); 
}

// 整合色相舒适度与泥土脏色惩罚
function getHueScore(h: number, s: number, l: number): number {
  const hue = normHue(h);
  let score = 0;
  
  if (hue >= 170 && hue <= 285) score += 12; // 青蓝紫最稳
  else if (hue > 100 && hue < 170) score += 5; // 绿相对舒服
  else if (hue < 60 || hue >= 330) score += (s > 60 || l > 30) ? -10 : -2; // 暖色高饱和易躁

  // 暖棕、泥黄、偏脏黄绿惩罚
  if (hue >= 18 && hue <= 52 && s >= 18 && s <= 46 && l >= 22 && l <= 58) score -= 8;
  if (hue >= 52 && hue <= 78 && s >= 20 && s <= 54 && l >= 22 && l <= 50) score -= 6;
  
  return score;
}

// 对攻击性强的色相做极轻微修正
function softenHue(h: number, s: number, l: number): number {
  let hue = normHue(h);
  if (hue >= 45 && hue <= 70 && s > 45) hue += 8; // 刺眼黄往橄榄/金棕收
  if (hue >= 100 && hue <= 140 && s > 55) hue += 10; // 高饱绿往青收
  if ((hue <= 20 || hue >= 350) && s > 50 && l > 18) hue += 8; // 红橙往酒红收
  return Math.round(normHue(hue));
}

// 动态修正力度：偏离越多，拉回力度越大
function softenToRange(value: number, min: number, max: number): number {
  const diff = value < min ? min - value : value > max ? value - max : 0;
  if (!diff) return Math.round(value);
  const strength = diff > 12 ? 0.6 : 0.35; 
  return Math.round(value < min ? value + diff * strength : value - diff * strength);
}

export function pickBestColor(candidates: CandidateColor[]): HSL | null {
  if (!candidates?.length) return null;

  let best: HSL | null = null;
  let bestScore = -Infinity;

  for (let i = 0; i < candidates.length; i++) {
    const item = candidates[i];
    const hex = typeof item === 'string' ? item : item.hex;
    const weight = typeof item === 'string' ? 1 : clamp(item.weight ?? 1, 0, 1);
    
    const rgb = hexToRgb(hex);
    if (!rgb) continue;

    const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);

    if (s < CONFIG.MIN_S || l < CONFIG.MIN_L || l > CONFIG.MAX_L) continue;

    // 基础权重 = 面积权重 + 顺序偏置
    let score = (weight * 18) + Math.max(0, 8 - i * 2);

    score += scoreByDistance(s, 40, 24, 24);
    score += scoreByDistance(l, getIdealLightness(h), 12, 30);
    score += getHueScore(h, s, l);

    if (s < 24) score -= 8;
    if (l > 32 && s > 45) score -= 10;
    if (h >= 15 && h <= 38 && s >= 20 && s <= 55 && l >= 35 && l <= 75) score -= 12; // 肤色惩罚

    if (score > bestScore) {
      bestScore = score;
      best = [h, s, l];
    }
  }

  if (!best) return null;

  return [
    softenHue(best[0], best[1], best[2]),
    softenToRange(best[1], CONFIG.SAFE_S[0], CONFIG.SAFE_S[1]),
    softenToRange(best[2], CONFIG.SAFE_L[0], CONFIG.SAFE_L[1]),
  ];
}