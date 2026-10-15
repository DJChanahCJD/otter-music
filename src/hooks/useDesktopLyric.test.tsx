import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { useDesktopLyric } from "./useDesktopLyric";
import { useMusicStore } from "@/store/music-store";
import { musicApi } from "@/lib/music-api";
import type { MusicTrack } from "@/types/music";

vi.mock("@/lib/storage-adapter", () => ({
  idbStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock("@/lib/music-api", () => ({
  musicApi: {
    getLyric: vi.fn(),
  },
}));

/**
 * 用 getter 暴露，方便单个用例模拟"旧 APK 没有该原生方法"，
 * 也就是 `DesktopLyric.setLyric` 为 undefined 的情况。
 */
const pluginMocks = vi.hoisted(() => ({
  setLyric: undefined as undefined | ReturnType<typeof vi.fn>,
  setSize: undefined as undefined | ReturnType<typeof vi.fn>,
  setColor: undefined as undefined | ReturnType<typeof vi.fn>,
  consumeOpenSettings: undefined as undefined | ReturnType<typeof vi.fn>,
  show: undefined as undefined | ReturnType<typeof vi.fn>,
  hide: undefined as undefined | ReturnType<typeof vi.fn>,
}));

vi.mock("@/plugins/desktop-lyric", () => ({
  get DesktopLyric() {
    return {
      get setLyric() {
        return pluginMocks.setLyric;
      },
      get setSize() {
        return pluginMocks.setSize;
      },
      get setColor() {
        return pluginMocks.setColor;
      },
      get consumeOpenSettings() {
        return pluginMocks.consumeOpenSettings;
      },
      get show() {
        return pluginMocks.show;
      },
      get hide() {
        return pluginMocks.hide;
      },
    };
  },
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
  },
}));

const configMocks = vi.hoisted(() => ({ isNative: true }));

vi.mock("@/lib/api/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/config")>()),
  get IS_NATIVE() {
    return configMocks.isNative;
  },
}));

const TRACK: MusicTrack = {
  id: "netease_1",
  name: "测试歌曲",
  artist: ["歌手"],
  album: "专辑",
  pic_id: "pic-1",
  url_id: "url-1",
  lyric_id: "lyric-1",
  source: "netease",
};

const TRACK_WITHOUT_LYRIC: MusicTrack = {
  ...TRACK,
  id: "netease_2",
  lyric_id: "",
};

const LRC = "[00:01.00]第一行\n[00:05.00]第二行";

/** 记录最近一次渲染所在的路由位置，供导航断言使用 */
const lastLocationRef: { current: ReturnType<typeof useLocation> | null } = {
  current: null,
};

