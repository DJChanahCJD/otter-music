import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

import { MusicSearchView } from "./MusicSearchView";
import { useMusicStore } from "@/store/music-store";
import type { MusicTrack, SearchSuggestionItem } from "@/types/music";

vi.mock("@/lib/storage-adapter", () => ({
  idbStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock("@/hooks/use-debounce", () => ({
  useDebounce: <T,>(value: T) => value,
}));

vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
  },
}));

vi.mock("@/lib/utils/toast", () => ({
  toastUtils: {
    notFound: vi.fn(),
  },
}));

vi.mock("./PlaylistMarket/PlaylistMarket", () => ({
  PlaylistMarket: () => <div data-testid="playlist-market">playlist-market</div>,
}));

vi.mock("./MusicTrackList", () => ({
  MusicTrackList: () => <div data-testid="music-track-list">music-track-list</div>,
}));

vi.mock("./ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: ReactNode;
  }) => (
    <div data-testid="search-source-select" data-value={value}>
      <button type="button" onClick={() => onValueChange(value)}>
        select
      </button>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span>value</span>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children: ReactNode;
  }) => <div data-testid={`select-item-${value}`}>{children}</div>,
}));

vi.mock("./SearchSuggestions", () => ({
  SearchSuggestions: ({
    suggestions,
    onSelect,
    activeIndex,
    onClose,
  }: {
    suggestions: SearchSuggestionItem[];
    onSelect: (item: SearchSuggestionItem) => void;
    activeIndex: number;
    onClose: () => void;
  }) => (
    <div data-testid="search-suggestions">
      <button type="button" data-testid="close-suggestions" onClick={onClose}>
        close
      </button>
      {suggestions.map((item, index) => (
        <button
          key={`${item.type}-${item.id ?? item.text}`}
          type="button"
          data-testid={`suggestion-${index}`}
          data-active={index === activeIndex}
          onClick={() => onSelect(item)}
        >
          {item.text}
        </button>
      ))}
    </div>
  ),
}));

const musicApiMocks = vi.hoisted(() => ({
  getSearchSuggestions: vi.fn(),
  searchAll: vi.fn(),
  search: vi.fn(),
}));

vi.mock("@/lib/music-api", () => ({
  musicApi: musicApiMocks,
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

const suggestions: SearchSuggestionItem[] = [
  { text: "Alpha", type: "song", source: "_netease", id: "1" },
  { text: "Beta", type: "artist", source: "_netease", id: "2" },
  { text: "Gamma", type: "album", source: "_netease", id: "3" },
];

describe("MusicSearchView", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();

    useMusicStore.setState({
      searchSource: "all",
      searchQuery: "",
      searchIntent: null,
      searchResults: [],
      searchLoading: false,
      searchHasMore: false,
      searchPage: 0,
    });

    musicApiMocks.getSearchSuggestions.mockResolvedValue(suggestions);
    musicApiMocks.searchAll.mockResolvedValue({
      items: [track],
      hasMore: false,
    });
    musicApiMocks.search.mockResolvedValue({
      items: [track],
      hasMore: false,
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
  });

  const renderView = () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(
        <MemoryRouter>
          <MusicSearchView onPlay={vi.fn()} />
        </MemoryRouter>,
      );
    });
  };

  const flushEffects = async () => {
    await act(async () => {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

  const getInput = () => {
    const input = container?.querySelector(
      'input[placeholder="搜索音乐、歌手或专辑..."]',
    ) as HTMLInputElement | null;
    expect(input).not.toBeNull();
    return input!;
  };

  const getSuggestion = (index: number) => {
    const suggestion = container?.querySelector(
      `[data-testid="suggestion-${index}"]`,
    ) as HTMLButtonElement | null;
    expect(suggestion).not.toBeNull();
    return suggestion!;
  };

  const setInputValue = async (value: string) => {
    const input = getInput();
    await act(async () => {
      input.focus();
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flushEffects();
    expect(musicApiMocks.getSearchSuggestions).toHaveBeenLastCalledWith(value);
    return input;
  };

  const keyDown = async (key: string) => {
    const input = getInput();
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    });
    await flushEffects();
  };

  const click = async (element: Element) => {
    await act(async () => {
      (element as HTMLElement).dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    await flushEffects();
  };

  it("opens suggestions and updates the active item with arrow keys", async () => {
    renderView();
    const input = await setInputValue("a");

    const closeButton = container?.querySelector(
      '[data-testid="close-suggestions"]',
    ) as HTMLButtonElement | null;
    expect(closeButton).not.toBeNull();
    await click(closeButton!);
    expect(container?.querySelector('[data-testid="search-suggestions"]')).toBeNull();

    await act(async () => {
      input.focus();
    });
    await keyDown("ArrowDown");
    expect(container?.querySelector('[data-testid="search-suggestions"]')).not.toBeNull();
    expect(getSuggestion(0).getAttribute("data-active")).toBe("true");

    await keyDown("ArrowDown");
    expect(getSuggestion(1).getAttribute("data-active")).toBe("true");

    await keyDown("ArrowUp");
    expect(getSuggestion(0).getAttribute("data-active")).toBe("true");
  });

  it("selects the active suggestion on Enter", async () => {
    renderView();
    const input = await setInputValue("a");

    await keyDown("ArrowDown");
    await keyDown("ArrowDown");
    await keyDown("Enter");

    expect(musicApiMocks.searchAll).toHaveBeenLastCalledWith(
      "Beta",
      1,
      20,
      expect.any(AbortSignal),
      null,
    );
    expect(input.value).toBe("Beta");
  });

  it("submits a direct search on Enter when no suggestion is active", async () => {
    renderView();
    const input = await setInputValue("keyword");

    await keyDown("Enter");

    expect(musicApiMocks.searchAll).toHaveBeenLastCalledWith(
      "keyword",
      1,
      20,
      expect.any(AbortSignal),
      null,
    );
    expect(container?.querySelector('[data-testid="search-suggestions"]')).toBeNull();
    expect(input.value).toBe("keyword");
  });

  it("clears the query, hides suggestions, and refocuses the input", async () => {
    renderView();
    const input = await setInputValue("clear me");

    const clearButton = Array.from(container?.querySelectorAll("button") ?? []).find(
      (button) => button.className.includes("rounded-full"),
    ) as HTMLButtonElement | undefined;

    expect(clearButton).toBeDefined();
    await click(clearButton!);

    expect(input.value).toBe("");
    expect(container?.querySelector('[data-testid="search-suggestions"]')).toBeNull();
    expect(document.activeElement).toBe(input);
  });
});
