// lib/utils/color.ts

export type HSL = [h: number, s: number, l: number];

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
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  
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

export function pickBestColor(candidates: string[] | any[]): HSL | null {
  if (!candidates?.length) return null;

  for (const item of candidates) {
    const hex = typeof item === 'string' ? item : item.hex;
    const rgb = hexToRgb(hex);
    if (!rgb) continue;

    let [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);

    // 1. 过滤无效背景色
    if (l > 90 || l < 10) continue;

    // 2. 背景化处理：强制将颜色压暗、降噪，适应深色模式
    s = Math.min(s, 85); // 饱和度最高限制在 85% 以内，避免刺眼
    l = Math.min(Math.max(l, 18), 32); // 亮度强制卡在 18% - 32% 的深色安全区间

    // 直接返回顺位最靠前、且符合条件的第一个颜色
    return [h, s, l];
  }

  return null;
}