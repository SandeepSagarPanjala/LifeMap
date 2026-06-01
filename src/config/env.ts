let local: {SENTRY_DSN?: string} = {};

try {
  local = require('./env.local').envLocal;
} catch {
  // env.local.ts not present — expected in CI and for new clones
}

export const env = {
  /** Set in src/config/env.local.ts — leave empty to disable Sentry */
  sentryDsn: local.SENTRY_DSN ?? '',
} as const;

export function isSentryEnabled(): boolean {
  return env.sentryDsn.length > 0;
}
