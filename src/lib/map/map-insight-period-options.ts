import { TZDate } from '@date-fns/tz';
import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfYear,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';

import { getDayRange, parseDateKey, toDateKey } from '@/lib/day-utils';
import { APP_TIMEZONE } from '@/lib/timezone';

export type MapInsightTab = 'overview' | 'today' | 'week' | 'month' | 'year';

export type MapInsightFilterOption = {
  id: string;
  /** Primary line, e.g. "Week 1 (Aug 2 – Aug 8)". */
  label: string;
  startDateKey: string;
  endDateKey: string;
  isCurrent: boolean;
  /** 1-based week-of-month index when this option is a week. */
  weekIndex?: number;
};

function zoned(date: Date): TZDate {
  return new TZDate(date, APP_TIMEZONE);
}

function weekStartInAppTz(anchor: Date): Date {
  return startOfWeek(zoned(anchor), { weekStartsOn: 0 });
}

function formatDayLabel(date: Date): string {
  return zoned(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatMonthLong(year: number, monthIndex: number): string {
  return new TZDate(year, monthIndex, 1, APP_TIMEZONE).toLocaleDateString(
    undefined,
    { month: 'long', year: 'numeric' },
  );
}

function formatMonthShort(year: number, monthIndex: number): string {
  return new TZDate(year, monthIndex, 1, APP_TIMEZONE).toLocaleDateString(
    undefined,
    { month: 'short' },
  );
}

function clampEndToToday(end: Date, now: Date): Date {
  const todayEnd = endOfDay(zoned(now));
  return end.getTime() > todayEnd.getTime() ? todayEnd : end;
}

export function monthKeyFromDateKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function yearFromDateKey(dateKey: string): number {
  return Number(dateKey.slice(0, 4));
}

function monthStartFromKey(monthKey: string): Date {
  const [yearStr, monthStr] = monthKey.split('-');
  return startOfMonth(
    new TZDate(Number(yearStr), Number(monthStr) - 1, 1, APP_TIMEZONE),
  );
}

function optionOverlapsData(
  option: MapInsightFilterOption,
  dateKeysWithData: readonly string[],
): boolean {
  return dateKeysWithData.some(
    key => key >= option.startDateKey && key <= option.endDateKey,
  );
}

/** Short month label for the segment bar (e.g. "Aug"). */
export function mapInsightMonthBarLabel(
  monthKey: string,
  now: Date = new Date(),
): string {
  const key = monthKey || toDateKey(now).slice(0, 7);
  const [yearStr, monthStr] = key.split('-');
  return formatMonthShort(Number(yearStr), Number(monthStr) - 1);
}

/** Week label for the segment bar (e.g. "Week 2"). */
export function mapInsightWeekBarLabel(weekIndex: number): string {
  const n = Number.isFinite(weekIndex) && weekIndex > 0 ? Math.floor(weekIndex) : 1;
  return `Week ${n}`;
}

/** Year label for the segment bar. */
export function mapInsightYearBarLabel(
  year: number,
  now: Date = new Date(),
): string {
  return String(Number.isFinite(year) ? year : zoned(now).getFullYear());
}

export function contextFromFilterOption(option: MapInsightFilterOption): {
  year: number;
  monthKey: string;
} {
  return {
    year: yearFromDateKey(option.startDateKey),
    monthKey: monthKeyFromDateKey(option.startDateKey),
  };
}

/** Default selection for a period tab (current day / week / month / year so far). */
export function defaultMapInsightFilterOption(
  tab: Exclude<MapInsightTab, 'overview'>,
  now: Date = new Date(),
): MapInsightFilterOption {
  if (tab === 'today') {
    return todayOption(now);
  }

  if (tab === 'week') {
    const weeks = listWeekOptionsForMonth(startOfMonth(zoned(now)), now);
    return weeks.find(option => option.isCurrent) ?? weeks[weeks.length - 1]!;
  }

  if (tab === 'month') {
    return monthOptionForKey(toDateKey(now).slice(0, 7), now);
  }

  return yearOptionForYear(zoned(now).getFullYear(), now);
}

/**
 * Resolve the filter when switching tabs while preserving year/month/week chrome.
 * Pass `focusMonthKey` / `focusWeekStartKey` so a Year range (Jan 1–…) does not
 * reset the Month / Week segment labels.
 */
export function resolveFilterForTabChange(input: {
  nextTab: MapInsightTab;
  previousTab: MapInsightTab;
  previousFilter: MapInsightFilterOption | null;
  /** Preserved month (YYYY-MM), independent of year-option start dates. */
  focusMonthKey?: string;
  /** Preserved week start date key. */
  focusWeekStartKey?: string;
  dateKeysWithData: readonly string[];
  now?: Date;
}): MapInsightFilterOption | null {
  const now = input.now ?? new Date();
  if (input.nextTab === 'overview') {
    return null;
  }

  if (input.nextTab === 'today') {
    return todayOption(now);
  }

  const previous = input.previousFilter;
  const ctx = previous != null ? contextFromFilterOption(previous) : null;
  const year =
    input.focusMonthKey != null
      ? yearFromDateKey(input.focusMonthKey)
      : (ctx?.year ?? zoned(now).getFullYear());
  const monthKey =
    input.focusMonthKey ??
    ctx?.monthKey ??
    toDateKey(now).slice(0, 7);

  if (input.nextTab === 'year') {
    // Prefer year from focus month / previous non-year filter, not Jan reset.
    const yearFromPrev =
      previous != null && previous.id.startsWith('year:')
        ? yearFromDateKey(previous.startDateKey)
        : year;
    return yearOptionForYear(yearFromPrev, now);
  }

  if (input.nextTab === 'month') {
    const months = listMonthOptions(input.dateKeysWithData, now);
    const inYear = months.filter(
      option => yearFromDateKey(option.startDateKey) === year,
    );
    const match =
      inYear.find(option => option.id === `month:${monthKey}`) ??
      months.find(option => option.id === `month:${monthKey}`) ??
      inYear[inYear.length - 1] ??
      months[months.length - 1] ??
      monthOptionForKey(monthKey, now);
    return match;
  }

  // week — keep month; prefer same week index when it still has data
  const weeks = listWeekOptionsForMonth(monthStartFromKey(monthKey), now);
  const preferredWeek = input.focusWeekStartKey
    ? weeks.find(option => option.startDateKey === input.focusWeekStartKey)
    : null;
  return pickWeekOptionWithData({
    weeks,
    dateKeysWithData: input.dateKeysWithData,
    preferredWeekStartKey: input.focusWeekStartKey ?? null,
    preferredWeekIndex: preferredWeek?.weekIndex ?? null,
    now,
  });
}

function monthOptionForKey(
  monthKey: string,
  now: Date,
): MapInsightFilterOption {
  const monthStart = monthStartFromKey(monthKey);
  const end = clampEndToToday(endOfMonth(monthStart), now);
  const [yearStr, monthStr] = monthKey.split('-');
  const currentMonthKey = toDateKey(now).slice(0, 7);
  return {
    id: `month:${monthKey}`,
    label: formatMonthLong(Number(yearStr), Number(monthStr) - 1),
    startDateKey: toDateKey(monthStart),
    endDateKey: toDateKey(end),
    isCurrent: monthKey === currentMonthKey,
  };
}

function yearOptionForYear(year: number, now: Date): MapInsightFilterOption {
  const yearStart = startOfYear(new TZDate(year, 0, 1, APP_TIMEZONE));
  const end = clampEndToToday(endOfYear(yearStart), now);
  return {
    id: `year:${year}`,
    label: String(year),
    startDateKey: toDateKey(yearStart),
    endDateKey: toDateKey(end),
    isCurrent: year === zoned(now).getFullYear(),
  };
}

/**
 * Filter menu rows for the active period tab.
 * - Week: weeks of the focused month (no future).
 * - Month: months that have trip data (no future, no empty).
 * - Year: years that have trip data (no future).
 */
export function listMapInsightFilterOptions(input: {
  period: Exclude<MapInsightTab, 'overview' | 'today'>;
  dateKeysWithData: readonly string[];
  /** When listing weeks, scope to this month (YYYY-MM). */
  monthKey?: string;
  now?: Date;
}): MapInsightFilterOption[] {
  const now = input.now ?? new Date();
  switch (input.period) {
    case 'week': {
      const key = input.monthKey ?? toDateKey(now).slice(0, 7);
      return listWeekOptionsForMonth(monthStartFromKey(key), now);
    }
    case 'month':
      return listMonthOptions(input.dateKeysWithData, now);
    case 'year':
      return listYearOptions(input.dateKeysWithData, now);
  }
}

/** Single-day window for the Today tab. */
export function todayOption(now: Date = new Date()): MapInsightFilterOption {
  const key = toDateKey(now);
  return {
    id: `today:${key}`,
    label: formatDayLabel(now),
    startDateKey: key,
    endDateKey: key,
    isCurrent: true,
  };
}

export function listWeekOptionsForMonth(
  monthAnchor: Date,
  now: Date = new Date(),
): MapInsightFilterOption[] {
  const monthStart = startOfMonth(zoned(monthAnchor));
  const monthEnd = endOfMonth(zoned(monthAnchor));
  const currentWeekStart = weekStartInAppTz(now);
  const options: MapInsightFilterOption[] = [];

  let weekStart = weekStartInAppTz(monthStart);
  let weekIndex = 1;

  while (weekStart.getTime() <= monthEnd.getTime()) {
    if (weekStart.getTime() > currentWeekStart.getTime()) {
      break;
    }

    const weekEndRaw = endOfDay(addDays(weekStart, 6));
    const overlapsMonth =
      weekEndRaw.getTime() >= monthStart.getTime() &&
      weekStart.getTime() <= monthEnd.getTime();
    if (!overlapsMonth) {
      weekStart = addDays(weekStart, 7);
      continue;
    }

    const isCurrent = weekStart.getTime() === currentWeekStart.getTime();
    const end = clampEndToToday(weekEndRaw, now);
    const startDateKey = toDateKey(weekStart);
    const endDateKey = toDateKey(end);
    const rangeLabel = `${formatDayLabel(weekStart)} – ${formatDayLabel(end)}`;

    options.push({
      id: `week:${startDateKey}`,
      label: `Week ${weekIndex} (${rangeLabel})`,
      startDateKey,
      endDateKey,
      isCurrent,
      weekIndex,
    });

    weekIndex += 1;
    weekStart = addDays(weekStart, 7);
    if (weekIndex > 6) {
      break;
    }
  }

  return options;
}

/**
 * Prefer keeping the same week-of-month index when the month changes.
 * Only auto-picks another week when that index is missing or has no trip data.
 */
export function pickWeekOptionWithData(input: {
  weeks: readonly MapInsightFilterOption[];
  dateKeysWithData: readonly string[];
  preferredWeekStartKey?: string | null;
  preferredWeekIndex?: number | null;
  now?: Date;
}): MapInsightFilterOption {
  const weeks = input.weeks;
  if (weeks.length === 0) {
    const now = input.now ?? new Date();
    return defaultMapInsightFilterOption('week', now);
  }

  const withData = weeks.filter(option =>
    optionOverlapsData(option, input.dateKeysWithData),
  );

  const preferredIndex = input.preferredWeekIndex;
  if (preferredIndex != null && preferredIndex > 0) {
    const sameIndex = weeks.find(option => option.weekIndex === preferredIndex);
    if (
      sameIndex != null &&
      optionOverlapsData(sameIndex, input.dateKeysWithData)
    ) {
      return sameIndex;
    }
    // Same week number exists but has no data (or doesn't exist) → auto-pick.
    if (withData.length > 0) {
      const currentWithData = withData.find(option => option.isCurrent);
      return currentWithData ?? withData[withData.length - 1]!;
    }
    return sameIndex ?? weeks[weeks.length - 1]!;
  }

  if (input.preferredWeekStartKey) {
    const preferred =
      withData.find(
        option => option.startDateKey === input.preferredWeekStartKey,
      ) ??
      weeks.find(option => option.startDateKey === input.preferredWeekStartKey);
    if (
      preferred != null &&
      optionOverlapsData(preferred, input.dateKeysWithData)
    ) {
      return preferred;
    }
  }

  const currentWithData = withData.find(option => option.isCurrent);
  if (currentWithData != null) {
    return currentWithData;
  }

  if (withData.length > 0) {
    return withData[withData.length - 1]!;
  }

  return weeks.find(option => option.isCurrent) ?? weeks[weeks.length - 1]!;
}

function listMonthOptions(
  dateKeysWithData: readonly string[],
  now: Date,
): MapInsightFilterOption[] {
  const currentMonthKey = toDateKey(now).slice(0, 7);
  const monthsWithData = new Set(
    dateKeysWithData
      .map(monthKeyFromDateKey)
      .filter(key => key <= currentMonthKey),
  );

  const options: MapInsightFilterOption[] = [];
  const sortedMonths = [...monthsWithData].sort();

  for (const monthKey of sortedMonths) {
    options.push(monthOptionForKey(monthKey, now));
  }

  return options;
}

function listYearOptions(
  dateKeysWithData: readonly string[],
  now: Date,
): MapInsightFilterOption[] {
  const currentYear = zoned(now).getFullYear();
  const yearsWithData = new Set(
    dateKeysWithData
      .map(yearFromDateKey)
      .filter(year => Number.isFinite(year) && year <= currentYear),
  );

  const options: MapInsightFilterOption[] = [];
  const sortedYears = [...yearsWithData].sort((a, b) => a - b);

  for (const year of sortedYears) {
    options.push(yearOptionForYear(year, now));
  }

  return options;
}

/** True when Year tab should show a filter (at least one prior year with data). */
export function mapInsightYearFilterAvailable(
  dateKeysWithData: readonly string[],
  now: Date = new Date(),
): boolean {
  const currentYear = zoned(now).getFullYear();
  return dateKeysWithData.some(key => yearFromDateKey(key) < currentYear);
}

export function resolveMapInsightFilterBounds(option: MapInsightFilterOption): {
  startDateKey: string;
  endDateKey: string;
  start: Date;
  end: Date;
} {
  return {
    startDateKey: option.startDateKey,
    endDateKey: option.endDateKey,
    start: getDayRange(option.startDateKey).start,
    end: getDayRange(option.endDateKey).end,
  };
}

/** @internal test helper — parse a month key without exporting parseDateKey usage. */
export function monthKeyExistsInOptions(
  options: readonly MapInsightFilterOption[],
  monthKey: string,
): boolean {
  return options.some(option => option.id === `month:${monthKey}`);
}

export function weekStartKeyFromAnchor(anchor: Date): string {
  return toDateKey(weekStartInAppTz(anchor));
}

export function parseMonthKeyToDate(monthKey: string): Date {
  return parseDateKey(`${monthKey}-01`);
}
