import * as Sentry from '@sentry/react-native';

import {env, isSentryEnabled} from '@/config/env';

export function initMonitoring(): void {
  if (!isSentryEnabled()) {
    if (__DEV__) {
      console.info('[LifeMap] Sentry disabled — set SENTRY_DSN in src/config/env.local.ts');
    }
    return;
  }

  Sentry.init({
    dsn: env.sentryDsn,
    debug: __DEV__,
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    enableAutoSessionTracking: true,
    attachStacktrace: true,
  });
}

export {Sentry};
