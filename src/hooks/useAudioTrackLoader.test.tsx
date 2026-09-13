import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { useAudioTrackLoader } from "./useAudioTrackLoader";
import { useMusicStore } from "@/store/music-store";
import { useOfflineStore } from "@/store/offline-store";
import { useUrlCacheStore } from "@/store/url-cache-store";
import { resolveTrackUrl } from "@/lib/audio-resolver";
import { getProxyUrl } from "@/lib/api";
import toast from "react-hot-toast";
import type { MusicTrack } from "@/types/music";

vi.mock("@/lib/storage-adapter", () => ({
  idbStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock("@/lib/audio-resolver", () => ({
  resolveTrackUrl: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  isProxyUrl: vi.fn(() => false),
  getProxyUrl: vi.fn((url: string) => url),
}));

vi.mock("@/lib/api/config", () => ({
  IS_NATIVE: false,
}));

vi.mock("@/lib/audio-match", () => ({
  handleAutoMatch: vi.fn().mockResolvedValue(false),
}));

vi.mock("react-hot-toast", () => ({
  default: Object.assign(vi.fn(), { error: vi.fn(), dismiss: vi.fn() }),
}));

const MOCK_URL = "https://cdn.example.com/audio-320.mp3";
const MOCK_URL_2 = "https://cdn.example.com/audio-320-v2.mp3";
const TRACK_KEY = "netease:t1:320";

const TRACK = {
  id: "t1",
  source: "netease",
  name: "Test Song",
  artist: ["Artist"],
  album: "Album",
  duration: 180,
} as unknown as MusicTrack;

/** 创建 jsdom 可用的 audio 桩：load 后异步派发 canplay 模拟媒体就绪 */
const createAudio = () => {
  const audio = document.createElement("audio");
  audio.load = vi.fn(() => {
    queueMicrotask(() => audio.dispatchEvent(new Event("canplay")));
  });
  audio.play = vi.fn().mockResolvedValue(undefined);
  audio.pause = vi.fn();
  return audio;
};

/** 排空微任务队列 */
const drainMicrotasks = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

/** 等待微任务与定时器链路全部走完（loadAudio 为异步流程） */
const flushAsync = () =>
  act(async () => {
    await drainMicrotasks();
    await new Promise((r) => setTimeout(r, 0));
    await drainMicrotasks();
  });

describe("useAudioTrackLoader", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();

    useMusicStore.setState({
      queue: [TRACK],
      currentIndex: 0,
      quality: "320",
      hasUserGesture: true,
      isPlaying: true,
      isLoading: false,
      currentAudioTime: 0,
      playbackSpeed: 1,
      enableAutoMatch: false,
      enableProxyFallback: true,
      consecutiveFailures: 0,
      maxConsecutiveFailures: 1,
      urlRecoveryKey: 0,
    });
    useOfflineStore.setState({ records: {} });
    useUrlCacheStore.setState({ urlMap: {} });

    vi.mocked(resolveTrackUrl).mockReset();
    vi.mocked(resolveTrackUrl).mockResolvedValue({ url: MOCK_URL });
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  const setup = async (audioOverrides?: (audio: HTMLAudioElement) => void) => {
    const audio = createAudio();
    audioOverrides?.(audio);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    function TestHarness() {
      useAudioTrackLoader(
        { current: audio },
        { current: false },
        { current: false }
      );
      return null;
    }

    // 异步排空：loadAudio 的续体（store 更新）需在 act 内完成
    await act(async () => {
      root.render(<TestHarness />);
      await drainMicrotasks();
    });

    return {
      audio,
      cleanup: () =>
        act(() => {
          root.unmount();
        }),
    };
  };

  it("首次加载不误判为恢复，不走 forceRefresh", async () => {
    const { cleanup } = await setup();
    await flushAsync();

    expect(resolveTrackUrl).toHaveBeenCalledWith(TRACK, 320, {
      forceRefresh: false,
    });
    cleanup();
  });

  it("urlRecoveryKey 变化触发恢复流程，走 forceRefresh", async () => {
    vi.mocked(resolveTrackUrl)
      .mockResolvedValueOnce({ url: MOCK_URL })
      .mockResolvedValueOnce({ url: MOCK_URL_2 });

    const { cleanup } = await setup();
    await flushAsync();

    await act(async () => {
      useMusicStore.getState().incrementUrlRecoveryKey();
    });
    await flushAsync();

    expect(resolveTrackUrl).toHaveBeenNthCalledWith(2, TRACK, 320, {
      forceRefresh: true,
    });
    cleanup();
  });

  it("在线加载失败时同样清理 URL 缓存与 stream-cache 快照", async () => {
    // 预置失效缓存（旧逻辑仅离线场景才清理，在线场景会残留）
    useUrlCacheStore.getState().set(TRACK_KEY, MOCK_URL);
    useOfflineStore.setState({
      records: {
        t1: {
          trackId: "t1",
          source: "stream-cache",
          url: MOCK_URL,
          cachedAt: Date.now(),
          name: "Test Song",
          artist: ["Artist"],
          album: "Album",
          trackSource: "netease",
          url_id: "u1",
          pic_id: "p1",
          lyric_id: "l1",
        },
      },
    });

    const { cleanup } = await setup((audio) => {
      audio.play = vi.fn().mockRejectedValue(new Error("PLAY_FAIL"));
    });
    await flushAsync();

    expect(useUrlCacheStore.getState().urlMap[TRACK_KEY]).toBeUndefined();
    expect(useOfflineStore.getState().records["t1"]).toBeUndefined();
    cleanup();
  });

  it("requestId 失效（被恢复流程取代）时，失效缓存清理仍执行", async () => {
    let resolveFirst!: (v: { url: string }) => void;
    vi.mocked(resolveTrackUrl)
      .mockImplementationOnce(() => new Promise((res) => (resolveFirst = res)))
      .mockResolvedValue({ url: MOCK_URL_2 });

    // 首次播放成功，使后续被取代的旧请求在 play 阶段失败
    const playStub = vi
      .fn<() => Promise<void>>()
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error("LATE_FAIL"));

    const { cleanup } = await setup((audio) => {
      audio.play = playStub;
    });
    await flushAsync(); // load#1 挂起在 resolveTrackUrl

    // audio error 恢复流程：urlRecoveryKey 变化 → 新 effect 取代旧请求
    await act(async () => {
      useMusicStore.getState().incrementUrlRecoveryKey();
    });
    await flushAsync(); // load#2 成功

    // 预置失效缓存，释放挂起的 load#1
    useUrlCacheStore.getState().set(TRACK_KEY, MOCK_URL);
    await act(async () => {
      resolveFirst({ url: MOCK_URL });
      await drainMicrotasks();
      await new Promise((r) => setTimeout(r, 0));
      await drainMicrotasks();
    });

    // 旧请求虽被守卫拦截（不触发失败 UI），但失效缓存仍被清理
    expect(useUrlCacheStore.getState().urlMap[TRACK_KEY]).toBeUndefined();
    expect(toast.error).not.toHaveBeenCalled();
    cleanup();
  });

  it("网络层播放失败时回退代理线路，且不重复请求 URL", async () => {
    const PROXY_URL = "https://proxy.example.com/audio";
    vi.mocked(getProxyUrl).mockReturnValueOnce(PROXY_URL);

    const { audio, cleanup } = await setup((a) => {
      a.play = vi
        .fn<() => Promise<void>>()
        .mockRejectedValueOnce(
          Object.assign(new Error("NETWORK_FAIL"), { mediaErrorCode: 2 })
        )
        .mockResolvedValueOnce(undefined);
    });
    await flushAsync();

    expect(toast).toHaveBeenCalledWith("已切换备用线路", {
      icon: "🌐",
      id: "proxy-notice",
    });
    expect(getProxyUrl).toHaveBeenCalledWith(MOCK_URL);
    expect(audio.play).toHaveBeenCalledTimes(2);
    // 代理回退复用 remoteUrlRef 中的远程 URL，不重新触发 URL 解析
    expect(resolveTrackUrl).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("连续失败达到上限时停止播放而非无限跳下一首", async () => {
    const skipToNext = vi.spyOn(useMusicStore.getState(), "skipToNext");

    const { cleanup } = await setup((a) => {
      a.play = vi.fn().mockRejectedValue(new Error("PLAY_FAIL"));
    });
    await flushAsync();

    expect(useMusicStore.getState().isPlaying).toBe(false);
    expect(skipToNext).not.toHaveBeenCalled();
    cleanup();
  });
});
