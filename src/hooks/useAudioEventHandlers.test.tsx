import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { useAudioEventHandlers } from "./useAudioEventHandlers";
import { useMusicStore } from "@/store/music-store";
import { useOfflineStore } from "@/store/offline-store";
import { hasCacheEntry, hasCacheEntryAfterDelay } from "@/lib/sw-cache";

vi.mock("@/lib/storage-adapter", () => ({
  idbStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock("@/lib/sw-cache", () => ({
  AUDIO_STREAM_CACHE_NAME: "audio-stream-cache",
  hasCacheEntry: vi.fn().mockResolvedValue(true),
  hasCacheEntryAfterDelay: vi.fn().mockResolvedValue(true),
}));

vi.mock("@jofr/capacitor-media-session", () => ({
  MediaSession: {
    setPositionState: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("react-hot-toast", () => ({
  default: {
    dismiss: vi.fn(),
  },
}));

vi.mock("@/lib/audio-match", () => ({
  handleAutoMatch: vi.fn(),
}));

describe("useAudioEventHandlers pause confirm", () => {
  beforeEach(() => {
    // Silence React act warnings for root render/unmount in test env.
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    vi.clearAllMocks();

    useMusicStore.setState({
      queue: [],
      currentIndex: 0,
      isPlaying: true,
      isLoading: false,
      isRepeat: false,
      enableAutoMatch: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const setup = () => {
    const audio = document.createElement("audio");

    let paused = false;
    Object.defineProperty(audio, "paused", {
      configurable: true,
      get: () => paused,
    });

    const audioRef = {
      current: audio,
    } as React.RefObject<HTMLAudioElement | null>;
    const isSwitchingTrackRef = { current: false };
    const hasRecordedRef = { current: true };

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    function TestHarness() {
      useAudioEventHandlers(audioRef, isSwitchingTrackRef, hasRecordedRef);
      return null;
    }

    act(() => {
      root.render(<TestHarness />);
    });

    const cleanup = () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    };

    return {
      audio,
      setPaused: (value: boolean) => {
        paused = value;
      },
      isSwitchingTrackRef,
      cleanup,
    };
  };

  it("does not set isPlaying=false if play resumes within 200ms", () => {
    const { audio, setPaused, cleanup } = setup();

    setPaused(true);
    audio.dispatchEvent(new Event("pause"));

    vi.advanceTimersByTime(100);

    setPaused(false);
    audio.dispatchEvent(new Event("play"));

    vi.advanceTimersByTime(250);

    expect(useMusicStore.getState().isPlaying).toBe(true);
    cleanup();
  });

  it("sets isPlaying=false if pause stays stable for 200ms", () => {
    const { audio, setPaused, cleanup } = setup();

    setPaused(true);
    audio.dispatchEvent(new Event("pause"));

    vi.advanceTimersByTime(250);

    expect(useMusicStore.getState().isPlaying).toBe(false);
    cleanup();
  });

  it("does not set isPlaying=false while switching track", () => {
    const { audio, setPaused, isSwitchingTrackRef, cleanup } = setup();

    isSwitchingTrackRef.current = true;
    setPaused(true);
    audio.dispatchEvent(new Event("pause"));

    vi.advanceTimersByTime(250);

    expect(useMusicStore.getState().isPlaying).toBe(true);
    cleanup();
  });
});

describe("useAudioEventHandlers offline stream cache recording", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    vi.clearAllMocks();

    useOfflineStore.setState({ records: {} });
    useMusicStore.setState({
      queue: [
        {
          id: "track-1",
          name: "Test Track",
          artist: ["Test Artist"],
          album: "Test Album",
          source: "kuwo",
          url_id: "123",
          pic_id: "",
          lyric_id: "",
        },
      ],
      currentIndex: 0,
      isPlaying: false,
      isLoading: false,
      isRepeat: false,
      enableAutoMatch: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const setupRecording = () => {
    const audio = document.createElement("audio");
    Object.defineProperty(audio, "paused", {
      configurable: true,
      get: () => false,
    });

    const audioRef = {
      current: audio,
    } as React.RefObject<HTMLAudioElement | null>;
    const isSwitchingTrackRef = { current: false };
    const hasRecordedRef = { current: false };

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    function TestHarness() {
      useAudioEventHandlers(audioRef, isSwitchingTrackRef, hasRecordedRef);
      return null;
    }

    act(() => {
      root.render(<TestHarness />);
    });

    const cleanup = () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    };

    return { audio, cleanup };
  };

  it("stores proxy url as-is when audio.src is a proxy url", async () => {
    const { audio, cleanup } = setupRecording();
    audio.src =
      "https://otter-music.pages.dev/proxy?url=http%3A%2F%2Fbd-er.kuwo.cn%2Fa.mp3&bvid=BV123";
    audio.dispatchEvent(new Event("canplaythrough"));
    await act(async () => {
      await Promise.resolve();
    });
    cleanup();

    const record = useOfflineStore.getState().records["track-1"];
    expect(record).toBeDefined();
    expect(record.url).toBe(
      "https://otter-music.pages.dev/proxy?url=http%3A%2F%2Fbd-er.kuwo.cn%2Fa.mp3&bvid=BV123"
    );
    expect(record.cacheKey).toBe(
      "https://otter-music.pages.dev/proxy?url=http%3A%2F%2Fbd-er.kuwo.cn%2Fa.mp3&bvid=BV123"
    );
    expect(record.verifiedAt).toBeGreaterThan(0);
  });

  it("stores original http url as-is", async () => {
    const { audio, cleanup } = setupRecording();
    audio.src = "http://bd-er.kuwo.cn/a.mp3";
    audio.dispatchEvent(new Event("canplaythrough"));
    await act(async () => {
      await Promise.resolve();
    });
    cleanup();

    const record = useOfflineStore.getState().records["track-1"];
    expect(record).toBeDefined();
    expect(record.url).toBe("http://bd-er.kuwo.cn/a.mp3");
    expect(record.cacheKey).toBe("http://bd-er.kuwo.cn/a.mp3");
  });

  it("stores https direct url as-is", async () => {
    const { audio, cleanup } = setupRecording();
    audio.src = "https://example.com/a.mp3";
    audio.dispatchEvent(new Event("canplaythrough"));
    await act(async () => {
      await Promise.resolve();
    });
    cleanup();

    const record = useOfflineStore.getState().records["track-1"];
    expect(record).toBeDefined();
    expect(record.url).toBe("https://example.com/a.mp3");
    expect(record.cacheKey).toBe("https://example.com/a.mp3");
  });

  it("does not store blob url", async () => {
    const { audio, cleanup } = setupRecording();
    audio.src = "blob:abc123";
    audio.dispatchEvent(new Event("canplaythrough"));
    await act(async () => {
      await Promise.resolve();
    });
    cleanup();

    expect(useOfflineStore.getState().records["track-1"]).toBeUndefined();
  });

  it("does not store capacitor url", async () => {
    const { audio, cleanup } = setupRecording();
    audio.src = "capacitor://file";
    audio.dispatchEvent(new Event("canplaythrough"));
    await act(async () => {
      await Promise.resolve();
    });
    cleanup();

    expect(useOfflineStore.getState().records["track-1"]).toBeUndefined();
  });

  it("does not store record when SW cache entry is missing", async () => {
    vi.mocked(hasCacheEntry).mockResolvedValue(false);
    vi.mocked(hasCacheEntryAfterDelay).mockResolvedValue(false);

    const { audio, cleanup } = setupRecording();
    audio.src = "https://example.com/a.mp3";
    audio.dispatchEvent(new Event("canplaythrough"));
    await act(async () => {
      await Promise.resolve();
    });
    cleanup();

    expect(useOfflineStore.getState().records["track-1"]).toBeUndefined();
  });

  it("retries cache check when first attempt fails", async () => {
    vi.mocked(hasCacheEntry).mockResolvedValue(false);
    vi.mocked(hasCacheEntryAfterDelay).mockResolvedValue(true);

    const { audio, cleanup } = setupRecording();
    audio.src = "https://example.com/a.mp3";
    audio.dispatchEvent(new Event("canplaythrough"));
    await act(async () => {
      await Promise.resolve();
    });
    cleanup();

    expect(useOfflineStore.getState().records["track-1"]).toBeDefined();
    expect(hasCacheEntryAfterDelay).toHaveBeenCalledWith(
      "audio-stream-cache",
      "https://example.com/a.mp3"
    );
  });

  it("writes record only once per playback session", async () => {
    const { audio, cleanup } = setupRecording();
    audio.src = "https://example.com/a.mp3";

    audio.dispatchEvent(new Event("canplaythrough"));
    await act(async () => {
      await Promise.resolve();
    });

    // 模拟同一首歌再次 canplaythrough（如循环播放）
    audio.dispatchEvent(new Event("canplaythrough"));
    await act(async () => {
      await Promise.resolve();
    });

    cleanup();

    expect(useOfflineStore.getState().records["track-1"]).toBeDefined();
    expect(hasCacheEntry).toHaveBeenCalledTimes(1);
  });
});