describe("useDesktopLyric", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;

    configMocks.isNative = true;
    pluginMocks.setLyric = vi.fn().mockResolvedValue(undefined);
    pluginMocks.setSize = vi.fn().mockResolvedValue(undefined);
    pluginMocks.setColor = vi.fn().mockResolvedValue(undefined);
    pluginMocks.consumeOpenSettings = vi
      .fn()
      .mockResolvedValue({ pending: false });
    pluginMocks.show = vi.fn().mockResolvedValue(undefined);
    pluginMocks.hide = vi.fn().mockResolvedValue(undefined);
    vi.mocked(musicApi.getLyric).mockResolvedValue({ lyric: LRC, tlyric: "" });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    lastLocationRef.current = null;

    useMusicStore.setState({
      queue: [TRACK],
      currentIndex: 0,
      desktopLyricEnabled: true,
      currentAudioTime: 2,
      lyricOffset: 0,
    });
  });

  const render = () => {
    function TestHarness() {
      useDesktopLyric();
      const location = useLocation();

      useEffect(() => {
        lastLocationRef.current = location;
      }, [location]);

      return null;
    }

    act(() => {
      root!.render(
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="*" element={<TestHarness />} />
          </Routes>
        </MemoryRouter>
      );
    });
  };

  /** 等 mock 的 getLyric promise 落地，并让 effect 重跑 */
  const flush = async () => {
    await act(async () => {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

  const cleanup = () => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    container?.remove();
    root = undefined;
    container = undefined;
  };

  it("开启时显示悬浮窗并按进度推送歌词行", async () => {
    render();
    await flush();

    expect(pluginMocks.show).toHaveBeenCalled();
    expect(pluginMocks.setLyric).toHaveBeenLastCalledWith({ text: "第一行" });

    await act(async () => {
      useMusicStore.setState({ currentAudioTime: 6 });
    });

    expect(pluginMocks.setLyric).toHaveBeenLastCalledWith({ text: "第二行" });

    cleanup();
  });

  it("前奏期间回退歌名兜底文案", async () => {
    useMusicStore.setState({ currentAudioTime: 0.5 });

    render();
    await flush();

    expect(pluginMocks.setLyric).toHaveBeenLastCalledWith({
      text: "测试歌曲 - 歌手",
    });

    cleanup();
  });

  it("切到无歌词歌曲时显示兜底文案", async () => {
    render();
    await flush();

    await act(async () => {
      useMusicStore.setState({ queue: [TRACK_WITHOUT_LYRIC] });
    });

    expect(pluginMocks.setLyric).toHaveBeenLastCalledWith({
      text: "测试歌曲 - 歌手",
    });

    cleanup();
  });

  it("同一行不重复过桥", async () => {
    render();
    await flush();

    const before = pluginMocks.setLyric?.mock.calls.length ?? 0;

    // 时间推进但仍落在同一行内
    await act(async () => {
      useMusicStore.setState({ currentAudioTime: 3 });
    });

    expect(pluginMocks.setLyric?.mock.calls.length).toBe(before);

    cleanup();
  });

  it("关闭开关时隐藏悬浮窗", async () => {
    render();
    await flush();

    await act(async () => {
      useMusicStore.setState({ desktopLyricEnabled: false });
    });

    expect(pluginMocks.hide).toHaveBeenCalled();

    cleanup();
  });

  it("字号变化时调用 setSize 同步悬浮窗", async () => {
    render();
    await flush();

    await act(async () => {
      useMusicStore.setState({ desktopLyricFontSize: 22 });
    });

    expect(pluginMocks.setSize).toHaveBeenCalledWith({ size: 22 });

    cleanup();
  });

  it("字色变化时调用 setColor 同步悬浮窗", async () => {
    render();
    await flush();

    await act(async () => {
      useMusicStore.setState({ desktopLyricColor: "#6FB7FF" });
    });

    expect(pluginMocks.setColor).toHaveBeenCalledWith({ color: "#6FB7FF" });

    cleanup();
  });

  it("双击请求 pending 时跳转设置页并携带展开标记", async () => {
    pluginMocks.consumeOpenSettings = vi
      .fn()
      .mockResolvedValue({ pending: true });

    render();
    await flush();

    expect(pluginMocks.consumeOpenSettings).toHaveBeenCalled();
    expect(lastLocationRef.current?.pathname).toBe("/settings");
    expect(
      (
        lastLocationRef.current?.state as {
          expandDesktopLyric?: boolean;
        } | null
      )?.expandDesktopLyric
    ).toBe(true);

    cleanup();
  });

  it("无双击请求时不导航", async () => {
    render();
    await flush();

    expect(pluginMocks.consumeOpenSettings).toHaveBeenCalled();
    expect(lastLocationRef.current?.pathname).toBe("/");

    cleanup();
  });

  it("Web 端（非原生）不触碰原生方法", async () => {
    configMocks.isNative = false;

    render();
    await flush();

    expect(pluginMocks.setLyric).not.toHaveBeenCalled();
    expect(pluginMocks.show).not.toHaveBeenCalled();

    cleanup();
  });

  it("旧 APK 缺少该原生方法时不抛错", async () => {
    pluginMocks.setLyric = undefined;
    pluginMocks.setSize = undefined;
    pluginMocks.setColor = undefined;
    pluginMocks.consumeOpenSettings = undefined;
    pluginMocks.show = undefined;
    pluginMocks.hide = undefined;

    expect(() => render()).not.toThrow();
    await flush();

    // 歌词链路本身照常跑，只是不往原生写
    expect(musicApi.getLyric).toHaveBeenCalledWith("lyric-1", "netease");

    cleanup();
  });
});
