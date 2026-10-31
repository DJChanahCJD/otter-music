import { describe, expect, it } from "vitest";
import {
  parseQqMusicUrl,
  buildQqPlaylistApiPath,
  parseQqPlaylistResponse,
  convertQqSongToMusicTrack,
} from "./qqmusic-api";

// ============================================================
// parseQqMusicUrl
// ============================================================

describe("parseQqMusicUrl", () => {
  it("extracts playlist id from path-based QQ Music links", () => {
    expect(
      parseQqMusicUrl("https://y.qq.com/n/yqq/playlist/7177076625.html")
    ).toBe("7177076625");
  });

  it("extracts playlist id from ryqq_v2 playlist links", () => {
    expect(
      parseQqMusicUrl(
        "https://y.qq.com/n/ryqq_v2/playlist/3569246560?ADTAG=h5_share_playlist&redirecttag=mn.redirect.custom&mnst=2.27"
      )
    ).toBe("3569246560");
  });

  it("extracts playlist id from query-based QQ Music share links", () => {
    expect(
      parseQqMusicUrl(
        "https://i2.y.qq.com/n3/other/pages/details/playlist.html?platform=11&appshare=android_qq&appversion=20040508&hosteuin=oK6kowEAoK4z7ecsoKvsow6ANn**&id=3569246560&ADTAG=wxfshare"
      )
    ).toBe("3569246560");
  });

  it("rejects links without a numeric playlist id", () => {
    expect(
      parseQqMusicUrl("https://y.qq.com/n/yqq/playlist/not-a-number.html")
    ).toBeNull();
    expect(
      parseQqMusicUrl("https://i.y.qq.com/n2/m/share/details/taoge.html?id=abc")
    ).toBeNull();
  });

  it("rejects completely unrelated URLs", () => {
    expect(parseQqMusicUrl("https://example.com/some/page")).toBeNull();
    expect(parseQqMusicUrl("not a url")).toBeNull();
  });
});

// ============================================================
// buildQqPlaylistApiPath
// ============================================================

describe("buildQqPlaylistApiPath", () => {
  it("uses disstid parameter (not categoryID)", () => {
    const url = buildQqPlaylistApiPath("3569246560");
    expect(url).toContain("disstid=3569246560");
    expect(url).not.toContain("categoryID");
  });

  it("encodes the playlist id", () => {
    const url = buildQqPlaylistApiPath("abc%123");
    expect(url).toContain("disstid=abc%25123");
  });

  it("includes required compatibility parameters", () => {
    const url = buildQqPlaylistApiPath("123");
    expect(url).toContain("nosign=1");
    expect(url).toContain("g_tk=5381");
    expect(url).toContain("loginUin=0");
    expect(url).toContain("hostUin=0");
    expect(url).toContain("platform=yqq");
    expect(url).toContain("needNewCode=0");
    expect(url).toContain("format=json");
    expect(url).toContain("inCharset=GB2312");
    expect(url).toContain("outCharset=utf-8");
  });

  it("starts with the correct API path", () => {
    const url = buildQqPlaylistApiPath("123");
    expect(url).toMatch(
      /^\/qzone-music\/fcg-bin\/fcg_ucc_getcdinfo_byids_cp\.fcg\?/
    );
  });

  it("works with the user's playlist id", () => {
    const url = buildQqPlaylistApiPath("3569246560");
    expect(url).toContain("disstid=3569246560");
    expect(url).toContain("fcg_ucc_getcdinfo_byids_cp.fcg");
  });
});

// ============================================================
// parseQqPlaylistResponse
// ============================================================

describe("parseQqPlaylistResponse", () => {
  it("parses plain JSON", () => {
    const result = parseQqPlaylistResponse('{"code":0,"cdlist":[]}');
    expect(result).toEqual({ code: 0, cdlist: [] });
  });

  it("parses plain JSON containing parentheses in song names", () => {
    const result = parseQqPlaylistResponse(
      '{"code":0,"cdlist":[{"songlist":[{"songname":"不该 (with aMEI)"}]}]}'
    );

    expect(result.cdlist[0].songlist[0].songname).toBe("不该 (with aMEI)");
  });

  it("parses JSONP responses", () => {
    const result = parseQqPlaylistResponse(
      'jsonCallback({"code":0,"cdlist":[]})'
    );
    expect(result).toEqual({ code: 0, cdlist: [] });
  });

  it("throws for invalid non-JSONP text", () => {
    expect(() => parseQqPlaylistResponse("not json")).toThrow();
  });
});

// ============================================================
// convertQqSongToMusicTrack
// ============================================================

describe("convertQqSongToMusicTrack", () => {
  it("converts QQ Music song to MusicTrack format", () => {
    const track = convertQqSongToMusicTrack({
      songid: "123",
      songmid: "abc123",
      songname: "晴天",
      singer: [{ name: "周杰伦" }],
      albumname: "叶惠美",
      albummid: "xyz789",
      interval: 269,
    });

    expect(track.id).toBe("qq_abc123");
    expect(track.name).toBe("晴天");
    expect(track.artist).toEqual(["周杰伦"]);
    expect(track.album).toBe("叶惠美");
    expect(track.source).toBe("qq");
    expect(track.url_id).toBe("abc123");
    expect(track.lyric_id).toBe("abc123");
    expect(track.pic_id).toContain("xyz789");
    expect(track.pic_id).toContain("y.gtimg.cn");
  });

  it("handles multiple singers", () => {
    const track = convertQqSongToMusicTrack({
      songid: "1",
      songmid: "m1",
      songname: "某某",
      singer: [{ name: "A" }, { name: "B" }],
      albumname: "Album",
      albummid: "mid1",
      interval: 200,
    });

    expect(track.artist).toEqual(["A", "B"]);
    expect(track.album_id).toBe("mid1");
  });

  it("handles empty albummid", () => {
    const track = convertQqSongToMusicTrack({
      songid: "1",
      songmid: "m1",
      songname: "Song",
      singer: [{ name: "Artist" }],
      albumname: "Album",
      albummid: "",
      interval: 200,
    });

    expect(track.pic_id).toBe("");
  });
});
