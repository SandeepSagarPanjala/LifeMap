import { useCallback, useMemo } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import { startOfMonth } from 'date-fns';
import { TZDate } from '@date-fns/tz';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import type { ActivityRow } from '@/db/repositories/activities';
import type { MomentRow } from '@/db/repositories/moments';
import { resolveInsightCalendarStartDate } from '@/lib/activities/activity-insights';
import {
  formatMetricCompact,
  formatMetricPeriodPhrase,
  metricValuesByMonth,
  type InsightPeriodMetric,
} from '@/lib/activities/insight-period-metric';
import { APP_TIMEZONE } from '@/lib/timezone';
import { useAppStore } from '@/stores/app-store';

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const BAR_TRACK_HEIGHT = 10;
const BAR_MIN_WIDTH_PCT = 2;
const ZERO_BAR_COLOR = '#D1D5DB';
const ROW_HEIGHT = 26;

function yearInAppTz(date: Date): number {
  return new TZDate(date, APP_TIMEZONE).getFullYear();
}

function monthStartInAppTz(date: Date): Date {
  return startOfMonth(new TZDate(date, APP_TIMEZONE));
}

/**
 * Same calendar month in `year` as `preferredMonthDate` (e.g. Aug → Aug).
 * Clamped to earliest/current month when that month isn't available yet.
 */
export function sameMonthInYear(
  year: number,
  preferredMonthDate: Date,
  earliestMonth: Date,
  currentMonth: Date,
): Date {
  const preferredMonth = new TZDate(
    preferredMonthDate,
    APP_TIMEZONE,
  ).getMonth();
  const candidate = monthStartInAppTz(
    new TZDate(year, preferredMonth, 1, 0, 0, 0, 0, APP_TIMEZONE),
  );
  if (candidate.getTime() < earliestMonth.getTime()) {
    return earliestMonth;
  }
  if (candidate.getTime() > currentMonth.getTime()) {
    return currentMonth;
  }
  return candidate;
}

