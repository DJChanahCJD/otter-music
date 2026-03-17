let sentryConfig: {
  endpoint: string;
  release: string;
  environment: string;
} | null = null;

let initialized = false;

type ExtraData = Record<string, unknown>;

const genId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '')
    : Date.now().toString(16) + Math.random().toString(16).slice(2, 10);

const nowSeconds = () => Date.now() / 1000;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toErrorLike = (
  error: unknown,
): { name: string; message: string; stack?: string; extra?: ExtraData } => {
  if (error instanceof Error) {
    return {
      name: error.name || 'Error',
      message: error.message || 'Unknown error',
      stack: error.stack,
    };
  }

  if (typeof error === 'string') {
    return {
      name: 'Error',
      message: error,
    };
  }

  if (isObject(error)) {
    const name =
      typeof error.name === 'string' && error.name ? error.name : 'Error';
    const message =
      typeof error.message === 'string' && error.message
        ? error.message
        : JSON.stringify(error);
    const stack = typeof error.stack === 'string' ? error.stack : undefined;

    return {
      name,
      message,
      stack,
      extra: error,
    };
  }

  return {
    name: 'Error',
    message: String(error),
  };
};

const shouldIgnoreError = (message: string) => {
  const text = message.toLowerCase();

  return [
    'the message port closed before a response was received',
    'resizeobserver loop limit exceeded',
    'resizeobserver loop completed with undelivered notifications',
    'non-error promise rejection captured',
  ].some((keyword) => text.includes(keyword));
};

const buildEndpointFromDsn = (dsn: string) => {
  const url = new URL(dsn);
  const pathSegments = url.pathname.split('/').filter(Boolean);
  const projectId = pathSegments.pop();

  if (!projectId || !url.username) return null;

  const prefix = pathSegments.length ? `/${pathSegments.join('/')}` : '';

  return `${url.protocol}//${url.host}${prefix}/api/${projectId}/envelope/?sentry_key=${url.username}&sentry_version=7&sentry_client=otter-lite`;
};

const postEnvelope = async (endpoint: string, envelope: string) => {
  const blob = new Blob([envelope], {
    type: 'text/plain;charset=UTF-8',
  });

  if (navigator.sendBeacon) {
    const ok = navigator.sendBeacon(endpoint, blob);
    if (ok) {
      return;
    }
  }

  try {
    await fetch(endpoint, {
      method: 'POST',
      body: envelope,
      keepalive: true,
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
      },
    });
  } catch {
    // ignore
  }
};

const sendEvent = async (payload: Record<string, unknown>) => {
  if (!sentryConfig) return;

  const eventId = genId();
  const envelope = [
    JSON.stringify({
      event_id: eventId,
      sent_at: new Date().toISOString(),
    }),
    JSON.stringify({
      type: 'event',
    }),
    JSON.stringify({
      event_id: eventId,
      ...payload,
    }),
  ].join('\n');

  await postEnvelope(sentryConfig.endpoint, envelope);
};

export const captureException = (error: unknown, extra: ExtraData = {}) => {
  if (!sentryConfig) return;

  const parsed = toErrorLike(error);

  if (shouldIgnoreError(parsed.message)) {
    return;
  }

  void sendEvent({
    timestamp: nowSeconds(),
    level: 'error',
    platform: 'javascript',
    environment: sentryConfig.environment,
    release: sentryConfig.release,
    tags: {
      app_version: __APP_VERSION__,
      runtime: 'web',
    },
    exception: {
      values: [
        {
          type: parsed.name,
          value: parsed.message,
        },
      ],
    },
    extra: {
      ...parsed.extra,
      ...extra,
      stack: parsed.stack,
      url: location.href,
      userAgent:
        typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    },
  });
};

export const captureMessage = (
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  extra: ExtraData = {},
) => {
  if (!sentryConfig) return;
  if (!message) return;

  void sendEvent({
    timestamp: nowSeconds(),
    level,
    platform: 'javascript',
    environment: sentryConfig.environment,
    release: sentryConfig.release,
    tags: {
      app_version: __APP_VERSION__,
      runtime: 'web',
    },
    message,
    extra: {
      ...extra,
      url: location.href,
      userAgent:
        typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    },
  });
};

export const testSentry = () => {
  captureException(new Error('Manual Sentry test'), {
    source: 'manual.test',
  });
};

export const initSentry = () => {
  if (initialized) return;

  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  try {
    const endpoint = buildEndpointFromDsn(dsn);
    if (!endpoint) return;

    sentryConfig = {
      endpoint,
      release: `otter-music@${__APP_VERSION__}`,
      environment:
        import.meta.env.VITE_SENTRY_ENVIRONMENT ??
        (import.meta.env.PROD ? 'production' : 'development'),
    };

    initialized = true;

    // testSentry();
    // console.log('[sentry] initialized, dsn:', dsn);
    
    window.addEventListener('error', (e) => {
      captureException(e.error ?? e.message, {
        source: 'window.error',
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
      });
    });

    window.addEventListener('unhandledrejection', (e) => {
      captureException(e.reason, {
        source: 'window.unhandledrejection',
      });
    });
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[sentry] init failed:', err);
    }
  }
};