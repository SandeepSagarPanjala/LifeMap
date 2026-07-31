import { TZDate } from '@date-fns/tz';
import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
} from 'date-fns';

import type { ActivityRow } from '@/db/repositories/activities';
import type { MomentRow } from '@/db/repositories/moments';
import {
  parseActivityValuesJson,
  type ActivityFieldDefinition,
} from '@/lib/activities/activity-definition';
import {
  activityIntentLabel,
  type ActivityIntent,
} from '@/lib/activities/activity-intent';
import { parseDateKey, toDateKey } from '@/lib/day-utils';
import type { ReminderRepeat } from '@/lib/notifications/types';
import { APP_TIMEZONE } from '@/lib/timezone';

/** On-time if logged within scheduled time ± this many minutes. */
export const ACTIVITY_ON_TIME_WINDOW_MINUTES = 30;

export type ActivityInsightRange = 'today' | 'week' | 'month' | 'year' | 'all';

export const ACTIVITY_INSIGHT_RANGES: Array<{
  value: ActivityInsightRange;
  label: string;
}> = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All' },
];

export type TimingOutcome =
  | { kind: 'on_time' }
  | { kind: 'early'; minutes: number }
  | { kind: 'late'; minutes: number };

export type TimingSummary = {
  evaluated: number;
  onTime: number;
  early: number;
  late: number;
  onTimeRate: number;
  /** Average minutes late among late logs only. */
  avgLateMinutes: number | null;
  /** Average minutes early among early logs only. */
  avgEarlyMinutes: number | null;
  recent: Array<{
    at: Date;
    outcome: TimingOutcome;
  }>;
};

export type FrequencySummary = {
  logCount: number;
  daysWithLog: number;
  daySpan: number;
  /** Consecutive days with a log ending at the newest logged day (build / track). */
  currentStreak: number;
  bestStreak: number;
  /** Consecutive days without a log ending yesterday (avoidance / less). */
  cleanStreak: number;
  bestCleanStreak: number;
};

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
  | 'empty'
  | 'future'
  | 'unscheduled';

export type InsightCalendarCell = {
  dateKey: string;
  dayOfMonth: number;
  state: InsightCalendarCellState;
  scheduled: boolean;
  hasLog: boolean;
  /** Number of logs on this day (0 when none). */
  logCount: number;
};

export type AdherenceSummary = {
  scheduledDays: number;
  /** Good: days with a log. Bad: days without a log. */
  successDays: number;
  /** Good: skipped scheduled days. Bad: days with a log (relapse). */
  failDays: number;
  rate: number;
};

export type ActivityInsightWidgets = {
  /** @deprecated Streak widgets removed — always false. */
  showHabitCore: boolean;
  /** Adherence % for daily/weekdays reminder (good/bad only). */
  showSchedule: boolean;
  /** Month calendar — always shown. */
  showCalendar: boolean;
  /** On-time / early / late when reminder is on with a repeating schedule. */
  showTiming: boolean;
  /** Today / Week / Month / Year / All log counts. */
  showLogTotals: boolean;
};

export type LogTotals = {
  today: number;
  week: number;
  month: number;
  year: number;
  all: number;
};

export type ActivityInsightSnapshot = {
  intent: ActivityIntent;
  intentLabel: string;
  statusLine: string;
  frequency: FrequencySummary;
  logTotals: LogTotals;
  timing: TimingSummary | null;
  adherence: AdherenceSummary | null;
  calendar: InsightCalendarCell[];
  /** Month label for the calendar grid (local YYYY-MM). */
  calendarMonthKey: string;
  /** False when viewing the current calendar month (block swipe to future). */
  canGoNextMonth: boolean;
  amounts: AmountFieldSummary[];
  widgets: ActivityInsightWidgets;
};

function zoned(date: Date): TZDate {
  return new TZDate(date, APP_TIMEZONE);
}

