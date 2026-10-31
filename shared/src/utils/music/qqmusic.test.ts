import { describe, expect, it } from "vitest";
import {
  buildQqAlbumApiPath,
  buildQqAlbumInfoApiPath,
  buildQqSearchApiPath,
  buildQqSmartboxApiPath,
  buildVkeyRequestBody,
  extractVkeyUrl,
  orderQqQualityKeys,
  parseQqAlbumInfoResponse,
  parseQqAlbumResponse,
  parseQqSosoSearchResponse,
  qqBrToQualityKey,
} from "./qqmusic";
import type {
  QqAlbumInfoResponse,
  QqAlbumMusicuResponse,
  QqSosoSearchResponse,
  QqVkeyResponse,
} from "../../types/music-platforms";

function buildVkeyResponse(
  sip: string[],
  midurlinfo: { purl: string; filename: string }[]
): QqVkeyResponse {
  return { req_1: { code: 0, data: { sip, midurlinfo } } };
}

describe("buildQqSearchApiPath", () => {
  it("builds soso search path with encoded query and page params", () => {
    const path = buildQqSearchApiPath("周杰伦", 2, 20);

    expect(path.startsWith("/soso/fcgi-bin/client_search_cp?")).toBe(true);
    expect(path).toContain("w=%E5%91%A8%E6%9D%B0%E4%BC%A6");
    expect(path).toContain("p=2");
    expect(path).toContain("n=20");
  });

  it("does not include new_json param (upstream returns empty list with it)", () => {
    expect(buildQqSearchApiPath("jay", 1, 20)).not.toContain("new_json");
  });
});

describe("parseQqSosoSearchResponse", () => {
  it("converts soso song list and computes hasMore", () => {
    const data: QqSosoSearchResponse = {
      code: 0,
      data: {
        song: {
          totalnum: 45,
          list: [
            {
              songmid: "m1",
              songname: "song",
              singer: [{ name: "a" }],
              albummid: "al",
              albumname: "album",
            },
          ],
        },
      },
    };

    const res = parseQqSosoSearchResponse(data, 1, 20);

    expect(res.items).toHaveLength(1);
    expect(res.items[0]).toMatchObject({
      id: "qq_m1",
      name: "song",
      artist: ["a"],
      album: "album",
      source: "qq",
    });
    expect(res.hasMore).toBe(true);
  });

  it("returns empty result when code is non-zero", () => {
    expect(parseQqSosoSearchResponse({ code: 2001 }, 1, 20)).toEqual({
      items: [],
      hasMore: false,
    });
  });

  it("sets hasMore false when no more pages", () => {
    const data: QqSosoSearchResponse = {
      code: 0,
      data: { song: { totalnum: 20, list: [] } },
    };

    expect(parseQqSosoSearchResponse(data, 1, 20).hasMore).toBe(false);
  });
});

describe("buildVkeyRequestBody", () => {
  it("uses anonymous credentials by default", () => {
    const body = buildVkeyRequestBody("song-mid", ["320k"]);

    expect(body.loginUin).toBe("0");
    expect(body.comm.uin).toBe("0");
    expect(body.req_1.param.uin).toBe("0");
  });

  it("uses the authenticated uin when provided", () => {
    const body = buildVkeyRequestBody("song-mid", ["320k"], "123456");

    expect(body.loginUin).toBe("123456");
    expect(body.comm.uin).toBe("123456");
    expect(body.req_1.param.uin).toBe("123456");
  });
});

describe("qqBrToQualityKey", () => {
  it("caps at 320k for high bitrates", () => {
    expect(qqBrToQualityKey(320)).toBe("320k");
    expect(qqBrToQualityKey(999)).toBe("320k");
  });

  it("falls back to 128k below 320 (no 192 tier on QQ)", () => {
    expect(qqBrToQualityKey(192)).toBe("128k");
    expect(qqBrToQualityKey(128)).toBe("128k");
  });

  it("defaults to 320k", () => {
    expect(qqBrToQualityKey()).toBe("320k");
  });
});

