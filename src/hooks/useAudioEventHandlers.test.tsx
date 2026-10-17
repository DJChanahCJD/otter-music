import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { useAudioEventHandlers } from "./useAudioEventHandlers";
import { handleAutoMatch } from "@/lib/audio-match";
import { useMusicStore } from "@/store/music-store";
import { useAppStore } from "@/store/app-store";
import { useOfflineStore } from "@/store/offline-store";
import type { MusicTrack } from "@/types/music";

vi.mock("@/lib/storage-adapter", () => ({
  idbStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
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
  isNeteaseSampleClip: (duration: number, src: string) =>
    [30, 45, 60].some((d) => Math.abs(duration - d) < 1) ||
    src.includes("jdusicrep-ts"),
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

  it("stops after the current track instead of advancing the queue", () => {
    const { audio, cleanup } = setup();

    useMusicStore.setState({
      queue: [
        {
          id: "track-1",
          name: "Track 1",
          artist: ["Artist"],
          album: "Album",
          source: "kuwo",
          url_id: "1",
          pic_id: "",
          lyric_id: "",
        },
        {
          id: "track-2",
          name: "Track 2",
          artist: ["Artist"],
          album: "Album",
          source: "kuwo",
          url_id: "2",
          pic_id: "",
          lyric_id: "",
        },
      ] satisfies MusicTrack[],
      currentIndex: 0,
      sleepTimerIsActive: true,
      sleepTimerStopAfterCurrentTrack: true,
      sleepTimerRemaining: 0,
      sleepTimerEndTime: 0,
    });

    audio.dispatchEvent(new Event("ended"));

    const state = useMusicStore.getState();
    expect(state.isPlaying).toBe(false);
    expect(state.currentIndex).toBe(0);
    expect(state.sleepTimerIsActive).toBe(false);
    expect(state.sleepTimerStopAfterCurrentTrack).toBe(false);
    cleanup();
  });
});

describe("useAudioEventHandlers simultaneous playback", () => {
  beforeEach(() => {
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
    });
    useAppStore.setState({ allowSimultaneousPlayback: false });
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
      cleanup,
    };
  };

  it("resumes playback on external pause while the setting is enabled", () => {
    useAppStore.setState({ allowSimultaneousPlayback: true });
    const { audio, setPaused, cleanup } = setup();
    const playSpy = vi.spyOn(audio, "play").mockResolvedValue(undefined);

    setPaused(true);
    audio.dispatchEvent(new Event("pause"));

    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(useMusicStore.getState().isPlaying).toBe(true);

    vi.advanceTimersByTime(250);
    expect(useMusicStore.getState().isPlaying).toBe(true);
    cleanup();
  });

  it("does not resume when isPlaying is already false (user pause or route loss)", () => {
    useAppStore.setState({ allowSimultaneousPlayback: true });
    useMusicStore.setState({ isPlaying: false });
    const { audio, setPaused, cleanup } = setup();
    const playSpy = vi.spyOn(audio, "play");

    setPaused(true);
    audio.dispatchEvent(new Event("pause"));

    vi.advanceTimersByTime(250);
    expect(playSpy).not.toHaveBeenCalled();
    expect(useMusicStore.getState().isPlaying).toBe(false);
    cleanup();
  });

  it("falls back to paused state when resume play() rejects", async () => {
    useAppStore.setState({ allowSimultaneousPlayback: true });
    const { audio, setPaused, cleanup } = setup();
    vi.spyOn(audio, "play").mockRejectedValue(new Error("focus denied"));

    setPaused(true);
    audio.dispatchEvent(new Event("pause"));
    await act(async () => {});

    expect(useMusicStore.getState().isPlaying).toBe(false);
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

  it("stores proxy url as-is when audio.src is a proxy url", () => {
    const { audio, cleanup } = setupRecording();
    audio.src =
      "https://otter-music.pages.dev/proxy?url=http%3A%2F%2Fbd-er.kuwo.cn%2Fa.mp3&bvid=BV123";
    audio.dispatchEvent(new Event("play"));
    cleanup();

    const record = useOfflineStore.getState().records["track-1"];
    expect(record).toBeDefined();
    expect(record.url).toBe(
      "https://otter-music.pages.dev/proxy?url=http%3A%2F%2Fbd-er.kuwo.cn%2Fa.mp3&bvid=BV123"
    );
  });

  it("stores original http url as-is", () => {
    const { audio, cleanup } = setupRecording();
    audio.src = "http://bd-er.kuwo.cn/a.mp3";
    audio.dispatchEvent(new Event("play"));
    cleanup();

    const record = useOfflineStore.getState().records["track-1"];
    expect(record).toBeDefined();
    expect(record.url).toBe("http://bd-er.kuwo.cn/a.mp3");
  });

  it("stores https direct url as-is", () => {
    const { audio, cleanup } = setupRecording();
    audio.src = "https://example.com/a.mp3";
    audio.dispatchEvent(new Event("play"));
    cleanup();

    const record = useOfflineStore.getState().records["track-1"];
    expect(record).toBeDefined();
    expect(record.url).toBe("https://example.com/a.mp3");
  });

  it("does not store blob url", () => {
    const { audio, cleanup } = setupRecording();
    audio.src = "blob:abc123";
    audio.dispatchEvent(new Event("play"));
    cleanup();

    expect(useOfflineStore.getState().records["track-1"]).toBeUndefined();
  });

  it("does not store capacitor url", () => {
    const { audio, cleanup } = setupRecording();
    audio.src = "capacitor://file";
    audio.dispatchEvent(new Event("play"));
    cleanup();

    expect(useOfflineStore.getState().records["track-1"]).toBeUndefined();
  });
});

describe("useAudioEventHandlers passive auto match abort", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    vi.clearAllMocks();

    useMusicStore.setState({
      queue: [
        {
          id: "track-1",
          name: "Test Track",
          artist: ["Test Artist"],
          album: "Test Album",
          source: "_netease",
          url_id: "123",
          pic_id: "",
          lyric_id: "",
        },
      ],
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

    const paused = false;
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

    return { audio, cleanup };
  };

  it("triggers auto match with abort check on netease sample clip", () => {
    const { audio, cleanup } = setup();
    Object.defineProperty(audio, "duration", {
      configurable: true,
      value: 30,
    });
    audio.src = "https://example.com/sample.mp3";
    audio.dispatchEvent(new Event("durationchange"));

    expect(handleAutoMatch).toHaveBeenCalledTimes(1);
    const abortCheck = (handleAutoMatch as ReturnType<typeof vi.fn>).mock
      .calls[0][3] as () => boolean;
    expect(typeof abortCheck).toBe("function");

    // 搜索返回时：原音源仍在播放且时长已纠正为完整时长 → 中止换源
    Object.defineProperty(audio, "duration", {
      configurable: true,
      value: 240,
    });
    expect(abortCheck()).toBe(true);

    // 时长仍是试听片段 → 不中止
    Object.defineProperty(audio, "duration", {
      configurable: true,
      value: 30,
    });
    expect(abortCheck()).toBe(false);

    cleanup();
  });

  it("does not trigger auto match when duration is a full length", () => {
    const { audio, cleanup } = setup();
    Object.defineProperty(audio, "duration", {
      configurable: true,
      value: 240,
    });
    audio.src = "https://example.com/full.mp3";
    audio.dispatchEvent(new Event("durationchange"));

    expect(handleAutoMatch).not.toHaveBeenCalled();
    cleanup();
  });
});
