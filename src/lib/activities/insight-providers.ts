import { TZDate } from '@date-fns/tz';
import {
  differenceInCalendarDays,
  endOfMonth,
  startOfDay,
  startOfMonth,
  subMonths,
} from 'date-fns';

import type { ActivityRow } from '@/db/repositories/activities';
import type { MomentRow } from '@/db/repositories/moments';
import {
  parseActivityValuesJson,
  type ActivityFieldDefinition,
} from '@/lib/activities/activity-definition';
import type { ActivityIntent } from '@/lib/activities/activity-intent';
import { APP_TIMEZONE } from '@/lib/timezone';

export type InsightCategory =
  | 'identity'
  | 'pattern'
  | 'trend'
  | 'change'
  | 'reflection'
  | 'statistics';

export type ActivityInsightCandidate = {
  id: string;
  category: InsightCategory;
  /** Short section title for cards. */
  title: string;
  /** The memorable observation sentence. */
  sentence: string;
  /** Optional supporting line. */
  subtitle?: string;
  /** 0–1 evidence strength. */
  confidence: number;
  /** Higher = more likely to be Pattern of the Day. */
  priority: number;
  /** Viz payload for UI cards. */
  viz?:
    | { kind: 'hour_histogram'; counts: number[]; peakHour: number }
    | { kind: 'weekday_bars'; counts: number[]; peakWeekday: number }
    | {
        kind: 'change';
        percent: number | null;
        direction: 'up' | 'down' | 'flat';
        intentAligned: boolean;
      }
    | { kind: 'money'; total: number; average: number; fieldLabel: string }
    | { kind: 'choice'; favorite: string; share: number; fieldLabel: string }
    | {
        kind: 'duration';
        averageSeconds: number;
        fieldLabel: string;
      };
};

export type ActivityOverviewStats = {
  lastLoggedLabel: string;
  trackingSinceLabel: string;
  totalLogs: number;
  typicalPerWeek: number | null;
};

function zoned(date: Date): TZDate {
  return new TZDate(date, APP_TIMEZONE);
}

function localHour(date: Date): number {
  return zoned(date).getHours();
}

function localWeekday(date: Date): number {
  return zoned(date).getDay();
}

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function formatHourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  if (h === 0) {
    return '12 AM';
  }
  if (h === 12) {
    return '12 PM';
  }
  if (h < 12) {
    return `${h} AM`;
  }
  return `${h - 12} PM`;
}

function formatHourRange(startHour: number, endHourExclusive: number): string {
  return `${formatHourLabel(startHour)} and ${formatHourLabel(endHourExclusive)}`;
}

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export function formatRelativeLoggedAt(
  loggedAt: Date | null,
  now: Date,
): string {
  if (loggedAt == null) {
    return 'Never';
  }
  const today = startOfDay(zoned(now));
  const day = startOfDay(zoned(loggedAt));
  const days = differenceInCalendarDays(today, day);
  if (days <= 0) {
    return 'Today';
  }
  if (days === 1) {
    return 'Yesterday';
  }
  if (days < 7) {
    return `${days} days ago`;
  }
  if (days < 14) {
    return 'Last week';
  }
  return loggedAt.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year:
      zoned(loggedAt).getFullYear() === zoned(now).getFullYear()
        ? undefined
        : 'numeric',
  });
}

export function formatTrackingSince(createdAt: Date, now: Date): string {
  const sameYear =
    zoned(createdAt).getFullYear() === zoned(now).getFullYear();
  return createdAt.toLocaleDateString(undefined, {
    month: 'short',
    year: sameYear ? undefined : 'numeric',
    day: sameYear ? 'numeric' : undefined,
  });
}

function countInMonth(
  moments: readonly MomentRow[],
  monthStart: Date,
  monthEnd: Date,
): number {
  const startMs = monthStart.getTime();
  const endMs = monthEnd.getTime();
  let count = 0;
  for (const moment of moments) {
    const t = moment.timestamp.getTime();
    if (t >= startMs && t <= endMs) {
      count += 1;
    }
  }
  return count;
}

