import { TZDate } from '@date-fns/tz';

import {
  ACTIVITY_ON_TIME_WINDOW_MINUTES,
  buildActivityInsightSnapshot,
  buildInsightCalendarMonth,
  calendarCellState,
  classifyTimingAgainstSchedule,
  listMonthsInclusive,
  resolveInsightCalendarStartDate,
  resolveInsightWidgets,
  shiftMonth,
  summarizeAdherence,
  summarizeAmounts,
  summarizeFrequency,
  summarizeLogTotals,
  summarizeTiming,
} from '@/lib/activities/activity-insights';
import type { ActivityRow } from '@/db/repositories/activities';
import type { MomentRow } from '@/db/repositories/moments';
import { toDateKey } from '@/lib/day-utils';
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

const baseActivity: ActivityRow = {
  id: 1,
  emoji: '☕',
  label: 'Coffee',
  sortOrder: 0,
  createdAt: new Date('2026-06-01T00:00:00Z'),
  archivedAt: null,
  schemaVersion: 1,
  source: 'blank',
  templateId: null,
  definitionJson: '[]',
  fields: [
    {
      id: 'spend',
      type: 'money',
      label: 'Spend',
      required: false,
    },
  ],
  intent: 'more',
  reminderEnabled: true,
  reminderRepeat: 'daily',
  reminderTimeMinutes: 13 * 60, // 1:00 PM
  reminderWeekday: null,
  reminderDayOfMonth: null,
  reminderAnchorAt: null,
  reminderSound: 'ding',
};

describe('activity insights timing', () => {
  it('treats logs inside ±30m as on time', () => {
    expect(
      classifyTimingAgainstSchedule(atLocal(2026, 6, 8, 12, 30), 13 * 60),
    ).toEqual({ kind: 'on_time' });
    expect(
      classifyTimingAgainstSchedule(atLocal(2026, 6, 8, 13, 30), 13 * 60),
    ).toEqual({ kind: 'on_time' });
    expect(
      classifyTimingAgainstSchedule(atLocal(2026, 6, 8, 13, 0), 13 * 60),
    ).toEqual({ kind: 'on_time' });
  });

  it('reports minutes early from scheduled time outside the window', () => {
    expect(
      classifyTimingAgainstSchedule(atLocal(2026, 6, 8, 12, 20), 13 * 60),
    ).toEqual({ kind: 'early', minutes: 40 });
  });

  it('reports minutes late from scheduled time outside the window', () => {
    expect(
      classifyTimingAgainstSchedule(atLocal(2026, 6, 8, 13, 45), 13 * 60),
    ).toEqual({ kind: 'late', minutes: 45 });
  });

  it('uses the configured window constant', () => {
    expect(ACTIVITY_ON_TIME_WINDOW_MINUTES).toBe(30);
  });

  it('summarizes timing counts and average late minutes', () => {
    const summary = summarizeTiming(
      [
        activityMoment({ id: 1, timestamp: atLocal(2026, 6, 8, 13, 0) }),
        activityMoment({ id: 2, timestamp: atLocal(2026, 6, 8, 12, 20) }),
        activityMoment({ id: 3, timestamp: atLocal(2026, 6, 8, 14, 0) }),
        activityMoment({ id: 4, timestamp: atLocal(2026, 6, 9, 14, 30) }),
      ],
      13 * 60,
      true,
    );
    expect(summary).toMatchObject({
      evaluated: 4,
      onTime: 1,
      early: 1,
      late: 2,
      avgLateMinutes: 75,
      avgEarlyMinutes: 40,
    });
  });

  it('hides timing when reminder is off', () => {
    expect(
      summarizeTiming(
        [activityMoment({ id: 1, timestamp: atLocal(2026, 6, 8, 13, 0) })],
        13 * 60,
        false,
      ),
    ).toBeNull();
  });
});

