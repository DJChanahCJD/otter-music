export interface ArtistAlbumSheetNavigationState {
  from?: "artist-album-sheet";
  artistId?: string;
  artistName?: string;
  restoreAlbumSheet?: boolean;
  /** 专辑页加载失败时用于回退到 QQ 音乐的检索词 */
  albumFallback?: { name?: string; artist?: string };
}

const SHEET_RESTORE_KEY = "netease-album-sheet-restore";

/** 将 sheet 恢复信息写入 sessionStorage，用于 navigate(-1) 回退时恢复 */
export function setAlbumSheetRestoreSession(
  artistId: string,
  artistName?: string
) {
  sessionStorage.setItem(
    SHEET_RESTORE_KEY,
    JSON.stringify({ artistId, artistName })
  );
}

/** 读取并清除 sessionStorage 中的 sheet 恢复信息 */
export function consumeAlbumSheetRestoreSession(): {
  artistId: string;
  artistName?: string;
} | null {
  const raw = sessionStorage.getItem(SHEET_RESTORE_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(SHEET_RESTORE_KEY);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function createArtistAlbumSheetState(
  artistId: string,
  artistName?: string
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
  state: ArtistAlbumSheetNavigationState | null | undefined
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
  state: ArtistAlbumSheetNavigationState | null | undefined
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
