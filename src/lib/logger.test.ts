import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureWindowErrors, logger } from "./logger";

describe("logger", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("keeps only the latest 100 logs", () => {
    for (let index = 0; index < 105; index += 1) {
      logger.error("test", `entry-${index}`);
    }

    const logs = logger.getLogs();
    expect(logs).toHaveLength(100);
    expect(logs[0]?.message).toBe("entry-5");
    expect(logs.at(-1)?.message).toBe("entry-104");
  });

  it("exports readable text with stack and context", () => {
    const error = new Error("boom");
    logger.error("test", "something failed", error, { step: "load" });

    const exported = logger.exportText();
    expect(exported).toContain("ERROR test: something failed");
    expect(exported).toContain("Error: boom");
    expect(exported).toContain('"step": "load"');
  });

  it("clears logs", () => {
    logger.warn("test", "warning");
    logger.clear();

    expect(logger.getLogs()).toEqual([]);
    expect(logger.exportText()).toBe("");
  });

  it("captures window error and unhandled rejection", () => {
    const cleanup = captureWindowErrors();

    window.dispatchEvent(new ErrorEvent("error", {
      message: "runtime failed",
      error: new Error("runtime failed"),
      filename: "app.ts",
      lineno: 12,
      colno: 8,
    }));

    window.dispatchEvent(new PromiseRejectionEvent("unhandledrejection", {
      promise: Promise.reject(new Error("async failed")).catch(() => undefined),
      reason: new Error("async failed"),
    }));

    cleanup();

    const exported = logger.exportText();
    expect(exported).toContain("window.error");
    expect(exported).toContain("runtime failed");
    expect(exported).toContain("window.unhandledrejection");
    expect(exported).toContain("async failed");
  });
});
