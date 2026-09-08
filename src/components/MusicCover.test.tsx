import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MusicCover } from "./MusicCover";
import { useExitLayerStore } from "@/hooks/useExitLayer";
import { Capacitor } from "@capacitor/core";
import { Filesystem } from "@capacitor/filesystem";
import { blobToBase64 } from "@/lib/utils/base64";
import toast from "react-hot-toast";
import { ensurePermission } from "@/lib/utils/download";

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
  },
}));

vi.mock("@/lib/api/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/config")>()),
  get IS_NATIVE() {
    return Capacitor.isNativePlatform();
  },
}));

vi.mock("@capacitor/filesystem", () => ({
  Filesystem: { writeFile: vi.fn() },
  Directory: { ExternalStorage: "EXTERNAL_STORAGE" },
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/utils/download", () => ({
  ensurePermission: vi.fn(),
  triggerBlobDownload: vi.fn(),
}));

vi.mock("@/lib/utils/base64", () => ({
  blobToBase64: vi.fn(),
}));

const SAMPLE_SRC = "https://example.com/cover.jpg";

describe("MusicCover preview exit stack integration", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  beforeEach(() => {
    useExitLayerStore.setState({ stack: [] });
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    container?.remove();
    root = undefined;
    container = undefined;
    document.body
      .querySelectorAll('[data-testid="cover-preview-portal"]')
      .forEach((el) => el.remove());
  });

  type CoverRenderProps = {
    previewable?: boolean;
    src?: string | null;
    previewOpen?: boolean;
    onPreviewOpenChange?: (open: boolean) => void;
  };

  const render = (props: CoverRenderProps) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const renderProps = (p: CoverRenderProps) => ({
      src: p.src ?? SAMPLE_SRC,
      alt: "cover",
      previewable: p.previewable ?? true,
      previewOpen: p.previewOpen,
      onPreviewOpenChange: p.onPreviewOpenChange,
    });
    act(() => {
      root!.render(<MusicCover {...renderProps(props)} />);
    });
    return {
      rerender: (nextProps: CoverRenderProps) => {
        act(() => {
          root!.render(<MusicCover {...renderProps(nextProps)} />);
        });
      },
    };
  };

  const clickCover = () => {
    const img = container?.querySelector("img");
    if (!img) throw new Error("cover img not found");
    act(() => {
      img.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  };

  it("does not push to the stack when preview is closed", () => {
    render({});
    expect(useExitLayerStore.getState().stack).toHaveLength(0);
  });

  it("pushes to the stack when preview opens and pops when preview closes", () => {
    render({});

    clickCover();

    expect(useExitLayerStore.getState().stack).toHaveLength(1);
    expect(
      document.body.querySelector('[data-testid="cover-preview-portal"]')
    ).toBeTruthy();

    act(() => {
      useExitLayerStore.getState().handleExit();
    });

    expect(useExitLayerStore.getState().stack).toHaveLength(0);
    expect(
      document.body.querySelector('[data-testid="cover-preview-portal"]')
    ).toBeFalsy();
  });

  it("handleExit closes the preview and is idempotent on re-trigger", () => {
    render({});
    clickCover();

    act(() => {
      useExitLayerStore.getState().handleExit();
    });
    act(() => {
      useExitLayerStore.getState().handleExit();
    });

    expect(useExitLayerStore.getState().stack).toHaveLength(0);
  });

  it("clicking the overlay also closes the preview and pops the stack", () => {
    render({});
    clickCover();

    const overlay = document.body.querySelector(
      '[data-testid="cover-preview-portal"]'
    ) as HTMLElement | null;
    expect(overlay).toBeTruthy();

    act(() => {
      overlay!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(useExitLayerStore.getState().stack).toHaveLength(0);
  });

  it("reopening the preview re-pushes a fresh frame", () => {
    render({});

    clickCover();
    act(() => {
      useExitLayerStore.getState().handleExit();
    });
    expect(useExitLayerStore.getState().stack).toHaveLength(0);

    clickCover();
    expect(useExitLayerStore.getState().stack).toHaveLength(1);
  });

  it("unmounting the component pops its frame and does not leak", () => {
    render({});
    clickCover();
    expect(useExitLayerStore.getState().stack).toHaveLength(1);

    act(() => {
      root?.unmount();
      root = undefined;
    });

    expect(useExitLayerStore.getState().stack).toHaveLength(0);
  });

  it("resets error state when src changes so a new cover can load", () => {
    const { rerender } = render({ src: "invalid-url" });

    const firstImg = container?.querySelector("img");
    expect(firstImg).toBeTruthy();

    act(() => {
      firstImg!.dispatchEvent(new Event("error", { bubbles: true }));
    });

    // 加载失败后显示默认 Icon
    expect(container?.querySelector("img")).toBeFalsy();
    expect(container?.querySelector("svg")).toBeTruthy();

    rerender({ src: SAMPLE_SRC });

    // src 变化后应重新尝试加载图片
    const secondImg = container?.querySelector("img");
    expect(secondImg).toBeTruthy();
    expect(secondImg?.getAttribute("src")).toBe(SAMPLE_SRC);
  });

  it("does not open preview on click when not previewable", () => {
    render({ previewable: false });

    clickCover();

    expect(useExitLayerStore.getState().stack).toHaveLength(0);
    expect(
      document.body.querySelector('[data-testid="cover-preview-portal"]')
    ).toBeFalsy();
  });

  it("opens preview via controlled previewOpen without previewable", () => {
    const onChange = vi.fn();
    const { rerender } = render({
      previewable: false,
      previewOpen: false,
      onPreviewOpenChange: onChange,
    });

    rerender({
      previewable: false,
      previewOpen: true,
      onPreviewOpenChange: onChange,
    });

    expect(useExitLayerStore.getState().stack).toHaveLength(1);
    expect(
      document.body.querySelector('[data-testid="cover-preview-portal"]')
    ).toBeTruthy();

    // 关闭时通知父组件，父组件同步状态后预览消失
    act(() => {
      useExitLayerStore.getState().handleExit();
    });
    expect(onChange).toHaveBeenCalledWith(false);

    rerender({
      previewable: false,
      previewOpen: false,
      onPreviewOpenChange: onChange,
    });
    expect(useExitLayerStore.getState().stack).toHaveLength(0);
    expect(
      document.body.querySelector('[data-testid="cover-preview-portal"]')
    ).toBeFalsy();
  });
});

describe("MusicCover native save", () => {
  let container: HTMLDivElement | undefined;
  let root: Root | undefined;

  beforeEach(() => {
    useExitLayerStore.setState({ stack: [] });
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(ensurePermission).mockResolvedValue();
    vi.mocked(Filesystem.writeFile).mockResolvedValue({
      uri: "pictures://",
    } as any);
    vi.mocked(blobToBase64).mockResolvedValue("base64mock");
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(["fake-image"])),
    }) as any;
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    container?.remove();
    root = undefined;
    container = undefined;
    document.body
      .querySelectorAll('[data-testid="cover-preview-portal"]')
      .forEach((el) => el.remove());
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
  });

  const renderAndSave = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(
        <MusicCover src={SAMPLE_SRC} alt="cover" previewable={true} />
      );
    });

    const img = container?.querySelector("img");
    if (!img) throw new Error("cover img not found");
    act(() => {
      img.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const saveBtn = document.body.querySelector(
      '[data-testid="cover-preview-portal"] button'
    ) as HTMLButtonElement | null;
    if (!saveBtn) throw new Error("save button not found");
    await act(async () => {
      saveBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  };

  it("saves cover via native fetch + writeFile on Android", async () => {
    await renderAndSave();

    expect(ensurePermission).toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledWith(SAMPLE_SRC);
    expect(blobToBase64).toHaveBeenCalled();
    expect(Filesystem.writeFile).toHaveBeenCalledWith(
      expect.objectContaining({
        path: expect.stringContaining("Pictures/OtterMusic"),
        data: "base64mock",
        directory: "EXTERNAL_STORAGE",
        recursive: true,
      })
    );
  });

  it("shows error toast when fetch fails on native", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
    }) as any;

    await renderAndSave();

    expect(toast.error).toHaveBeenCalledWith("保存失败，请重试");
  });
});
