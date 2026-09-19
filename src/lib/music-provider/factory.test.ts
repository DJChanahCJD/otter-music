import { describe, expect, it } from "vitest";
import { MusicProviderFactory } from "./factory";
import { MusicTrack } from "@/types/music";

const qqTrack: MusicTrack = {
  id: "qq_000abc",
  name: "QQ测试歌曲",
  artist: ["QQ测试歌手"],
  album: "QQ测试专辑",
  pic_id: "https://y.gtimg.cn/music/photo_new/T002R800x800M000abc.jpg",
  url_id: "",
  lyric_id: "",
  source: "qq",
};

const kugouTrack: MusicTrack = {
  id: "kugou_ABC",
  name: "测试歌曲",
  artist: ["测试歌手"],
  album: "测试专辑",
  pic_id: "https://example.com/cover.jpg",
  url_id: "ABC",
  lyric_id: "",
  source: "kugou",
};

const miguTrack: MusicTrack = {
  id: "migu_60054704083_600908000006663347",
  name: "测试歌曲",
  artist: ["测试歌手"],
  album: "测试专辑",
  pic_id: "https://example.com/migu-cover.jpg",
  url_id: "migu_60054704083_600908000006663347",
  lyric_id: "",
  source: "migu",
};

const bilibiliTrack: MusicTrack = {
  id: "bilibili_BV1xx411c7mD",
  name: "Bilibili Song",
  artist: ["UP"],
  album: "Bilibili",
  pic_id: "https://example.com/bilibili-cover.jpg",
  url_id: "bilibili_BV1xx411c7mD",
  lyric_id: "",
  source: "bilibili",
};

const higequTrack: MusicTrack = {
  id: "higequ_228908",
  name: "晴天",
  artist: ["周杰伦"],
  album: "叶惠美",
  pic_id: "higequ_228908",
  url_id: "228908",
  lyric_id: "higequ_228908",
  source: "higequ",
};

const jamendoTrack: MusicTrack = {
  id: "jamendo_1474237",
  name: "Test Song",
  artist: ["Artist"],
  album: "Album",
  pic_id: "https://example.com/jamendo-cover.jpg",
  url_id: "1474237",
  lyric_id: "jamendo_1474237",
  source: "jamendo",
};

const alistTrack: MusicTrack = {
  id: "alist:missing-server:/music/test.mp3",
  name: "test",
  artist: ["Alist"],
  album: "/music",
  pic_id: "",
  url_id: "/music/test.mp3",
  lyric_id: "_alist",
  source: "alist",
};

describe("MusicProviderFactory", () => {
  it("creates a safe placeholder provider for Kugou tracks", async () => {
    const provider = MusicProviderFactory.getProvider("kugou");

    await expect(provider.search("测试", 1, 20)).resolves.toEqual({
      items: [],
      hasMore: false,
    });
    await expect(provider.getUrl(kugouTrack)).resolves.toBeNull();
    await expect(provider.getPic(kugouTrack)).resolves.toBe(
      "https://example.com/cover.jpg"
    );
    await expect(provider.getLyric(kugouTrack)).resolves.toBeNull();
  });

  it("creates a provider for Migu tracks", async () => {
    const provider = MusicProviderFactory.getProvider("migu");

    await expect(provider.search("测试", 1, 20)).resolves.toEqual({
      items: [],
      hasMore: false,
    });
    await expect(provider.getPic(miguTrack)).resolves.toBe(
      "https://example.com/migu-cover.jpg"
    );
    await expect(provider.getLyric(miguTrack)).resolves.toBeNull();
  });

  it("creates a provider for Bilibili tracks", async () => {
    const provider = MusicProviderFactory.getProvider("bilibili");

    await expect(provider.getPic(bilibiliTrack)).resolves.toBe(
      "/api/bilibili-cover?url=https%3A%2F%2Fexample.com%2Fbilibili-cover.jpg"
    );
    await expect(provider.getLyric(bilibiliTrack)).resolves.toBeNull();
  });

  it("creates a provider for QQ tracks", async () => {
    const provider = MusicProviderFactory.getProvider("qq");
    expect(provider.source).toBe("qq");
    await expect(provider.getPic(qqTrack)).resolves.toBe(
      "https://y.gtimg.cn/music/photo_new/T002R800x800M000abc.jpg"
    );
    await expect(provider.getLyric(qqTrack)).resolves.toBeNull();
  });

  it("creates a provider for Hi歌曲 tracks", async () => {
    const provider = MusicProviderFactory.getProvider("higequ");
    expect(provider.source).toBe("higequ");

    // 非法 rid 直接返回 null（不触发播放页抓取），避免测试依赖真实网络
    await expect(
      provider.getUrl({ ...higequTrack, id: "invalid", url_id: "" })
    ).resolves.toBeNull();
    await expect(
      provider.getPic({ ...higequTrack, pic_id: "invalid" })
    ).resolves.toBeNull();
    await expect(
      provider.getLyric({ ...higequTrack, lyric_id: "invalid" })
    ).resolves.toBeNull();
  });

  it("creates a provider for Jamendo tracks", async () => {
    const provider = MusicProviderFactory.getProvider("jamendo");
    expect(provider.source).toBe("jamendo");

    // 空搜索词直接返回空页，不发请求
    await expect(provider.search("  ", 1, 20)).resolves.toEqual({
      items: [],
      hasMore: false,
    });
    // 音频直链由 ID 模板拼出（无需请求接口）
    await expect(provider.getUrl(jamendoTrack)).resolves.toBe(
      "https://prod-1.storage.jamendo.com/?trackid=1474237&format=mp32"
    );
    // 封面在搜索结果中已是直链，直接透传
    await expect(provider.getPic(jamendoTrack)).resolves.toBe(
      jamendoTrack.pic_id
    );
    // 非法 ID 返回 null
    await expect(
      provider.getUrl({ ...jamendoTrack, id: "invalid", url_id: "invalid" })
    ).resolves.toBeNull();
    // Jamendo 无歌词能力
    await expect(provider.getLyric(jamendoTrack)).resolves.toBeNull();
  });

  it("creates a provider for Alist tracks", async () => {
    const provider = MusicProviderFactory.getProvider("alist");
    expect(provider.source).toBe("alist");
    // search 返回空（Alist 已排除聚合搜索）
    await expect(provider.search("测试", 1, 20)).resolves.toEqual({
      items: [],
      hasMore: false,
    });
    // 服务器不存在时 getUrl 返回 null
    await expect(provider.getUrl(alistTrack)).resolves.toBeNull();
    await expect(provider.getPic(alistTrack)).resolves.toBeNull();
    await expect(provider.getLyric(alistTrack)).resolves.toBeNull();
  });
});
