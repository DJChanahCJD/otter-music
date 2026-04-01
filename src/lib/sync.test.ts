import { beforeEach, describe, expect, it, vi } from "vitest";
import toast from "react-hot-toast";
import { ApiError } from "@/lib/api/config";

vi.mock("@/lib/storage-adapter", () => ({
  idbStorage: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

import { useMusicStore } from "@/store";
import { useSyncStore } from "@/store/sync-store";
import { syncPull, syncPushAndPull } from "@/lib/api/sync";
import { checkAndSync } from "./sync";

vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/lib/api/sync", () => ({
  syncPull: vi.fn(),
  syncPushAndPull: vi.fn(),
}));

describe("checkAndSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSyncStore.setState({ syncKey: "sync-key", lastSyncTime: 12345 });
    useMusicStore.setState({ favorites: [], playlists: [] });
  });

  it("returns skipped when within throttle window", async () => {
    useSyncStore.setState({ syncKey: "sync-key", lastSyncTime: Date.now() - 1000 });

    const result = await checkAndSync();

    expect(result).toEqual({ success: true, skipped: true });
    expect(syncPushAndPull).not.toHaveBeenCalled();
  });

  it("clears local sync config when POST returns 404", async () => {
    vi.mocked(syncPushAndPull).mockRejectedValue(new ApiError("missing", 404));

    const result = await checkAndSync();

    expect(result).toEqual({ success: false, error: "密钥失效" });
    expect(useSyncStore.getState()).toMatchObject({ syncKey: null, lastSyncTime: 0 });
    expect(toast.error).toHaveBeenCalledWith("同步密钥不存在或已失效");
    expect(syncPull).not.toHaveBeenCalled();
  });

  it("returns skipped on Level 1 short-circuit (data === null)", async () => {
    const serverTime = 99999;
    vi.mocked(syncPushAndPull).mockResolvedValue({ data: null, lastSyncTime: serverTime });

    const result = await checkAndSync();

    expect(result).toEqual({ success: true, skipped: true });
    expect(useSyncStore.getState().lastSyncTime).toBe(serverTime);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("applies snapshot and shows toast on successful sync", async () => {
    const merged = { favorites: [{ id: "t1" }], playlists: [] };
    const serverTime = 99999;
    vi.mocked(syncPushAndPull).mockResolvedValue({ data: merged, lastSyncTime: serverTime });

    const result = await checkAndSync();

    expect(result).toEqual({ success: true });
    expect(useMusicStore.getState().favorites).toEqual(merged.favorites);
    expect(useSyncStore.getState().lastSyncTime).toBe(serverTime);
    expect(toast.success).toHaveBeenCalled();
  });

  it("falls back to syncPull on non-404 POST failure", async () => {
    const pullData = { favorites: [{ id: "t2" }], playlists: [] };
    vi.mocked(syncPushAndPull).mockRejectedValue(new ApiError("server error", 500));
    vi.mocked(syncPull).mockResolvedValue({ data: pullData, lastSyncTime: 77777 });

    const result = await checkAndSync();

    expect(result).toEqual({ success: true });
    expect(useMusicStore.getState().favorites).toEqual(pullData.favorites);
  });
});
