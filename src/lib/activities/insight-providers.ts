import { TZDate } from '@date-fns/tz';
import { differenceInCalendarDays, startOfDay } from 'date-fns';

import { APP_TIMEZONE } from '@/lib/timezone';

function zoned(date: Date): TZDate {
  return new TZDate(date, APP_TIMEZONE);
}

/** Human-readable relative label for last-logged timestamps. */
export function formatRelativeLoggedAt(
  loggedAt: Date | null,
  now: Date,
): string {
  if (loggedAt == null) {
    return 'Never';
  }
  const today = startOfDay(zoned(now));
  const day = startOfDay(zoned(loggedAt));
  const days = differenceInCalendarDays(today, day);
  if (days <= 0) {
    return 'Today';
  }
  if (days === 1) {
    return 'Yesterday';
  }
  if (days < 7) {
    return `${days} days ago`;
  }
  if (days < 14) {
    return 'Last week';
  }
  return loggedAt.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year:
      zoned(loggedAt).getFullYear() === zoned(now).getFullYear()
        ? undefined
        : 'numeric',
  });
}
