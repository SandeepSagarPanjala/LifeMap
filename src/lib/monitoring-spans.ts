import {isSentryEnabled} from '@/config/env';
import {Sentry} from '@/lib/monitoring';

type MonitoringSpanOptions = {
  name: string;
  op: string;
  attributes?: Record<string, string | number | boolean>;
};

export async function withMonitoringSpan<T>(
  options: MonitoringSpanOptions,
  fn: () => Promise<T>,
): Promise<T> {
  if (!isSentryEnabled()) {
    return fn();
  }

  return Sentry.startSpan(options, async span => {
    for (const [key, value] of Object.entries(options.attributes ?? {})) {
      span.setAttribute(key, value);
    }
    return fn();
  });
}