function YearBarsPage({
  year,
  values,
  metric,
  accent,
  soft,
  muted,
  foreground,
  selectedMonth,
  canGoPrev,
  canGoNext,
  onPrevYear,
  onNextYear,
  onSelectMonth,
}: {
  year: number;
  values: number[];
  metric: InsightPeriodMetric;
  accent: string;
  soft: string;
  muted: string;
  foreground: string;
  selectedMonth: number | null;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrevYear: () => void;
  onNextYear: () => void;
  onSelectMonth: (month: number) => void;
}) {
  const maxValue = Math.max(1, ...values);
  const yearTotal = values.reduce((sum, n) => sum + n, 0);

  return (
    <View style={styles.page}>
      <View style={styles.yearHeader}>
        <View style={styles.yearNav}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous year"
            disabled={!canGoPrev}
            onPress={onPrevYear}
            hitSlop={8}
            style={styles.navBtn}
          >
            <ChevronLeft
              size={18}
              color={foreground}
              strokeWidth={2.5}
              opacity={canGoPrev ? 1 : 0.35}
            />
          </Pressable>
          <Text style={[styles.yearLabel, { color: foreground }]}>{year}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next year"
            disabled={!canGoNext}
            onPress={onNextYear}
            hitSlop={8}
            style={styles.navBtn}
          >
            <ChevronRight
              size={18}
              color={foreground}
              strokeWidth={2.5}
              opacity={canGoNext ? 1 : 0.35}
            />
          </Pressable>
        </View>
        <RNText
          style={[styles.yearRatio, { color: accent }]}
          allowFontScaling={false}
          numberOfLines={1}
        >
          {formatMetricPeriodPhrase(metric, yearTotal, 'Year')}
        </RNText>
      </View>
      <View style={styles.barsList}>
        {values.map((value, month) => {
          const isZero = value <= 0;
          const isSelected = selectedMonth === month;
          const widthPct = isZero
            ? BAR_MIN_WIDTH_PCT
            : Math.max(
                BAR_MIN_WIDTH_PCT,
                Math.round((value / maxValue) * 100),
              );
          const fillColor = isZero ? ZERO_BAR_COLOR : accent;
          const label = formatMetricCompact(metric, value);
          return (
            <Pressable
              key={`${year}-${month}`}
              style={[
                styles.barRow,
                isSelected ? { backgroundColor: soft } : null,
              ]}
              onPress={() => onSelectMonth(month)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${MONTH_LABELS[month]} ${year}, ${label}`}
            >
              <Text
                style={[
                  styles.monthLabel,
                  { color: isSelected ? accent : muted },
                ]}
              >
                {MONTH_LABELS[month]}
              </Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${widthPct}%`,
                      backgroundColor: fillColor,
                    },
                  ]}
                />
              </View>
              <RNText
                style={[
                  styles.amountLabel,
                  { color: isSelected ? accent : foreground },
                ]}
                allowFontScaling={false}
                numberOfLines={1}
              >
                {label}
              </RNText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * 12-month bars for one year, with prev/next arrows (no swipe).
 * Visible year follows `selectedMonthDate`.
 */
export function ActivityInsightYearBars({
  activity,
  moments,
  metric,
  accent,
  soft,
  muted,
  foreground,
  selectedMonthDate,
  onSelectMonthDate,
  onVisibleYearChange,
}: {
  activity: ActivityRow;
  moments: readonly MomentRow[];
  metric: InsightPeriodMetric;
  accent: string;
  soft: string;
  muted: string;
  foreground: string;
  selectedMonthDate?: Date | null;
  /** User tapped a month bar. */
  onSelectMonthDate?: (monthDate: Date) => void;
  /** User pressed year prev/next. */
  onVisibleYearChange?: (year: number) => void;
}) {
  const now = useMemo(() => new Date(), []);
  const currentYear = yearInAppTz(now);
  const historyEarliestDateKey = useAppStore(
    state => state.historyEarliestDateKey,
  );

  const earliestYear = useMemo(() => {
    const start = resolveInsightCalendarStartDate({
      moments,
      activityCreatedAt: activity.createdAt,
      historyEarliestDateKey,
      now,
    });
    return yearInAppTz(start);
  }, [activity.createdAt, historyEarliestDateKey, moments, now]);

  const year = useMemo(() => {
    const fromMonth =
      selectedMonthDate != null
        ? yearInAppTz(selectedMonthDate)
        : currentYear;
    return Math.min(currentYear, Math.max(earliestYear, fromMonth));
  }, [currentYear, earliestYear, selectedMonthDate]);

  const values = useMemo(
    () => metricValuesByMonth(moments, metric, year),
    [metric, moments, year],
  );

  const selectedMonth =
    selectedMonthDate != null && yearInAppTz(selectedMonthDate) === year
      ? new TZDate(selectedMonthDate, APP_TIMEZONE).getMonth()
      : null;

  const canGoPrev = year > earliestYear;
  const canGoNext = year < currentYear;

  const goPrev = useCallback(() => {
    if (!canGoPrev) {
      return;
    }
    onVisibleYearChange?.(year - 1);
  }, [canGoPrev, onVisibleYearChange, year]);

  const goNext = useCallback(() => {
    if (!canGoNext) {
      return;
    }
    onVisibleYearChange?.(year + 1);
  }, [canGoNext, onVisibleYearChange, year]);

  const handleSelectMonth = useCallback(
    (month: number) => {
      onSelectMonthDate?.(
        monthStartInAppTz(
          new TZDate(year, month, 1, 0, 0, 0, 0, APP_TIMEZONE),
        ),
      );
    },
    [onSelectMonthDate, year],
  );

  return (
    <View style={styles.wrap}>
      <YearBarsPage
        year={year}
        values={values}
        metric={metric}
        accent={accent}
        soft={soft}
        muted={muted}
        foreground={foreground}
        selectedMonth={selectedMonth}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        onPrevYear={goPrev}
        onNextYear={goNext}
        onSelectMonth={handleSelectMonth}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  page: {
    gap: 10,
  },
  yearHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  yearNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: -4,
  },
  navBtn: {
    padding: 2,
  },
  yearLabel: {
    fontSize: 15,
    fontWeight: '700',
    minWidth: 44,
    textAlign: 'center',
  },
  yearRatio: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  barsList: {
    gap: 4,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: ROW_HEIGHT,
    borderRadius: 8,
    paddingHorizontal: 4,
  },
  monthLabel: {
    width: 30,
    fontSize: 12,
    fontWeight: '700',
  },
  barTrack: {
    flex: 1,
    height: BAR_TRACK_HEIGHT,
    borderRadius: 5,
    overflow: 'hidden',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  amountLabel: {
    minWidth: 68,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
});
