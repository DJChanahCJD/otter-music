import { colord } from "colord";

export type RGB = [r: number, g: number, b: number];
export type Lab = [L: number, a: number, b: number];

/** 颜色候选数据，包含像素占比 */
export interface SwatchData {
  hex: string;
  population?: number;
}

/** 背景色方案：top 为渐变起点基色，bottom 为渐变终点，dominant 为主色（用于封面投影） */
export interface BackgroundColors {
  top: RGB;
  bottom: RGB;
  dominant: RGB;
}

/**
 * 汽水音乐播放页取色算法参数（由 20 张真实截图回归拟合得到）。
 * 与原版差异：亮度上限收紧（原版 lMax=69.34 面向可随背景切换文字颜色的页面），
 * 本项目播放器固定白字 UI，过亮背景会导致文字对比度不足。
 */
const SODA_PARAMS = {
  /** 主色打分：权重指数（压扁弱簇影响） */
  alpha: 1.88,
  /** 主色打分：色度指数 */
  beta: 0.25,
  /** 主色打分：亮度高斯中心与宽度（偏好中间调色彩） */
  l0: 35,
  sigma: 55,
  /** 基色 Lab 亮度映射：L' = lScale·L + lBias，色相保持不变 */
  lScale: 1.01,
  lBias: -9.2,
  lMin: 24.55,
  /** 亮度软压缩阈值：超过该值的部分按 lCompress 衰减 */
  lKnee: 24,
  lCompress: 0.45,
  /** 软压缩后的硬上限（兜底，仅在极亮封面触发） */
  lMax: 32,
  /** 基色色度增益与上限 */
  cGain: 1.13,
  cMax: 70,
  /** 渐变底部相对顶部的 Lab 亮度差 */
  gradientDL: -15,
} as const;

/** sRGB(0-255) → CIELab，输入 [r,g,b] 返回 [L,a,b] */
export function srgbToLab(rgb: RGB): Lab {
  const c = [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255].map((v) =>
    v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  );
  const x = (0.4124 * c[0] + 0.3576 * c[1] + 0.1805 * c[2]) / 0.9505;
  const y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const z = (0.0193 * c[0] + 0.1192 * c[1] + 0.9505 * c[2]) / 1.089;
  const f = [x, y, z].map((v) =>
    v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116
  );
  return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])];
}

/** CIELab → sRGB(0-255)，输入 [L,a,b] 返回 [r,g,b]，越界截断 */
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** 过亮基色的亮度软压缩：超阈值部分按系数衰减，压低调子的同时保留亮封面之间的相对差异 */
function compressLightness(l: number): number {
  return l <= SODA_PARAMS.lKnee
    ? l
    : SODA_PARAMS.lKnee + (l - SODA_PARAMS.lKnee) * SODA_PARAMS.lCompress;
}

/**
 * 从调色板候选中提取播放器背景色方案（汽水音乐取色算法）：
 * 1. 对候选按 权重^1.88 × 色度^0.25 × 亮度高斯(L0=35, σ=55) 打分，加权混合得主色；
 * 2. 主色经 Lab 变换（亮度线性映射 + 过亮软压缩、色度增益、色相保持）得到渐变基色；
 * 3. 渐变顶部为基色，底部为基色 Lab 亮度 −15。
 */
export function extractBackgroundColors(
  swatches: SwatchData[]
): BackgroundColors | null {
  const parsed = (swatches ?? [])
    .map((s) => ({ hex: s.hex, population: s.population ?? 0 }))
    .filter((s) => colord(s.hex).isValid());
  if (!parsed.length) return null;

  const totalPopulation = parsed.reduce((sum, s) => sum + s.population, 0);
  const clusters = parsed.map(({ hex, population }) => {
    const { r, g, b } = colord(hex).toRgb();
    const rgb: RGB = [Math.round(r), Math.round(g), Math.round(b)];
    return {
      rgb,
      lab: srgbToLab(rgb),
      // 无像素占比数据时退化为等权
      weight:
        totalPopulation > 0 ? population / totalPopulation : 1 / parsed.length,
    };
  });

  // 按权重、色度、亮度打分并加权混合得主色
  let dominant: RGB = [0, 0, 0];
  let totalScore = 0;
  for (const { rgb, lab, weight } of clusters) {
    const chroma = Math.max(Math.hypot(lab[1], lab[2]), 1e-3);
    const gauss = Math.exp(
      -0.5 * Math.pow((lab[0] - SODA_PARAMS.l0) / SODA_PARAMS.sigma, 2)
    );
    const score =
      Math.pow(weight, SODA_PARAMS.alpha) *
      Math.pow(chroma, SODA_PARAMS.beta) *
      gauss;
    totalScore += score;
    dominant = [
      dominant[0] + rgb[0] * score,
      dominant[1] + rgb[1] * score,
      dominant[2] + rgb[2] * score,
    ];
  }
  dominant = dominant.map((v) => v / totalScore) as RGB;

  // 基色变换：Lab 下钳制亮度、增益色度、保持色相
  const domLab = srgbToLab(dominant.map(Math.round) as RGB);
  const l = clamp(
    compressLightness(SODA_PARAMS.lScale * domLab[0] + SODA_PARAMS.lBias),
    SODA_PARAMS.lMin,
    SODA_PARAMS.lMax
  );
  const chroma = Math.min(
    SODA_PARAMS.cMax,
    Math.hypot(domLab[1], domLab[2]) * SODA_PARAMS.cGain
  );
  const hue = Math.atan2(domLab[2], domLab[1]);
  const topLab: Lab = [l, chroma * Math.cos(hue), chroma * Math.sin(hue)];
  const bottomLab: Lab = [
    Math.max(l + SODA_PARAMS.gradientDL, 0),
    topLab[1],
    topLab[2],
  ];

  return {
    top: labToSrgb(topLab),
    bottom: labToSrgb(bottomLab),
    dominant: dominant.map(Math.round) as RGB,
  };
}
