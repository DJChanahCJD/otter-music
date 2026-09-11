import { describe, expect, it } from "vitest";
import { findActiveLyricIndex, parseLrc, parseSimpleLrc } from "./lyrics";

describe("parseSimpleLrc", () => {
  it("解析时间戳并按时间升序排列", () => {
    expect(
      parseSimpleLrc("[00:03.00]第三\n[00:01.50]第一\n[00:02.00]第二")
    ).toEqual([
      { time: 1.5, text: "第一" },
      { time: 2, text: "第二" },
      { time: 3, text: "第三" },
    ]);
  });

  it("同一行有多个时间戳时展开成多行", () => {
    expect(parseSimpleLrc("[00:01.00][00:05.00]重复")).toEqual([
      { time: 1, text: "重复" },
      { time: 5, text: "重复" },
    ]);
  });

  it("三位小数按毫秒解析", () => {
    expect(parseSimpleLrc("[00:01.234]x")).toEqual([
      { time: 1.234, text: "x" },
    ]);
  });

  it("忽略无时间戳的行与空文本行", () => {
    expect(parseSimpleLrc("作词 : 某人\n[00:01.00]\n[00:02.00]正文")).toEqual([
      { time: 2, text: "正文" },
    ]);
  });
});

describe("parseLrc", () => {
  it("没有译文时只返回原文行", () => {
    expect(parseLrc("[00:01.00]hi")).toEqual([
      { time: 1, text: "hi", ttext: undefined },
    ]);
  });

  it("按时间容差把译文挂到原文行上", () => {
    expect(
      parseLrc("[00:01.00]hi\n[00:09.00]bye", "[00:01.02]你好\n[00:09.20]再见")
    ).toEqual([
      { time: 1, text: "hi", ttext: "你好" },
      { time: 9, text: "bye", ttext: "再见" },
    ]);
  });

  it("时间差超出容差时不挂译文", () => {
    const result = parseLrc("[00:01.00]hi", "[00:03.00]你好");

    expect(result[0].ttext).toBeUndefined();
  });
});

describe("findActiveLyricIndex", () => {
  const lines = parseSimpleLrc("[00:01.00]a\n[00:05.00]b\n[00:09.00]c");

  it("前奏早于第一行时返回 -1", () => {
    expect(findActiveLyricIndex(lines, 0.5)).toBe(-1);
  });

  it("返回最后一个已到达的行", () => {
    expect(findActiveLyricIndex(lines, 1)).toBe(0);
    expect(findActiveLyricIndex(lines, 4.99)).toBe(0);
    expect(findActiveLyricIndex(lines, 5)).toBe(1);
    expect(findActiveLyricIndex(lines, 100)).toBe(2);
  });

  it("与应用内歌词偏移口径一致", () => {
    expect(findActiveLyricIndex(lines, 4.5, -0.5)).toBe(1);
    expect(findActiveLyricIndex(lines, 1.3, 0.5)).toBe(-1);
  });

  it("空歌词返回 -1", () => {
    expect(findActiveLyricIndex([], 10)).toBe(-1);
  });
});
