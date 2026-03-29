import { formatDate } from "date-fns";
import { Capacitor } from "@capacitor/core";

const LOG_STORAGE_KEY = "otter-debug-logs";
const MAX_LOG_ENTRIES = 100;
const APP_START_TIME = formatDate(new Date(), "yyyy-MM-dd HH:mm:ss");
const IS_BROWSER = typeof window !== "undefined";

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  id: string;
  time: string;
  level: LogLevel;
  source: string;
  message: string;
  stack?: string;
  context?: unknown;
}

// 1. 内存缓存：避免每次写入都触发高昂的 localStorage 读取开销
let logsCache: LogEntry[] = [];
if (IS_BROWSER) {
  try {
    const raw = window.localStorage.getItem(LOG_STORAGE_KEY);
    logsCache = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(logsCache)) logsCache = [];
  } catch {
    logsCache = [];
  }
}

const persistLogs = () => {
  if (!IS_BROWSER) return;
  try {
    window.localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logsCache));
  } catch {} // 忽略配额超限等错误
};

// 2. 优化调用栈解析逻辑
const getSource = () => {
  try { throw new Error(); } catch (e: any) {
    const match = e.stack?.split("\n")[4]?.match(/\((.*):\d+:\d+\)/);
    return match?.[1]?.split("/").pop() || "unknown";
  }
};

const createAndSaveLog = (level: LogLevel, args: any[]): LogEntry => {
  let source = "unknown", message = "", error: Error | undefined, context: any;

  // 灵活的参数重载解析
  if (args.length >= 2 && typeof args[0] === "string" && typeof args[1] === "string") {
    [source, message, error, context] = args;
  } else {
    source = getSource();
    [message, error, context] = args;
  }

  if (error && !(error instanceof Error)) {
    context = error;
    error = undefined;
  }

  const entry: LogEntry = {
    id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    time: formatDate(new Date(), "yyyy-MM-dd HH:mm:ss"),
    level,
    source,
    message: message || error?.message || String(message),
    stack: error?.stack,
    context: context ?? undefined,
  };

  // 维护内存队列并同步
  logsCache.push(entry);
  if (logsCache.length > MAX_LOG_ENTRIES) logsCache.shift();
  persistLogs();

  if (import.meta.env?.DEV) {
    console[level](`[${source}] ${entry.message}`, context ?? entry.stack ?? "");
  }
  return entry;
};

export const logger = {
  info: (...args: any[]) => createAndSaveLog("info", args),
  warn: (...args: any[]) => createAndSaveLog("warn", args),
  error: (...args: any[]) => createAndSaveLog("error", args),
  getLogs: () => [...logsCache],
  getRecentLogs: () => logsCache.filter(e => e.time >= APP_START_TIME),
  getLastNLogs: (n: number) => logsCache.slice(-n),
  clear: () => { logsCache = []; persistLogs(); },
  exportText: (filter?: { recent?: boolean; lastN?: number }) => {
    let res = logsCache;
    if (filter?.recent) res = res.filter(e => e.time >= APP_START_TIME);
    if (filter?.lastN) res = res.slice(-filter.lastN);
    
    return res.map(e => {
      const ctx = e.context ? `\ncontext: ${JSON.stringify(e.context, null, 2)}` : "";
      const stack = e.stack ? `\n${e.stack}` : "";
      return `[${e.time}] ${e.level.toUpperCase()} ${e.source}: ${e.message}${stack}${ctx}`;
    }).join("\n\n");
  },
};

export function captureWindowErrors() {
  if (!IS_BROWSER) return () => {};

  const onError = (e: ErrorEvent) => logger.error("window.error", e.message || "Unhandled error", e.error, { file: e.filename, line: e.lineno });
  const onReject = (e: PromiseRejectionEvent) => logger.error("window.unhandledrejection", e.reason instanceof Error ? e.reason.message : String(e.reason), e.reason);

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onReject);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onReject);
  };
}

function interceptNetworkRequests() {
  if (!IS_BROWSER) return () => {};

  const { fetch: origFetch, XMLHttpRequest: OrigXHR } = window;

  window.fetch = async (...args) => {
    const start = Date.now();
    try {
      const res = await origFetch(...args);
      if (!res.ok) logger.warn("Network", `Fetch failed: ${res.url}`, { status: res.status, duration: Date.now() - start });
      return res;
    } catch (err) {
      logger.error("Network", "Fetch error", err);
      throw err;
    }
  };

  window.XMLHttpRequest = function () {
    const xhr = new OrigXHR();
    let reqMethod = "", reqUrl = "";
    const start = Date.now();
    
    xhr.addEventListener("load", () => {
      if (xhr.status >= 400) logger.warn("Network", `XHR failed: ${reqMethod} ${reqUrl}`, { status: xhr.status, duration: Date.now() - start });
    });
    xhr.addEventListener("error", () => logger.error("Network", `XHR error: ${reqMethod} ${reqUrl}`));

    const origOpen = xhr.open;
    xhr.open = function (method: string, url: string | URL, ...rest: any[]) {
      reqMethod = method; // 修复了原版中 method = method 作用域覆盖导致的 Bug
      reqUrl = url.toString();
      return origOpen.apply(this, [method, url, ...rest] as any);
    };
    return xhr;
  } as any;

  return () => {
    window.fetch = origFetch;
    window.XMLHttpRequest = OrigXHR;
  };
}

export function initializeLogger() {
  captureWindowErrors();
  interceptNetworkRequests();
  const platform = IS_BROWSER ? (Capacitor?.isNativePlatform?.() ? "native" : "web") : "server";
  const env = import.meta.env?.DEV ? "development" : "production";
  logger.info("system", `App started at ${APP_START_TIME}`, { version: __APP_VERSION__, platform, env });
}