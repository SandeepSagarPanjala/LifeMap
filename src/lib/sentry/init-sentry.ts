import * as Sentry from '@sentry/react-native';

const SENTRY_DSN =
  'https://4693b0d14384114a9dac501bb37e468d@o4511658529062912.ingest.us.sentry.io/4511658536075264';

function getSentryEnvironment(): string {
  if (__DEV__) {
    return 'development';
  }

  return 'production';
}

export function initSentry(): void {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: getSentryEnvironment(),
    sendDefaultPii: false,
    enableAutoPerformanceTracing: false,
    tracesSampleRate: 0,
    profilesSampleRate: 0,
    enableAppHangTracking: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
  });
}
