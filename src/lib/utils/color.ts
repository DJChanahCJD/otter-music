export type HSL = [h: number, s: number, l: number];

export function hexToRgb(hex: string): [number, number, number] | null {
  const s = hex.replace(/^#/, "");
  const match = s.match(s.length === 3 ? /./g : /../g);
  if (!match || match.length !== 3) return null;
  
  const [r, g, b] = match.map(c => parseInt(c.length === 1 ? c + c : c, 16));
  return [r, g, b].some(Number.isNaN) ? null : [r, g, b];
}

export function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];

  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  
  return [Math.round(h * 60), Math.round(s * 100), Math.round(l * 100)];
}

export function pickBestColor(candidates: any[]): HSL | null {
  if (!candidates?.length) return null;
  let best = { score: -Infinity, hsl: null as HSL | null };

  for (const item of candidates) {
    const rgb = hexToRgb(typeof item === "string" ? item : item?.hex || "");
    if (!rgb) continue;

    const [h, s, l] = rgbToHsl(...rgb);

    // 基础过滤：前置判断，尽早跳出循环
    if (l > 88 || l < 8 || s < 12) continue;

    // 分数计算精简版
    let score = (s >= 35 && s <= 80 ? 16 : s >= 20 ? 8 : -10) + (l >= 25 && l <= 65 ? 12 : -6);
    
    if ((h >= 200 && h <= 280) || (h >= 300 && h <= 345)) score += 20;
    else if (h >= 160 && h <= 199) score += 12;
    else if (h <= 20 || h >= 345) score += 8;
    else if (h >= 35 && h <= 95) score -= 18;

    // 脏色惩罚内联
    if (((h >= 35 && h <= 75) || (h >= 80 && h <= 95)) && s >= 18 && l >= 20 && l <= 70) score -= 28;

    // 仅当分数高于历史最高时，才进行归一化计算（减少性能开销）
    if (score > best.score) {
      const isMud = h >= 35 && h <= 75;
      const nextS = isMud ? Math.max(28, Math.min(s, 55)) : s;
      
      best = {
        score,
        hsl: [
          Math.round(isMud ? Math.max(18, h - 18) : h),
          Math.round(Math.max(24, Math.min(nextS, 68))),
          Math.round(Math.max(18, Math.min(28, l)))
        ]
      };
    }
  }

  return best.hsl;
}