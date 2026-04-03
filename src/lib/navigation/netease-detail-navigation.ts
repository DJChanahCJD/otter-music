export interface ArtistAlbumSheetNavigationState {
  from?: "artist-album-sheet";
  artistId?: string;
  artistName?: string;
  restoreAlbumSheet?: boolean;
}

export function createArtistAlbumSheetState(
  artistId: string,
  artistName?: string,
): ArtistAlbumSheetNavigationState {
  return {
    from: "artist-album-sheet",
    artistId,
    artistName,
    restoreAlbumSheet: true,
  };
}

export function shouldRestoreArtistAlbumSheet(
  type: "playlist" | "artist" | "album",
  currentId: string | null,
  state: ArtistAlbumSheetNavigationState | null | undefined,
): boolean {
  return (
    type === "artist" &&
    !!currentId &&
    state?.from === "artist-album-sheet" &&
    state.restoreAlbumSheet === true &&
    state.artistId === currentId
  );
}

export function getArtistAlbumSheetBackTarget(
  type: "playlist" | "artist" | "album",
  state: ArtistAlbumSheetNavigationState | null | undefined,
): { artistId: string; artistName?: string } | null {
  if (
    type !== "album" ||
    state?.from !== "artist-album-sheet" ||
    !state.artistId
  ) {
    return null;
  }

  return {
    artistId: state.artistId,
    artistName: state.artistName,
  };
}
