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
}));

vi.mock("@jofr/capacitor-media-session", () => ({
  MediaSession: {
    setMetadata: mediaSessionMocks.setMetadata,
    setPlaybackState: mediaSessionMocks.setPlaybackState,
    setActionHandler: mediaSessionMocks.setActionHandler,
  },
}));

describe("useMediaSessionIntegration", () => {
  const originalOnLine = navigator.onLine;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });

    useMusicStore.setState({
      queue: [],
      currentIndex: 0,
      isPlaying: false,
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
    const audioRef = { current: audio } as React.RefObject<HTMLAudioElement | null>;

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
    expect(sanitizeMediaSessionArtworkUrl("http://localhost:3000/cover.jpg")).toBeNull();
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
});
