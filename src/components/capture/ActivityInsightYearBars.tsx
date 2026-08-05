import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import { startOfMonth } from 'date-fns';
import { TZDate } from '@date-fns/tz';

import { Text } from '@/components/ui/text';
import type { MomentRow } from '@/db/repositories/moments';
import { resolveInsightCalendarStartDate } from '@/lib/activities/activity-insights';
import {
  formatMetricCompact,
  metricValuesByMonth,
  type InsightPeriodMetric,
} from '@/lib/activities/insight-period-metric';
import { APP_TIMEZONE } from '@/lib/timezone';
import { useAppStore } from '@/stores/app-store';

const MONTH_LABELS = [
  'J',
  'F',
  'M',
  'A',
  'M',
  'J',
  'J',
  'A',
  'S',
  'O',
  'N',
  'D',
] as const;

const MONTH_A11Y = [
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

const BAR_MAX_HEIGHT = 96;
const BAR_MIN_HEIGHT = 4;
const VALUE_SLOT_VERTICAL = 36;
const VALUE_SLOT_HORIZONTAL = 16;
const ZERO_BAR_COLOR = '#D1D5DB';

/** Integer digit count of |value| (ignores fraction). */
function integerDigitCount(value: number): number {
  const n = Math.trunc(Math.abs(value));
  if (n < 10) {
    return 1;
  }
  return String(n).length;
}

/**
 * Money amounts always vertical. Number fields stay horizontal when every
 * month value has fewer than 3 digits; otherwise vertical. Other metrics
 * (logs / duration) follow the same digit rule as numbers.
 */
function preferVerticalValueLabels(
  metric: InsightPeriodMetric,
  values: readonly number[],
): boolean {
  if (metric.kind === 'money') {
    return true;
  }
  return values.some(value => integerDigitCount(value) >= 3);
}

function yearInAppTz(date: Date): number {
  return new TZDate(date, APP_TIMEZONE).getFullYear();
}

function monthStartInAppTz(date: Date): Date {
  return startOfMonth(new TZDate(date, APP_TIMEZONE));
}

function yearsFromThrough(from: number, through: number): number[] {
  const out: number[] = [];
  for (let y = from; y <= through; y++) {
    out.push(y);
  }
  return out.length > 0 ? out : [through];
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
  onSelectMonth,
  onPressYearTotal,
}: {
  year: number;
  values: number[];
  metric: InsightPeriodMetric;
  accent: string;
  soft: string;
  muted: string;
  foreground: string;
  selectedMonth: number | null;
  onSelectMonth: (month: number) => void;
  onPressYearTotal?: () => void;
}) {
  const maxValue = Math.max(1, ...values);
  const yearTotal = values.reduce((sum, n) => sum + n, 0);
  const verticalLabels = preferVerticalValueLabels(metric, values);
  const valueSlotHeight = verticalLabels
    ? VALUE_SLOT_VERTICAL
    : VALUE_SLOT_HORIZONTAL;
  const yearTotalLabel = formatMetricCompact(metric, yearTotal);

  const yearTotalNode = (
    <RNText
      style={[styles.yearRatio, { color: accent }]}
      allowFontScaling={false}
      numberOfLines={1}
    >
      {yearTotalLabel}
    </RNText>
  );

  return (
    <View style={styles.page}>
      <View style={styles.yearHeader}>
        <Text style={[styles.yearLabel, { color: foreground }]}>{year}</Text>
        {onPressYearTotal != null ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={yearTotalLabel}
            onPress={onPressYearTotal}
            hitSlop={6}
            style={({ pressed }) => [
              styles.yearTotalHit,
              pressed ? { opacity: 0.72 } : null,
            ]}
          >
            {yearTotalNode}
          </Pressable>
        ) : (
          yearTotalNode
        )}
      </View>
      <View style={styles.barsRow}>
        {values.map((value, month) => {
          const isZero = value <= 0;
          const isSelected = selectedMonth === month;
          const height = isZero
            ? BAR_MIN_HEIGHT
            : Math.max(
                BAR_MIN_HEIGHT,
                Math.round((value / maxValue) * BAR_MAX_HEIGHT),
              );
          const fillColor = isZero ? ZERO_BAR_COLOR : accent;
          const label = formatMetricCompact(metric, value);
          return (
            <Pressable
              key={`${year}-${month}`}
              style={[
                styles.barCol,
                isSelected ? { backgroundColor: soft } : null,
              ]}
              onPress={() => onSelectMonth(month)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${MONTH_A11Y[month]} ${year}, ${label}`}
            >
              <View style={[styles.valueSlot, { height: valueSlotHeight }]}>
                <RNText
                  style={[
                    verticalLabels
                      ? styles.valueAboveVertical
                      : styles.valueAboveHorizontal,
                    { color: isSelected ? accent : muted },
                  ]}
                  allowFontScaling={false}
                  numberOfLines={1}
                >
                  {label}
                </RNText>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      height,
                      backgroundColor: fillColor,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.monthLabel,
                  { color: isSelected ? accent : muted },
                ]}
              >
                {MONTH_LABELS[month]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Swipeable vertical 12-month bars. Years from first data through current.
 * Horizontal bounce stays enabled even with a single year (no empty prior
 * year pages). Amount labels are always vertical; number labels are horizontal
 * when every month value has fewer than 3 digits.
 */
export function ActivityInsightYearBars({
  moments,
  metric,
  createdAt,
  accent,
  soft,
  muted,
  foreground,
  selectedMonthDate,
  onSelectMonthDate,
  onVisibleYearChange,
  onPressYearTotal,
}: {
  moments: readonly MomentRow[];
  metric: InsightPeriodMetric;
  /** Fallback earliest bound when there are no moments yet. */
  createdAt: Date;
  accent: string;
  soft: string;
  muted: string;
  foreground: string;
  selectedMonthDate?: Date | null;
  /** User tapped a month bar. */
  onSelectMonthDate?: (monthDate: Date) => void;
  /** User finished a year swipe. */
  onVisibleYearChange?: (year: number) => void;
  /** Opens period drill-down for the visible year’s total. */
  onPressYearTotal?: (year: number) => void;
}) {
  const pagerRef = useRef<ScrollView>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const suppressReportRef = useRef(false);
  const pendingYearRef = useRef<number | null>(null);
  const lastReportedYearRef = useRef<number | null>(null);
  const onVisibleYearChangeRef = useRef(onVisibleYearChange);
  onVisibleYearChangeRef.current = onVisibleYearChange;

  const now = useMemo(() => new Date(), []);
  const currentYear = yearInAppTz(now);
  const historyEarliestDateKey = useAppStore(
    state => state.historyEarliestDateKey,
  );

  const earliestYear = useMemo(() => {
    const start = resolveInsightCalendarStartDate({
      moments,
      activityCreatedAt: createdAt,
      historyEarliestDateKey,
      now,
    });
    return yearInAppTz(start);
  }, [createdAt, historyEarliestDateKey, moments, now]);

  const years = useMemo(
    () => yearsFromThrough(earliestYear, currentYear),
    [currentYear, earliestYear],
  );

  const selectedYear = useMemo(() => {
    const fromMonth =
      selectedMonthDate != null
        ? yearInAppTz(selectedMonthDate)
        : currentYear;
    return Math.min(currentYear, Math.max(earliestYear, fromMonth));
  }, [currentYear, earliestYear, selectedMonthDate]);

  const pages = useMemo(
    () =>
      years.map(year => ({
        year,
        values: metricValuesByMonth(moments, metric, year),
      })),
    [metric, moments, years],
  );

  const selectedMonth =
    selectedMonthDate != null && yearInAppTz(selectedMonthDate) === selectedYear
      ? new TZDate(selectedMonthDate, APP_TIMEZONE).getMonth()
      : null;

  useEffect(() => {
    if (lastReportedYearRef.current === selectedYear) {
      return;
    }
    pendingYearRef.current = selectedYear;
    suppressReportRef.current = true;
  }, [selectedYear]);

  useLayoutEffect(() => {
    const target = pendingYearRef.current;
    if (target == null || pageWidth <= 0) {
      return;
    }
    const index = years.indexOf(target);
    if (index < 0) {
      suppressReportRef.current = false;
      pendingYearRef.current = null;
      return;
    }
    pagerRef.current?.scrollTo({
      x: index * pageWidth,
      animated: false,
    });
    lastReportedYearRef.current = target;
    pendingYearRef.current = null;
    const t = setTimeout(() => {
      suppressReportRef.current = false;
    }, 400);
    return () => clearTimeout(t);
  }, [pageWidth, selectedYear, years]);

  const scrollToSelectedOrCurrent = useCallback(
    (width: number) => {
      if (width <= 0) {
        return;
      }
      const index = years.indexOf(selectedYear);
      const target = index >= 0 ? index : years.length - 1;
      if (target < 0) {
        return;
      }
      suppressReportRef.current = true;
      lastReportedYearRef.current = years[target] ?? currentYear;
      requestAnimationFrame(() => {
        pagerRef.current?.scrollTo({
          x: target * width,
          animated: false,
        });
        setTimeout(() => {
          suppressReportRef.current = false;
        }, 400);
      });
    },
    [currentYear, selectedYear, years],
  );

  const settleYear = useCallback(
    (index: number) => {
      if (suppressReportRef.current) {
        return;
      }
      const clamped = Math.max(0, Math.min(index, years.length - 1));
      const year = years[clamped];
      if (year == null) {
        return;
      }
      // Already aligned with parent (e.g. bar tap set the year) — skip so we
      // don't overwrite the tapped month via sameMonthInYear.
      if (lastReportedYearRef.current === year || selectedYear === year) {
        lastReportedYearRef.current = year;
        return;
      }
      lastReportedYearRef.current = year;
      onVisibleYearChangeRef.current?.(year);
    },
    [selectedYear, years],
  );

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pageWidth <= 0 || suppressReportRef.current) {
        return;
      }
      const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
      settleYear(index);
    },
    [pageWidth, settleYear],
  );

  const handleSelectMonth = useCallback(
    (year: number, month: number) => {
      onSelectMonthDate?.(
        monthStartInAppTz(
          new TZDate(year, month, 1, 0, 0, 0, 0, APP_TIMEZONE),
        ),
      );
    },
    [onSelectMonthDate],
  );

  return (
    <View style={styles.wrap}>
      <View
        style={styles.pagerHost}
        onLayout={event => {
          const width = Math.round(event.nativeEvent.layout.width);
          if (width <= 0 || width === pageWidth) {
            return;
          }
          setPageWidth(width);
          scrollToSelectedOrCurrent(width);
        }}
      >
        {pageWidth > 0 ? (
          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            scrollEnabled
            bounces
            alwaysBounceHorizontal
            nestedScrollEnabled
            directionalLockEnabled
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            style={{ width: pageWidth }}
            onMomentumScrollEnd={onMomentumScrollEnd}
          >
            {pages.map(page => (
              <View
                key={page.year}
                style={[styles.pageWrap, { width: pageWidth }]}
              >
                <YearBarsPage
                  year={page.year}
                  values={page.values}
                  metric={metric}
                  accent={accent}
                  soft={soft}
                  muted={muted}
                  foreground={foreground}
                  selectedMonth={
                    page.year === selectedYear ? selectedMonth : null
                  }
                  onSelectMonth={month => handleSelectMonth(page.year, month)}
                  onPressYearTotal={
                    onPressYearTotal != null
                      ? () => onPressYearTotal(page.year)
                      : undefined
                  }
                />
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
    gap: 8,
  },
  pagerHost: {
    width: '100%',
    overflow: 'hidden',
  },
  pageWrap: {
    paddingTop: 2,
  },
  placeholder: {
    height: VALUE_SLOT_VERTICAL + BAR_MAX_HEIGHT + 40,
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
  yearLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  yearRatio: {
    flexShrink: 1,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'right',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  yearTotalHit: {
    flexShrink: 1,
    maxWidth: '70%',
    paddingVertical: 2,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 8,
    paddingTop: 4,
    paddingBottom: 4,
    gap: 4,
  },
  valueSlot: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  valueAboveVertical: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    width: VALUE_SLOT_VERTICAL + 8,
    transform: [{ rotate: '-90deg' }],
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  valueAboveHorizontal: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  barTrack: {
    width: '70%',
    height: BAR_MAX_HEIGHT,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barFill: {
    width: '100%',
    borderRadius: 4,
    minHeight: BAR_MIN_HEIGHT,
  },
  monthLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
});
