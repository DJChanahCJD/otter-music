import { beforeEach, describe, expect, it, vi } from "vitest";
import toast from "react-hot-toast";
import { ApiError } from "@/lib/api/config";
import { useMusicStore } from "@/store";
import { useSyncStore } from "@/store/sync-store";
import { syncPull, syncPushAndPull } from "@/lib/api/sync";
import { checkAndSync } from "./sync";
import type { MusicTrack } from "@/types/music";

/* ---------------- mocks ---------------- */

vi.mock("@/lib/crypto-storage", () => ({
  encryptString: vi.fn(async (str) => `mock_${str}`),
  decryptString: vi.fn(async (str) => str.replace("mock_", "")),
}));

vi.mock("@/lib/storage-adapter", () => ({
  idbStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/lib/api/sync");

/* ---------------- helpers ---------------- */

// 固定时间，避免 flaky
const NOW = 4_000_000;

const createTrack = (id: string, is_deleted = false): MusicTrack => ({
  id,
  name: `Song ${id}`,
  artist: ["Artist"],
  album: "Album",
  pic_id: id,
  url_id: id,
  lyric_id: id,
  source: "netease",
  is_deleted,
});

const setupBaseState = () => {
  useSyncStore.setState({
    syncKey: "sync-key",
    lastSyncTime: 12345,
  });

  useMusicStore.setState({
    favorites: [],
    playlists: [],
  });
};

/* ---------------- tests ---------------- */

describe("checkAndSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // 固定时间
    vi.spyOn(Date, "now").mockReturnValue(NOW);

    setupBaseState();
  });

  it("skips when within throttle window", async () => {
    useSyncStore.setState({
      lastSyncTime: NOW - 1000,
    });

    await expect(checkAndSync()).resolves.toEqual({
      success: true,
      skipped: true,
    });

    expect(syncPushAndPull).not.toHaveBeenCalled();
  });

  it("clears sync config on 404", async () => {
    vi.mocked(syncPushAndPull).mockRejectedValue(
      new ApiError("missing", 404)
    );

    await expect(checkAndSync()).resolves.toEqual({
      success: false,
      error: "密钥失效",
    });

    expect(useSyncStore.getState()).toMatchObject({
      syncKey: null,
      lastSyncTime: 0,
    });

    expect(toast.error).toHaveBeenCalledWith(
      "同步密钥不存在或已失效"
    );
  });

  it("applies snapshot on success", async () => {
    const data = {
      favorites: [{ id: "t1" }],
      playlists: [],
    };

    vi.mocked(syncPushAndPull).mockResolvedValue({
      data,
      lastSyncTime: 99999,
    });

    await expect(checkAndSync()).resolves.toEqual({
      success: true,
    });

    expect(useMusicStore.getState().favorites).toEqual(data.favorites);
    expect(toast.success).toHaveBeenCalled();
  });

  it("keeps deleted markers in pushed snapshot", async () => {
    useMusicStore.setState({
      favorites: [createTrack("fav-1", true)],
      playlists: [
        {
          id: "playlist-1",
          name: "Test",
          createdAt: 1,
          is_deleted: false,
          tracks: [
            createTrack("track-1", true),
            createTrack("track-2"),
          ],
        },
      ],
    });

    const data = { favorites: [createTrack("fav-1", true)], playlists: [] };
    vi.mocked(syncPushAndPull).mockResolvedValue({ data, lastSyncTime: 99999 });

    await expect(checkAndSync(true)).resolves.toEqual({ success: true });

    expect(syncPushAndPull).toHaveBeenCalledWith(
      "sync-key",
      expect.objectContaining({
        favorites: [expect.objectContaining({ id: "fav-1", is_deleted: true })],
        playlists: [
          expect.objectContaining({
            id: "playlist-1",
            tracks: expect.arrayContaining([
              expect.objectContaining({ id: "track-1", is_deleted: true }),
              expect.objectContaining({ id: "track-2", is_deleted: false }),
            ]),
          }),
        ],
      }),
    );
  });

  it("applies snapshot with deleted markers intact", async () => {
    const data = {
      favorites: [createTrack("t1", true)],
      playlists: [
        {
          id: "playlist-1",
          name: "Test",
          createdAt: 1,
          is_deleted: false,
          tracks: [createTrack("track-1", true)],
        },
      ],
    };

    vi.mocked(syncPushAndPull).mockResolvedValue({
      data,
      lastSyncTime: 99999,
    });

    await expect(checkAndSync()).resolves.toEqual({
      success: true,
    });

    expect(useMusicStore.getState().favorites).toEqual(data.favorites);
    expect(useMusicStore.getState().playlists).toEqual(data.playlists);
  });

  it("fallbacks to syncPull on non-404 error", async () => {
    const data = {
      favorites: [{ id: "t2" }],
      playlists: [],
    };

    vi.mocked(syncPushAndPull).mockRejectedValue(
      new ApiError("server error", 500)
    );

    vi.mocked(syncPull).mockResolvedValue({
      data,
      lastSyncTime: 77777,
    });

    await expect(checkAndSync()).resolves.toEqual({
      success: true,
    });

    expect(useMusicStore.getState().favorites).toEqual(data.favorites);
  });
});
