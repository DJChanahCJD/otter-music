import { describe, expect, it, vi, beforeEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { LyricsPanel } from "./LyricsPanel";
import { musicApi } from "@/lib/music-api";
import type { MusicTrack } from "@/types/music";

vi.mock("@/lib/music-api", () => ({
  musicApi: {
    getLyric: vi.fn(),
  },
}));

const { mockSeek } = vi.hoisted(() => ({ mockSeek: vi.fn() }));

vi.mock("@/store/music-store", () => ({
  useMusicStore: vi.fn(() => ({
    currentAudioTime: 0,
    seek: mockSeek,
    seekTimestamp: 0,
    lyricAlign: "center",
    lyricFontSize: 18,
    lyricOffset: -0.5,
  })),
}));

const bilibiliTrack: MusicTrack = {
  id: "bilibili_BV1xx411c7mD",
  name: "Test Bilibili Video",
  artist: [""],
  album: "",
  pic_id: "https://example.com/pic.jpg",
  url_id: "bilibili_BV1xx411c7mD",
  lyric_id: "bilibili_BV1xx411c7mD",
  source: "bilibili",
};

const bilibiliTrackNoLyric: MusicTrack = {
  ...bilibiliTrack,
  lyric_id: "",
};

const neteaseTrack: MusicTrack = {
  id: "netease_123456",
  name: "Test Song",
  artist: ["Artist"],
  album: "Album",
  pic_id: "pic-1",
  url_id: "url-1",
  lyric_id: "lyric-1",
  source: "netease",
};

describe("LyricsPanel", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom 未实现 Element.scrollTo，歌词自动滚动依赖该 API
    Element.prototype.scrollTo = () => {};
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  const renderPanel = (track: MusicTrack | null) => {
    act(() => {
      root!.render(<LyricsPanel track={track} />);
    });
  };

  const cleanup = () => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    container?.remove();
    root = undefined;
    container = undefined;
  };

  it("当 track 为 null 时显示提示", () => {
    renderPanel(null);
    expect(container?.textContent).toContain("选择歌曲查看歌词");
    cleanup();
  });

  it("B 站音源 lyric_id 为空时显示暂无歌词", async () => {
    renderPanel(bilibiliTrackNoLyric);

    await act(async () => {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container?.textContent).toContain("暂无歌词");
    cleanup();
  });

  it("B 站音源 lyric_id 非空时渲染歌词", async () => {
    vi.mocked(musicApi.getLyric).mockResolvedValue({
      lyric: "[00:00.00]第一句歌词",
      tlyric: "",
    });

    renderPanel(bilibiliTrack);

    await act(async () => {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(musicApi.getLyric).toHaveBeenCalledWith(
      "bilibili_BV1xx411c7mD",
      "bilibili"
    );
    expect(container?.textContent).toContain("第一句歌词");
    expect(container?.textContent).not.toContain("加载歌词中...");
    cleanup();
  });

  it("B 站音源歌词加载失败时提示暂无歌词", async () => {
    vi.mocked(musicApi.getLyric).mockResolvedValue(null);

    renderPanel(bilibiliTrack);

    await act(async () => {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container?.textContent).toContain("暂无歌词");
    cleanup();
  });

  it("正常音源加载歌词时显示加载中", () => {
    renderPanel(neteaseTrack);
    expect(container?.textContent).toContain("加载歌词中...");
    cleanup();
  });

  it("滚动后基准线所在歌词行显示背景高亮", async () => {
    vi.mocked(musicApi.getLyric).mockResolvedValue({
      lyric: "[00:00.00]第一句歌词\n[00:10.00]第二句歌词",
      tlyric: "",
    });

    renderPanel(neteaseTrack);

    await act(async () => {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const viewport = container!.querySelector(
      '[data-slot="scroll-area-viewport"]'
    )!;

    await act(async () => {
      viewport.dispatchEvent(new Event("scroll"));
    });

    const baselineLine = container!.querySelector('[class*="bg-white/10"]');
    expect(baselineLine).not.toBeNull();
    expect(baselineLine!.textContent).toContain("第一句歌词");
    cleanup();
  });

  it("滚动后点击基准线浮层可跳转到该句", async () => {
    vi.mocked(musicApi.getLyric).mockResolvedValue({
      lyric: "[00:00.00]第一句歌词\n[00:10.00]第二句歌词",
      tlyric: "",
    });

    renderPanel(neteaseTrack);

    await act(async () => {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const viewport = container!.querySelector(
      '[data-slot="scroll-area-viewport"]'
    )!;

    await act(async () => {
      viewport.dispatchEvent(new Event("scroll"));
    });

    const baseline = container!.querySelector<HTMLButtonElement>(
      'button[aria-label="从此句开始播放"]'
    );
    expect(baseline).not.toBeNull();

    await act(async () => {
      baseline!.click();
    });

    expect(mockSeek).toHaveBeenCalledWith(0);
    cleanup();
  });

  it("点击基准线不会冒泡触发外层容器点击", async () => {
    vi.mocked(musicApi.getLyric).mockResolvedValue({
      lyric: "[00:00.00]第一句歌词\n[00:10.00]第二句歌词",
      tlyric: "",
    });

    const onOuterClick = vi.fn();

    act(() => {
      root!.render(
        <div onClick={onOuterClick}>
          <LyricsPanel track={neteaseTrack} />
        </div>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const viewport = container!.querySelector(
      '[data-slot="scroll-area-viewport"]'
    )!;

    await act(async () => {
      viewport.dispatchEvent(new Event("scroll"));
    });

    const baseline = container!.querySelector<HTMLButtonElement>(
      'button[aria-label="从此句开始播放"]'
    )!;

    await act(async () => {
      baseline.click();
    });

    expect(mockSeek).toHaveBeenCalledWith(0);
    expect(onOuterClick).not.toHaveBeenCalled();
    cleanup();
  });
});
