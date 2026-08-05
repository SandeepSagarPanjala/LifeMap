import { useMemo } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import { addDays, endOfDay, startOfMonth, startOfWeek } from 'date-fns';
import { TZDate } from '@date-fns/tz';

import { Text } from '@/components/ui/text';
import type { MomentRow } from '@/db/repositories/moments';
import {
  formatMetricCompact,
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
 * Week to show for a visible month.
 * Current month → this week; otherwise the week containing the 1st (clamped
 * so we never go past the current week).
 */
export function preferredWeekForMonth(
  monthDate: Date,
  _currentWeekAnchor?: Date,
  now: Date = new Date(),
): Date {
  const currentWeek = weekStartInAppTz(now);
  const monthStart = startOfMonth(zoned(monthDate));
  const currentMonth = startOfMonth(zoned(now));
  if (monthStart.getTime() === currentMonth.getTime()) {
    return currentWeek;
  }
  const firstWeek = weekStartInAppTz(monthStart);
  if (firstWeek.getTime() > currentWeek.getTime()) {
    return currentWeek;
  }
  return firstWeek;
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

/**
 * Static week summary (not swipeable). Driven by `weekAnchorDate` from month
 * swipe / day tap.
 */
export function ActivityInsightWeekPager({
  moments,
  metric,
  accent,
  muted,
  foreground,
  earliestDate,
  weekAnchorDate,
  onPressValue,
}: {
  moments: readonly MomentRow[];
  metric: InsightPeriodMetric;
  accent: string;
  muted: string;
  foreground: string;
  earliestDate: Date;
  weekAnchorDate: Date;
  /** Opens period drill-down for this week’s total. */
  onPressValue?: () => void;
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
  const valueLabel = formatMetricCompact(metric, value);
  const rangeLabel = formatWeekRangeLabel(start, end);

  const valueNode = (
    <RNText
      style={[
        styles.value,
        { color: onPressValue != null ? accent : foreground },
      ]}
      allowFontScaling={false}
      numberOfLines={1}
    >
      {valueLabel}
    </RNText>
  );

  return (
    <View style={styles.page}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: muted }]}>Week</Text>
        <Text style={[styles.range, { color: muted }]} numberOfLines={1}>
          {rangeLabel}
        </Text>
      </View>
      {onPressValue != null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Week ${valueLabel}`}
          onPress={onPressValue}
          hitSlop={6}
          style={({ pressed }) => [
            styles.valueHit,
            pressed ? { opacity: 0.72 } : null,
          ]}
        >
          {valueNode}
        </Pressable>
      ) : (
        valueNode
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    gap: 2,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    flexWrap: 'wrap',
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
  },
  range: {
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  valueHit: {
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingVertical: 2,
  },
  value: {
    fontSize: 20,
    fontWeight: '800',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
});
