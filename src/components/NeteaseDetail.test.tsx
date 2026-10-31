import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { NeteaseDetail } from "./NeteaseDetail";
import { getAlbum } from "@/lib/netease/netease-api";
import { resolveQqAlbumMid } from "@/lib/qqmusic/qqmusic-api";

vi.mock("@/lib/storage-adapter", () => ({
  idbStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn(), loading: vi.fn() },
}));

vi.mock("./MusicTrackList", () => ({
  MusicTrackList: () => <div data-testid="track-list" />,
}));

vi.mock("./ArtistAlbumSheet", () => ({
  ArtistAlbumSheet: () => null,
}));

vi.mock("@/lib/netease/netease-api", () => ({
  getPlaylistDetail: vi.fn(),
  getArtist: vi.fn(),
  getAlbum: vi.fn(),
  getArtistSongs: vi.fn(),
  getAlbumDynamicDetail: vi.fn().mockResolvedValue(null),
  convertSongToMusicTrack: vi.fn(),
  toggleSubAlbum: vi.fn(),
}));

vi.mock("@/lib/qqmusic/qqmusic-api", () => ({
  resolveQqAlbumMid: vi.fn(),
}));

const ALBUM_ID = "123456";
const QQ_MID = "000MkMni19ClKG";

/** 轮询等待断言成立，避免依赖 @testing-library */
async function waitFor(assertion: () => void, timeout = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      assertion();
      return;
    } catch {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
    }
  }
  assertion();
}

describe("NeteaseDetail 专辑回退", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    // 网易云专辑接口失败
    vi.mocked(getAlbum).mockResolvedValue(null);
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
  });

  const renderAlbum = (state: unknown) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(
        <MemoryRouter
          initialEntries={[{ pathname: `/netease-album/${ALBUM_ID}`, state }]}
        >
          <Routes>
            <Route
              path="/netease-album/:id"
              element={
                <NeteaseDetail
                  id={ALBUM_ID}
                  type="album"
                  onBack={vi.fn()}
                  onPlay={vi.fn()}
                />
              }
            />
            <Route
              path="/qq-album/:mid"
              element={<div data-testid="qq-album-page" />}
            />
          </Routes>
        </MemoryRouter>
      );
    });
  };

  it("网易云专辑加载失败时跳转 QQ 专辑页", async () => {
    vi.mocked(resolveQqAlbumMid).mockResolvedValue(QQ_MID);

    renderAlbum({ albumFallback: { name: "叶惠美", artist: "周杰伦" } });

    await waitFor(() => {
      expect(resolveQqAlbumMid).toHaveBeenCalledWith("叶惠美", "周杰伦");
      expect(
        container!.querySelector('[data-testid="qq-album-page"]')
      ).not.toBeNull();
    });
  });

  it("QQ 也解析不到时保留网易云错误页", async () => {
    vi.mocked(resolveQqAlbumMid).mockResolvedValue(null);

    renderAlbum({ albumFallback: { name: "不存在的专辑", artist: "某人" } });

    await waitFor(() => {
      expect(resolveQqAlbumMid).toHaveBeenCalled();
    });
    expect(
      container!.querySelector('[data-testid="qq-album-page"]')
    ).toBeNull();
  });

  it("没有回退信息时不触发 QQ 解析", async () => {
    renderAlbum(null);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    expect(resolveQqAlbumMid).not.toHaveBeenCalled();
  });
});
