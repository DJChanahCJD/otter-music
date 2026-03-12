import type {
  RawNeteaseResponse,
  RawQrCheckResponse,
  RawQrKeyData,
  RecommendPlaylist,
  Toplist,
  UserPlaylist,
  UserProfile,
} from "./netease-raw-types";
import type { MarketPlaylist, QrStatusResult } from "./netease-models";

export function unwrapRawResponse<T>(res: RawNeteaseResponse<T>): T | undefined {
  return res.data ?? res.result;
}

export function unwrapQrKey(res: RawNeteaseResponse<RawQrKeyData>): string {
  const payload = unwrapRawResponse(res);
  const key = payload?.unikey;
  if (!key) throw new Error("Qr key not found");
  return key;
}

export function normalizeQrStatus(res: RawQrCheckResponse): QrStatusResult {
  if ("data" in res && res.data?.code !== undefined) {
    return { code: res.data.code, message: res.data.message, cookie: res.cookie };
  }
  if ("code" in res) {
    return { code: res.code, message: res.message, cookie: res.cookie };
  }
  throw new Error("Invalid qr check response");
}

export function unwrapMyInfoProfile(res: unknown): UserProfile | null {
  if (!res || typeof res !== "object") return null;
  const r = res as { profile?: UserProfile; data?: { profile?: UserProfile } };
  return r.profile ?? r.data?.profile ?? null;
}

export function unwrapRecommendResult(res: unknown): RecommendPlaylist[] {
  if (!res || typeof res !== "object") return [];
  const r = res as { result?: RecommendPlaylist[]; data?: { result?: RecommendPlaylist[] } };
  const list = r.result ?? r.data?.result;
  return Array.isArray(list) ? list : [];
}

export function toMarketPlaylistFromRecommend(p: RecommendPlaylist): MarketPlaylist {
  const coverUrl = p.picUrl ?? p.coverImgUrl ?? p.coverUrl ?? "";
  return {
    id: String(p.id),
    name: p.name,
    coverUrl: coverUrl,
    playCount: p.playCount ?? 0,
  };
}

export function toMarketPlaylistFromUserPlaylist(p: UserPlaylist): MarketPlaylist {
  const coverUrl = p.coverImgUrl ?? p.coverUrl ?? p.picUrl ?? "";
  return {
    id: String(p.id),
    name: p.name,
    coverUrl: coverUrl,
    playCount: p.playCount ?? 0,
    userId: String(p.creator?.userId ?? ""),
  };
}

export function toMarketPlaylistFromToplist(p: Toplist): MarketPlaylist {
  const coverUrl = p.coverImgUrl ?? p.coverUrl ?? p.picUrl ?? "";
  return {
    id: String(p.id),
    name: p.name,
    coverUrl: coverUrl,
    playCount: p.playCount ?? 0,
  };
}
