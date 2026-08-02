import { useCallback, useMemo } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import { addDays, endOfDay, startOfMonth, startOfWeek } from 'date-fns';
import { TZDate } from '@date-fns/tz';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import type { MomentRow } from '@/db/repositories/moments';
import {
  formatMetricShortPhrase,
  sumMetricInRange,
  type InsightPeriodMetric,
} from '@/lib/activities/insight-period-metric';
import { APP_TIMEZONE } from '@/lib/timezone';

function zoned(date: Date): TZDate {
  return new TZDate(date, APP_TIMEZONE);
}

export function weekStartInAppTz(anchor: Date): Date {
  return startOfWeek(zoned(anchor), { weekStartsOn: 0 });
}

export function weekBoundsForAnchor(anchor: Date): { start: Date; end: Date } {
  const start = weekStartInAppTz(anchor);
  const end = endOfDay(addDays(start, 6));
  return { start, end };
}

/**
 * Month that best represents a week — the month with the most days in that week.
 * Tie-break toward the later month.
 */
export function preferredMonthForWeek(weekStart: Date): Date {
  const start = weekStartInAppTz(weekStart);
  const counts = new Map<number, Date>();
  const tallies = new Map<number, number>();
  for (let i = 0; i < 7; i++) {
    const month = startOfMonth(zoned(addDays(start, i)));
    const key = month.getTime();
    counts.set(key, month);
    tallies.set(key, (tallies.get(key) ?? 0) + 1);
  }
  let bestKey = startOfMonth(zoned(start)).getTime();
  let bestCount = 0;
  for (const [key, count] of tallies) {
    if (count > bestCount || (count === bestCount && key > bestKey)) {
      bestCount = count;
      bestKey = key;
    }
  }
  return counts.get(bestKey) ?? startOfMonth(zoned(start));
}

/**
 * First week of a month (week containing the 1st), clamped to not after the
 * current week.
 */
export function preferredWeekForMonth(
  monthDate: Date,
  _currentWeekAnchor?: Date,
  now: Date = new Date(),
): Date {
  const currentWeek = weekStartInAppTz(now);
  const firstWeek = weekStartInAppTz(startOfMonth(zoned(monthDate)));
  if (firstWeek.getTime() > currentWeek.getTime()) {
    return currentWeek;
  }
  return firstWeek;
}

function shiftWeek(weekStart: Date, deltaWeeks: number): Date {
  return weekStartInAppTz(addDays(weekStart, deltaWeeks * 7));
}

function clampWeekToRange(
  weekStart: Date,
  earliestWeek: Date,
  currentWeek: Date,
): Date {
  const week = weekStartInAppTz(weekStart);
  if (week.getTime() < earliestWeek.getTime()) {
    return earliestWeek;
  }
  if (week.getTime() > currentWeek.getTime()) {
    return currentWeek;
  }
  return week;
}

function formatWeekRangeLabel(start: Date, end: Date): string {
  const startLabel = start.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  const endLabel = end.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  return `${startLabel} – ${endLabel}`;
}

function isCurrentWeek(weekStart: Date, now: Date): boolean {
  return weekStart.getTime() === weekStartInAppTz(now).getTime();
}

/**
 * Week summary with prev/next arrows (no swipe).
 * Controlled by `weekAnchorDate`; reports arrow presses via `onVisibleWeekChange`.
 */
export function ActivityInsightWeekPager({
  moments,
  metric,
  accent,
  muted,
  foreground,
  earliestDate,
  weekAnchorDate,
  onVisibleWeekChange,
}: {
  moments: readonly MomentRow[];
  metric: InsightPeriodMetric;
  accent: string;
  muted: string;
  foreground: string;
  earliestDate: Date;
  weekAnchorDate: Date;
  onVisibleWeekChange?: (weekStart: Date) => void;
}) {
  const now = useMemo(() => new Date(), []);
  const currentWeek = useMemo(() => weekStartInAppTz(now), [now]);
  const earliestWeek = useMemo(
    () => weekStartInAppTz(earliestDate),
    [earliestDate],
  );

  const weekStart = useMemo(
    () => clampWeekToRange(weekAnchorDate, earliestWeek, currentWeek),
    [currentWeek, earliestWeek, weekAnchorDate],
  );

  const { start, end } = useMemo(
    () => weekBoundsForAnchor(weekStart),
    [weekStart],
  );
  const value = sumMetricInRange(moments, metric, start, end);
  const valueLabel = formatMetricShortPhrase(metric, value);
  const rangeLabel = formatWeekRangeLabel(start, end);
  const title = isCurrentWeek(weekStart, now) ? 'This Week' : 'Week';

  const canGoPrev = weekStart.getTime() > earliestWeek.getTime();
  const canGoNext = weekStart.getTime() < currentWeek.getTime();

  const goPrev = useCallback(() => {
    if (!canGoPrev) {
      return;
    }
    onVisibleWeekChange?.(
      clampWeekToRange(shiftWeek(weekStart, -1), earliestWeek, currentWeek),
    );
  }, [
    canGoPrev,
    currentWeek,
    earliestWeek,
    onVisibleWeekChange,
    weekStart,
  ]);

  const goNext = useCallback(() => {
    if (!canGoNext) {
      return;
    }
    onVisibleWeekChange?.(
      clampWeekToRange(shiftWeek(weekStart, 1), earliestWeek, currentWeek),
    );
  }, [
    canGoNext,
    currentWeek,
    earliestWeek,
    onVisibleWeekChange,
    weekStart,
  ]);

  return (
    <View style={styles.page}>
      <Text style={[styles.label, { color: muted }]}>{title}</Text>
      <View style={styles.rangeRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous week"
          disabled={!canGoPrev}
          onPress={goPrev}
          hitSlop={8}
          style={styles.navBtn}
        >
          <ChevronLeft
            size={16}
            color={accent}
            strokeWidth={2.5}
            opacity={canGoPrev ? 1 : 0.35}
          />
        </Pressable>
        <Text style={[styles.range, { color: accent }]} numberOfLines={1}>
          {rangeLabel}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next week"
          disabled={!canGoNext}
          onPress={goNext}
          hitSlop={8}
          style={styles.navBtn}
        >
          <ChevronRight
            size={16}
            color={accent}
            strokeWidth={2.5}
            opacity={canGoNext ? 1 : 0.35}
          />
        </Pressable>
      </View>
      <RNText
        style={[styles.value, { color: foreground }]}
        allowFontScaling={false}
        numberOfLines={1}
      >
        {valueLabel}
      </RNText>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: -4,
  },
  navBtn: {
    padding: 2,
  },
  range: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  value: {
    fontSize: 18,
    fontWeight: '800',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
});
