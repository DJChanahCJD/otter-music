import { describe, expect, it } from "vitest";
import {
  extractFromPixels,
  kmeans,
  labToSrgb,
  srgbToLab,
  type RGB,
} from "@/lib/utils/soda-color";

/** 构造 96×96 的纯色 RGBA 像素缓冲 */
function solidPixels(rgb: RGB): Uint8ClampedArray {
  const data = new Uint8ClampedArray(96 * 96 * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
    data[i + 3] = 255;
  }
  return data;
}

describe("srgbToLab / labToSrgb", () => {
  /** 与取色算法标定使用的 CIELab 参考值对齐（白 L=100、中灰 53.59、纯红 53.23/80.11/67.22） */
  it("sRGB 参考值转换正确", () => {
    expect(srgbToLab([255, 255, 255])[0]).toBeCloseTo(100, 1);
    expect(srgbToLab([128, 128, 128])[0]).toBeCloseTo(53.59, 1);
    const red = srgbToLab([255, 0, 0]);
    expect(red[0]).toBeCloseTo(53.23, 1);
    expect(red[1]).toBeCloseTo(80.11, 1);
    expect(red[2]).toBeCloseTo(67.22, 1);
  });

  it("Lab → sRGB 往返误差 ≤ 1", () => {
    const samples = [
      [255, 255, 255],
      [0, 0, 0],
      [128, 128, 128],
      [51, 85, 170],
      [221, 85, 68],
      [30, 90, 88],
    ];
    for (const rgb of samples) {
      const roundtrip = labToSrgb(srgbToLab(rgb as RGB));
      for (let i = 0; i < 3; i++) {
        expect(Math.abs(roundtrip[i] - rgb[i])).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("kmeans", () => {
  it("固定种子下结果可复现", () => {
    const pixels: RGB[] = Array.from({ length: 200 }, (_, i) => [
      (i * 7) % 256,
      (i * 13) % 256,
      (i * 29) % 256,
    ]);
    const a = kmeans(pixels);
    const b = kmeans(pixels);
    expect(a.centers).toEqual(b.centers);
    expect(a.weights).toEqual(b.weights);
  });
});

describe("extractFromPixels", () => {
  it("低色度下渐变底部为顶部 Lab 亮度 −10，且色相保持一致", () => {
    // 选用低色度颜色，避免 Lab→RGB 越界截断干扰亮度验证
    const result = extractFromPixels(solidPixels([122, 122, 94]));
    const topLab = srgbToLab(result.top);
    const bottomLab = srgbToLab(result.bottom);
    expect(topLab[0] - bottomLab[0]).toBeGreaterThan(9);
    expect(topLab[0] - bottomLab[0]).toBeLessThan(11);
    // 渐变仅改变亮度，a/b（色相与色度）保持不变
    expect(Math.abs(bottomLab[1] - topLab[1])).toBeLessThan(2);
    expect(Math.abs(bottomLab[2] - topLab[2])).toBeLessThan(2);
  });

  it("高色度下渐变底部仍严格暗于顶部（越界截断时允许 ΔL 收窄）", () => {
    const result = extractFromPixels(solidPixels([51, 85, 170]));
    const topL = srgbToLab(result.top)[0];
    const bottomL = srgbToLab(result.bottom)[0];
    expect(topL - bottomL).toBeGreaterThan(5);
  });

  it("基色亮度被钳制到算法区间 [12, 28]（允许取整量化误差）", () => {
    const dark = extractFromPixels(solidPixels([5, 5, 8]));
    const bright = extractFromPixels(solidPixels([240, 232, 200]));
    expect(srgbToLab(dark.top)[0]).toBeGreaterThanOrEqual(11);
    expect(srgbToLab(bright.top)[0]).toBeLessThanOrEqual(29);
  });

  it("高占比颜色主导主色与基色色相", () => {
    // 96×96 像素中仅 64 个为红色，其余为蓝色
    const data = solidPixels([34, 68, 204]);
    for (let i = 0; i < 64; i++) {
      data[i * 4] = 204;
      data[i * 4 + 1] = 34;
      data[i * 4 + 2] = 34;
    }
    const result = extractFromPixels(data);
    const dominantHue = Math.atan2(
      srgbToLab(result.dominant)[2],
      srgbToLab(result.dominant)[1]
    );
    const topHue = Math.atan2(
      srgbToLab(result.top)[2],
      srgbToLab(result.top)[1]
    );
    expect(dominantHue).toBeLessThan(0); // 蓝色 Lab b 分量为负
    // 基色色相应与主色色相一致（允许轻微偏差）
    expect(Math.abs(dominantHue - topHue)).toBeLessThan(0.15);
  });
});