/** Month-over-month frequency change — highest-value Pattern of the Day candidate. */
export function provideFrequencyChange(input: {
  moments: readonly MomentRow[];
  intent: ActivityIntent;
  now: Date;
}): ActivityInsightCandidate | null {
  const { moments, intent, now } = input;
  if (moments.length < 4) {
    return null;
  }
  const thisStart = startOfMonth(zoned(now));
  const thisEnd = endOfMonth(zoned(now));
  const prevStart = startOfMonth(subMonths(thisStart, 1));
  const prevEnd = endOfMonth(prevStart);
  const thisCount = countInMonth(moments, thisStart, thisEnd);
  const prevCount = countInMonth(moments, prevStart, prevEnd);
  if (prevCount === 0 && thisCount === 0) {
    return null;
  }
  if (prevCount === 0) {
    if (thisCount < 2) {
      return null;
    }
    const intentAligned = intent === 'more';
    return {
      id: 'change.frequency.new',
      category: 'change',
      title: "What's changing",
      sentence:
        intent === 'less'
          ? 'This is showing up more often than last month.'
          : intent === 'more'
            ? 'You have logged this more than last month.'
            : 'This is happening more often than last month.',
      subtitle: `${thisCount} so far this month · none last month`,
      confidence: clamp01(thisCount / 8),
      priority: 86 + (intentAligned ? 8 : 0),
      viz: {
        kind: 'change',
        percent: null,
        direction: 'up',
        intentAligned,
      },
    };
  }

  const percent = ((thisCount - prevCount) / prevCount) * 100;
  const abs = Math.abs(percent);
  if (abs < 8 && thisCount === prevCount) {
    return {
      id: 'change.frequency.flat',
      category: 'change',
      title: "What's changing",
      sentence: 'Almost unchanged compared with last month.',
      subtitle: `${thisCount} this month · ${prevCount} last month`,
      confidence: clamp01(Math.min(thisCount, prevCount) / 6),
      priority: 72,
      viz: {
        kind: 'change',
        percent: 0,
        direction: 'flat',
        intentAligned: true,
      },
    };
  }

  const direction: 'up' | 'down' = percent >= 0 ? 'up' : 'down';
  const intentAligned =
    (intent === 'less' && direction === 'down') ||
    (intent === 'more' && direction === 'up') ||
    intent === 'track';

  const rounded = Math.round(abs);
  let sentence: string;
  if (intent === 'less' && direction === 'down') {
    sentence = `${rounded}% less frequent than last month.`;
  } else if (intent === 'less' && direction === 'up') {
    sentence = `${rounded}% more frequent than last month.`;
  } else if (intent === 'more' && direction === 'up') {
    sentence = `${rounded}% more frequent than last month.`;
  } else if (intent === 'more' && direction === 'down') {
    sentence = `${rounded}% less frequent than last month.`;
  } else if (direction === 'up') {
    sentence = `${rounded}% more frequent than last month.`;
  } else {
    sentence = `${rounded}% less frequent than last month.`;
  }

  return {
    id: 'change.frequency.mom',
    category: 'change',
    title: "What's changing",
    sentence,
    subtitle: `${thisCount} this month · ${prevCount} last month`,
    confidence: clamp01((thisCount + prevCount) / 16),
    priority: 90 + (intentAligned ? 8 : -4) + Math.min(10, rounded / 5),
    viz: {
      kind: 'change',
      percent: Math.round(percent),
      direction,
      intentAligned,
    },
  };
}

