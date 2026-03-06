import { beforeEach, describe, expect, it } from "vitest";
import {
  getOrderedMusicApiUrls,
  markMusicApiUrlFailure,
  markMusicApiUrlSuccess,
  setMusicApiUrls
} from "./config";

describe("music api route policy", () => {
  beforeEach(() => {
    localStorage.clear();
    setMusicApiUrls(["https://primary.test/api.php", "https://backup.test/api.php"]);
  });

  it("keeps primary first when all endpoints are healthy", () => {
    expect(getOrderedMusicApiUrls()).toEqual([
      "https://primary.test/api.php",
      "https://backup.test/api.php"
    ]);
  });

  it("moves failed endpoint behind healthy ones", () => {
    markMusicApiUrlFailure("https://primary.test/api.php", 1000);
    expect(getOrderedMusicApiUrls(1000)).toEqual([
      "https://backup.test/api.php",
      "https://primary.test/api.php"
    ]);
  });

  it("restores endpoint priority after success", () => {
    markMusicApiUrlFailure("https://primary.test/api.php", 1000);
    markMusicApiUrlSuccess("https://primary.test/api.php", 1001);
    expect(getOrderedMusicApiUrls(1001)).toEqual([
      "https://primary.test/api.php",
      "https://backup.test/api.php"
    ]);
  });
});
