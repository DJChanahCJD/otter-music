import { describe, expect, it } from "vitest";
import {
  DEFAULT_FALLBACK_SEARCH_SOURCE,
  resolveFallbackSearchSource,
} from "./search-source";

describe("resolveFallbackSearchSource", () => {
  it("支持站内搜索的音源保持自身音源", () => {
    expect(resolveFallbackSearchSource("netease")).toBe("netease");
    expect(resolveFallbackSearchSource("_netease")).toBe("_netease");
    expect(resolveFallbackSearchSource("qq")).toBe("qq");
    expect(resolveFallbackSearchSource("migu")).toBe("migu");
  });

  it("不支持站内搜索的音源回退到默认音源", () => {
    expect(resolveFallbackSearchSource("local")).toBe(
      DEFAULT_FALLBACK_SEARCH_SOURCE
    );
    expect(resolveFallbackSearchSource("podcast")).toBe(
      DEFAULT_FALLBACK_SEARCH_SOURCE
    );
    expect(resolveFallbackSearchSource("alist")).toBe(
      DEFAULT_FALLBACK_SEARCH_SOURCE
    );
    expect(resolveFallbackSearchSource("kugou")).toBe(
      DEFAULT_FALLBACK_SEARCH_SOURCE
    );
  });

  it("聚合搜索与缺省来源回退到默认音源", () => {
    expect(resolveFallbackSearchSource("all")).toBe(
      DEFAULT_FALLBACK_SEARCH_SOURCE
    );
    expect(resolveFallbackSearchSource()).toBe(DEFAULT_FALLBACK_SEARCH_SOURCE);
  });

  it("未注册音源不抛错并回退到默认音源", () => {
    expect(resolveFallbackSearchSource("tencent")).toBe(
      DEFAULT_FALLBACK_SEARCH_SOURCE
    );
  });
});
