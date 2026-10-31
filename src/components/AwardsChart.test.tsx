import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { AwardsChart } from "./AwardsChart";
import { fetchAward } from "@/lib/awards/awards-api";
import { searchAlbums } from "@/lib/netease/netease-api";
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

vi.mock("@/lib/awards/awards-api", () => ({
  fetchAward: vi.fn(),
  toAwardTracks: vi.fn(() => []),
  cleanAwardTitle: (title: string) => title,
  splitAwardArtists: (winner: string) => [winner],
  awardTitleIsAlbum: vi.fn(() => false),
  awardWinnerIsTechnicalCredit: vi.fn(() => false),
}));

// 必须返回稳定引用：AwardsChart 的年份记忆 effect 依赖 meta 对象，每次新建对象会导致无限渲染
const { AWARD_META } = vi.hoisted(() => ({
  AWARD_META: {
    id: "gma",
    name: "测试奖项",
    enName: "TEST",
    latestYear: 2024,
    years: [2024],
    colors: ["#111111", "#222222"],
  },
}));

vi.mock("@/lib/awards/awards-meta", () => ({
  getAwardMeta: () => AWARD_META,
}));

vi.mock("@/lib/netease/netease-api", () => ({
  searchAlbums: vi.fn(),
  searchArtists: vi.fn(),
}));

vi.mock("@/lib/qqmusic/qqmusic-api", () => ({
  resolveQqAlbumMid: vi.fn(),
}));

const QQ_MID = "000MkMni19ClKG";

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

describe("AwardsChart 专辑跳转", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();

    vi.mocked(fetchAward).mockResolvedValue({
      award: "gma",
      year: 2024,
      edition: 1,
      categories: [
        { name: "年度专辑", kind: "album", title: "叶惠美", winner: "周杰伦" },
      ],
    } as never);
    vi.mocked(searchAlbums).mockResolvedValue([]);
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
  });

  const renderChart = () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(
        <MemoryRouter initialEntries={["/awards/gma"]}>
          <Routes>
            <Route
              path="/awards/:awardId"
              element={<AwardsChart awardId="gma" />}
            />
            <Route
              path="/qq-album/:mid"
              element={<div data-testid="qq-album-page" />}
            />
            <Route path="/search" element={<div data-testid="search-page" />} />
          </Routes>
        </MemoryRouter>
      );
    });
  };

  /** 年份 <select> 也带 cursor-pointer，需按文本定位获奖行 */
  const clickAwardRow = async () => {
    await waitFor(() => {
      expect(findRow()).not.toBeUndefined();
    });
    act(() => {
      findRow()!.click();
    });
  };

  const findRow = () =>
    Array.from(
      container!.querySelectorAll<HTMLElement>(".cursor-pointer")
    ).find((el) => el.textContent?.includes("叶惠美"));

  it("网易云没有该专辑时回退到 QQ 专辑页", async () => {
    vi.mocked(resolveQqAlbumMid).mockResolvedValue(QQ_MID);
    renderChart();
    await clickAwardRow();

    await waitFor(() => {
      expect(resolveQqAlbumMid).toHaveBeenCalledWith("叶惠美", "周杰伦");
      expect(
        container!.querySelector('[data-testid="qq-album-page"]')
      ).not.toBeNull();
    });
  });

  it("网易云与 QQ 都没有时回落到搜索页", async () => {
    vi.mocked(resolveQqAlbumMid).mockResolvedValue(null);
    renderChart();
    await clickAwardRow();

    await waitFor(() => {
      expect(resolveQqAlbumMid).toHaveBeenCalled();
      expect(
        container!.querySelector('[data-testid="search-page"]')
      ).not.toBeNull();
    });
  });
});
