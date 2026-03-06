import { beforeEach, describe, expect, it, vi } from "vitest";
import { musicApi } from "./music-api";
import { getOrderedMusicApiUrls, setMusicApiUrls } from "./api/config";

describe("musicApi fallback", () => {
  beforeEach(() => {
    localStorage.clear();
    setMusicApiUrls(["https://primary.test/api.php", "https://backup.test/api.php"]);
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("falls back to backup endpoint when primary fails", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network failed"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: "1",
              name: "song",
              artist: "artist",
              album: "album",
              pic_id: "https://img.test/a.jpg",
              url_id: "https://audio.test/a.mp3",
              lyric_id: "https://lyric.test/a.lrc"
            }
          ]),
          { status: 200 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await musicApi.search("song", "joox", 1, 1);

    expect(result.items).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("https://primary.test/api.php");
    expect(String(fetchMock.mock.calls[1][0])).toContain("https://backup.test/api.php");
    expect(getOrderedMusicApiUrls()[0]).toBe("https://backup.test/api.php");
  });
});
