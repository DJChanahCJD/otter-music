/**
 * 汽水音乐播放页背景取色算法
 * 流程：封面像素 k-means 聚类 → 打分混合得主色 → Lab 变换得背景基色 → 生成垂直渐变。
 */

export type RGB = [number, number, number];
export type Lab = [number, number, number];

/** 背景色方案：top 为渐变起点基色，bottom 为渐变终点，dominant 为主色（用于封面投影） */
export interface SodaColors {
  dominant: RGB;
  top: RGB;
  bottom: RGB;
}

/** 选色与映射参数（由 20 张截图联合拟合得到） */
export const PARAMS = {
  k: 8,
  iters: 100,
  seed: 1,
  alpha: 1.88,
  beta: 0.25,
  l0: 35,
  sigma: 55,
  lScale: 1.01,
  lBias: -9.2,
  lMin: 22, // 原算法:24.55
  lMax: 34, // 原：69.34
  cGain: 1.13,
  cMax: 70,
  gradientDL: -12,  // 原：-15
} as const;

/** 固定种子的伪随机数发生器，保证取色结果可复现。 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** sRGB(0-255) → CIELab，输入 [r,g,b] 返回 [L,a,b]。 */
export function srgbToLab(rgb: RGB): Lab {
  const c = [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255].map(
    (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
  );
  const x = (0.4124 * c[0] + 0.3576 * c[1] + 0.1805 * c[2]) / 0.9505;
  const y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const z = (0.0193 * c[0] + 0.1192 * c[1] + 0.9505 * c[2]) / 1.089;
  const f = [x, y, z].map((v) =>
    v > 0.008856 ? Math.cbrt(v) : (7.787 * v) + 16 / 116
  );
  return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])];
}

/** CIELab → sRGB(0-255)，输入 [L,a,b] 返回 [r,g,b]，越界截断。 */
export function labToSrgb(lab: Lab): RGB {
  const fy = (lab[0] + 16) / 116;
  const fx = fy + lab[1] / 500;
  const fz = fy - lab[2] / 200;

  /** Lab f 函数反推 XYZ 分量 */
  const finv = (t: number) => {
    const t3 = t * t * t;
    return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787;
  };

  const x = finv(fx) * 0.9505;
  const y = finv(fy);
  const z = finv(fz) * 1.089;
  const lin = [
    3.2406 * x - 1.5372 * y - 0.4986 * z,
    -0.9689 * x + 1.8758 * y + 0.0415 * z,
    0.0557 * x - 0.204 * y + 1.057 * z,
  ];
  return lin.map((v) => {
    const s = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return Math.min(255, Math.max(0, Math.round(s * 255)));
  }) as RGB;
}

/** 对 RGB 像素做 k-means，返回按权重降序的 { centers, weights }。 */
export function kmeans(
  pixels: RGB[],
  k: number = PARAMS.k,
  iters: number = PARAMS.iters,
  seed: number = PARAMS.seed
): { centers: RGB[]; weights: number[] } {
  const rng = mulberry32(seed);
  const pool = pixels.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    // 洗牌后取前 k 个作为初始中心
    const j = Math.floor(rng() * (i + 1));
    const t = pool[i];
    pool[i] = pool[j];
    pool[j] = t;
  }
  const centers = pool.slice(0, k).map((p) => p.slice()) as RGB[];
  const assign = new Array<number>(pixels.length);
  for (let it = 0; it < iters; it++) {
    for (let p = 0; p < pixels.length; p++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const dr = pixels[p][0] - centers[c][0];
        const dg = pixels[p][1] - centers[c][1];
        const db = pixels[p][2] - centers[c][2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      assign[p] = best;
    }
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (let q = 0; q < pixels.length; q++) {
      const s = sums[assign[q]];
      s[0] += pixels[q][0];
      s[1] += pixels[q][1];
      s[2] += pixels[q][2];
      s[3]++;
    }
    for (let m = 0; m < k; m++) {
      if (sums[m][3] > 0) {
        centers[m] = [
          sums[m][0] / sums[m][3],
          sums[m][1] / sums[m][3],
          sums[m][2] / sums[m][3],
        ];
      }
    }
  }
  const counts = new Array<number>(k).fill(0);
  for (let n = 0; n < assign.length; n++) counts[assign[n]]++;
  const order = centers
    .map((_, idx) => idx)
    .sort((a, b) => counts[b] - counts[a]);
  return {
    centers: order.map((i) => centers[i]),
    weights: order.map((i) => counts[i] / assign.length),
  };
}

/** 提取主色：按 权重^α × 色度^β × 亮度高斯 打分，对聚类中心加权混合。 */
export function dominantColor(pixels: RGB[]): RGB {
  const km = kmeans(pixels);
  const score: number[] = [];
  let total = 0;
  for (let i = 0; i < km.centers.length; i++) {
    const lab = srgbToLab(km.centers[i]);
    const chroma = Math.max(Math.hypot(lab[1], lab[2]), 1e-3);
    const gauss = Math.exp(
      -0.5 * Math.pow((lab[0] - PARAMS.l0) / PARAMS.sigma, 2)
    );
    const v =
      Math.pow(km.weights[i], PARAMS.alpha) *
      Math.pow(chroma, PARAMS.beta) *
      gauss;
    score.push(v);
    total += v;
  }
  const out: RGB = [0, 0, 0];
  for (let j = 0; j < km.centers.length; j++) {
    const w = total > 0 ? score[j] / total : 0;
    out[0] += km.centers[j][0] * w;
    out[1] += km.centers[j][1] * w;
    out[2] += km.centers[j][2] * w;
  }
  return out;
}

/** 由主色计算背景基色：Lab 下压缩并钳制亮度、增益色度、保持色相。 */
export function backgroundColor(pixels: RGB[]): RGB {
  const lab = srgbToLab(dominantColor(pixels));
  const l = Math.min(
    PARAMS.lMax,
    Math.max(PARAMS.lMin, PARAMS.lScale * lab[0] + PARAMS.lBias)
  );
  const c = Math.min(PARAMS.cMax, Math.hypot(lab[1], lab[2]) * PARAMS.cGain);
  const h = Math.atan2(lab[2], lab[1]);
  return labToSrgb([l, c * Math.cos(h), c * Math.sin(h)]);
}

/** 生成背景渐变起止色：顶部为基色，底部为基色亮度 -15。 */
export function gradientStops(pixels: RGB[]): { top: RGB; bottom: RGB } {
  const base = srgbToLab(backgroundColor(pixels));
  const bottom: Lab = [
    Math.max(base[0] + PARAMS.gradientDL, 0),
    base[1],
    base[2],
  ];
  return { top: labToSrgb(base), bottom: labToSrgb(bottom) };
}

/** 从 RGBA 像素缓冲（如 96×96 canvas 的 getImageData 结果）提取背景色方案。 */
export function extractFromPixels(data: Uint8ClampedArray): SodaColors {
  const pixels: RGB[] = [];
  for (let i = 0; i < data.length; i += 4) {
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }
  const stops = gradientStops(pixels);
  return {
    dominant: dominantColor(pixels).map(Math.round) as RGB,
    top: stops.top,
    bottom: stops.bottom,
  };
}
