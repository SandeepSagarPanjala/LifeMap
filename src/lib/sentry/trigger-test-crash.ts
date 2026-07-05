import * as Sentry from '@sentry/react-native';

import { isSentryNativeLinked } from '@/lib/sentry/is-native-linked';

export function isSentryTestCrashNative(): boolean {
  return isSentryNativeLinked();
}

/** Temporary helper for verifying Sentry crash reporting. */
export function triggerSentryTestCrash(): void {
  if (isSentryNativeLinked()) {
    Sentry.nativeCrash();
    return;
  }

  // Native module missing (usually pod install + rebuild not done yet).
  // Unhandled JS errors still reach Sentry via the JS SDK.
  setTimeout(() => {
    throw new Error('LifeMap Sentry test crash (JS fallback)');
  }, 0);
}
