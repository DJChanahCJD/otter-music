import { describe, expect, it, vi, beforeEach } from "vitest";
import { useOfflineStore, OfflineTrackRecord } from "./offline-store";

vi.mock("@/lib/storage-adapter", () => ({
  idbStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

const createRecord = (
  trackId: string,
  overrides: Partial<OfflineTrackRecord> = {}
): OfflineTrackRecord => ({
  trackId,
  source: "stream-cache",
  url: `https://example.com/${trackId}.mp3`,
  cacheKey: `https://example.com/${trackId}.mp3`,
  cachedAt: Date.now(),
  verifiedAt: Date.now(),
  name: "Song",
  artist: ["Artist"],
  album: "Album",
  trackSource: "kuwo",
  url_id: `url-${trackId}`,
  pic_id: `pic-${trackId}`,
  lyric_id: `lyric-${trackId}`,
  ...overrides,
});

describe("useOfflineStore", () => {
  beforeEach(() => {
    useOfflineStore.setState({ records: {} });
  });

  it("adds a record", () => {
    const record = createRecord("track-1");
    useOfflineStore.getState().addRecord(record);

    expect(useOfflineStore.getState().records["track-1"]).toEqual(record);
  });

  it("updates an existing record", () => {
    useOfflineStore.getState().addRecord(createRecord("track-1"));
    useOfflineStore
      .getState()
      .addRecord(createRecord("track-1", { name: "Updated" }));

    expect(useOfflineStore.getState().records["track-1"].name).toBe("Updated");
  });

  it("removes a record", () => {
    useOfflineStore.getState().addRecord(createRecord("track-1"));
    useOfflineStore.getState().removeRecord("track-1");

    expect(useOfflineStore.getState().records["track-1"]).toBeUndefined();
  });

  it("getRecord returns the record or undefined", () => {
    const record = createRecord("track-1");
    useOfflineStore.getState().addRecord(record);

    expect(useOfflineStore.getState().getRecord("track-1")).toEqual(record);
    expect(useOfflineStore.getState().getRecord("missing")).toBeUndefined();
  });

  it("isRecordValid returns true for records with cacheKey", () => {
    useOfflineStore.getState().addRecord(createRecord("track-1"));

    expect(useOfflineStore.getState().isRecordValid("track-1")).toBe(true);
  });

  it("isRecordValid returns true for legacy records without cacheKey but with url", () => {
    useOfflineStore
      .getState()
      .addRecord(createRecord("track-1", { cacheKey: undefined }));

    expect(useOfflineStore.getState().isRecordValid("track-1")).toBe(true);
  });

  it("isRecordValid returns false for missing records", () => {
    expect(useOfflineStore.getState().isRecordValid("missing")).toBe(false);
  });

  it("isRecordValid returns false for records missing both cacheKey and url", () => {
    useOfflineStore
      .getState()
      .addRecord(createRecord("track-1", { cacheKey: undefined, url: "" }));

    expect(useOfflineStore.getState().isRecordValid("track-1")).toBe(false);
  });

  it("clears all records", () => {
    useOfflineStore.getState().addRecord(createRecord("track-1"));
    useOfflineStore.getState().addRecord(createRecord("track-2"));
    useOfflineStore.getState().clear();

    expect(useOfflineStore.getState().records).toEqual({});
  });
});
