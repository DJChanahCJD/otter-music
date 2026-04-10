import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { RootLayout } from "./RootLayout";
import { useMusicStore } from "@/store/music-store";
import type { MusicTrack } from "@/types/music";

vi.mock("@/lib/storage-adapter", () => ({
  idbStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/utils/toast", () => ({
  toastUtils: {
    info: vi.fn(),
  },
}));

vi.mock("@/hooks/useMusicCover", () => ({
  useMusicCover: vi.fn(() => null),
}));

vi.mock("@/components/MusicLayout", () => ({
  MusicLayout: ({ children, player, tabBar }: { children: ReactNode; player: ReactNode; tabBar: ReactNode }) => (
    <div>
      <div data-testid="player-slot">{player}</div>
      <div data-testid="content">{children}</div>
      <div data-testid="tabbar-slot">{tabBar}</div>
    </div>
  ),
}));

vi.mock("@/components/MusicNowPlayingBar", () => ({
  MusicNowPlayingBar: () => <div>Now Playing</div>,
}));

vi.mock("@/components/MusicTabBar", () => ({
  MusicTabBar: () => <div>Tab Bar</div>,
}));

vi.mock("@/components/GlobalMusicPlayer", () => ({
  GlobalMusicPlayer: () => <div>Global Player</div>,
}));

vi.mock("@/components/FullScreenPlayer", () => ({
  FullScreenPlayer: ({ isFullScreen }: { isFullScreen: boolean }) => (
    <div data-testid="fullscreen-state">{isFullScreen ? "open" : "closed"}</div>
  ),
}));

const capacitorMocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
  addListener: vi.fn(),
  minimizeApp: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: capacitorMocks.isNativePlatform,
  },
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: capacitorMocks.addListener,
    minimizeApp: capacitorMocks.minimizeApp,
  },
}));

const track: MusicTrack = {
  id: "track-1",
  name: "Song",
  artist: ["Artist"],
  album: "Album",
  pic_id: "pic-1",
  url_id: "url-1",
  lyric_id: "lyric-1",
  source: "netease",
};

describe("RootLayout", () => {
  let backButtonHandler: (() => void | Promise<void>) | undefined;
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();

    capacitorMocks.isNativePlatform.mockReturnValue(false);
    capacitorMocks.minimizeApp.mockResolvedValue(undefined);
    capacitorMocks.addListener.mockImplementation((eventName: string, callback: () => void | Promise<void>) => {
      if (eventName === "backButton") {
        backButtonHandler = callback;
      }
      return Promise.resolve({ remove: vi.fn() });
    });

    useMusicStore.setState({
      queue: [track],
      currentIndex: 0,
      isPlaying: false,
      isLoading: false,
      isRepeat: false,
      isShuffle: false,
      isFullScreenPlayer: false,
      favorites: [],
    });
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    container?.remove();
    root = undefined;
    container = undefined;
    backButtonHandler = undefined;
  });

  const renderLayout = (initialEntries: string[], initialIndex = 0) => {
    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: <RootLayout />,
          children: [
            { path: "search", element: <div>Search Page</div> },
            { path: "playlist/:id", element: <div>Playlist Page</div> },
          ],
        },
      ],
      { initialEntries, initialIndex },
    );

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(<RouterProvider router={router} />);
    });

    return { router };
  };

  it("closes the fullscreen player on real Escape without registering popstate handling", async () => {
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");
    useMusicStore.setState({ isFullScreenPlayer: true });

    renderLayout(["/search"]);

    expect(container?.querySelector('[data-testid="fullscreen-state"]')?.textContent).toBe("open");

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(useMusicStore.getState().isFullScreenPlayer).toBe(false);
    expect(container?.querySelector('[data-testid="fullscreen-state"]')?.textContent).toBe("closed");
    expect(addEventListenerSpy.mock.calls.some(([eventName]) => eventName === "popstate")).toBe(false);

    addEventListenerSpy.mockRestore();
  });

  it("uses history back on native when there is router history", async () => {
    capacitorMocks.isNativePlatform.mockReturnValue(true);
    window.history.replaceState({ idx: 1 }, "");

    const { router } = renderLayout(["/search", "/playlist/1"], 1);

    expect(container?.textContent).toContain("Playlist Page");
    expect(backButtonHandler).toBeDefined();

    await act(async () => {
      await backButtonHandler?.();
    });

    expect(router.state.location.pathname).toBe("/search");
    expect(container?.textContent).toContain("Search Page");
  });

  it("falls back to /search on native when there is no router history entry to go back to", async () => {
    capacitorMocks.isNativePlatform.mockReturnValue(true);
    window.history.replaceState({ idx: 0 }, "");

    const { router } = renderLayout(["/playlist/1"]);

    expect(backButtonHandler).toBeDefined();

    await act(async () => {
      await backButtonHandler?.();
    });

    expect(router.state.location.pathname).toBe("/search");
  });
});
