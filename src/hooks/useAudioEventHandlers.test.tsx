import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { useAudioEventHandlers } from "./useAudioEventHandlers";
import { useMusicStore } from "@/store/music-store";

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
}));

describe("useAudioEventHandlers pause confirm", () => {
  beforeEach(() => {
    // Silence React act warnings for root render/unmount in test env.
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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

    const audioRef = { current: audio } as React.RefObject<HTMLAudioElement | null>;
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
