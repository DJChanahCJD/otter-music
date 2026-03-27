import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage-adapter", () => ({
  idbStorage: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

import { useSyncStore } from "./sync-store";

describe("sync store", () => {
  it("clears sync key and last sync time together", () => {
    useSyncStore.setState({ syncKey: "test-key", lastSyncTime: 12345 });

    useSyncStore.getState().clearSyncConfig();

    expect(useSyncStore.getState()).toMatchObject({
      syncKey: null,
      lastSyncTime: 0,
    });
  });
});
