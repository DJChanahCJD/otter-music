import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary, isDynamicImportError } from "./ErrorBoundary";

function ThrowError({ error }: { error: Error }): ReactNode {
  throw error;
}

describe("isDynamicImportError", () => {
  it("detects Vite dynamic import loading failures", () => {
    expect(
      isDynamicImportError(new Error("Failed to fetch dynamically imported module: /assets/Page-a1b2.js")),
    ).toBe(true);
    expect(
      isDynamicImportError(new Error("Importing a module script failed.")),
    ).toBe(true);
    expect(isDynamicImportError(new Error("ChunkLoadError: Loading chunk 42 failed"))).toBe(true);
  });

  it("ignores unrelated render errors", () => {
    expect(isDynamicImportError(new Error("Cannot read properties of undefined"))).toBe(false);
  });
});

describe("ErrorBoundary", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
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
    vi.restoreAllMocks();
  });

  it("shows the generic fallback for normal render errors", () => {
    act(() => {
      root!.render(
        <ErrorBoundary>
          <ThrowError error={new Error("普通渲染错误")} />
        </ErrorBoundary>,
      );
    });

    expect(container?.textContent).toContain("应用异常");
    expect(container?.textContent).toContain("普通渲染错误");
  });

  it("shows an update recovery message for dynamic import failures", () => {
    const reload = vi.fn();
    const originalLocation = window.location;

    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, reload },
    });

    act(() => {
      root!.render(
        <ErrorBoundary>
          <ThrowError error={new Error("Failed to fetch dynamically imported module: /assets/Search-a1b2.js")} />
        </ErrorBoundary>,
      );
    });

    expect(container?.textContent).toContain("应用已更新");
    expect(container?.textContent).toContain("当前版本资源已刷新，请重新加载应用");

    act(() => {
      container?.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(reload).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });
});