describe("orderQqQualityKeys", () => {
  it("puts the preferred key first and keeps the rest in default order", () => {
    expect(orderQqQualityKeys("128k")).toEqual(["128k", "320k", "m4a"]);
  });

  it("returns the default order when preferred is unknown", () => {
    expect(orderQqQualityKeys("flac")).toEqual(["320k", "128k", "m4a"]);
  });
});

describe("extractVkeyUrl", () => {
  const purlInfo = [
    {
      purl: "C400songmid.m4a?guid=10000&key=vkey&uin=0",
      filename: "C400songmid.m4a",
    },
  ];

  it("returns the first non-empty purl joined with the base sip", () => {
    const data = buildVkeyResponse(
      ["https://ws.stream.qqmusic.qq.com/"],
      purlInfo
    );
    expect(extractVkeyUrl(data)).toBe(
      "https://ws.stream.qqmusic.qq.com/C400songmid.m4a?guid=10000&key=vkey&uin=0"
    );
  });

  it("prefers the https mirror over http mirrors", () => {
    const data = buildVkeyResponse(
      ["http://ws.stream.qqmusic.qq.com/", "https://ws.stream.qqmusic.qq.com/"],
      purlInfo
    );
    expect(extractVkeyUrl(data)?.startsWith("https://")).toBe(true);
  });

  it("upgrades an http mirror to https when no https mirror exists", () => {
    const data = buildVkeyResponse(
      ["http://ws.stream.qqmusic.qq.com/"],
      purlInfo
    );
    expect(extractVkeyUrl(data)).toBe(
      "https://ws.stream.qqmusic.qq.com/C400songmid.m4a?guid=10000&key=vkey&uin=0"
    );
  });

  it("skips empty purls and returns null when none is playable", () => {
    const data = buildVkeyResponse(
      ["http://ws.stream.qqmusic.qq.com/"],
      [
        { purl: "", filename: "C400a.m4a" },
        { purl: "", filename: "M500a.mp3" },
      ]
    );
    expect(extractVkeyUrl(data)).toBeNull();
  });

  it("returns null when sip or midurlinfo is missing", () => {
    expect(extractVkeyUrl(buildVkeyResponse([], purlInfo))).toBeNull();
    expect(
      extractVkeyUrl(
        buildVkeyResponse(["http://ws.stream.qqmusic.qq.com/"], [])
      )
    ).toBeNull();
  });
});

describe("buildQqAlbumApiPath", () => {
  it("encodes both album sub requests into one musicu query", () => {
    const path = buildQqAlbumApiPath("000MkMni19ClKG");

    expect(path.startsWith("/cgi-bin/musicu.fcg?data=")).toBe(true);

    const data = JSON.parse(
      decodeURIComponent(path.slice("/cgi-bin/musicu.fcg?data=".length))
    );
    expect(data.req_0.param.AlbumMid).toBe("000MkMni19ClKG");
    expect(data.req_1.param.albumMid).toBe("000MkMni19ClKG");
    expect(data.req_1.param.begin).toBe(0);
  });
});

describe("buildQqSmartboxApiPath", () => {
  it("encodes the album name with %20 (not +) into the smartbox path", () => {
    const path = buildQqSmartboxApiPath("恒星不忘 Forever");

    expect(path.startsWith("/splcloud/fcgi-bin/smartbox_new.fcg?")).toBe(true);
    expect(path).toContain(
      "key=%E6%81%92%E6%98%9F%E4%B8%8D%E5%BF%98%20Forever"
    );
    expect(path).not.toContain("+");
  });
});

