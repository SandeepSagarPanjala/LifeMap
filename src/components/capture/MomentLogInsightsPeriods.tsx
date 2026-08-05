import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  endOfDay,
  endOfMonth,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfYear,
} from 'date-fns';
import { TZDate } from '@date-fns/tz';

import { ActivityInsightMonthCalendar } from '@/components/capture/ActivityInsightMonthCalendar';
import {
  ActivityInsightYearBars,
  sameMonthInYear,
} from '@/components/capture/ActivityInsightYearBars';
import {
  ActivityInsightWeekPager,
  preferredWeekForMonth,
  weekBoundsForAnchor,
  weekStartInAppTz,
} from '@/components/capture/ActivityInsightWeekPager';
import { Text } from '@/components/ui/text';
import type { MomentRow } from '@/db/repositories/moments';
import { resolveInsightCalendarStartDate } from '@/lib/activities/activity-insights';
import {
  formatMetricCompact,
  sumMetricInMonth,
  sumMetricInRange,
  type InsightPeriodMetric,
} from '@/lib/activities/insight-period-metric';
import { parseDateKey } from '@/lib/day-utils';
import { APP_TIMEZONE } from '@/lib/timezone';
import type { RootStackParamList } from '@/navigation/types';
import { useAppStore } from '@/stores/app-store';

const LOGS_METRIC: InsightPeriodMetric = { id: 'logs', kind: 'logs' };

export type MomentInsightPeriodSource =
  RootStackParamList['MomentInsightPeriodDetail']['momentKind'];

/**
 * Shared today / week / month / year log insights block used by mood, diary,
 * voice, and camera (same pattern as activity insights, logs-only).
 * Period totals open a drill-down list when `momentKind` is set.
 */