export function provideTimeOfDay(input: {
  moments: readonly MomentRow[];
}): ActivityInsightCandidate | null {
  const { moments } = input;
  if (moments.length < 8) {
    return null;
  }
  const counts = Array.from({ length: 24 }, () => 0);
  for (const moment of moments) {
    counts[localHour(moment.timestamp)]! += 1;
  }
  let peakHour = 0;
  let peakCount = -1;
  for (let hour = 0; hour < 24; hour++) {
    if (counts[hour]! > peakCount) {
      peakCount = counts[hour]!;
      peakHour = hour;
    }
  }
  const share = peakCount / moments.length;
  if (share < 0.12) {
    // Soften: use a 3-hour window around the peak.
    let windowStart = peakHour;
    let windowCount = 0;
    for (let offset = -1; offset <= 1; offset++) {
      const hour = (peakHour + offset + 24) % 24;
      windowCount += counts[hour]!;
    }
    const windowShare = windowCount / moments.length;
    if (windowShare < 0.22) {
      return null;
    }
    windowStart = (peakHour - 1 + 24) % 24;
    const sentence = `Most of your logs happen between ${formatHourRange(windowStart, (peakHour + 2) % 24)}.`;
    return {
      id: 'pattern.time.window',
      category: 'pattern',
      title: 'Time of day',
      sentence,
      confidence: clamp01(windowShare + moments.length / 40),
      priority: 78 + windowShare * 20,
      viz: { kind: 'hour_histogram', counts, peakHour },
    };
  }

  const lateNight = counts.slice(22).reduce((a, b) => a + b, 0) + counts[0]! + counts[1]!;
  const lateShare = lateNight / moments.length;
  if (lateShare >= 0.4) {
    return {
      id: 'pattern.time.late',
      category: 'pattern',
      title: 'Time of day',
      sentence: 'Nearly half of your logs occur after 10 PM.',
      confidence: clamp01(lateShare + moments.length / 40),
      priority: 80,
      viz: { kind: 'hour_histogram', counts, peakHour },
    };
  }

  const morning =
    counts.slice(5, 12).reduce((a, b) => a + b, 0) / moments.length;
  const evening =
    counts.slice(17, 23).reduce((a, b) => a + b, 0) / moments.length;
  if (morning >= 0.45 && morning > evening + 0.1) {
    return {
      id: 'pattern.time.morning',
      category: 'pattern',
      title: 'Time of day',
      sentence: 'This activity is mostly part of your morning routine.',
      confidence: clamp01(morning + moments.length / 40),
      priority: 76,
      viz: { kind: 'hour_histogram', counts, peakHour },
    };
  }
  if (evening >= 0.45 && evening > morning + 0.1) {
    return {
      id: 'pattern.time.evening',
      category: 'pattern',
      title: 'Time of day',
      sentence: 'This activity is mostly part of your evening routine.',
      confidence: clamp01(evening + moments.length / 40),
      priority: 76,
      viz: { kind: 'hour_histogram', counts, peakHour },
    };
  }

  return {
    id: 'pattern.time.peak',
    category: 'pattern',
    title: 'Time of day',
    sentence: `You often log this around ${formatHourLabel(peakHour)}.`,
    confidence: clamp01(share + moments.length / 40),
    priority: 74 + share * 25,
    viz: { kind: 'hour_histogram', counts, peakHour },
  };
}

export function provideWeekday(input: {
  moments: readonly MomentRow[];
}): ActivityInsightCandidate | null {
  const { moments } = input;
  if (moments.length < 8) {
    return null;
  }
  const counts = Array.from({ length: 7 }, () => 0);
  for (const moment of moments) {
    counts[localWeekday(moment.timestamp)]! += 1;
  }
  let peakWeekday = 0;
  let peakCount = -1;
  for (let day = 0; day < 7; day++) {
    if (counts[day]! > peakCount) {
      peakCount = counts[day]!;
      peakWeekday = day;
    }
  }
  const share = peakCount / moments.length;
  if (share < 0.22) {
    return null;
  }
  const name = WEEKDAY_NAMES[peakWeekday]!;
  const almostAlways = share >= 0.4;
  return {
    id: 'pattern.weekday',
    category: 'pattern',
    title: 'Weekday',
    sentence: almostAlways
      ? `You almost always do this on ${name}s.`
      : `${name} is your strongest day for this.`,
    confidence: clamp01(share + moments.length / 40),
    priority: 70 + share * 30,
    viz: { kind: 'weekday_bars', counts, peakWeekday },
  };
}

