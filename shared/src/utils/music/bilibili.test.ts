import { describe, expect, it } from "vitest";
import {
  buildBilibiliDurlPlayUrlPath,
  buildBilibiliPlayUrlPath,
  buildBilibiliSeasonsArchivesListPath,
  buildBilibiliSearchPath,
  buildBilibiliSeriesArchivesPath,
  buildBilibiliSeriesDetailPath,
  buildBilibiliViewPath,
  convertBilibiliSearchVideoToMusicTrack,
  convertSeasonArchiveToMusicTrack,
  convertSeriesArchiveToMusicTrack,
  convertSeriesToMusicTrack,
  describePlayurlResponse,
  parseBilibiliAlbumId,
  parseBilibiliSeasonsArchivesList,
  parseBilibiliSearchResponse,
  parseBilibiliSeriesArchives,
  parseBilibiliSeriesDetail,
  parseBilibiliTrackId,
  selectBilibiliAudioUrl,
  selectBilibiliDurlUrl,
} from "./bilibili";

describe("bilibili music utilities", () => {
  it("builds Bilibili API paths", () => {
    expect(buildBilibiliSearchPath("周杰伦", 2, 20)).toContain(
      "/x/web-interface/search/type?"
    );
    expect(buildBilibiliSearchPath("周杰伦", 2, 20)).toContain(
      "keyword=%E5%91%A8%E6%9D%B0%E4%BC%A6"
    );
    expect(buildBilibiliViewPath("BV1xx411c7mD")).toBe(
      "/x/web-interface/view?bvid=BV1xx411c7mD"
    );
    expect(buildBilibiliPlayUrlPath("BV1xx411c7mD", 62131)).toBe(
      "/x/player/playurl?fnval=16&bvid=BV1xx411c7mD&cid=62131"
    );
  });

  it("converts search videos to MusicTrack", () => {
    const track = convertBilibiliSearchVideoToMusicTrack({
      bvid: "BV1xx411c7mD",
      title: '<em class="keyword">周杰伦</em> 歌曲精选',
      author: "UP主",
      mid: 123,
      pic: "//i0.hdslb.com/bfs/archive/cover.jpg",
    });

    expect(track).toMatchObject({
      id: "bilibili_BV1xx411c7mD",
      name: "周杰伦 歌曲精选",
      artist: ["UP主"],
      album: "",
      pic_id: "https://i0.hdslb.com/bfs/archive/cover.jpg",
      url_id: "bilibili_BV1xx411c7mD",
      lyric_id: "",
      source: "bilibili",
      artist_ids: ["123"],
    });
    expect(track).not.toHaveProperty("album_id");
  });

  describe("convertBilibiliSearchVideoToMusicTrack collection detection", () => {
    it("does not set album from season_id (only ugc_season from view API is reliable)", () => {
      const track = convertBilibiliSearchVideoToMusicTrack({
        bvid: "BV1xx411c7mD",
        title: "歌曲标题",
        author: "",
        pic: "https://example.com/cover.jpg",
        season_id: 67890,
      });

      expect(track.album).toBe("");
      expect(track).not.toHaveProperty("album_id");
    });

    it("keeps album empty when no collection info", () => {
      const track = convertBilibiliSearchVideoToMusicTrack({
        bvid: "BV1xx411c7mD",
        title: "歌曲标题",
        author: "",
        pic: "https://example.com/cover.jpg",
      });

      expect(track.album).toBe("");
      expect(track).not.toHaveProperty("album_id");
    });
  });

  it("parses search responses and hasMore", () => {
    const result = parseBilibiliSearchResponse(
      {
        code: 0,
        data: {
          numResults: 30,
          result: [
            {
              type: "video",
              bvid: "BV1",
              title: "Song",
              author: "UP",
              pic: "https://example.com/cover.jpg",
            },
          ],
        },
      },
      1,
      20
    );

    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(true);
  });

  it("parses track ids and selects the highest bandwidth audio url", () => {
    expect(parseBilibiliTrackId("bilibili_BV1xx411c7mD")).toEqual({
      bvid: "BV1xx411c7mD",
    });
    expect(parseBilibiliTrackId("netease_1")).toBeNull();

    expect(
      selectBilibiliAudioUrl({
        data: {
          dash: {
            audio: [
              {
                baseUrl: "https://example.com/low.m4s",
                bandwidth: 1,
                mimeType: "audio/mp4",
              },
              {
                base_url: "https://example.com/high.m4s",
                bandwidth: 2,
                mimeType: "audio/mp4",
              },
            ],
          },
        },
      })
    ).toEqual({
      url: "https://example.com/high.m4s",
      format: "m4s",
    });
  });

  describe("selectBilibiliAudioUrl extended field matching", () => {
    it("selects backup_url when baseUrl and base_url are missing", () => {
      expect(
        selectBilibiliAudioUrl({
          data: {
            dash: {
              audio: [
                {
                  backup_url: "https://example.com/backup.m4s",
                  bandwidth: 1,
                  mimeType: "audio/mp4",
                },
              ],
            },
          },
        })
      ).toEqual({
        url: "https://example.com/backup.m4s",
        format: "m4s",
      });
    });

    it("selects backupUrl (camelCase) when snake_case is missing", () => {
      expect(
        selectBilibiliAudioUrl({
          data: {
            dash: {
              audio: [
                {
                  backupUrl: "https://example.com/backup-camel.m4s",
                  bandwidth: 1,
                  mimeType: "audio/mp4",
                },
              ],
            },
          },
        })
      ).toEqual({
        url: "https://example.com/backup-camel.m4s",
        format: "m4s",
      });
    });

    it("selects url field when all other fields are missing", () => {
      expect(
        selectBilibiliAudioUrl({
          data: {
            dash: {
              audio: [
                {
                  url: "https://example.com/plain-url.m4s",
                  bandwidth: 1,
                  mimeType: "audio/mp4",
                },
              ],
            },
          },
        })
      ).toEqual({
        url: "https://example.com/plain-url.m4s",
        format: "m4s",
      });
    });

    it("prefers baseUrl over backup_url when both present", () => {
      expect(
        selectBilibiliAudioUrl({
          data: {
            dash: {
              audio: [
                {
                  baseUrl: "https://example.com/primary.m4s",
                  backup_url: "https://example.com/backup.m4s",
                  bandwidth: 1,
                  mimeType: "audio/mp4",
                },
              ],
            },
          },
        })
      ).toEqual({
        url: "https://example.com/primary.m4s",
        format: "m4s",
      });
    });

    it("returns null when audio array is empty", () => {
      expect(
        selectBilibiliAudioUrl({
          data: { dash: { audio: [] } },
        })
      ).toBeNull();
    });

    it("returns null when no recognizable URL field exists", () => {
      expect(
        selectBilibiliAudioUrl({
          data: {
            dash: {
              audio: [{ bandwidth: 320, codecs: "mp4a.40.2" }],
            },
          },
        })
      ).toBeNull();
    });

    it("returns null when dash is missing", () => {
      expect(
        selectBilibiliAudioUrl({
          data: {},
        } as any)
      ).toBeNull();
    });
  });

  describe("selectBilibiliAudioUrl format inference", () => {
    it("infers m4s from audio/mp4 mimeType", () => {
      expect(
        selectBilibiliAudioUrl({
          data: {
            dash: {
              audio: [
                {
                  baseUrl: "https://example.com/a.m4s",
                  bandwidth: 1,
                  mimeType: "audio/mp4",
                },
              ],
            },
          },
        })
      ).toEqual({ url: "https://example.com/a.m4s", format: "m4s" });
    });

    it("infers flv from audio/x-flv mimeType", () => {
      expect(
        selectBilibiliAudioUrl({
          data: {
            dash: {
              audio: [
                {
                  baseUrl: "https://example.com/a.flv",
                  bandwidth: 1,
                  mimeType: "audio/x-flv",
                },
              ],
            },
          },
        })
      ).toEqual({ url: "https://example.com/a.flv", format: "flv" });
    });

    it("infers m4a as fallback when mimeType is missing", () => {
      expect(
        selectBilibiliAudioUrl({
          data: {
            dash: {
              audio: [{ baseUrl: "https://example.com/a", bandwidth: 1 }],
            },
          },
        })
      ).toEqual({ url: "https://example.com/a", format: "m4a" });
    });
  });

  describe("selectBilibiliDurlUrl", () => {
    it("extracts the first durl entry url with format", () => {
      expect(
        selectBilibiliDurlUrl({
          data: {
            durl: [
              { url: "https://example.com/segment1.flv", length: 1000 },
              { url: "https://example.com/segment2.flv", length: 1000 },
            ],
          },
        })
      ).toEqual({
        url: "https://example.com/segment1.flv",
        format: "flv",
      });
    });

    it("infers m4s from .m4s url", () => {
      expect(
        selectBilibiliDurlUrl({
          data: { durl: [{ url: "https://example.com/audio.m4s" }] },
        })
      ).toEqual({
        url: "https://example.com/audio.m4s",
        format: "m4s",
      });
    });

    it("returns null when durl array is empty", () => {
      expect(
        selectBilibiliDurlUrl({
          data: { durl: [] },
        })
      ).toBeNull();
    });

    it("returns null when data is missing", () => {
      expect(selectBilibiliDurlUrl({} as any)).toBeNull();
    });

    it("normalizes protocol-relative URLs", () => {
      expect(
        selectBilibiliDurlUrl({
          data: {
            durl: [{ url: "//example.com/audio.flv" }],
          },
        })
      ).toEqual({ url: "https://example.com/audio.flv", format: "flv" });
    });

    it("falls back to m4a when extension is unknown", () => {
      expect(
        selectBilibiliDurlUrl({
          data: { durl: [{ url: "https://example.com/segment" }] },
        })
      ).toEqual({ url: "https://example.com/segment", format: "m4a" });
    });
  });

  describe("describePlayurlResponse", () => {
    it("reports missing data", () => {
      expect(describePlayurlResponse({})).toContain(
        "response.data is null/undefined"
      );
    });

    it("reports missing dash", () => {
      expect(describePlayurlResponse({ data: {} } as any)).toContain(
        "dash: missing"
      );
    });

    it("reports empty audio array", () => {
      const desc = describePlayurlResponse({
        data: { dash: { audio: [] } },
      } as any);
      expect(desc).toContain("dash.audio.length: 0");
    });

    it("reports entry field keys", () => {
      const desc = describePlayurlResponse({
        data: {
          dash: {
            audio: [{ mimeType: "audio/mp4", codecs: "mp4a" }],
          },
        },
      } as any);
      expect(desc).toContain("first entry keys:");
      expect(desc).toContain("audio/mp4");
    });
  });

  describe("buildBilibiliDurlPlayUrlPath", () => {
    it("builds durl path with fnval=0", () => {
      expect(buildBilibiliDurlPlayUrlPath("BV1xx411c7mD", 62131)).toBe(
        "/x/player/playurl?fnval=0&bvid=BV1xx411c7mD&cid=62131"
      );
    });
  });

  describe("series / collection", () => {
    it("builds series detail path", () => {
      expect(buildBilibiliSeriesDetailPath(12345)).toBe(
        "/x/series/series?series_id=12345"
      );
    });

    it("builds series archives path", () => {
      expect(buildBilibiliSeriesArchivesPath(12345, 2, 30)).toBe(
        "/x/series/archives?series_id=12345&pn=2&ps=30"
      );
    });

    it("converts series meta to MusicTrack (as album)", () => {
      const track = convertSeriesToMusicTrack({
        series_id: 42,
        name: "周杰伦歌曲合集",
        creator: { name: "音乐UP", mid: 999 },
        cover: "https://i0.hdslb.com/cover.jpg",
        total: 15,
      });

      expect(track).toMatchObject({
        id: "bilibili_S_42",
        name: "周杰伦歌曲合集",
        artist: ["音乐UP"],
        pic_id: "https://i0.hdslb.com/cover.jpg",
        url_id: "bilibili_series_42",
        source: "bilibili",
        artist_ids: ["999"],
      });
    });

    it("converts series archive to MusicTrack without albumId", () => {
      const track = convertSeriesArchiveToMusicTrack({
        bvid: "BV1xx411c7mD",
        title: "晴天 - 周杰伦",
        cover: "https://i0.hdslb.com/archive-cover.jpg",
        owner: { name: "音乐UP", mid: 999 },
      });

      expect(track).toMatchObject({
        id: "bilibili_BV1xx411c7mD",
        name: "晴天 - 周杰伦",
        artist: ["音乐UP"],
        pic_id: "https://i0.hdslb.com/archive-cover.jpg",
        url_id: "bilibili_BV1xx411c7mD",
        source: "bilibili",
        artist_ids: ["999"],
      });
      expect(track.album_id).toBeUndefined();
    });

    it("converts series archive to MusicTrack with albumId", () => {
      const track = convertSeriesArchiveToMusicTrack(
        {
          bvid: "BV1xx411c7mD",
          title: "晴天 - 周杰伦",
          cover: "https://i0.hdslb.com/archive-cover.jpg",
          owner: { name: "音乐UP", mid: 999 },
        },
        "bilibili_S_42"
      );

      expect(track.album_id).toBe("bilibili_S_42");
    });

    it("parses bilibili album id (old format and new format)", () => {
      expect(parseBilibiliAlbumId("bilibili_S_42")).toEqual({
        seriesId: "42",
      });
      expect(parseBilibiliAlbumId("bilibili_S_42_999")).toEqual({
        seriesId: "42",
        mid: "999",
      });
      expect(parseBilibiliAlbumId("bilibili_BV1xx")).toBeNull();
      expect(parseBilibiliAlbumId("netease_1")).toBeNull();
    });

    it("handles missing creator fields in series meta", () => {
      const track = convertSeriesToMusicTrack({
        series_id: 1,
        name: "Untitled",
      });
      expect(track.artist).toEqual([""]);
      expect(track.artist_ids).toBeUndefined();
    });

    it("parses series detail response", () => {
      const meta = parseBilibiliSeriesDetail({
        code: 0,
        data: {
          meta: {
            series_id: 42,
            name: "音乐合集",
            total: 10,
          },
        },
      });
      expect(meta).not.toBeNull();
      expect(meta!.series_id).toBe(42);
      expect(meta!.name).toBe("音乐合集");
    });

    it("returns null for non-zero series detail response", () => {
      const meta = parseBilibiliSeriesDetail({
        code: -404,
        message: "not found",
      });
      expect(meta).toBeNull();
    });

    it("parses series archives response", () => {
      const result = parseBilibiliSeriesArchives({
        code: 0,
        data: {
          archives: [{ bvid: "BV1", title: "Test" }],
          page: { total: 25 },
        },
      });
      expect(result.archives).toHaveLength(1);
      expect(result.archives[0].bvid).toBe("BV1");
      expect(result.total).toBe(25);
    });

    it("returns empty archives for error response", () => {
      const result = parseBilibiliSeriesArchives({ code: -1 });
      expect(result.archives).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe("seasons_archives (合集)", () => {
    it("builds seasons_archives_list path", () => {
      expect(
        buildBilibiliSeasonsArchivesListPath(37029661, 3050068, 1, 30)
      ).toBe(
        "/x/polymer/web-space/seasons_archives_list?mid=37029661&season_id=3050068&page_num=1&page_size=30"
      );
    });

    it("parses seasons_archives_list response", () => {
      const result = parseBilibiliSeasonsArchivesList({
        code: 0,
        message: "OK",
        data: {
          aids: [1],
          archives: [
            {
              aid: 1,
              bvid: "BV1xx411c7mD",
              ctime: 1234567890,
              duration: 120,
              pic: "https://i0.hdslb.com/cover.jpg",
              pubdate: 1234567890,
              stat: { view: 100, vt: 0 },
              title: "测试视频",
            },
          ],
          meta: {
            category: 1,
            cover: "https://i0.hdslb.com/meta-cover.jpg",
            description: "合集描述",
            mid: 37029661,
            name: "合集·测试",
            season_id: 3050068,
            total: 35,
          },
          page: {
            page_num: 1,
            page_size: 30,
            total: 35,
          },
        },
      });

      expect(result.meta).toMatchObject({
        series_id: 3050068,
        name: "合集·测试",
        cover: "https://i0.hdslb.com/meta-cover.jpg",
        description: "合集描述",
        total: 35,
      });
      expect(result.archives).toHaveLength(1);
      expect(result.total).toBe(35);
    });

    it("returns empty result for error code", () => {
      const result = parseBilibiliSeasonsArchivesList({ code: -400 } as any);
      expect(result.meta).toBeNull();
      expect(result.archives).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("converts season archive to MusicTrack without albumId", () => {
      const track = convertSeasonArchiveToMusicTrack({
        aid: 116640121363085,
        bvid: "BV1TYVA6sEhm",
        ctime: 1779787425,
        duration: 1604,
        pic: "https://i0.hdslb.com/archive-cover.jpg",
        pubdate: 1779789600,
        stat: { view: 500, vt: 0 },
        title: "不办婚礼去旅行结婚",
      });

      expect(track).toMatchObject({
        id: "bilibili_BV1TYVA6sEhm",
        name: "不办婚礼去旅行结婚",
        artist: ["UP主"],
        pic_id: "https://i0.hdslb.com/archive-cover.jpg",
        source: "bilibili",
      });
      expect(track.album_id).toBe("bilibili_V_BV1TYVA6sEhm");
    });

    it("converts season archive to MusicTrack with albumId", () => {
      const track = convertSeasonArchiveToMusicTrack(
        {
          aid: 116640121363085,
          bvid: "BV1TYVA6sEhm",
          ctime: 1779787425,
          duration: 1604,
          pic: "https://i0.hdslb.com/archive-cover.jpg",
          pubdate: 1779789600,
          stat: { view: 500, vt: 0 },
          title: "不办婚礼去旅行结婚",
        },
        undefined,
        "bilibili_S_42_999"
      );

      expect(track.album_id).toBe("bilibili_S_42_999");
    });
  });
});
