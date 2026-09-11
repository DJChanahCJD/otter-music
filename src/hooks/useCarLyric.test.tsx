import { beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useCarLyric } from "./useCarLyric";
import { useMusicStore } from "@/store/music-store";
import { musicApi } from "@/lib/music-api";
import type { MusicTrack } from "@/types/music";

vi.mock("@/lib/storage-adapter", () => ({
  idbStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock("@/lib/music-api", () => ({
  musicApi: {
    getLyric: vi.fn(),
  },
}));

/**
 * 用 getter 暴露，方便单个用例模拟"旧 APK 没有该原生方法"，
 * 也就是 `MediaSession.setCarLyric` 为 undefined 的情况。
 */
const mediaSessionMocks = vi.hoisted(() => ({
  setCarLyric: undefined as undefined | ReturnType<typeof vi.fn>,
}));

vi.mock("@jofr/capacitor-media-session", () => ({
  get MediaSession() {
    return { setCarLyric: mediaSessionMocks.setCarLyric };
  },
}));

const configMocks = vi.hoisted(() => ({ isNative: true }));

vi.mock("@/lib/api/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/config")>()),
  get IS_NATIVE() {
    return configMocks.isNative;
  },
}));

const TRACK: MusicTrack = {
  id: "netease_1",
  name: "测试歌曲",
  artist: ["歌手"],
  album: "专辑",
  pic_id: "pic-1",
  url_id: "url-1",
  lyric_id: "lyric-1",
  source: "netease",
};

const TRACK_WITHOUT_LYRIC: MusicTrack = {
  ...TRACK,
  id: "netease_2",
  lyric_id: "",
};

const LRC = "[00:01.00]第一行\n[00:05.00]第二行";

const callCount = () => mediaSessionMocks.setCarLyric?.mock.calls.length ?? 0;

describe("useCarLyric", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;

    configMocks.isNative = true;
    mediaSessionMocks.setCarLyric = vi.fn().mockResolvedValue(undefined);
    vi.mocked(musicApi.getLyric).mockResolvedValue({ lyric: LRC, tlyric: "" });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    useMusicStore.setState({
      queue: [TRACK],
      currentIndex: 0,
      carLyricEnabled: true,
      currentAudioTime: 2,
      lyricOffset: 0,
    });
  });

  const render = () => {
    function TestHarness() {
      useCarLyric();
      return null;
    }

    act(() => {
      root!.render(<TestHarness />);
    });
  };

  /** 等 mock 的 getLyric promise 落地，并让依赖 linesVersion 的 effect 重跑 */
  const flush = async () => {
    await act(async () => {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
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

  it("按当前播放进度把对应歌词行覆写到车机", async () => {
    render();
    await flush();

    expect(mediaSessionMocks.setCarLyric).toHaveBeenLastCalledWith({
      text: "第一行",
    });

    await act(async () => {
      useMusicStore.setState({ currentAudioTime: 6 });
    });

    expect(mediaSessionMocks.setCarLyric).toHaveBeenLastCalledWith({
      text: "第二行",
    });

    cleanup();
  });

  it("前奏期间不覆写，车机继续显示歌名", async () => {
    useMusicStore.setState({ currentAudioTime: 0.5 });

    render();
    await flush();

    expect(mediaSessionMocks.setCarLyric).not.toHaveBeenCalled();

    cleanup();
  });

  it("切歌时回退歌名，避免车机残留上一首的歌词", async () => {
    render();
    await flush();

    expect(mediaSessionMocks.setCarLyric).toHaveBeenLastCalledWith({
      text: "第一行",
    });

    await act(async () => {
      useMusicStore.setState({ queue: [TRACK_WITHOUT_LYRIC] });
    });

    expect(mediaSessionMocks.setCarLyric).toHaveBeenLastCalledWith({
      text: null,
    });

    cleanup();
  });

  it("同一行不重复过桥", async () => {
    render();
    await flush();

    const before = callCount();

    // 时间推进但仍落在同一行内
    await act(async () => {
      useMusicStore.setState({ currentAudioTime: 3 });
    });

    expect(callCount()).toBe(before);

    cleanup();
  });

  it("开关关闭时不覆写", async () => {
    useMusicStore.setState({ carLyricEnabled: false });

    render();
    await flush();

    expect(mediaSessionMocks.setCarLyric).not.toHaveBeenCalled();

    cleanup();
  });

  it("播放中关闭开关会清掉覆写", async () => {
    render();
    await flush();

    await act(async () => {
      useMusicStore.setState({ carLyricEnabled: false });
    });

    expect(mediaSessionMocks.setCarLyric).toHaveBeenLastCalledWith({
      text: null,
    });

    cleanup();
  });

  it("Web 端（非原生）不触碰原生方法", async () => {
    configMocks.isNative = false;

    render();
    await flush();

    expect(mediaSessionMocks.setCarLyric).not.toHaveBeenCalled();

    cleanup();
  });

  it("旧 APK 缺少该原生方法时不抛错", async () => {
    mediaSessionMocks.setCarLyric = undefined;

    expect(() => render()).not.toThrow();
    await flush();

    // 歌词链路本身照常跑，只是不往原生写
    expect(musicApi.getLyric).toHaveBeenCalledWith("lyric-1", "netease");

    cleanup();
  });
});