export function MomentLogInsightsPeriods({
  moments,
  accent,
  soft,
  muted,
  foreground,
  momentKind,
}: {
  moments: readonly MomentRow[];
  accent: string;
  soft: string;
  muted: string;
  foreground: string;
  /** When set, period totals navigate to the moment drill-down. */
  momentKind?: MomentInsightPeriodSource;
}) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const historyEarliestDateKey = useAppStore(
    state => state.historyEarliestDateKey,
  );

  const [visibleMonthDate, setVisibleMonthDate] = useState<Date>(
    () => new Date(startOfMonth(new TZDate(new Date(), APP_TIMEZONE))),
  );
  const visibleMonthDateRef = useRef(visibleMonthDate);
  visibleMonthDateRef.current = visibleMonthDate;
  const [weekAnchorDate, setWeekAnchorDate] = useState<Date>(() =>
    preferredWeekForMonth(
      new Date(startOfMonth(new TZDate(new Date(), APP_TIMEZONE))),
    ),
  );

  const calendarBounds = useMemo(() => {
    const now = new Date();
    const createdAt =
      moments.length > 0
        ? moments.reduce(
            (earliest, moment) =>
              moment.timestamp.getTime() < earliest.getTime()
                ? moment.timestamp
                : earliest,
            moments[0]!.timestamp,
          )
        : now;
    const earliestDate = resolveInsightCalendarStartDate({
      moments,
      activityCreatedAt: createdAt,
      historyEarliestDateKey,
      now,
    });
    const earliestMonth = startOfMonth(new TZDate(earliestDate, APP_TIMEZONE));
    const currentMonth = startOfMonth(new TZDate(now, APP_TIMEZONE));
    return { createdAt, earliestDate, earliestMonth, currentMonth };
  }, [historyEarliestDateKey, moments]);

  const monthTotalLabel = useMemo(() => {
    const value = sumMetricInMonth(moments, LOGS_METRIC, visibleMonthDate);
    return formatMetricCompact(LOGS_METRIC, value);
  }, [moments, visibleMonthDate]);

  const todayStats = useMemo(() => {
    const today = startOfDay(new TZDate(new Date(), APP_TIMEZONE));
    const value = sumMetricInRange(
      moments,
      LOGS_METRIC,
      today,
      endOfDay(today),
    );
    return {
      valueLabel: formatMetricCompact(LOGS_METRIC, value),
      dateLabel: today.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
      start: today,
      end: endOfDay(today),
    };
  }, [moments]);

  const openPeriodDetail = useCallback(
    (input: {
      period: 'today' | 'week' | 'month' | 'year';
      periodTitle: string;
      start: Date;
      end: Date;
    }) => {
      if (momentKind == null) {
        return;
      }
      navigation.navigate('MomentInsightPeriodDetail', {
        momentKind,
        period: input.period,
        periodTitle: input.periodTitle,
        startMs: input.start.getTime(),
        endMs: input.end.getTime(),
      });
    },
    [momentKind, navigation],
  );

  const handlePressToday = useCallback(() => {
    openPeriodDetail({
      period: 'today',
      periodTitle: 'Today',
      start: todayStats.start,
      end: todayStats.end,
    });
  }, [openPeriodDetail, todayStats.end, todayStats.start]);

  const handlePressWeek = useCallback(() => {
    const { start, end } = weekBoundsForAnchor(weekAnchorDate);
    openPeriodDetail({
      period: 'week',
      periodTitle: 'Week',
      start,
      end,
    });
  }, [openPeriodDetail, weekAnchorDate]);

  const handlePressMonth = useCallback(() => {
    const monthStart = startOfMonth(
      new TZDate(visibleMonthDate, APP_TIMEZONE),
    );
    openPeriodDetail({
      period: 'month',
      periodTitle: monthStart.toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      }),
      start: monthStart,
      end: endOfMonth(monthStart),
    });
  }, [openPeriodDetail, visibleMonthDate]);

  const handlePressYear = useCallback(
    (year: number) => {
      const yearStart = startOfYear(
        new TZDate(year, 0, 1, 0, 0, 0, 0, APP_TIMEZONE),
      );
      openPeriodDetail({
        period: 'year',
        periodTitle: String(year),
        start: yearStart,
        end: endOfYear(yearStart),
      });
    },
    [openPeriodDetail],
  );

  const skipNextMonthToWeekSyncRef = useRef(false);
  const monthToWeekSyncReadyRef = useRef(false);

  useEffect(() => {
    if (!monthToWeekSyncReadyRef.current) {
      monthToWeekSyncReadyRef.current = true;
      return;
    }
    if (skipNextMonthToWeekSyncRef.current) {
      skipNextMonthToWeekSyncRef.current = false;
      return;
    }
    const nextWeek = preferredWeekForMonth(visibleMonthDate);
    setWeekAnchorDate(prev =>
      weekStartInAppTz(prev).getTime() === nextWeek.getTime()
        ? prev
        : nextWeek,
    );
  }, [visibleMonthDate]);

  const setMonthAndWeek = useCallback((monthDate: Date) => {
    const nextMonth = new Date(
      startOfMonth(new TZDate(monthDate, APP_TIMEZONE)).getTime(),
    );
    setVisibleMonthDate(prev =>
      prev.getTime() === nextMonth.getTime() ? prev : nextMonth,
    );
  }, []);

  const handleVisibleMonthChange = useCallback(
    (monthDate: Date) => {
      setMonthAndWeek(monthDate);
    },
    [setMonthAndWeek],
  );

  const handleYearBarMonthSelect = useCallback(
    (monthDate: Date) => {
      const year = new TZDate(monthDate, APP_TIMEZONE).getFullYear();
      setMonthAndWeek(
        sameMonthInYear(
          year,
          monthDate,
          calendarBounds.earliestMonth,
          calendarBounds.currentMonth,
        ),
      );
    },
    [
      calendarBounds.currentMonth,
      calendarBounds.earliestMonth,
      setMonthAndWeek,
    ],
  );

  const handleYearBarsYearChange = useCallback(
    (year: number) => {
      const current = visibleMonthDateRef.current;
      if (new TZDate(current, APP_TIMEZONE).getFullYear() === year) {
        return;
      }
      setMonthAndWeek(
        sameMonthInYear(
          year,
          current,
          calendarBounds.earliestMonth,
          calendarBounds.currentMonth,
        ),
      );
    },
    [
      calendarBounds.currentMonth,
      calendarBounds.earliestMonth,
      setMonthAndWeek,
    ],
  );

  const handleCalendarDayPress = useCallback((dateKey: string) => {
    const day = new Date(parseDateKey(dateKey));
    const nextWeek = weekStartInAppTz(day);
    skipNextMonthToWeekSyncRef.current = true;
    setWeekAnchorDate(prev =>
      weekStartInAppTz(prev).getTime() === nextWeek.getTime()
        ? prev
        : nextWeek,
    );
  }, []);

  const valueColor = momentKind != null ? accent : foreground;

  return (
    <View style={styles.root}>
      <View style={styles.periodBlock}>
        <View style={styles.periodRow}>
          <View style={styles.periodCell}>
            <View style={styles.periodLabelRow}>
              <Text style={[styles.periodLabel, { color: muted }]}>Today</Text>
              <Text
                style={[styles.periodRange, { color: muted }]}
                numberOfLines={1}
              >
                {todayStats.dateLabel}
              </Text>
            </View>
            {momentKind != null ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Today ${todayStats.valueLabel}`}
                onPress={handlePressToday}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.periodValueHit,
                  pressed ? { opacity: 0.72 } : null,
                ]}
              >
                <RNText
                  style={[styles.periodValue, { color: valueColor }]}
                  allowFontScaling={false}
                  numberOfLines={1}
                >
                  {todayStats.valueLabel}
                </RNText>
              </Pressable>
            ) : (
              <RNText
                style={[styles.periodValue, { color: valueColor }]}
                allowFontScaling={false}
                numberOfLines={1}
              >
                {todayStats.valueLabel}
              </RNText>
            )}
          </View>
          <ActivityInsightWeekPager
            moments={moments}
            metric={LOGS_METRIC}
            accent={accent}
            muted={muted}
            foreground={foreground}
            earliestDate={calendarBounds.earliestDate}
            weekAnchorDate={weekAnchorDate}
            onPressValue={
              momentKind != null ? handlePressWeek : undefined
            }
          />
        </View>
      </View>
      <ActivityInsightMonthCalendar
        moments={moments}
        intent="track"
        createdAt={calendarBounds.createdAt}
        monthTotalLabel={monthTotalLabel}
        accent={accent}
        selectedMonthDate={visibleMonthDate}
        onVisibleMonthChange={handleVisibleMonthChange}
        onDayPress={handleCalendarDayPress}
        onPressMonthTotal={
          momentKind != null ? handlePressMonth : undefined
        }
      />
      <ActivityInsightYearBars
        moments={moments}
        metric={LOGS_METRIC}
        createdAt={calendarBounds.createdAt}
        accent={accent}
        soft={soft}
        muted={muted}
        foreground={foreground}
        selectedMonthDate={visibleMonthDate}
        onSelectMonthDate={handleYearBarMonthSelect}
        onVisibleYearChange={handleYearBarsYearChange}
        onPressYearTotal={
          momentKind != null ? handlePressYear : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 0,
  },
  periodBlock: {
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  periodRow: {
    flexDirection: 'row',
    gap: 16,
  },
  periodCell: {
    flex: 1,
    gap: 2,
  },
  periodLabelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    flexWrap: 'wrap',
  },
  periodLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  periodRange: {
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  periodValueHit: {
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingVertical: 2,
  },
  periodValue: {
    fontSize: 20,
    fontWeight: '800',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
});
