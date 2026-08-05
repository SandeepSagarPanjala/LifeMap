import { TZDate } from '@date-fns/tz';

import {
  buildInsightCalendarMonth,
  calendarCellState,
  listMonthsInclusive,
  resolveInsightCalendarStartDate,
  shiftMonth,
  summarizeAmounts,
  summarizeLogTotals,
} from '@/lib/activities/activity-insights';
import type { MomentRow } from '@/db/repositories/moments';
import type { ActivityFieldDefinition } from '@/lib/activities/activity-definition';
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

const moneyFields: ActivityFieldDefinition[] = [
  {
    id: 'spend',
    type: 'money',
    label: 'Spend',
    required: false,
  },
];

describe('activity insights amounts and log totals', () => {
  const now = atLocal(2026, 6, 10, 15, 0);

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
    const amounts = summarizeAmounts(moments, moneyFields, 'week', now);
    expect(amounts).toHaveLength(1);
    expect(amounts[0]?.today).toBe(4.5);
    expect(amounts[0]?.week).toBe(7.5);
    expect(amounts[0]?.avgPerLog).toBe(3.75);
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
});

describe('activity insights calendar', () => {
  const now = atLocal(2026, 6, 10, 15, 0);

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
        intent: 'more',
        scheduled: true,
        hasLog: false,
        isFuture: false,
        isToday: true,
      }),
    ).toBe('today');
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