describe('activity insights frequency and amounts', () => {
  const now = atLocal(2026, 6, 10, 15, 0);

  it('builds streaks for good-habit frequency', () => {
    const moments = [
      activityMoment({ id: 1, timestamp: atLocal(2026, 6, 8, 10, 0) }),
      activityMoment({ id: 2, timestamp: atLocal(2026, 6, 9, 10, 0) }),
      activityMoment({ id: 3, timestamp: atLocal(2026, 6, 10, 10, 0) }),
    ];
    const frequency = summarizeFrequency(moments, 'week', now);
    expect(frequency.logCount).toBe(3);
    expect(frequency.daysWithLog).toBe(3);
    expect(frequency.currentStreak).toBe(3);
    expect(frequency.bestStreak).toBe(3);
  });

  it('sums money fields across ranges', () => {
    const moments = [
      activityMoment({
        id: 1,
        timestamp: atLocal(2026, 6, 10, 9, 0),
        activityValuesJson: JSON.stringify({
          spend: { type: 'money', amount: 4.5 },
        }),
      }),
      activityMoment({
        id: 2,
        timestamp: atLocal(2026, 6, 9, 9, 0),
        activityValuesJson: JSON.stringify({
          spend: { type: 'money', amount: 3 },
        }),
      }),
    ];
    const amounts = summarizeAmounts(moments, baseActivity.fields, 'week', now);
    expect(amounts).toHaveLength(1);
    expect(amounts[0]?.today).toBe(4.5);
    expect(amounts[0]?.week).toBe(7.5);
    expect(amounts[0]?.avgPerLog).toBe(3.75);
  });

  it('builds log totals and always shows calendar', () => {
    const snapshot = buildActivityInsightSnapshot({
      activity: baseActivity,
      moments: [
        activityMoment({ id: 1, timestamp: atLocal(2026, 6, 10, 13, 5) }),
        activityMoment({ id: 2, timestamp: atLocal(2026, 6, 9, 13, 0) }),
      ],
      now,
    });
    expect(snapshot.intentLabel).toBe('Good habit');
    expect(snapshot.logTotals.all).toBe(2);
    expect(snapshot.logTotals.today).toBe(1);
    expect(snapshot.timing?.onTime).toBe(2);
    expect(snapshot.widgets.showHabitCore).toBe(false);
    expect(snapshot.widgets.showCalendar).toBe(true);
    expect(snapshot.widgets.showLogTotals).toBe(true);
    expect(snapshot.widgets.showTiming).toBe(true);
    expect(snapshot.calendar.length).toBeGreaterThan(0);
  });
});