export function provideMoneyField(input: {
  moments: readonly MomentRow[];
  field: ActivityFieldDefinition;
}): ActivityInsightCandidate | null {
  const { moments, field } = input;
  if (field.type !== 'money') {
    return null;
  }
  const amounts: number[] = [];
  for (const moment of moments) {
    const values = parseActivityValuesJson(moment.activityValuesJson);
    const value = values[field.id];
    if (value?.type === 'money') {
      amounts.push(value.amount);
    }
  }
  if (amounts.length < 3) {
    return null;
  }
  const total = amounts.reduce((a, b) => a + b, 0);
  const average = total / amounts.length;
  const money = (n: number) =>
    `$${n.toLocaleString(undefined, {
      minimumFractionDigits: n % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;
  return {
    id: `dynamic.money.${field.id}`,
    category: 'trend',
    title: field.label,
    sentence: `Average ${field.label.toLowerCase()} is ${money(average)} per log.`,
    subtitle: `${money(total)} across ${amounts.length} logs`,
    confidence: clamp01(amounts.length / 12),
    priority: 55 + Math.min(15, amounts.length),
    viz: {
      kind: 'money',
      total,
      average,
      fieldLabel: field.label,
    },
  };
}

export function provideChoiceField(input: {
  moments: readonly MomentRow[];
  field: ActivityFieldDefinition;
}): ActivityInsightCandidate | null {
  const { moments, field } = input;
  if (field.type !== 'choice') {
    return null;
  }
  const tallies = new Map<string, number>();
  let n = 0;
  for (const moment of moments) {
    const values = parseActivityValuesJson(moment.activityValuesJson);
    const value = values[field.id];
    if (value?.type === 'choice' && value.value.trim()) {
      const key = value.value.trim();
      tallies.set(key, (tallies.get(key) ?? 0) + 1);
      n += 1;
    }
  }
  if (n < 5) {
    return null;
  }
  let favorite = '';
  let favoriteCount = 0;
  for (const [choice, count] of tallies) {
    if (count > favoriteCount) {
      favorite = choice;
      favoriteCount = count;
    }
  }
  if (!favorite) {
    return null;
  }
  const share = favoriteCount / n;
  if (share < 0.28) {
    return null;
  }
  return {
    id: `dynamic.choice.${field.id}`,
    category: 'pattern',
    title: field.label,
    sentence: `${favorite} is your most common ${field.label.toLowerCase()}.`,
    subtitle: `${Math.round(share * 100)}% of ${n} logs`,
    confidence: clamp01(share + n / 30),
    priority: 60 + share * 25,
    viz: {
      kind: 'choice',
      favorite,
      share,
      fieldLabel: field.label,
    },
  };
}

export function provideDurationField(input: {
  moments: readonly MomentRow[];
  field: ActivityFieldDefinition;
}): ActivityInsightCandidate | null {
  const { moments, field } = input;
  if (field.type !== 'duration') {
    return null;
  }
  const secondsList: number[] = [];
  for (const moment of moments) {
    const values = parseActivityValuesJson(moment.activityValuesJson);
    const value = values[field.id];
    if (value?.type === 'duration' && value.seconds > 0) {
      secondsList.push(value.seconds);
    }
  }
  if (secondsList.length < 3) {
    return null;
  }
  const average =
    secondsList.reduce((a, b) => a + b, 0) / secondsList.length;
  const minutes = Math.round(average / 60);
  const sentence =
    minutes < 1
      ? `Typical ${field.label.toLowerCase()} is under a minute.`
      : `Typical ${field.label.toLowerCase()} is about ${minutes} minute${minutes === 1 ? '' : 's'}.`;
  return {
    id: `dynamic.duration.${field.id}`,
    category: 'trend',
    title: field.label,
    sentence,
    confidence: clamp01(secondsList.length / 12),
    priority: 52 + Math.min(12, secondsList.length),
    viz: {
      kind: 'duration',
      averageSeconds: average,
      fieldLabel: field.label,
    },
  };
}

export function buildOverviewStats(input: {
  activity: ActivityRow;
  moments: readonly MomentRow[];
  now: Date;
}): ActivityOverviewStats {
  const sorted = [...input.moments].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
  );
  const last = sorted[0]?.timestamp ?? null;
  const earliest =
    sorted[sorted.length - 1]?.timestamp ?? input.activity.createdAt;
  const daySpan = Math.max(
    1,
    differenceInCalendarDays(
      startOfDay(zoned(last ?? input.now)),
      startOfDay(zoned(earliest)),
    ) + 1,
  );
  const typicalPerWeek =
    input.moments.length >= 3
      ? Math.round((input.moments.length / daySpan) * 7 * 10) / 10
      : null;
  return {
    lastLoggedLabel: formatRelativeLoggedAt(last, input.now),
    trackingSinceLabel: formatTrackingSince(
      input.activity.createdAt,
      input.now,
    ),
    totalLogs: input.moments.length,
    typicalPerWeek,
  };
}

export function collectInsightCandidates(input: {
  activity: ActivityRow;
  moments: readonly MomentRow[];
  now: Date;
}): ActivityInsightCandidate[] {
  const { activity, moments, now } = input;
  const out: ActivityInsightCandidate[] = [];

  const change = provideFrequencyChange({
    moments,
    intent: activity.intent,
    now,
  });
  if (change != null) {
    out.push(change);
  }

  const time = provideTimeOfDay({ moments });
  if (time != null) {
    out.push(time);
  }

  const weekday = provideWeekday({ moments });
  if (weekday != null) {
    out.push(weekday);
  }

  for (const field of activity.fields) {
    const money = provideMoneyField({ moments, field });
    if (money != null) {
      out.push(money);
    }
    const choice = provideChoiceField({ moments, field });
    if (choice != null) {
      out.push(choice);
    }
    const duration = provideDurationField({ moments, field });
    if (duration != null) {
      out.push(duration);
    }
  }

  return out;
}
