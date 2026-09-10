import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import {
  sanitizeMediaSessionArtworkUrl,
  useMediaSessionIntegration,
} from "./useMediaSessionIntegration";
import { useMusicStore } from "@/store/music-store";

vi.mock("@/lib/storage-adapter", () => ({
  idbStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

const mediaSessionMocks = vi.hoisted(() => ({
  setMetadata: vi.fn().mockResolvedValue(undefined),
  setPlaybackState: vi.fn().mockResolvedValue(undefined),
  setActionHandler: vi.fn(),
  setActionState: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@jofr/capacitor-media-session", () => ({
  MediaSession: {
    setMetadata: mediaSessionMocks.setMetadata,
    setPlaybackState: mediaSessionMocks.setPlaybackState,
    setActionHandler: mediaSessionMocks.setActionHandler,
    setActionState: mediaSessionMocks.setActionState,
  },
}));

const configMocks = vi.hoisted(() => ({ isNative: false }));

vi.mock("@/lib/api/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/config")>()),
  get IS_NATIVE() {
    return configMocks.isNative;
  },
}));

describe("useMediaSessionIntegration", () => {
  const originalOnLine = navigator.onLine;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    configMocks.isNative = false;
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });

    useMusicStore.setState({
      queue: [],
      currentIndex: 0,
      isPlaying: false,
      isShuffle: false,
      isRepeat: false,
      favorites: [],
    });
  });

  afterEach(() => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: originalOnLine,
    });
  });

  const renderHook = async (coverUrl: string | null | undefined) => {
    const audio = document.createElement("audio");
    const audioRef = {
      current: audio,
    } as React.RefObject<HTMLAudioElement | null>;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    function TestHarness() {
      useMediaSessionIntegration(audioRef, coverUrl);
      return null;
    }

    await act(async () => {
      root.render(<TestHarness />);
      await Promise.resolve();
    });

    return () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    };
  };

  it("sanitizes http artwork URL to https", () => {
    expect(sanitizeMediaSessionArtworkUrl("http://image.test/cover.jpg")).toBe(
      "https://image.test/cover.jpg"
    );
  });

  it("drops unsafe artwork URL", () => {
    expect(sanitizeMediaSessionArtworkUrl("javascript:alert(1)")).toBeNull();
    expect(
      sanitizeMediaSessionArtworkUrl("http://localhost:3000/cover.jpg")
    ).toBeNull();
  });

  it("passes sanitized artwork when URL is safe", async () => {
    useMusicStore.setState({
      queue: [
        {
          id: "1",
          name: "Song",
          artist: ["Artist"],
          album: "Album",
          pic_id: "pic-1",
          url_id: "url-1",
          lyric_id: "lyric-1",
          source: "joox",
        },
      ],
      currentIndex: 0,
      hasUserGesture: true,
    });

    const cleanup = await renderHook("http://image.test/cover.jpg");

    expect(mediaSessionMocks.setMetadata).toHaveBeenCalledWith({
      title: "Song",
      artist: "Artist",
      album: "Album",
      artwork: [{ src: "https://image.test/cover.jpg" }],
    });

    cleanup();
  });

  it("drops artwork when URL is unsafe", async () => {
    useMusicStore.setState({
      queue: [
        {
          id: "2",
          name: "Web Song",
          artist: ["Web Artist"],
          album: "Web Album",
          pic_id: "pic-2",
          url_id: "url-2",
          lyric_id: "lyric-2",
          source: "joox",
        },
      ],
      currentIndex: 0,
      hasUserGesture: true,
    });

    const cleanup = await renderHook("http://localhost:3000/web-cover.jpg");

    expect(mediaSessionMocks.setMetadata).toHaveBeenCalledWith({
      title: "Web Song",
      artist: "Web Artist",
      album: "Web Album",
      artwork: [],
    });

    cleanup();
  });

  it("skips metadata update when there is no current track", async () => {
    const cleanup = await renderHook("https://image.test/cover.jpg");

    expect(mediaSessionMocks.setMetadata).not.toHaveBeenCalled();

    cleanup();
  });

  describe("通知栏自定义按钮", () => {
    const track = {
      id: "song-1",
      name: "Song",
      artist: ["Artist"],
      album: "Album",
      pic_id: "pic-1",
      url_id: "url-1",
      lyric_id: "lyric-1",
      source: "joox" as const,
    };

    const registeredActions = () =>
      mediaSessionMocks.setActionHandler.mock.calls.map(
        (call) => call[0].action
      );

    const handlerFor = (action: string) => {
      const call = mediaSessionMocks.setActionHandler.mock.calls.find(
        (c) => c[0].action === action
      );
      return call?.[1] as (() => void) | undefined;
    };

    const renderNative = async () => {
      configMocks.isNative = true;
      useMusicStore.setState({
        queue: [track],
        currentIndex: 0,
        hasUserGesture: true,
        isShuffle: false,
        isRepeat: false,
        favorites: [],
      });
      return renderHook(null);
    };

    it("原生端注册 like 与 playmode 动作", async () => {
      const cleanup = await renderNative();

      expect(registeredActions()).toEqual(
        expect.arrayContaining(["like", "playmode"])
      );

      cleanup();
    });

    it("Web 端不注册自定义动作", async () => {
      configMocks.isNative = false;
      useMusicStore.setState({ queue: [track], currentIndex: 0 });
      const cleanup = await renderHook(null);

      expect(registeredActions()).not.toContain("like");
      expect(registeredActions()).not.toContain("playmode");
      expect(mediaSessionMocks.setActionState).not.toHaveBeenCalled();

      cleanup();
    });

    it("按下 like 时切换当前曲目收藏状态", async () => {
      const cleanup = await renderNative();

      act(() => handlerFor("like")?.());
      expect(useMusicStore.getState().favorites).toHaveLength(1);

      act(() => handlerFor("like")?.());
      expect(useMusicStore.getState().favorites[0].is_deleted).toBe(true);

      cleanup();
    });

    it("按下 playmode 时与应用内保持同一套循环顺序", async () => {
      const cleanup = await renderNative();

      // 列表循环 → 单曲循环
      act(() => handlerFor("playmode")?.());
      expect(useMusicStore.getState()).toMatchObject({
        isRepeat: true,
        isShuffle: false,
      });

      // 单曲循环 → 随机播放
      act(() => handlerFor("playmode")?.());
      expect(useMusicStore.getState()).toMatchObject({
        isRepeat: false,
        isShuffle: true,
      });

      // 随机播放 → 列表循环
      act(() => handlerFor("playmode")?.());
      expect(useMusicStore.getState()).toMatchObject({
        isRepeat: false,
        isShuffle: false,
      });

      cleanup();
    });

    it("把按钮状态同步给原生层", async () => {
      const cleanup = await renderNative();

      expect(mediaSessionMocks.setActionState).toHaveBeenCalledWith({
        action: "like",
        active: false,
      });
      expect(mediaSessionMocks.setActionState).toHaveBeenCalledWith({
        action: "playmode",
        mode: "list",
      });

      // 播放模式变化后同步，用于切换通知栏按钮图标
      act(() => useMusicStore.setState({ isRepeat: true }));
      expect(mediaSessionMocks.setActionState).toHaveBeenCalledWith({
        action: "playmode",
        mode: "repeat",
      });

      cleanup();
    });
  });
});
