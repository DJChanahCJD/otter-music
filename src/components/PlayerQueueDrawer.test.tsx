import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import type { MusicTrack } from "@/types/music";
import { PlayerQueueDrawer } from "./PlayerQueueDrawer";

const tracks: MusicTrack[] = [
  {
    id: "1",
    name: "First",
    artist: ["Artist A"],
    album: "",
    pic_id: "",
    url_id: "1",
    lyric_id: "",
    source: "netease",
  },
  {
    id: "2",
    name: "Second",
    artist: ["Artist B"],
    album: "",
    pic_id: "",
    url_id: "2",
    lyric_id: "",
    source: "netease",
  },
];

describe("PlayerQueueDrawer", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    container?.remove();
    document.body.innerHTML = "";
    root = undefined;
    container = undefined;
    vi.restoreAllMocks();
  });

  const renderDrawer = (
    props?: Partial<React.ComponentProps<typeof PlayerQueueDrawer>>
  ) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    const defaultProps: React.ComponentProps<typeof PlayerQueueDrawer> = {
      queue: tracks,
      currentIndex: 0,
      isPlaying: true,
      isShuffle: false,
      onPlay: vi.fn(),
      onClear: vi.fn(),
      onReshuffle: vi.fn(),
      onRemove: vi.fn(),
      trigger: <button type="button">queue</button>,
    };

    act(() => {
      root!.render(<PlayerQueueDrawer {...defaultProps} {...props} />);
    });

    return { ...defaultProps, ...props };
  };

  const click = (element: Element) => {
    act(() => {
      element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  };

  it("opens as a drawer and plays a selected track", () => {
    const props = renderDrawer();

    click(document.querySelector("button")!);
    expect(document.body.textContent).toContain("播放列表 (2)");

    const secondTrack = document.body.querySelector(
      '[aria-label="播放 Second"]'
    );
    expect(secondTrack).not.toBeNull();

    click(secondTrack!);

    expect(props.onPlay).toHaveBeenCalledWith(1);
  });

  it("removes one queued track without playing it", () => {
    const props = renderDrawer({ currentIndex: 1 });

    click(document.querySelector("button")!);

    const removeFirst = document.body.querySelector(
      'button[aria-label="移除 First"]'
    );
    expect(removeFirst).not.toBeNull();

    click(removeFirst!);

    expect(props.onRemove).toHaveBeenCalledWith(tracks[0]);
    expect(props.onPlay).not.toHaveBeenCalled();
  });
});
