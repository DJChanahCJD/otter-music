const LOG_STORAGE_KEY = "otter-debug-logs";
const MAX_LOG_ENTRIES = 100;

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

function isBrowser() {
  return typeof window !== "undefined";
}

function readLogs(): LogEntry[] {
  if (!isBrowser()) return [];

  try {
    const raw = window.localStorage.getItem(LOG_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLogs(entries: LogEntry[]) {
  if (!isBrowser()) return;

  try {
    window.localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(entries.slice(-MAX_LOG_ENTRIES)));
  } catch {
    // Ignore storage errors. Logging must never break the app.
  }
}

function normalizeMessage(value: unknown) {
  if (value instanceof Error) return value.message || value.name;
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeStack(value: unknown) {
  return value instanceof Error ? value.stack : undefined;
}

function normalizeContext(value: unknown) {
  if (value === undefined) return undefined;
  if (value instanceof Error) return undefined;
  return value;
}

function createEntry(
  level: LogLevel,
  source: string,
  message: string,
  errorOrContext?: unknown,
  context?: unknown,
): LogEntry {
  const error = errorOrContext instanceof Error ? errorOrContext : undefined;
  const resolvedContext = error ? context : errorOrContext;

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    time: new Date().toISOString(),
    level,
    source,
    message: message || normalizeMessage(errorOrContext),
    stack: normalizeStack(error),
    context: normalizeContext(resolvedContext),
  };
}

function persist(entry: LogEntry) {
  const next = [...readLogs(), entry].slice(-MAX_LOG_ENTRIES);
  writeLogs(next);
}

function mirrorConsole(level: LogLevel, entry: LogEntry) {
  if (!import.meta.env.DEV) return;

  const prefix = `[${entry.source}] ${entry.message}`;
  if (level === "info") console.info(prefix, entry.context);
  if (level === "warn") console.warn(prefix, entry.context);
  if (level === "error") console.error(prefix, entry.context ?? entry.stack);
}

function log(level: LogLevel, source: string, message: string, errorOrContext?: unknown, context?: unknown) {
  const entry = createEntry(level, source, message, errorOrContext, context);
  persist(entry);
  mirrorConsole(level, entry);
  return entry;
}

function formatContext(context: unknown) {
  if (context === undefined) return undefined;

  try {
    return JSON.stringify(context, null, 2);
  } catch {
    return String(context);
  }
}

export const logger = {
  info: (source: string, message: string, context?: unknown) => log("info", source, message, context),
  warn: (source: string, message: string, context?: unknown) => log("warn", source, message, context),
  error: (source: string, message: string, errorOrContext?: unknown, context?: unknown) =>
    log("error", source, message, errorOrContext, context),
  getLogs: () => readLogs(),
  clear: () => writeLogs([]),
  exportText: () =>
    readLogs()
      .map((entry) => {
        const lines = [
          `[${entry.time}] ${entry.level.toUpperCase()} ${entry.source}: ${entry.message}`,
        ];

        if (entry.stack) lines.push(entry.stack);

        const formattedContext = formatContext(entry.context);
        if (formattedContext) lines.push(`context: ${formattedContext}`);

        return lines.join("\n");
      })
      .join("\n\n"),
};

export function captureWindowErrors() {
  if (!isBrowser()) return () => undefined;

  const onError = (event: ErrorEvent) => {
    logger.error(
      "window.error",
      event.message || "Unhandled runtime error",
      event.error,
      {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    );
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    logger.error(
      "window.unhandledrejection",
      reason instanceof Error ? reason.message : normalizeMessage(reason),
      reason instanceof Error ? reason : { reason },
    );
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
  };
}
