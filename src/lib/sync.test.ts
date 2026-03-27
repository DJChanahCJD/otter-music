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
import { syncCheck, syncPull, syncPush } from "@/lib/api/sync";
import { checkAndSync } from "./sync";

vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/lib/api/sync", () => ({
  syncCheck: vi.fn(),
  syncPull: vi.fn(),
  syncPush: vi.fn(),
}));

describe("checkAndSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSyncStore.setState({ syncKey: "sync-key", lastSyncTime: 12345 });
    useMusicStore.setState({ favorites: [], playlists: [] });
  });

  it("clears local sync config when syncCheck returns 404", async () => {
    vi.mocked(syncCheck).mockRejectedValue(new ApiError("missing", 404));

    const result = await checkAndSync();

    expect(result).toEqual({
      success: false,
      error: "同步密钥不存在或已失效",
    });
    expect(useSyncStore.getState()).toMatchObject({
      syncKey: null,
      lastSyncTime: 0,
    });
    expect(syncPush).not.toHaveBeenCalled();
    expect(syncPull).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("同步密钥不存在或已失效");
  });

  it("keeps sync config for non-404 failures", async () => {
    vi.mocked(syncCheck).mockRejectedValue(new ApiError("server error", 500));

    const result = await checkAndSync();

    expect(result).toEqual({ success: false, error: "server error" });
    expect(useSyncStore.getState()).toMatchObject({
      syncKey: "sync-key",
      lastSyncTime: 12345,
    });
    expect(syncPush).not.toHaveBeenCalled();
    expect(syncPull).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("server error");
  });
});
