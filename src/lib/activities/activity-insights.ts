import { TZDate } from '@date-fns/tz';
import {
  addDays,
  endOfDay,
  endOfMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';

import type { MomentRow } from '@/db/repositories/moments';
import {
  parseActivityValuesJson,
  type ActivityFieldDefinition,
} from '@/lib/activities/activity-definition';
import type { ActivityIntent } from '@/lib/activities/activity-intent';
import { parseDateKey, toDateKey } from '@/lib/day-utils';
import type { ReminderRepeat } from '@/lib/notifications/types';
import { APP_TIMEZONE } from '@/lib/timezone';

export type ActivityInsightRange = 'today' | 'week' | 'month' | 'year' | 'all';

export type AmountFieldSummary = {
  fieldId: string;
  label: string;
  kind: 'money' | 'number';
  today: number;
  week: number;
  month: number;
  year: number;
  all: number;
  rangeTotal: number;
  avgPerLog: number | null;
};

/** Calendar / adherence cell state (intent-aware). */
export type InsightCalendarCellState =
  | 'success'
  | 'miss'
  | 'relapse'
  | 'today'
  | 'empty'
  | 'future'
  | 'unscheduled';

export type InsightCalendarCell = {
  dateKey: string;
  dayOfMonth: number;
  state: InsightCalendarCellState;
  scheduled: boolean;
  hasLog: boolean;
  /** True when this cell is the current local calendar day. */
  isToday: boolean;
  /** Number of logs on this day (0 when none). */
  logCount: number;
};

export type LogTotals = {
  today: number;
  week: number;
  month: number;
  year: number;
  all: number;
};

function zoned(date: Date): TZDate {
  return new TZDate(date, APP_TIMEZONE);
}

export function insightRangeBounds(
  range: ActivityInsightRange,
  now: Date = new Date(),
): { start: Date | null; end: Date } {
  const end = endOfDay(zoned(now));
  switch (range) {
    case 'today':
      return { start: startOfDay(zoned(now)), end };
    case 'week':
      return {
        start: startOfWeek(zoned(now), { weekStartsOn: 0 }),
        end,
      };
    case 'month':
      return { start: startOfMonth(zoned(now)), end };
    case 'year':
      return { start: startOfYear(zoned(now)), end };
    case 'all':
      return { start: null, end };
  }
}

function filterMomentsInRange(
  moments: readonly MomentRow[],
  range: ActivityInsightRange,
  now: Date,
): MomentRow[] {
  const { start, end } = insightRangeBounds(range, now);
  return moments.filter(moment => {
    const t = moment.timestamp.getTime();
    if (t > end.getTime()) {
      return false;
    }
    if (start != null && t < start.getTime()) {
      return false;
    }
    return true;
  });
}

/** Per-day log counts for calendar multi-log indicators. */
export function countLogsByDateKey(
  moments: readonly { timestamp: Date }[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const moment of moments) {
    const key = toDateKey(moment.timestamp);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function sumFieldInMoments(
  moments: readonly MomentRow[],
  fieldId: string,
  kind: 'money' | 'number',
): number {
  let total = 0;
  for (const moment of moments) {
    const values = parseActivityValuesJson(moment.activityValuesJson);
    const value = values[fieldId];
    if (value == null) {
      continue;
    }
    if (kind === 'money' && value.type === 'money') {
      total += value.amount;
    } else if (kind === 'number' && value.type === 'number') {
      total += value.value;
    }
  }
  return total;
}

export function numericFieldsFromDefinition(
  fields: readonly ActivityFieldDefinition[],
): Array<{ fieldId: string; label: string; kind: 'money' | 'number' }> {
  const out: Array<{
    fieldId: string;
    label: string;
    kind: 'money' | 'number';
  }> = [];
  for (const field of fields) {
    if (field.type === 'money' || field.type === 'number') {
      out.push({
        fieldId: field.id,
        label: field.label,
        kind: field.type,
      });
    }
  }
  return out;
}

export function summarizeAmounts(
  allMoments: readonly MomentRow[],
  fields: readonly ActivityFieldDefinition[],
  range: ActivityInsightRange,
  now: Date = new Date(),
): AmountFieldSummary[] {
  const numeric = numericFieldsFromDefinition(fields);
  if (numeric.length === 0) {
    return [];
  }
  const todayMoments = filterMomentsInRange(allMoments, 'today', now);
  const weekMoments = filterMomentsInRange(allMoments, 'week', now);
  const monthMoments = filterMomentsInRange(allMoments, 'month', now);
  const yearMoments = filterMomentsInRange(allMoments, 'year', now);
  const rangeMoments = filterMomentsInRange(allMoments, range, now);

  return numeric.map(field => {
    const today = sumFieldInMoments(todayMoments, field.fieldId, field.kind);
    const week = sumFieldInMoments(weekMoments, field.fieldId, field.kind);
    const month = sumFieldInMoments(monthMoments, field.fieldId, field.kind);
    const year = sumFieldInMoments(yearMoments, field.fieldId, field.kind);
    const all = sumFieldInMoments(allMoments, field.fieldId, field.kind);
    const rangeTotal = sumFieldInMoments(
      rangeMoments,
      field.fieldId,
      field.kind,
    );
    const logsWithValue = rangeMoments.filter(moment => {
      const values = parseActivityValuesJson(moment.activityValuesJson);
      const value = values[field.fieldId];
      return (
        value != null &&
        ((field.kind === 'money' && value.type === 'money') ||
          (field.kind === 'number' && value.type === 'number'))
      );
    }).length;
    return {
      fieldId: field.fieldId,
      label: field.label,
      kind: field.kind,
      today,
      week,
      month,
      year,
      all,
      rangeTotal,
      avgPerLog: logsWithValue > 0 ? rangeTotal / logsWithValue : null,
    };
  });
}

export function summarizeLogTotals(
  moments: readonly MomentRow[],
  now: Date = new Date(),
): LogTotals {
  return {
    today: filterMomentsInRange(moments, 'today', now).length,
    week: filterMomentsInRange(moments, 'week', now).length,
    month: filterMomentsInRange(moments, 'month', now).length,
    year: filterMomentsInRange(moments, 'year', now).length,
    all: moments.length,
  };
}

/** Daily / weekdays reminders support scheduled-day adherence. */
export function isCalendarReminderRepeat(repeat: ReminderRepeat): boolean {
  return repeat === 'daily' || repeat === 'weekdays';
}

export function isDayScheduled(
  date: Date,
  repeat: ReminderRepeat,
): boolean {
  if (repeat === 'daily') {
    return true;
  }
  if (repeat === 'weekdays') {
    const day = zoned(date).getDay();
    return day >= 1 && day <= 5;
  }
  return false;
}

/** Whether this day participates in habit coloring (miss/success). */
export function isCalendarActiveDay(
  intent: ActivityIntent,
  reminderEnabled: boolean,
  reminderRepeat: ReminderRepeat,
  date: Date,
): boolean {
  if (intent === 'track') {
    return true;
  }
  if (reminderEnabled && isCalendarReminderRepeat(reminderRepeat)) {
    return isDayScheduled(date, reminderRepeat);
  }
  // Good/bad without daily/weekdays schedule: every day counts.
  return true;
}

/**
 * Map a day + log presence to a calendar cell state.
 * Good: log = green, no log = miss (when active). Today without a log is
 * `today` (in progress), never miss — the day is not over yet.
 * Bad: no log = green, log = relapse (when active).
 * Track: log = green, no log = gray.
 */
export function calendarCellState(input: {
  intent: ActivityIntent;
  scheduled: boolean;
  hasLog: boolean;
  isFuture: boolean;
  isToday?: boolean;
}): InsightCalendarCellState {
  if (input.isFuture) {
    return 'future';
  }
  if (input.intent === 'track') {
    return input.hasLog ? 'success' : 'unscheduled';
  }
  if (!input.scheduled) {
    if (input.intent === 'less') {
      return input.hasLog ? 'relapse' : 'unscheduled';
    }
    if (input.hasLog) {
      return 'success';
    }
    return input.isToday ? 'today' : 'unscheduled';
  }
  if (input.intent === 'less') {
    return input.hasLog ? 'relapse' : 'success';
  }
  if (input.hasLog) {
    return 'success';
  }
  return input.isToday ? 'today' : 'miss';
}

/**
 * Build a full calendar-month grid (Sun–Sat weeks) for `monthDate`'s month.
 * Future days (after `now`) are marked future; cannot color past current month.
 */
export function buildInsightCalendarMonth(input: {
  intent: ActivityIntent;
  reminderEnabled: boolean;
  reminderRepeat: ReminderRepeat;
  /** Per-day log counts. Prefer this when available. */
  loggedCounts?: ReadonlyMap<string, number>;
  /** @deprecated Prefer `loggedCounts`. Treated as count 1 when present. */
  loggedKeys?: ReadonlySet<string>;
  /** Any date inside the month to display. */
  monthDate: Date;
  now?: Date;
}): { monthKey: string; cells: InsightCalendarCell[]; canGoNextMonth: boolean } {
  const now = input.now ?? new Date();
  const monthStart = startOfMonth(zoned(input.monthDate));
  const monthEnd = endOfMonth(zoned(input.monthDate));
  const monthKey = toDateKey(monthStart).slice(0, 7);
  const currentMonthStart = startOfMonth(zoned(now));
  const todayStart = startOfDay(zoned(now));
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = addDays(startOfWeek(monthEnd, { weekStartsOn: 0 }), 6);

  const cells: InsightCalendarCell[] = [];
  let cursor = gridStart;
  while (cursor.getTime() <= gridEnd.getTime()) {
    const dateKey = toDateKey(cursor);
    const inMonth =
      cursor.getTime() >= monthStart.getTime() &&
      cursor.getTime() <= monthEnd.getTime();
    const isFuture = cursor.getTime() > todayStart.getTime();
    const isToday = cursor.getTime() === todayStart.getTime();
    const scheduled =
      inMonth &&
      isCalendarActiveDay(
        input.intent,
        input.reminderEnabled,
        input.reminderRepeat,
        cursor,
      );
    const logCount =
      input.loggedCounts?.get(dateKey) ??
      (input.loggedKeys?.has(dateKey) ? 1 : 0);
    const hasLog = logCount > 0;
    const z = zoned(cursor);
    cells.push({
      dateKey,
      dayOfMonth: z.getDate(),
      scheduled,
      hasLog,
      isToday,
      logCount,
      state: !inMonth
        ? 'empty'
        : calendarCellState({
            intent: input.intent,
            scheduled,
            hasLog,
            isFuture,
            isToday,
          }),
    });
    cursor = startOfDay(addDays(cursor, 1));
  }
  return {
    monthKey,
    cells,
    canGoNextMonth: monthStart.getTime() < currentMonthStart.getTime(),
  };
}

/**
 * Month header next to the calendar title (logs metric only).
 * Good habit → days logged; bad habit → clean days; track → log count.
 */
export function formatInsightCalendarMonthSummary(
  intent: ActivityIntent,
  cells: readonly InsightCalendarCell[],
): string {
  if (intent === 'less') {
    const clean = cells.reduce(
      (n, cell) => (cell.state === 'success' ? n + 1 : n),
      0,
    );
    return `${clean} clean day${clean === 1 ? '' : 's'} this month`;
  }
  if (intent === 'more') {
    const logged = cells.reduce(
      (n, cell) => (cell.state === 'success' ? n + 1 : n),
      0,
    );
    return `${logged} logged this month`;
  }
  let logs = 0;
  for (const cell of cells) {
    if (cell.state === 'empty' || cell.state === 'future') {
      continue;
    }
    logs += cell.logCount;
  }
  return `${logs} Logs this Month`;
}

export function parseMonthKey(monthKey: string): Date {
  const [y, m] = monthKey.split('-').map(Number);
  return startOfMonth(new TZDate(y!, m! - 1, 1, APP_TIMEZONE));
}

export function shiftMonth(monthDate: Date, deltaMonths: number): Date {
  const z = zoned(monthDate);
  return startOfMonth(
    new TZDate(z.getFullYear(), z.getMonth() + deltaMonths, 1, APP_TIMEZONE),
  );
}

/**
 * Earliest calendar day for month paging: first log if any, else app-install /
 * history bound, else activity created day. Never after `now`.
 */
export function resolveInsightCalendarStartDate(input: {
  moments: readonly { timestamp: Date }[];
  activityCreatedAt: Date;
  /** History earliest date key (install / first GPS), `YYYY-MM-DD`. */
  historyEarliestDateKey?: string | null;
  now?: Date;
}): Date {
  const now = input.now ?? new Date();
  const todayStart = startOfDay(zoned(now));
  let earliest: Date | null = null;
  for (const moment of input.moments) {
    const day = startOfDay(zoned(moment.timestamp));
    if (earliest == null || day.getTime() < earliest.getTime()) {
      earliest = day;
    }
  }
  if (earliest == null) {
    if (
      input.historyEarliestDateKey != null &&
      input.historyEarliestDateKey.length > 0
    ) {
      earliest = startOfDay(parseDateKey(input.historyEarliestDateKey));
    } else {
      earliest = startOfDay(zoned(input.activityCreatedAt));
    }
  }
  if (earliest.getTime() > todayStart.getTime()) {
    return todayStart;
  }
  return earliest;
}

/** Inclusive month starts from `fromDate`'s month through `toDate`'s month. */
export function listMonthsInclusive(fromDate: Date, toDate: Date): Date[] {
  const start = startOfMonth(zoned(fromDate));
  const end = startOfMonth(zoned(toDate));
  if (start.getTime() > end.getTime()) {
    return [end];
  }
  const months: Date[] = [];
  let cursor: Date = start;
  while (cursor.getTime() <= end.getTime()) {
    months.push(cursor);
    cursor = shiftMonth(cursor, 1);
  }
  return months;
}