describe('activity insights habit widgets', () => {
  const now = atLocal(2026, 6, 10, 15, 0);

  it('still shows calendar and log totals for track intent', () => {
    expect(resolveInsightWidgets('track', true, 'daily')).toEqual({
      showHabitCore: false,
      showSchedule: false,
      showCalendar: true,
      showTiming: false,
      showLogTotals: true,
    });
    const snapshot = buildActivityInsightSnapshot({
      activity: { ...baseActivity, intent: 'track' },
      moments: [
        activityMoment({ id: 1, timestamp: atLocal(2026, 6, 10, 13, 0) }),
      ],
      now,
    });
    expect(snapshot.widgets.showHabitCore).toBe(false);
    expect(snapshot.timing).toBeNull();
    expect(snapshot.adherence).toBeNull();
    expect(snapshot.calendar.length).toBeGreaterThan(0);
    expect(snapshot.logTotals.all).toBe(1);
  });

  it('maps good vs bad calendar cell semantics', () => {
    expect(
      calendarCellState({
        intent: 'more',
        scheduled: true,
        hasLog: true,
        isFuture: false,
      }),
    ).toBe('success');
    expect(
      calendarCellState({
        intent: 'more',
        scheduled: true,
        hasLog: false,
        isFuture: false,
      }),
    ).toBe('miss');
    expect(
      calendarCellState({
        intent: 'less',
        scheduled: true,
        hasLog: false,
        isFuture: false,
      }),
    ).toBe('success');
    expect(
      calendarCellState({
        intent: 'less',
        scheduled: true,
        hasLog: true,
        isFuture: false,
      }),
    ).toBe('relapse');
  });

  it('computes good-habit adherence from scheduled hits', () => {
    const adherence = summarizeAdherence({
      intent: 'more',
      scheduledKeys: ['2026-06-08', '2026-06-09', '2026-06-10'],
      loggedKeys: new Set(['2026-06-08', '2026-06-10']),
    });
    expect(adherence).toEqual({
      scheduledDays: 3,
      successDays: 2,
      failDays: 1,
      rate: 2 / 3,
    });
  });

  it('computes bad-habit adherence as clean days', () => {
    const adherence = summarizeAdherence({
      intent: 'less',
      scheduledKeys: ['2026-06-08', '2026-06-09', '2026-06-10'],
      loggedKeys: new Set(['2026-06-09']),
    });
    expect(adherence).toEqual({
      scheduledDays: 3,
      successDays: 2,
      failDays: 1,
      rate: 2 / 3,
    });
  });

  it('builds a reverse calendar for bad habits in the current month', () => {
    const { cells, canGoNextMonth } = buildInsightCalendarMonth({
      intent: 'less',
      reminderEnabled: true,
      reminderRepeat: 'daily',
      loggedKeys: new Set(['2026-06-09']),
      monthDate: now,
      now,
    });
    const day9 = cells.find(cell => cell.dateKey === '2026-06-09');
    const day8 = cells.find(cell => cell.dateKey === '2026-06-08');
    expect(day9?.state).toBe('relapse');
    expect(day8?.state).toBe('success');
    expect(canGoNextMonth).toBe(false);
  });

  it('allows next month only when viewing a past month', () => {
    const past = buildInsightCalendarMonth({
      intent: 'more',
      reminderEnabled: true,
      reminderRepeat: 'daily',
      loggedKeys: new Set(),
      monthDate: shiftMonth(now, -1),
      now,
    });
    expect(past.canGoNextMonth).toBe(true);
  });

  it('shows timing without schedule adherence for weekly reminders', () => {
    const widgets = resolveInsightWidgets('more', true, 'weekly');
    expect(widgets.showTiming).toBe(true);
    expect(widgets.showCalendar).toBe(true);
    expect(widgets.showSchedule).toBe(false);
  });

  it('shows timing for monthly reminders and hides it for never', () => {
    expect(resolveInsightWidgets('more', true, 'monthly').showTiming).toBe(
      true,
    );
    expect(resolveInsightWidgets('more', true, 'never').showTiming).toBe(
      false,
    );
    expect(resolveInsightWidgets('less', false, 'daily').showTiming).toBe(
      false,
    );
  });

  it('summarizes log totals by period', () => {
    const totals = summarizeLogTotals(
      [
        activityMoment({ id: 1, timestamp: atLocal(2026, 6, 10, 10, 0) }),
        activityMoment({ id: 2, timestamp: atLocal(2026, 6, 9, 10, 0) }),
        activityMoment({ id: 3, timestamp: atLocal(2026, 5, 1, 10, 0) }),
      ],
      now,
    );
    expect(totals.today).toBe(1);
    expect(totals.week).toBe(2);
    expect(totals.all).toBe(3);
  });

  it('starts calendar at first log when present', () => {
    const start = resolveInsightCalendarStartDate({
      moments: [
        activityMoment({ id: 1, timestamp: atLocal(2026, 5, 15, 10, 0) }),
        activityMoment({ id: 2, timestamp: atLocal(2026, 6, 1, 10, 0) }),
      ],
      activityCreatedAt: atLocal(2026, 1, 1, 0, 0),
      historyEarliestDateKey: '2026-01-01',
      now,
    });
    expect(toDateKey(start)).toBe('2026-05-15');
  });

  it('falls back to install/history day when there are no logs', () => {
    const start = resolveInsightCalendarStartDate({
      moments: [],
      activityCreatedAt: atLocal(2026, 6, 1, 0, 0),
      historyEarliestDateKey: '2026-03-01',
      now,
    });
    expect(toDateKey(start)).toBe('2026-03-01');
  });

  it('lists months from first data through current', () => {
    const months = listMonthsInclusive(
      atLocal(2026, 4, 15, 0, 0),
      atLocal(2026, 6, 10, 0, 0),
    );
    expect(months.map(m => toDateKey(m).slice(0, 7))).toEqual([
      '2026-04',
      '2026-05',
      '2026-06',
    ]);
  });

  it('includes per-day log counts on calendar cells', () => {
    const { cells } = buildInsightCalendarMonth({
      intent: 'track',
      reminderEnabled: false,
      reminderRepeat: 'daily',
      loggedCounts: new Map([
        ['2026-06-09', 2],
        ['2026-06-10', 5],
      ]),
      monthDate: now,
      now,
    });
    expect(cells.find(cell => cell.dateKey === '2026-06-09')?.logCount).toBe(2);
    expect(cells.find(cell => cell.dateKey === '2026-06-10')?.logCount).toBe(5);
    expect(cells.find(cell => cell.dateKey === '2026-06-08')?.logCount).toBe(0);
  });
});
