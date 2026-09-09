import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { App } from "@capacitor/app";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import { StatusBar } from "@capacitor/status-bar";
import { useLandscapeMode } from "./useLandscapeMode";
import { useExitLayerStore } from "./useExitLayer";

const { resumeListeners } = vi.hoisted(() => ({
  resumeListeners: [] as (() => void)[],
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: vi.fn((_event: string, callback: () => void) => {
      resumeListeners.push(callback);
      return Promise.resolve({ remove: vi.fn() });
    }),
  },
}));

vi.mock("@capacitor/screen-orientation", () => ({
  ScreenOrientation: { lock: vi.fn(), unlock: vi.fn() },
}));

vi.mock("@capacitor/status-bar", () => ({
  StatusBar: { hide: vi.fn(), show: vi.fn() },
}));

/** 已挂载的根实例，供 afterEach 统一卸载 */
const mountedRoots: Root[] = [];

/** 挂载探测组件，返回读取最新 hook 返回值与重渲染的方法 */
function renderMode(active: boolean) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mountedRoots.push(root);

  let api: ReturnType<typeof useLandscapeMode> | undefined;

  function Probe({ active }: { active: boolean }) {
    const mode = useLandscapeMode(active);

    useEffect(() => {
      api = mode;
    }, [mode]);

    return null;
  }

  act(() => {
    root.render(<Probe active={active} />);
  });

  return {
    api: () => api!,
    rerender: (next: boolean) =>
      act(() => {
        root.render(<Probe active={next} />);
      }),
  };
}

describe("useLandscapeMode", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    useExitLayerStore.setState({ stack: [] });
  });

  afterEach(() => {
    act(() => {
      mountedRoots.forEach((root) => root.unmount());
      mountedRoots.length = 0;
      useExitLayerStore.setState({ stack: [] });
    });
    resumeListeners.length = 0;
    vi.clearAllMocks();
  });

  it("进入时锁定横屏、隐藏状态栏并入栈退出层", async () => {
    const { api } = renderMode(true);

    await act(async () => {
      api().enter();
    });

    expect(ScreenOrientation.lock).toHaveBeenCalledWith({
      orientation: "landscape",
    });
    expect(StatusBar.hide).toHaveBeenCalled();
    expect(api().isLandscapeMode).toBe(true);
    expect(useExitLayerStore.getState().stack).toHaveLength(1);
  });

  it("回到前台时重新隐藏状态栏，避免下拉通知栏后状态栏常驻", async () => {
    const { api } = renderMode(true);

    act(() => api().enter());
    expect(resumeListeners).toHaveLength(1);

    await act(async () => {
      resumeListeners[0]();
    });

    expect(StatusBar.hide).toHaveBeenCalledTimes(2);
  });

  it("退出后不再监听 resume，避免错误隐藏状态栏", async () => {
    const { api } = renderMode(true);

    act(() => api().enter());
    await act(async () => {
      api().exit();
    });
    resumeListeners.length = 0;
    await act(async () => {});

    expect(App.addListener).toHaveBeenCalledTimes(1);
    expect(resumeListeners).toHaveLength(0);
  });

  it("退出时解锁方向、恢复状态栏并出栈", async () => {
    const { api } = renderMode(true);

    act(() => api().enter());
    await act(async () => {
      api().exit();
    });

    expect(ScreenOrientation.unlock).toHaveBeenCalled();
    expect(StatusBar.show).toHaveBeenCalled();
    expect(api().isLandscapeMode).toBe(false);
    expect(useExitLayerStore.getState().stack).toHaveLength(0);
  });

  it("返回键优先退出横屏模式", async () => {
    const { api } = renderMode(true);

    act(() => api().enter());
    await act(async () => {
      useExitLayerStore.getState().handleExit();
    });

    expect(api().isLandscapeMode).toBe(false);
    expect(ScreenOrientation.unlock).toHaveBeenCalled();
    expect(StatusBar.show).toHaveBeenCalled();
  });

  it("关闭播放器时自动退出并解锁，避免横屏被遗留", async () => {
    const { api, rerender } = renderMode(true);

    act(() => api().enter());
    await act(async () => {
      rerender(false);
    });

    expect(api().isLandscapeMode).toBe(false);
    expect(ScreenOrientation.unlock).toHaveBeenCalled();
    expect(StatusBar.show).toHaveBeenCalled();
  });
});
