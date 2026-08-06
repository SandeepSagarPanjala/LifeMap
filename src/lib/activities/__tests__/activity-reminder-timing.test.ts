import { TZDate } from '@date-fns/tz';

import {
  classifyReminderTiming,
  filterMomentsByReminderTiming,
  isReminderScheduledDay,
  reminderFireOnDay,
  summarizeReminderTiming,
} from '@/lib/activities/activity-reminder-timing';
import type { MomentRow } from '@/db/repositories/moments';
import { APP_TIMEZONE } from '@/lib/timezone';
import { makeMoment } from '../../../../__tests__/helpers/fixtures';

function atLocal(
  y: number,
  m: number,
  d: number,
  hour: number,
  minute: number,
): Date {
  return new TZDate(y, m - 1, d, hour, minute, 0, 0, APP_TIMEZONE);
}

function activityMoment(
  partial: Partial<MomentRow> & Pick<MomentRow, 'id' | 'timestamp'>,
): MomentRow {
  return makeMoment({
    type: 'activity',
    activityId: 1,
    activityEmoji: '☕',
    activityLabel: 'Coffee',
    ...partial,
  });
}

const dailyNineAm = {
  enabled: true,
  repeat: 'daily' as const,
  timeMinutes: 9 * 60,
  weekday: 1,
  dayOfMonth: 1,
  anchorAt: null,
};

describe('activity reminder timing', () => {
  it('classifies on time within ±30 minutes', () => {
    const scheduled = atLocal(2026, 8, 5, 9, 0);
    expect(classifyReminderTiming(atLocal(2026, 8, 5, 9, 0), scheduled)).toBe(
      'on_time',
    );
    expect(classifyReminderTiming(atLocal(2026, 8, 5, 8, 30), scheduled)).toBe(
      'on_time',
    );
    expect(classifyReminderTiming(atLocal(2026, 8, 5, 9, 30), scheduled)).toBe(
      'on_time',
    );
  });

  it('classifies early and late outside the 30-minute window', () => {
    const scheduled = atLocal(2026, 8, 5, 9, 0);
    expect(classifyReminderTiming(atLocal(2026, 8, 5, 8, 29), scheduled)).toBe(
      'early',
    );
    expect(classifyReminderTiming(atLocal(2026, 8, 5, 9, 31), scheduled)).toBe(
      'late',
    );
  });

  it('builds fire time on the log day', () => {
    const fire = reminderFireOnDay(atLocal(2026, 8, 5, 15, 40), 9 * 60);
    expect(fire.getTime()).toBe(atLocal(2026, 8, 5, 9, 0).getTime());
  });

  it('schedules weekdays only Mon–Fri', () => {
    expect(
      isReminderScheduledDay(atLocal(2026, 8, 5, 12, 0), {
        // Wednesday
        repeat: 'weekdays',
        weekday: 1,
        dayOfMonth: 1,
        anchorAt: null,
      }),
    ).toBe(true);
    expect(
      isReminderScheduledDay(atLocal(2026, 8, 8, 12, 0), {
        // Saturday
        repeat: 'weekdays',
        weekday: 1,
        dayOfMonth: 1,
        anchorAt: null,
      }),
    ).toBe(false);
  });

  it('summarizes timing buckets for daily notify', () => {
    const summary = summarizeReminderTiming(
      [
        activityMoment({ id: 1, timestamp: atLocal(2026, 8, 5, 8, 50) }), // on time
        activityMoment({ id: 2, timestamp: atLocal(2026, 8, 5, 7, 0) }), // early
        activityMoment({ id: 3, timestamp: atLocal(2026, 8, 5, 11, 0) }), // late
        activityMoment({ id: 4, timestamp: atLocal(2025, 8, 5, 9, 0) }), // other year
      ],
      dailyNineAm,
      { year: 2026 },
    );
    expect(summary).toEqual({
      onTime: 1,
      early: 1,
      late: 1,
      counted: 3,
    });
  });

  it('returns empty summary when notify is disabled', () => {
    expect(
      summarizeReminderTiming(
        [activityMoment({ id: 1, timestamp: atLocal(2026, 8, 5, 9, 0) })],
        { ...dailyNineAm, enabled: false },
      ),
    ).toEqual({ onTime: 0, early: 0, late: 0, counted: 0 });
  });

  it('filters moments by timing kind', () => {
    const moments = [
      activityMoment({ id: 1, timestamp: atLocal(2026, 8, 5, 8, 50) }),
      activityMoment({ id: 2, timestamp: atLocal(2026, 8, 5, 7, 0) }),
      activityMoment({ id: 3, timestamp: atLocal(2026, 8, 5, 11, 0) }),
    ];
    expect(
      filterMomentsByReminderTiming(moments, dailyNineAm, 'early').map(
        m => m.id,
      ),
    ).toEqual([2]);
    expect(
      filterMomentsByReminderTiming(moments, dailyNineAm, 'late').map(
        m => m.id,
      ),
    ).toEqual([3]);
  });
});
