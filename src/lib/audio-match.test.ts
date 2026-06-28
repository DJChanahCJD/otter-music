import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MusicSource, MusicTrack } from "@/types/music";
import { handleAutoMatch } from "./audio-match";
import { useMusicStore } from "@/store/music-store";
import { MusicProviderFactory } from "./music-provider";

vi.mock("@/lib/storage-adapter", () => ({
  idbStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock("react-hot-toast", () => ({
  toast: {
    loading: vi.fn(() => "toast-id"),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("./music-provider", () => ({
  isAbort: (e: unknown) => e instanceof Error && e.name === "AbortError",
  MusicProviderFactory: {
    getProvider: vi.fn(),
  },
}));

const createTrack = (
  id: string,
  source: MusicSource,
  name = "晴天",
  artist: string[] = ["周杰伦"]
): MusicTrack => ({
  id,
  name,
  artist,
  album: "叶惠美",
  pic_id: `pic-${id}`,
  url_id: `url-${id}`,
  lyric_id: `lyric-${id}`,
  source,
});

const jooxLoveWrongResults: MusicTrack[] = [
  {
    id: "hkI526VOIC18Gjzyw0mOzQ==",
    name: "愛錯 (feat. 單依純) (Live)",
    artist: ["王力宏", "單依純"],
    album: "愛錯 (feat. 單依純) (Live)",
    pic_id: "3f5d2b0f5b199d9a",
    url_id: "hkI526VOIC18Gjzyw0mOzQ==",
    lyric_id: "hkI526VOIC18Gjzyw0mOzQ==",
    source: "joox",
  },
  {
    id: "azcvmh6Uok1By3JayGGgiQ==",
    name: "對一個⼈愛錯 (Live)",
    artist: ["草蜢"],
    album: "RE: GRASSHOPPER CONCERT 草蜢演唱會2022 Live (Live)",
    pic_id: "88c915b71875d3db",
    url_id: "azcvmh6Uok1By3JayGGgiQ==",
    lyric_id: "azcvmh6Uok1By3JayGGgiQ==",
    source: "joox",
  },
  {
    id: "kCN0Rxo1tdbc0+iNxoyBIg==",
    name: "愛錯",
    artist: ["王力宏"],
    album: "大馬Music Man 紀念精選輯",
    pic_id: "56d1ad3c4f120cd1",
    url_id: "kCN0Rxo1tdbc0+iNxoyBIg==",
    lyric_id: "kCN0Rxo1tdbc0+iNxoyBIg==",
    source: "joox",
  },
  {
    id: "XycYUqjzeRDfcclMz035bw==",
    name: "愛錯",
    artist: ["王力宏"],
    album: "戀愛占星音樂全精選",
    pic_id: "9bfb4b92346fef7e",
    url_id: "XycYUqjzeRDfcclMz035bw==",
    lyric_id: "XycYUqjzeRDfcclMz035bw==",
    source: "joox",
  },
  {
    id: "nBx_njFDSXCkc4u6aeoOOA==",
    name: "愛錯",
    artist: ["王力宏"],
    album: "K情歌 6",
    pic_id: "29aec1fd80013d0c",
    url_id: "nBx_njFDSXCkc4u6aeoOOA==",
    lyric_id: "nBx_njFDSXCkc4u6aeoOOA==",
    source: "joox",
  },
  {
    id: "UG3wnPMoviMtKWFMhNHwWQ==",
    name: "愛錯",
    artist: ["王力宏"],
    album: "心中的日月",
    pic_id: "8bd6fe4136096207",
    url_id: "UG3wnPMoviMtKWFMhNHwWQ==",
    lyric_id: "UG3wnPMoviMtKWFMhNHwWQ==",
    source: "joox",
  },
];

describe("handleAutoMatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(MusicProviderFactory.getProvider).mockReset();
    useMusicStore.setState({
      favorites: [],
      playlists: [],
      queue: [],
      originalQueue: [],
      currentIndex: 0,
      autoMatchContext: null,
      sourceConfigs: [
        { source: "joox", enabled: true, visible: true },
        { source: "netease", enabled: true, visible: true },
        { source: "kuwo", enabled: true, visible: true },
      ],
    });
  });

  it("excludes the current track source from auto match sources", async () => {
    const sourceTrack = createTrack("old", "netease");
    const match = createTrack("new", "joox");
    const search = vi
      .fn()
      .mockResolvedValue({ items: [match], hasMore: false });
    vi.mocked(MusicProviderFactory.getProvider).mockReturnValue({
      source: "joox",
      search,
      getUrl: vi.fn(),
      getPic: vi.fn(),
      getLyric: vi.fn(),
    });

    await handleAutoMatch(sourceTrack);

    expect(MusicProviderFactory.getProvider).not.toHaveBeenCalledWith(
      "netease"
    );
  });

  it("picks Wang Leehom's solo Ai Cuo over the first duet live result", async () => {
    const sourceTrack = createTrack("old", "_netease", "爱错", ["王力宏"]);
    useMusicStore.setState({
      queue: [sourceTrack],
      originalQueue: [sourceTrack],
    });
    const search = vi
      .fn()
      .mockResolvedValue({ items: jooxLoveWrongResults, hasMore: false });
    vi.mocked(MusicProviderFactory.getProvider).mockReturnValue({
      source: "joox",
      search,
      getUrl: vi.fn(),
      getPic: vi.fn(),
      getLyric: vi.fn(),
    });

    await handleAutoMatch(sourceTrack);

    expect(useMusicStore.getState().queue[0]?.id).toBe(
      "kCN0Rxo1tdbc0+iNxoyBIg=="
    );
  });

  it("only updates queue when contextId is 'search'", async () => {
    const sourceTrack = createTrack("old", "netease");
    const match = createTrack("new", "joox");
    useMusicStore.setState({
      queue: [sourceTrack],
      originalQueue: [sourceTrack],
      favorites: [sourceTrack],
      playlists: [
        { id: "p1", name: "歌单", tracks: [sourceTrack], createdAt: 0 },
      ],
      contextId: "search",
    });
    const search = vi
      .fn()
      .mockResolvedValue({ items: [match], hasMore: false });
    vi.mocked(MusicProviderFactory.getProvider).mockReturnValue({
      source: "joox",
      search,
      getUrl: vi.fn(),
      getPic: vi.fn(),
      getLyric: vi.fn(),
    });

    await handleAutoMatch(sourceTrack);

    const state = useMusicStore.getState();
    expect(state.queue[0]?.id).toBe("new");
    expect(state.favorites[0]?.id).toBe("old");
    expect(state.playlists[0]?.tracks[0]?.id).toBe("old");
  });

  it("updates queue and playlists when contextId is 'playlist-xxx'", async () => {
    const sourceTrack = createTrack("old", "netease");
    const match = createTrack("new", "joox");
    useMusicStore.setState({
      queue: [sourceTrack],
      originalQueue: [sourceTrack],
      favorites: [sourceTrack],
      playlists: [
        { id: "p1", name: "歌单", tracks: [sourceTrack], createdAt: 0 },
      ],
      contextId: "playlist-p1",
    });
    const search = vi
      .fn()
      .mockResolvedValue({ items: [match], hasMore: false });
    vi.mocked(MusicProviderFactory.getProvider).mockReturnValue({
      source: "joox",
      search,
      getUrl: vi.fn(),
      getPic: vi.fn(),
      getLyric: vi.fn(),
    });

    await handleAutoMatch(sourceTrack);

    const state = useMusicStore.getState();
    expect(state.queue[0]?.id).toBe("new");
    expect(state.playlists[0]?.tracks[0]?.id).toBe("new");
    expect(state.favorites[0]?.id).toBe("old");
  });

  it("does not update favorites when contextId is 'favorites'", async () => {
    const sourceTrack = createTrack("old", "netease");
    const match = createTrack("new", "joox");
    useMusicStore.setState({
      queue: [sourceTrack],
      originalQueue: [sourceTrack],
      favorites: [sourceTrack],
      playlists: [
        { id: "p1", name: "歌单", tracks: [sourceTrack], createdAt: 0 },
      ],
      contextId: "favorites",
    });
    const search = vi
      .fn()
      .mockResolvedValue({ items: [match], hasMore: false });
    vi.mocked(MusicProviderFactory.getProvider).mockReturnValue({
      source: "joox",
      search,
      getUrl: vi.fn(),
      getPic: vi.fn(),
      getLyric: vi.fn(),
    });

    await handleAutoMatch(sourceTrack);

    const state = useMusicStore.getState();
    expect(state.queue[0]?.id).toBe("new");
    expect(state.favorites[0]?.id).toBe("old");
    expect(state.playlists[0]?.tracks[0]?.id).toBe("old");
  });

  it("updates favorites when autoMatchFavorites is true", async () => {
    const sourceTrack = createTrack("old", "netease");
    const match = createTrack("new", "joox");
    useMusicStore.setState({
      queue: [sourceTrack],
      originalQueue: [sourceTrack],
      favorites: [sourceTrack],
      contextId: "favorites",
      autoMatchFavorites: true,
    });
    const search = vi
      .fn()
      .mockResolvedValue({ items: [match], hasMore: false });
    vi.mocked(MusicProviderFactory.getProvider).mockReturnValue({
      source: "joox",
      search,
      getUrl: vi.fn(),
      getPic: vi.fn(),
      getLyric: vi.fn(),
    });

    await handleAutoMatch(sourceTrack);

    const state = useMusicStore.getState();
    expect(state.queue[0]?.id).toBe("new");
    expect(state.favorites[0]?.id).toBe("new");
  });

  it("does not update playlists when autoMatchPlaylists is false", async () => {
    const sourceTrack = createTrack("old", "netease");
    const match = createTrack("new", "joox");
    useMusicStore.setState({
      queue: [sourceTrack],
      originalQueue: [sourceTrack],
      playlists: [
        { id: "p1", name: "歌单", tracks: [sourceTrack], createdAt: 0 },
      ],
      contextId: "playlist-p1",
      autoMatchPlaylists: false,
    });
    const search = vi
      .fn()
      .mockResolvedValue({ items: [match], hasMore: false });
    vi.mocked(MusicProviderFactory.getProvider).mockReturnValue({
      source: "joox",
      search,
      getUrl: vi.fn(),
      getPic: vi.fn(),
      getLyric: vi.fn(),
    });

    await handleAutoMatch(sourceTrack);

    const state = useMusicStore.getState();
    expect(state.queue[0]?.id).toBe("new");
    expect(state.playlists[0]?.tracks[0]?.id).toBe("old");
  });

  it("excludes previously tried source on second auto match", async () => {
    // 模拟第一次换源后的状态：netease → joox
    const sourceTrack = createTrack("old", "netease");
    const match1 = createTrack("new-joox", "joox");
    const match2 = createTrack("new-kuwo", "kuwo");

    // 先完成一次从 netease 到 joox 的换源
    const search1 = vi
      .fn()
      .mockResolvedValue({ items: [match1], hasMore: false });
    vi.mocked(MusicProviderFactory.getProvider).mockReturnValue({
      source: "joox",
      search: search1,
      getUrl: vi.fn(),
      getPic: vi.fn(),
      getLyric: vi.fn(),
    });

    await handleAutoMatch(sourceTrack);

    // 验证第一次换源后 autoMatchContext 记录了 netease
    expect(
      useMusicStore.getState().autoMatchContext?.tried.has("netease")
    ).toBe(true);

    // 模拟第二次换源：当前 track 是 joox（第一次换源后的结果）
    const currentTrack = { ...match1 };
    vi.mocked(MusicProviderFactory.getProvider).mockClear();
    useMusicStore.setState({
      queue: [currentTrack],
      originalQueue: [currentTrack],
    });

    const search2 = vi
      .fn()
      .mockResolvedValue({ items: [match2], hasMore: false });
    vi.mocked(MusicProviderFactory.getProvider).mockImplementation(
      (source: string) => ({
        source: source as MusicSource,
        search: source === "kuwo" ? search2 : vi.fn(),
        getUrl: vi.fn(),
        getPic: vi.fn(),
        getLyric: vi.fn(),
      })
    );

    await handleAutoMatch(currentTrack);

    // netease 不应该被搜索（已尝试过）
    expect(MusicProviderFactory.getProvider).not.toHaveBeenCalledWith(
      "netease"
    );
    // joox 不应该被搜索（当前源）
    expect(MusicProviderFactory.getProvider).not.toHaveBeenCalledWith("joox");
    // kuwo 应该被搜索
    expect(MusicProviderFactory.getProvider).toHaveBeenCalledWith("kuwo");
  });

  it("resets tried sources when currentIndex changes", async () => {
    // 先完成一次换源，让 autoMatchContext 有数据
    const sourceTrack = createTrack("old", "netease");
    const match1 = createTrack("new-joox", "joox");
    const search1 = vi
      .fn()
      .mockResolvedValue({ items: [match1], hasMore: false });
    vi.mocked(MusicProviderFactory.getProvider).mockReturnValue({
      source: "joox",
      search: search1,
      getUrl: vi.fn(),
      getPic: vi.fn(),
      getLyric: vi.fn(),
    });

    await handleAutoMatch(sourceTrack);

    // 确认 tried 中有 netease
    expect(
      useMusicStore.getState().autoMatchContext?.tried.has("netease")
    ).toBe(true);

    // 模拟切歌：currentIndex 变化
    const newTrack = createTrack("other", "netease");
    vi.clearAllMocks();
    vi.mocked(MusicProviderFactory.getProvider).mockReset();
    useMusicStore.setState({
      currentIndex: 1,
      queue: [sourceTrack, newTrack],
      originalQueue: [sourceTrack, newTrack],
    });

    const search2 = vi
      .fn()
      .mockResolvedValue({ items: [match1], hasMore: false });
    vi.mocked(MusicProviderFactory.getProvider).mockReturnValue({
      source: "joox",
      search: search2,
      getUrl: vi.fn(),
      getPic: vi.fn(),
      getLyric: vi.fn(),
    });

    await handleAutoMatch(newTrack);

    // 切歌后 tried 应重置，netease 可以被搜索（作为新的候选排除逻辑）
    // 由于新 track 的 source 也是 netease，当前源 netease 仍应被排除
    expect(MusicProviderFactory.getProvider).not.toHaveBeenCalledWith(
      "netease"
    );
    // autoMatchContext 应更新为新的 index
    expect(useMusicStore.getState().autoMatchContext?.index).toBe(1);
  });
});
