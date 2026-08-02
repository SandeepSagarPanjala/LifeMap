import { TZDate } from '@date-fns/tz';

import { formatRelativeLoggedAt } from '@/lib/activities/insight-providers';
import { APP_TIMEZONE } from '@/lib/timezone';

function atLocal(
  y: number,
  m: number,
  d: number,
  hour: number,
  minute: number,
): Date {
  return new TZDate(y, m - 1, d, hour, minute, 0, 0, APP_TIMEZONE);
}

describe('formatRelativeLoggedAt', () => {
  it('formats relative last-logged labels', () => {
    const now = atLocal(2026, 7, 30, 12, 0);
    expect(formatRelativeLoggedAt(atLocal(2026, 7, 30, 9, 0), now)).toBe(
      'Today',
    );
    expect(formatRelativeLoggedAt(atLocal(2026, 7, 29, 9, 0), now)).toBe(
      'Yesterday',
    );
    expect(formatRelativeLoggedAt(atLocal(2026, 7, 27, 9, 0), now)).toBe(
      '3 days ago',
    );
    expect(formatRelativeLoggedAt(null, now)).toBe('Never');
  });
});
