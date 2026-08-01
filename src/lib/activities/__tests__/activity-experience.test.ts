import { TZDate } from '@date-fns/tz';

import { buildActivityExperience } from '@/lib/activities/activity-experience';
import {
  formatRelativeLoggedAt,
  provideFrequencyChange,
  provideTimeOfDay,
  provideWeekday,
} from '@/lib/activities/insight-providers';
import type { ActivityRow } from '@/db/repositories/activities';
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
    activityEmoji: '🍽',
    activityLabel: 'Restaurant Food',
    ...partial,
  });
}

const baseActivity: ActivityRow = {
  id: 1,
  emoji: '🍽',
  label: 'Restaurant Food',
  sortOrder: 0,
  createdAt: new Date('2026-01-15T00:00:00Z'),
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
    {
      id: 'meal',
      type: 'choice',
      label: 'Meal',
      required: false,
      options: ['Lunch', 'Dinner'],
    },
  ],
  intent: 'less',
  reminderEnabled: false,
  reminderRepeat: 'daily',
  reminderTimeMinutes: null,
  reminderWeekday: null,
  reminderDayOfMonth: null,
  reminderAnchorAt: null,
  reminderSound: 'ding',
};

describe('activity experience helpers', () => {
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

describe('insight providers', () => {
  const now = atLocal(2026, 7, 30, 15, 0);

  it('detects month-over-month frequency reduction for less intent', () => {
    const moments = [
      ...[1, 3, 5, 8, 10, 12, 15, 18].map((day, index) =>
        activityMoment({
          id: index + 1,
          timestamp: atLocal(2026, 6, day, 19, 0),
        }),
      ),
      ...[2, 10, 20].map((day, index) =>
        activityMoment({
          id: 20 + index,
          timestamp: atLocal(2026, 7, day, 19, 0),
        }),
      ),
    ];
    const change = provideFrequencyChange({
      moments,
      intent: 'less',
      now,
    });
    expect(change).not.toBeNull();
    expect(change?.sentence).toMatch(/less frequent than last month/i);
    expect(change?.viz?.kind).toBe('change');
    if (change?.viz?.kind === 'change') {
      expect(change.viz.intentAligned).toBe(true);
      expect(change.viz.direction).toBe('down');
    }
  });

  it('finds a weekday pattern when one day dominates', () => {
    const moments = Array.from({ length: 10 }, (_, index) =>
      activityMoment({
        // 2026-07-05 is Sunday; keep most on Sunday.
        id: index + 1,
        timestamp: atLocal(2026, 7, index < 7 ? 5 : 6 + (index - 7), 18, 0),
      }),
    );
    const weekday = provideWeekday({ moments });
    expect(weekday?.sentence).toMatch(/Sunday/i);
  });

  it('finds an evening time pattern', () => {
    const moments = Array.from({ length: 12 }, (_, index) =>
      activityMoment({
        id: index + 1,
        timestamp: atLocal(2026, 7, 1 + index, 20, 15),
      }),
    );
    const time = provideTimeOfDay({ moments });
    expect(time).not.toBeNull();
    expect(time?.viz?.kind).toBe('hour_histogram');
    expect(time?.sentence.toLowerCase()).toMatch(/evening|8 pm|around/);
  });
});

describe('buildActivityExperience', () => {
  const now = atLocal(2026, 7, 30, 15, 0);

  it('returns empty reason with no logs', () => {
    const experience = buildActivityExperience({
      activity: baseActivity,
      moments: [],
      now,
    });
    expect(experience.emptyReason).toBe('no_logs');
    expect(experience.patternOfTheDay).toBeNull();
    expect(experience.overview.lastLoggedLabel).toBe('Never');
    expect(experience.intentLabel).toBe('Do less');
  });

  it('features frequency change as pattern of the day when strong', () => {
    const moments = [
      ...[1, 2, 4, 6, 8, 10, 12, 14, 16, 18].map((day, index) =>
        activityMoment({
          id: index + 1,
          timestamp: atLocal(2026, 6, day, 19, 30),
        }),
      ),
      ...[5, 12].map((day, index) =>
        activityMoment({
          id: 50 + index,
          timestamp: atLocal(2026, 7, day, 19, 30),
        }),
      ),
    ];
    const experience = buildActivityExperience({
      activity: baseActivity,
      moments,
      now,
    });
    expect(experience.patternOfTheDay?.category).toBe('change');
    expect(experience.whatsChanging).not.toBeNull();
    expect(experience.emptyReason).toBeNull();
  });

  it('surfaces money and choice dynamic insights', () => {
    const moments = Array.from({ length: 8 }, (_, index) =>
      activityMoment({
        id: index + 1,
        timestamp: atLocal(2026, 7, 1 + index, 12, 0),
        activityValuesJson: JSON.stringify({
          spend: { type: 'money', amount: 12 + index },
          meal: {
            type: 'choice',
            value: index < 6 ? 'Dinner' : 'Lunch',
          },
        }),
      }),
    );
    const experience = buildActivityExperience({
      activity: baseActivity,
      moments,
      now,
    });
    expect(
      experience.dynamicInsights.some(item => item.viz?.kind === 'money'),
    ).toBe(true);
    expect(
      experience.dynamicInsights.some(item => item.viz?.kind === 'choice'),
    ).toBe(true);
    expect(experience.overview.totalLogs).toBe(8);
  });
});
