import { describe, expect, it } from "vitest";
import {
  createArtistAlbumSheetState,
  getArtistAlbumSheetBackTarget,
  shouldRestoreArtistAlbumSheet,
} from "@/lib/navigation/netease-detail-navigation";

describe("netease detail navigation helpers", () => {
  it("creates artist album sheet navigation state", () => {
    expect(createArtistAlbumSheetState("123", "Artist")).toEqual({
      from: "artist-album-sheet",
      artistId: "123",
      artistName: "Artist",
      restoreAlbumSheet: true,
    });
  });

  it("restores artist album sheet only for matching artist route", () => {
    const state = createArtistAlbumSheetState("123", "Artist");

    expect(shouldRestoreArtistAlbumSheet("artist", "123", state)).toBe(true);
    expect(shouldRestoreArtistAlbumSheet("artist", "456", state)).toBe(false);
    expect(shouldRestoreArtistAlbumSheet("album", "123", state)).toBe(false);
    expect(shouldRestoreArtistAlbumSheet("artist", null, state)).toBe(false);
  });

  it("returns explicit back target only for album pages opened from artist sheet", () => {
    const state = createArtistAlbumSheetState("123", "Artist");

    expect(getArtistAlbumSheetBackTarget("album", state)).toEqual({
      artistId: "123",
      artistName: "Artist",
    });
    expect(getArtistAlbumSheetBackTarget("artist", state)).toBeNull();
    expect(getArtistAlbumSheetBackTarget("album", null)).toBeNull();
  });
});
