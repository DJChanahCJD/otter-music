import * as Sentry from '@sentry/capacitor';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * Initialize Sentry for web and native (Capacitor) runtime.
 */
export const initSentry = async (): Promise<void> => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    console.warn('Sentry DSN is not configured, Sentry is disabled.');
    return;
  }

  const appVersion = __APP_VERSION__;
  const release = `otter-music@${appVersion}`;
  const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT ?? (import.meta.env.PROD ? 'production' : 'development');

  try {
    Sentry.init({
      dsn,
      integrations: [Sentry.browserTracingIntegration()],
      release,
      environment,
      debug: false,
      attachStacktrace: true,
      tracesSampleRate: 0,
    });

    Sentry.setTag('platform', Capacitor.getPlatform());
    Sentry.setTag('app_version', appVersion);

    if (Capacitor.isNativePlatform()) {
      const appInfo = await App.getInfo();
      Sentry.setTag('native_version', appInfo.version);
      Sentry.setTag('native_build', appInfo.build);
    }
  } catch (error) {
    console.error('Sentry initialization failed:', error);
  }
};