describe("parseQqAlbumResponse", () => {
  const buildResponse = (): QqAlbumMusicuResponse => ({
    code: 0,
    req_0: {
      code: 0,
      data: {
        basicInfo: {
          albumMid: "000MkMni19ClKG",
          albumName: "叶惠美",
          publishDate: "2003-07-31",
          desc: "专辑简介",
        },
        singer: { singerList: [{ name: "周杰伦", mid: "0025NhlN2yWrP4" }] },
      },
    },
    req_1: {
      code: 0,
      data: {
        totalNum: 2,
        songList: [
          {
            songInfo: {
              mid: "0039MnYb0qxYhV",
              name: "晴天",
              interval: 269,
              singer: [{ name: "周杰伦", mid: "0025NhlN2yWrP4" }],
              album: { mid: "000MkMni19ClKG", name: "叶惠美" },
              pay: { pay_play: 1 },
            },
          },
          { songInfo: {} },
        ],
      },
    },
  });

  it("normalizes album meta and skips songs without mid", () => {
    const album = parseQqAlbumResponse(buildResponse(), "fallbackMid");

    expect(album.albumMid).toBe("000MkMni19ClKG");
    expect(album.name).toBe("叶惠美");
    expect(album.creator).toBe("周杰伦");
    expect(album.publishDate).toBe("2003-07-31");
    expect(album.trackCount).toBe(2);
    expect(album.coverUrl).toContain("T002R800x800M000000MkMni19ClKG.jpg");
    expect(album.tracks).toHaveLength(1);
    expect(album.tracks[0]).toMatchObject({
      id: "qq_0039MnYb0qxYhV",
      name: "晴天",
      artist: ["周杰伦"],
      album: "叶惠美",
      url_id: "0039MnYb0qxYhV",
      source: "qq",
      fee: 1,
    });
  });

  it("falls back to the requested album mid when basicInfo omits it", () => {
    const response = buildResponse();
    response.req_0!.data!.basicInfo!.albumMid = undefined;
    expect(parseQqAlbumResponse(response, "000MkMni19ClKG").albumMid).toBe(
      "000MkMni19ClKG"
    );
  });

  it("throws when the album does not exist", () => {
    expect(() =>
      parseQqAlbumResponse({ code: 0, req_0: { code: 0 } }, "mid")
    ).toThrow();
  });

  it("throws when the upstream code is not 0", () => {
    expect(() => parseQqAlbumResponse({ code: 500 }, "mid")).toThrow();
  });
});

describe("buildQqAlbumInfoApiPath", () => {
  it("builds the legacy album path with albummid param", () => {
    const path = buildQqAlbumInfoApiPath("002S6zTQ4deh87");

    expect(path.startsWith("/v8/fcg-bin/fcg_v8_album_info_cp.fcg?")).toBe(true);
    expect(path).toContain("albummid=002S6zTQ4deh87");
    expect(path).toContain("format=json");
  });
});

describe("parseQqAlbumInfoResponse", () => {
  const buildResponse = (): QqAlbumInfoResponse => ({
    code: 0,
    data: {
      mid: "002S6zTQ4deh87",
      name: "Pleasure",
      singername: "蔡依林",
      aDate: "2025-07-25",
      desc: "专辑简介",
      total_song_num: 2,
      list: [
        {
          songmid: "0010EFJh2YexX5",
          songname: "Layers",
          interval: 176,
          singer: [{ name: "蔡依林", mid: "0027pdHE4STooO" }],
          albummid: "002S6zTQ4deh87",
          albumname: "Pleasure",
          pay: { payplay: 1 },
        },
        { songname: "无 mid 的脏数据" },
      ],
    },
  });

  it("normalizes album meta and tracks from the legacy response", () => {
    const album = parseQqAlbumInfoResponse(buildResponse(), "fallbackMid");

    expect(album.albumMid).toBe("002S6zTQ4deh87");
    expect(album.name).toBe("Pleasure");
    expect(album.creator).toBe("蔡依林");
    expect(album.publishDate).toBe("2025-07-25");
    expect(album.trackCount).toBe(2);
    expect(album.tracks).toHaveLength(1);
    expect(album.tracks[0]).toMatchObject({
      id: "qq_0010EFJh2YexX5",
      name: "Layers",
      artist: ["蔡依林"],
      album: "Pleasure",
      url_id: "0010EFJh2YexX5",
      source: "qq",
      fee: 1,
    });
  });

  it("throws when the album is missing or the code is not 0", () => {
    expect(() => parseQqAlbumInfoResponse({ code: 0 }, "mid")).toThrow();
    expect(() => parseQqAlbumInfoResponse({ code: 404 }, "mid")).toThrow();
  });
});