function localMinutesFromMidnight(date: Date): number {
  const z = zoned(date);
  return z.getHours() * 60 + z.getMinutes();
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

/**
 * Compare a log time to a scheduled local time-of-day.
 * Early/late minutes are measured from the scheduled time (not the window edge).
 */
export function classifyTimingAgainstSchedule(
  loggedAt: Date,
  scheduledTimeMinutes: number,
  windowMinutes: number = ACTIVITY_ON_TIME_WINDOW_MINUTES,
): TimingOutcome {
  const loggedMinutes = localMinutesFromMidnight(loggedAt);
  const delta = loggedMinutes - scheduledTimeMinutes;
  if (delta >= -windowMinutes && delta <= windowMinutes) {
    return { kind: 'on_time' };
  }
  if (delta < -windowMinutes) {
    return { kind: 'early', minutes: Math.abs(delta) };
  }
  return { kind: 'late', minutes: delta };
}

export function summarizeTiming(
  moments: readonly MomentRow[],
  scheduledTimeMinutes: number | null,
  reminderEnabled: boolean,
): TimingSummary | null {
  if (!reminderEnabled || scheduledTimeMinutes == null) {
    return null;
  }
  const recent: TimingSummary['recent'] = [];
  let onTime = 0;
  let early = 0;
  let late = 0;
  let lateMinutesSum = 0;
  let earlyMinutesSum = 0;
  for (const moment of moments) {
    const outcome = classifyTimingAgainstSchedule(
      moment.timestamp,
      scheduledTimeMinutes,
    );
    if (outcome.kind === 'on_time') {
      onTime += 1;
    } else if (outcome.kind === 'early') {
      early += 1;
      earlyMinutesSum += outcome.minutes;
    } else {
      late += 1;
      lateMinutesSum += outcome.minutes;
    }
    recent.push({ at: moment.timestamp, outcome });
  }
  recent.sort((a, b) => b.at.getTime() - a.at.getTime());
  const evaluated = moments.length;
  return {
    evaluated,
    onTime,
    early,
    late,
    onTimeRate: evaluated > 0 ? onTime / evaluated : 0,
    avgLateMinutes: late > 0 ? lateMinutesSum / late : null,
    avgEarlyMinutes: early > 0 ? earlyMinutesSum / early : null,
    recent: recent.slice(0, 5),
  };
}

function dateKeysWithLogs(moments: readonly MomentRow[]): string[] {
  const keys = new Set<string>();
  for (const moment of moments) {
    keys.add(toDateKey(moment.timestamp));
  }
  return [...keys].sort();
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

function streakEndingAt(sortedKeysAsc: string[], endKey: string): number {
  if (sortedKeysAsc.length === 0) {
    return 0;
  }
  const set = new Set(sortedKeysAsc);
  if (!set.has(endKey)) {
    return 0;
  }
  let streak = 0;
  let cursor = endKey;
  while (set.has(cursor)) {
    streak += 1;
    cursor = toDateKey(subDays(startOfDay(zoned(parseKey(cursor))), 1));
  }
  return streak;
}

function parseKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return startOfDay(new TZDate(y!, m! - 1, d!, APP_TIMEZONE));
}

function bestConsecutiveStreak(sortedKeysAsc: string[]): number {
  if (sortedKeysAsc.length === 0) {
    return 0;
  }
  let best = 1;
  let current = 1;
  for (let i = 1; i < sortedKeysAsc.length; i++) {
    const prev = parseKey(sortedKeysAsc[i - 1]!);
    const next = parseKey(sortedKeysAsc[i]!);
    const gap = differenceInCalendarDays(next, prev);
    if (gap === 1) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }
  return best;
}

/** Clean-day streaks: consecutive days with no logs (for intent `less`). */
function cleanStreaks(
  sortedKeysAsc: string[],
  now: Date,
): { current: number; best: number } {
  if (sortedKeysAsc.length === 0) {
    return { current: 0, best: 0 };
  }
  const logged = new Set(sortedKeysAsc);
  const first = parseKey(sortedKeysAsc[0]!);
  const yesterday = startOfDay(subDays(zoned(now), 1));
  let current = 0;
  let cursor = yesterday;
  while (
    cursor.getTime() >= first.getTime() &&
    !logged.has(toDateKey(cursor))
  ) {
    current += 1;
    cursor = startOfDay(subDays(cursor, 1));
  }

  let best = 0;
  let run = 0;
  for (
    let day = first;
    day.getTime() <= yesterday.getTime();
    day = startOfDay(addDays(day, 1))
  ) {
    if (!logged.has(toDateKey(day))) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return { current, best };
}

export function summarizeFrequency(
  moments: readonly MomentRow[],
  range: ActivityInsightRange,
  now: Date = new Date(),
): FrequencySummary {
  const keys = dateKeysWithLogs(moments);
  const { start, end } = insightRangeBounds(range, now);
  const spanStart =
    start ?? (keys[0] != null ? parseKey(keys[0]) : startOfDay(zoned(now)));
  const daySpan = Math.max(
    1,
    differenceInCalendarDays(
      startOfDay(zoned(end)),
      startOfDay(zoned(spanStart)),
    ) + 1,
  );
  const todayKey = toDateKey(now);
  const newestKey = keys[keys.length - 1] ?? todayKey;
  const streakEnd = keys.includes(todayKey) ? todayKey : newestKey;
  const clean = cleanStreaks(keys, now);
  return {
    logCount: moments.length,
    daysWithLog: keys.length,
    daySpan,
    currentStreak: streakEndingAt(keys, streakEnd),
    bestStreak: bestConsecutiveStreak(keys),
    cleanStreak: clean.current,
    bestCleanStreak: clean.best,
  };
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

/** Repeats that have a predictable scheduled clock time for on-time / early / late. */
export function isTimingReminderRepeat(repeat: ReminderRepeat): boolean {
  return (
    repeat === 'daily' ||
    repeat === 'weekdays' ||
    repeat === 'weekly' ||
    repeat === 'monthly'
  );
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

export function resolveInsightWidgets(
  intent: ActivityIntent,
  reminderEnabled: boolean,
  reminderRepeat: ReminderRepeat,
): ActivityInsightWidgets {
  const habit = intent === 'more' || intent === 'less';
  const timingRepeat =
    reminderEnabled && isTimingReminderRepeat(reminderRepeat);
  return {
    showHabitCore: false,
    showSchedule: false,
    showCalendar: true,
    showTiming: habit && timingRepeat,
    showLogTotals: true,
  };
}

/**
 * Map a day + log presence to a calendar cell state.
 * Good: log = green, no log = miss (when active).
 * Bad: no log = green, log = relapse (when active).
 * Track: log = green, no log = gray.
 */
export function calendarCellState(input: {
  intent: ActivityIntent;
  scheduled: boolean;
  hasLog: boolean;
  isFuture: boolean;
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
    return input.hasLog ? 'success' : 'unscheduled';
  }
  if (input.intent === 'less') {
    return input.hasLog ? 'relapse' : 'success';
  }
  return input.hasLog ? 'success' : 'miss';
}

export function listScheduledDateKeysInRange(
  start: Date,
  end: Date,
  repeat: ReminderRepeat,
): string[] {
  if (!isCalendarReminderRepeat(repeat)) {
    return [];
  }
  const keys: string[] = [];
  let cursor = startOfDay(zoned(start));
  const last = startOfDay(zoned(end));
  while (cursor.getTime() <= last.getTime()) {
    if (isDayScheduled(cursor, repeat)) {
      keys.push(toDateKey(cursor));
    }
    cursor = startOfDay(addDays(cursor, 1));
  }
  return keys;
}

export function summarizeAdherence(input: {
  intent: ActivityIntent;
  scheduledKeys: readonly string[];
  loggedKeys: ReadonlySet<string>;
}): AdherenceSummary | null {
  const scheduledDays = input.scheduledKeys.length;
  if (scheduledDays === 0) {
    return null;
  }
  let hits = 0;
  for (const key of input.scheduledKeys) {
    if (input.loggedKeys.has(key)) {
      hits += 1;
    }
  }
  const clean = scheduledDays - hits;
  if (input.intent === 'less') {
    return {
      scheduledDays,
      successDays: clean,
      failDays: hits,
      rate: clean / scheduledDays,
    };
  }
  return {
    scheduledDays,
    successDays: hits,
    failDays: clean,
    rate: hits / scheduledDays,
  };
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
      logCount,
      state: !inMonth
        ? 'empty'
        : calendarCellState({
            intent: input.intent,
            scheduled,
            hasLog,
            isFuture,
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
  let cursor = start;
  while (cursor.getTime() <= end.getTime()) {
    months.push(cursor);
    cursor = shiftMonth(cursor, 1);
  }
  return months;
}

function buildStatusLine(
  intent: ActivityIntent,
  logTotals: LogTotals,
  timing: TimingSummary | null,
  adherence: AdherenceSummary | null,
): string {
  const intentLabel = activityIntentLabel(intent);
  const parts: string[] = [intentLabel];
  parts.push(`${logTotals.all} log${logTotals.all === 1 ? '' : 's'} total`);
  if (adherence != null && adherence.scheduledDays > 0) {
    parts.push(
      `${Math.round(adherence.rate * 100)}% ${intent === 'less' ? 'clean' : 'kept'}`,
    );
  }
  if (timing != null && timing.evaluated > 0) {
    parts.push(`${Math.round(timing.onTimeRate * 100)}% on time`);
  }
  return parts.join(' · ');
}

export function buildActivityInsightSnapshot(input: {
  activity: ActivityRow;
  moments: readonly MomentRow[];
  /** @deprecated Range filter removed — ignored when provided. */
  range?: ActivityInsightRange;
  /** Month to show on the calendar (defaults to current month). */
  monthDate?: Date;
  now?: Date;
}): ActivityInsightSnapshot {
  const now = input.now ?? new Date();
  const activity = input.activity;
  const widgets = resolveInsightWidgets(
    activity.intent,
    activity.reminderEnabled,
    activity.reminderRepeat,
  );
  const logTotals = summarizeLogTotals(input.moments, now);
  // Keep frequency for tests / status helpers (all-time moments).
  const frequency = summarizeFrequency(input.moments, 'all', now);

  const timing = widgets.showTiming
    ? summarizeTiming(
        input.moments,
        activity.reminderTimeMinutes,
        activity.reminderEnabled,
      )
    : null;

  const allLoggedKeys = new Set(dateKeysWithLogs(input.moments));
  const loggedCounts = countLogsByDateKey(input.moments);

  let adherence: AdherenceSummary | null = null;
  if (widgets.showSchedule) {
    const monthStart = startOfMonth(zoned(now));
    const monthEnd = endOfDay(zoned(now));
    const scheduledKeys = listScheduledDateKeysInRange(
      monthStart,
      monthEnd,
      activity.reminderRepeat,
    );
    adherence = summarizeAdherence({
      intent: activity.intent,
      scheduledKeys,
      loggedKeys: allLoggedKeys,
    });
  }

  const monthDate = input.monthDate ?? now;
  const calendar = buildInsightCalendarMonth({
    intent: activity.intent,
    reminderEnabled: activity.reminderEnabled,
    reminderRepeat: activity.reminderRepeat,
    loggedCounts,
    monthDate,
    now,
  });

  const amounts = summarizeAmounts(
    input.moments,
    activity.fields,
    'all',
    now,
  );

  return {
    intent: activity.intent,
    intentLabel: activityIntentLabel(activity.intent),
    statusLine: buildStatusLine(
      activity.intent,
      logTotals,
      timing,
      adherence,
    ),
    frequency,
    logTotals,
    timing,
    adherence,
    calendar: calendar.cells,
    calendarMonthKey: calendar.monthKey,
    canGoNextMonth: calendar.canGoNextMonth,
    amounts,
    widgets,
  };
}
