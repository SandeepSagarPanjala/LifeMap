import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

import {
  getTodayDateKey,
  parseDateKey,
  shiftDateKey,
} from '@/lib/day-utils';
import { APP_TIMEZONE } from '@/lib/timezone';

/** Gallery day stripe / day-journey modal title. */
export function formatGalleryDayLabel(dateKey: string): string {
  const today = getTodayDateKey();
  if (dateKey === today) {
    return 'Today';
  }
  if (dateKey === shiftDateKey(today, -1)) {
    return 'Yesterday';
  }
  const day = parseDateKey(dateKey);
  return format(new TZDate(day, APP_TIMEZONE), 'EEE, MMM d, yyyy');
}
