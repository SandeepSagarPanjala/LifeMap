import { TZDate } from '@date-fns/tz';

import {
  defaultMapInsightFilterOption,
  listMapInsightFilterOptions,
  listWeekOptionsForMonth,
  mapInsightYearFilterAvailable,
  pickWeekOptionWithData,
  resolveFilterForTabChange,
} from '@/lib/map/map-insight-period-options';
import { APP_TIMEZONE } from '@/lib/timezone';

describe('map-insight-period-options', () => {
  const now = new TZDate(2026, 7, 3, 15, 0, 0, 0, APP_TIMEZONE); // Mon Aug 3

  it('lists non-future weeks of the current month with Current on this week', () => {
    const options = listMapInsightFilterOptions({
      period: 'week',
      dateKeysWithData: [],
      now,
    });

    expect(options.length).toBeGreaterThanOrEqual(1);
    expect(options.every(option => option.startDateKey <= '2026-08-03')).toBe(
      true,
    );
    const current = options.find(option => option.isCurrent);
    expect(current).toBeTruthy();
    expect(current!.label).toMatch(/^Week \d+ \(/);
    expect(options.some(option => option.label.includes('Week 1'))).toBe(true);
  });

  it('lists only months with data and skips future months', () => {
    const options = listMapInsightFilterOptions({
      period: 'month',
      dateKeysWithData: [
        '2026-06-10',
        '2026-07-01',
        '2026-08-02',
        '2026-09-01', // future relative to Aug 3 — ignored via month key > current
      ],
      now,
    });

    expect(options.map(option => option.id)).toEqual([
      'month:2026-06',
      'month:2026-07',
      'month:2026-08',
    ]);
    expect(options.find(option => option.id === 'month:2026-08')?.isCurrent).toBe(
      true,
    );
  });

  it('lists years with data and reports prior-year filter availability', () => {
    expect(
      mapInsightYearFilterAvailable(['2026-01-01', '2026-08-01'], now),
    ).toBe(false);
    expect(
      mapInsightYearFilterAvailable(['2025-12-01', '2026-08-01'], now),
    ).toBe(true);

    const options = listMapInsightFilterOptions({
      period: 'year',
      dateKeysWithData: ['2024-05-01', '2025-12-01', '2026-08-01'],
      now,
    });
    expect(options.map(option => option.label)).toEqual([
      '2024',
      '2025',
      '2026',
    ]);
  });

  it('defaults to the current period window', () => {
    const week = defaultMapInsightFilterOption('week', now);
    expect(week.isCurrent).toBe(true);
    const month = defaultMapInsightFilterOption('month', now);
    expect(month.id).toBe('month:2026-08');
    const year = defaultMapInsightFilterOption('year', now);
    expect(year.id).toBe('year:2026');
  });

  it('preserves year when switching year → month', () => {
    const year2025 = resolveFilterForTabChange({
      nextTab: 'year',
      previousTab: 'week',
      previousFilter: {
        id: 'week:2025-07-06',
        label: 'Week',
        startDateKey: '2025-07-06',
        endDateKey: '2025-07-12',
        isCurrent: false,
        weekIndex: 2,
      },
      focusMonthKey: '2025-07',
      focusWeekStartKey: '2025-07-06',
      dateKeysWithData: ['2025-07-10', '2026-08-01'],
      now,
    });
    expect(year2025?.id).toBe('year:2025');

    const month = resolveFilterForTabChange({
      nextTab: 'month',
      previousTab: 'year',
      previousFilter: year2025,
      focusMonthKey: '2025-07',
      focusWeekStartKey: '2025-07-06',
      dateKeysWithData: ['2025-03-01', '2025-07-10', '2026-08-01'],
      now,
    });
    expect(month?.id).toBe('month:2025-07');
  });

  it('does not move month to January when switching to year', () => {
    const year = resolveFilterForTabChange({
      nextTab: 'year',
      previousTab: 'month',
      previousFilter: {
        id: 'month:2026-08',
        label: 'August 2026',
        startDateKey: '2026-08-01',
        endDateKey: '2026-08-03',
        isCurrent: true,
      },
      focusMonthKey: '2026-08',
      focusWeekStartKey: '2026-08-02',
      dateKeysWithData: ['2026-08-02'],
      now,
    });
    expect(year?.id).toBe('year:2026');

    const backToMonth = resolveFilterForTabChange({
      nextTab: 'month',
      previousTab: 'year',
      previousFilter: year,
      focusMonthKey: '2026-08',
      focusWeekStartKey: '2026-08-02',
      dateKeysWithData: ['2026-08-02'],
      now,
    });
    expect(backToMonth?.id).toBe('month:2026-08');
  });

  it('preserves month when switching month → week and prefers a week with data', () => {
    const july = defaultMapInsightFilterOption('month', now);
    const julyOption = {
      id: 'month:2026-07',
      label: 'July 2026',
      startDateKey: '2026-07-01',
      endDateKey: '2026-07-31',
      isCurrent: false,
    };

    const week = resolveFilterForTabChange({
      nextTab: 'week',
      previousTab: 'month',
      previousFilter: julyOption,
      focusMonthKey: '2026-07',
      dateKeysWithData: ['2026-07-05', '2026-07-20'],
      now,
    });

    expect(week).toBeTruthy();
    expect(week!.startDateKey <= '2026-07-31').toBe(true);
    expect(week!.endDateKey >= '2026-07-01').toBe(true);
    const coversData =
      (week!.startDateKey <= '2026-07-05' && week!.endDateKey >= '2026-07-05') ||
      (week!.startDateKey <= '2026-07-20' && week!.endDateKey >= '2026-07-20');
    expect(coversData).toBe(true);
    expect(july.id).toBe('month:2026-08');
  });

  it('pickWeekOptionWithData keeps the same week index when it has data', () => {
    const weeks = listWeekOptionsForMonth(
      new TZDate(2026, 6, 1, APP_TIMEZONE),
      now,
    );
    const week1 = weeks.find(option => option.weekIndex === 1);
    expect(week1).toBeTruthy();

    const kept = pickWeekOptionWithData({
      weeks,
      dateKeysWithData: [
        week1!.startDateKey,
        '2026-07-20',
      ],
      preferredWeekIndex: 1,
      now,
    });
    expect(kept.weekIndex).toBe(1);

    const auto = pickWeekOptionWithData({
      weeks,
      // No data in week 1 — only later in the month
      dateKeysWithData: ['2026-07-20'],
      preferredWeekIndex: 1,
      now,
    });
    expect(auto.weekIndex).not.toBe(1);
    expect(auto.startDateKey <= '2026-07-20').toBe(true);
    expect(auto.endDateKey >= '2026-07-20').toBe(true);
  });

  it('pickWeekOptionWithData skips empty weeks', () => {
    const weeks = listWeekOptionsForMonth(
      new TZDate(2026, 6, 1, APP_TIMEZONE),
      now,
    );
    const picked = pickWeekOptionWithData({
      weeks,
      dateKeysWithData: ['2026-07-20'],
      now,
    });
    expect(picked.startDateKey <= '2026-07-20').toBe(true);
    expect(picked.endDateKey >= '2026-07-20').toBe(true);
  });
});
