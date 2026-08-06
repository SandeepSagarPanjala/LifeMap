import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
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
import { ActivityInsightShopSpendWidget } from '@/components/capture/ActivityInsightShopSpendWidget';
import { ActivityInsightTimingWidget } from '@/components/capture/ActivityInsightTimingWidget';
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
import { AdaptiveGlassSurface } from '@/components/glass/AdaptiveGlassSurface';
import { Text } from '@/components/ui/text';
import type { ActivityRow } from '@/db/repositories/activities';
import type { MomentRow } from '@/db/repositories/moments';
import { useThemeColors } from '@/hooks/use-theme-colors';
import {
  activityExperienceIntentLabel,
} from '@/lib/activities/activity-intent';
import type { ActivityIntent } from '@/lib/activities/activity-intent';
import {
  resolveInsightCalendarStartDate,
} from '@/lib/activities/activity-insights';
import { activityReminderSummary } from '@/lib/activities/activity-tile-style';
import {
  resolveAmountFieldId,
  summarizeSpendByShop,
  type ShopSpendRow,
} from '@/lib/activities/activity-insight-shop-spend';
import {
  defaultInsightPeriodMetric,
  formatMetricCompact,
  insightPeriodMetricOptions,
  sumMetricInMonth,
  sumMetricInRange,
  type InsightPeriodMetric,
} from '@/lib/activities/insight-period-metric';
import { formatRelativeLoggedAt } from '@/lib/activities/insight-providers';
import {
  summarizeReminderTiming,
  type ReminderTimingKind,
} from '@/lib/activities/activity-reminder-timing';
import {
  MAP_MOMENTS_BAR_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
} from '@/lib/app-constants';
import { parseDateKey } from '@/lib/day-utils';
import { reminderConfigFromRow } from '@/lib/notifications/activity-reminders';
import { APP_TIMEZONE } from '@/lib/timezone';
import type { RootStackParamList } from '@/navigation/types';
import { useAppStore } from '@/stores/app-store';

/** Compact glass metric bar (smaller than You tab bar). */
const METRIC_BAR_HEIGHT = 36;
const METRIC_H_PADDING = 5;
const METRIC_ACTIVE_PILL_HEIGHT = 28;
const METRIC_BAR_RADIUS = 12;
const METRIC_PILL_RADIUS = 8;
const METRIC_INDICATOR_SPRING = {
  damping: 17,
  stiffness: 190,
  mass: 0.8,
  reduceMotion: ReduceMotion.System,
};

function metricTabWidth(optionCount: number): number {
  if (optionCount <= 2) {
    return 100;
  }
  if (optionCount === 3) {
    return 80;
  }
  return 64;
}

const INTENT_THEME: Record<
  ActivityIntent,
  { tint: string; strong: string; soft: string; chipBg: string }
> = {
  more: {
    tint: '#ECFDF5',
    strong: '#059669',
    soft: '#A7F3D0',
    chipBg: '#D1FAE5',
  },
  less: {
    tint: '#FFF7ED',
    strong: '#EA580C',
    soft: '#FED7AA',
    chipBg: '#FFEDD5',
  },
  track: {
    tint: '#EFF6FF',
    strong: '#2563EB',
    soft: '#BFDBFE',
    chipBg: '#DBEAFE',
  },
};

function metricToRouteParam(
  metric: InsightPeriodMetric,
): RootStackParamList['ActivityInsightPeriodDetail']['metric'] {
  if (metric.kind === 'logs') {
    return { kind: 'logs' };
  }
  return {
    kind: metric.kind,
    fieldId: metric.fieldId,
    label: metric.label,
  };
}

function SectionCard({
  title,
  headerRight,
  children,
  tint,
  accent,
}: {
  title?: string;
  headerRight?: ReactNode;
  children: ReactNode;
  tint: string;
  accent: string;
}) {
  return (
    <Animated.View
      layout={LinearTransition.duration(220)}
      style={[styles.section, { backgroundColor: tint }]}
    >
      {title != null || headerRight != null ? (
        <View style={styles.sectionHeader}>
          {title != null ? (
            <Text style={[styles.sectionTitle, { color: accent }]}>
              {title}
            </Text>
          ) : (
            <View />
          )}
          {headerRight}
        </View>
      ) : null}
      {children}
    </Animated.View>
  );
}

function MetricSelectorBar({
  options,
  value,
  onChange,
  accent,
  muted,
}: {
  options: InsightPeriodMetric[];
  value: InsightPeriodMetric;
  onChange: (metric: InsightPeriodMetric) => void;
  accent: string;
  muted: string;
}) {
  const colorScheme = useColorScheme();
  const activePillBg =
    colorScheme === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)';
  const tabWidth = metricTabWidth(options.length);
  const pillWidth = tabWidth - 14;
  const selectedIndex = Math.max(
    0,
    options.findIndex(option => option.id === value.id),
  );
  const indicatorX = useSharedValue(selectedIndex * tabWidth);
  const indicatorOpacity = useSharedValue(1);
  const indicatorScaleX = useSharedValue(1);
  const indicatorScaleY = useSharedValue(1);
  const parentScale = useSharedValue(1);

  useEffect(() => {
    indicatorX.value = withSpring(
      selectedIndex * tabWidth,
      METRIC_INDICATOR_SPRING,
    );
    indicatorOpacity.value = withSequence(
      withTiming(0.38, {
        duration: 80,
        easing: Easing.out(Easing.quad),
        reduceMotion: ReduceMotion.System,
      }),
      withTiming(0.38, {
        duration: 35,
        reduceMotion: ReduceMotion.System,
      }),
      withTiming(1, {
        duration: 110,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      }),
    );
    indicatorScaleX.value = withSequence(
      withTiming(1.22, {
        duration: 120,
        easing: Easing.out(Easing.quad),
        reduceMotion: ReduceMotion.System,
      }),
      withTiming(1.22, {
        duration: 35,
        reduceMotion: ReduceMotion.System,
      }),
      withSpring(1, METRIC_INDICATOR_SPRING),
    );
    indicatorScaleY.value = withSequence(
      withTiming(1.18, {
        duration: 120,
        easing: Easing.out(Easing.quad),
        reduceMotion: ReduceMotion.System,
      }),
      withTiming(1.18, {
        duration: 35,
        reduceMotion: ReduceMotion.System,
      }),
      withSpring(1, METRIC_INDICATOR_SPRING),
    );
    parentScale.value = withSequence(
      withTiming(1.035, {
        duration: 105,
        easing: Easing.out(Easing.quad),
        reduceMotion: ReduceMotion.System,
      }),
      withSpring(1, METRIC_INDICATOR_SPRING),
    );
  }, [
    indicatorOpacity,
    indicatorScaleX,
    indicatorScaleY,
    indicatorX,
    parentScale,
    selectedIndex,
    tabWidth,
  ]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: indicatorOpacity.value,
    transform: [
      { translateX: indicatorX.value },
      { scaleX: indicatorScaleX.value },
      { scaleY: indicatorScaleY.value },
    ],
  }));

  const parentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: parentScale.value }],
  }));

  if (options.length <= 1) {
    return null;
  }

  return (
    <Animated.View style={[styles.metricShadowWrap, parentStyle]}>
      <AdaptiveGlassSurface style={styles.metricSelectorGlass}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.metricActivePill,
            {
              backgroundColor: activePillBg,
              width: pillWidth,
              left: METRIC_H_PADDING + (tabWidth - pillWidth) / 2,
            },
            indicatorStyle,
          ]}
        />
        {options.map(option => {
          const active = option.id === value.id;
          const label = option.kind === 'logs' ? 'Logs' : option.label;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}
              onPress={() => onChange(option)}
              style={[styles.metricTab, { width: tabWidth }]}
            >
              <Text
                style={[
                  styles.metricTabLabel,
                  {
                    color: active ? accent : muted,
                    fontWeight: active ? '800' : '600',
                  },
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </AdaptiveGlassSurface>
    </Animated.View>
  );
}

/**
 * Activity insights — calendar + year bars. Period totals open a drill-down
 * list of logs for that range.
 */
export function ActivityInsightDetailContent({
  activity,
  moments,
  contentBottomInset,
}: {
  activity: ActivityRow;
  moments: readonly MomentRow[];
  /** Overrides default padding reserved for the floating close button. */
  contentBottomInset?: number;
}) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const theme = INTENT_THEME[activity.intent];
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
  const metricOptions = useMemo(
    () => insightPeriodMetricOptions(activity.fields),
    [activity.fields],
  );

  const [selectedMetric, setSelectedMetric] = useState<InsightPeriodMetric>(
    () => defaultInsightPeriodMetric(metricOptions),
  );

  useEffect(() => {
    if (metricOptions.some(option => option.id === selectedMetric.id)) {
      return;
    }
    setSelectedMetric(defaultInsightPeriodMetric(metricOptions));
  }, [metricOptions, selectedMetric.id]);

  const calendarBounds = useMemo(() => {
    const now = new Date();
    const earliestDate = resolveInsightCalendarStartDate({
      moments,
      activityCreatedAt: activity.createdAt,
      historyEarliestDateKey,
      now,
    });
    const earliestMonth = startOfMonth(new TZDate(earliestDate, APP_TIMEZONE));
    const currentMonth = startOfMonth(new TZDate(now, APP_TIMEZONE));
    return { earliestDate, earliestMonth, currentMonth };
  }, [activity.createdAt, historyEarliestDateKey, moments]);

  const lastLoggedLabel = useMemo(() => {
    let latest: Date | null = null;
    for (const moment of moments) {
      if (latest == null || moment.timestamp.getTime() > latest.getTime()) {
        latest = moment.timestamp;
      }
    }
    return formatRelativeLoggedAt(latest, new Date());
  }, [moments]);

  const notifySummary = useMemo(
    () => activityReminderSummary(activity),
    [activity],
  );

  const shopSpendRows = useMemo(
    () => summarizeSpendByShop(moments, activity.fields),
    [activity.fields, moments],
  );

  const monthTotalLabel = useMemo(() => {
    const value = sumMetricInMonth(moments, selectedMetric, visibleMonthDate);
    return formatMetricCompact(selectedMetric, value);
  }, [moments, selectedMetric, visibleMonthDate]);

  const todayStats = useMemo(() => {
    const today = startOfDay(new TZDate(new Date(), APP_TIMEZONE));
    const value = sumMetricInRange(
      moments,
      selectedMetric,
      today,
      endOfDay(today),
    );
    return {
      valueLabel: formatMetricCompact(selectedMetric, value),
      dateLabel: today.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
      start: today,
      end: endOfDay(today),
    };
  }, [moments, selectedMetric]);

  const reminderTimingYear = useMemo(
    () => new TZDate(visibleMonthDate, APP_TIMEZONE).getFullYear(),
    [visibleMonthDate],
  );

  const reminderTiming = useMemo(() => {
    if (!activity.reminderEnabled) {
      return null;
    }
    return summarizeReminderTiming(
      moments,
      reminderConfigFromRow(activity),
      { year: reminderTimingYear },
    );
  }, [activity, moments, reminderTimingYear]);

  const openPeriodDetail = useCallback(
    (input: {
      period: 'today' | 'week' | 'month' | 'year';
      periodTitle: string;
      start: Date;
      end: Date;
    }) => {
      navigation.navigate('ActivityInsightPeriodDetail', {
        activityId: activity.id,
        period: input.period,
        periodTitle: input.periodTitle,
        startMs: input.start.getTime(),
        endMs: input.end.getTime(),
        metric: metricToRouteParam(selectedMetric),
      });
    },
    [activity.id, navigation, selectedMetric],
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

  const handlePressTiming = useCallback(
    (kind: ReminderTimingKind) => {
      const yearStart = startOfYear(
        new TZDate(reminderTimingYear, 0, 1, 0, 0, 0, 0, APP_TIMEZONE),
      );
      navigation.navigate('ActivityInsightPeriodDetail', {
        activityId: activity.id,
        period: 'year',
        periodTitle: String(reminderTimingYear),
        startMs: yearStart.getTime(),
        endMs: endOfYear(yearStart).getTime(),
        metric: { kind: 'logs' },
        timingKind: kind,
      });
    },
    [activity.id, navigation, reminderTimingYear],
  );

  const handlePressShopSpend = useCallback(
    (row: ShopSpendRow) => {
      const amountFieldId = resolveAmountFieldId(activity.fields);
      const moneyMetric =
        amountFieldId != null
          ? ({
              kind: 'money' as const,
              fieldId: amountFieldId,
              label: 'Amount',
            } as const)
          : ({ kind: 'logs' as const } as const);
      let earliest = Number.POSITIVE_INFINITY;
      let latest = 0;
      for (const moment of moments) {
        const t = moment.timestamp.getTime();
        if (t < earliest) {
          earliest = t;
        }
        if (t > latest) {
          latest = t;
        }
      }
      const startMs =
        Number.isFinite(earliest) && earliest !== Number.POSITIVE_INFINITY
          ? earliest
          : Date.now();
      const endMs = latest > 0 ? latest : Date.now();
      navigation.navigate('ActivityInsightPeriodDetail', {
        activityId: activity.id,
        period: 'year',
        periodTitle: row.shopName,
        startMs,
        endMs,
        metric: moneyMetric,
        shopNameFilter: row.shopKey,
      });
    },
    [activity.fields, activity.id, moments, navigation],
  );

  const skipNextMonthToWeekSyncRef = useRef(false);
  const monthToWeekSyncReadyRef = useRef(false);

  // Whenever the visible month changes (except when a week arrow caused it),
  // snap the week to that month's first week.
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

  /** User swiped month calendar / tapped year bar. */
  const handleVisibleMonthChange = useCallback(
    (monthDate: Date) => {
      setMonthAndWeek(monthDate);
    },
    [setMonthAndWeek],
  );

  /** User tapped a year-chart month bar. */
  const handleYearBarMonthSelect = useCallback(
    (monthDate: Date) => {
      const year = new TZDate(monthDate, APP_TIMEZONE).getFullYear();
      // Clamp to months the calendar pager actually contains (no future months).
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

  /** User swiped year chart → same month in that year. */
  const handleYearBarsYearChange = useCallback(
    (year: number) => {
      const current = visibleMonthDateRef.current;
      // Bar tap already moved us into this year — don't clobber that month when
      // the year pager's momentum settle fires right after the press.
      if (new TZDate(current, APP_TIMEZONE).getFullYear() === year) {
        return;
      }
      const monthDate = sameMonthInYear(
        year,
        current,
        calendarBounds.earliestMonth,
        calendarBounds.currentMonth,
      );
      setMonthAndWeek(monthDate);
    },
    [
      calendarBounds.currentMonth,
      calendarBounds.earliestMonth,
      setMonthAndWeek,
    ],
  );

  /** User tapped a calendar day → show that day's week. */
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

  const bottomPad =
    contentBottomInset ??
    MAP_MOMENTS_BAR_HEIGHT + Math.max(insets.bottom, MAP_MOMENTS_BAR_GAP) + 16;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: bottomPad,
          maxWidth: windowWidth,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.hero, { backgroundColor: theme.tint }]}>
        <RNText style={styles.heroEmoji} allowFontScaling={false}>
          {activity.emoji}
        </RNText>
        <View style={styles.heroText}>
          <RNText
            style={[styles.heroTitle, { color: colors.foreground }]}
            numberOfLines={1}
            allowFontScaling={false}
          >
            {activity.label}
          </RNText>
          <View style={styles.heroMetaRow}>
            <View
              style={[styles.intentChip, { backgroundColor: theme.chipBg }]}
            >
              <Text
                style={[styles.intentChipLabel, { color: colors.foreground }]}
              >
                {activityExperienceIntentLabel(activity.intent)}
              </Text>
            </View>
            {notifySummary != null ? (
              <View
                style={[styles.intentChip, { backgroundColor: theme.chipBg }]}
              >
                <Text
                  style={[styles.intentChipLabel, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {notifySummary}
                </Text>
              </View>
            ) : null}
            <Text
              style={[styles.heroLastLogged, { color: colors.mutedForeground }]}
            >
              Last logged {lastLoggedLabel.toLowerCase()}
            </Text>
          </View>
        </View>
      </View>

      {moments.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.tint }]}>
          <RNText style={styles.emptyEmoji} allowFontScaling={false}>
            {activity.emoji}
          </RNText>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            No logs yet
          </Text>
          <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
            Log this activity and your insights will show up here.
          </Text>
        </View>
      ) : (
        <>
          {metricOptions.length > 1 ? (
            <View style={styles.metricSelectorWrap}>
              <MetricSelectorBar
                options={metricOptions}
                value={selectedMetric}
                onChange={setSelectedMetric}
                accent={theme.strong}
                muted={colors.mutedForeground}
              />
            </View>
          ) : null}

          <SectionCard tint={theme.tint} accent={theme.strong}>
            <View style={styles.periodBlock}>
              <View style={styles.periodRow}>
                <View style={styles.periodCell}>
                  <View style={styles.periodLabelRow}>
                    <Text
                      style={[
                        styles.periodLabel,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      Today
                    </Text>
                    <Text
                      style={[
                        styles.periodRange,
                        { color: colors.mutedForeground },
                      ]}
                      numberOfLines={1}
                    >
                      {todayStats.dateLabel}
                    </Text>
                  </View>
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
                      style={[styles.periodValue, { color: theme.strong }]}
                      allowFontScaling={false}
                      numberOfLines={1}
                    >
                      {todayStats.valueLabel}
                    </RNText>
                  </Pressable>
                </View>
                <ActivityInsightWeekPager
                  moments={moments}
                  metric={selectedMetric}
                  accent={theme.strong}
                  muted={colors.mutedForeground}
                  foreground={colors.foreground}
                  earliestDate={calendarBounds.earliestDate}
                  weekAnchorDate={weekAnchorDate}
                  onPressValue={handlePressWeek}
                />
              </View>
            </View>
            <ActivityInsightMonthCalendar
              moments={moments}
              intent={activity.intent}
              createdAt={activity.createdAt}
              reminderEnabled={activity.reminderEnabled}
              reminderRepeat={activity.reminderRepeat}
              monthTotalLabel={monthTotalLabel}
              accent={theme.strong}
              selectedMonthDate={visibleMonthDate}
              onVisibleMonthChange={handleVisibleMonthChange}
              onDayPress={handleCalendarDayPress}
              onPressMonthTotal={handlePressMonth}
            />
            <ActivityInsightYearBars
              moments={moments}
              metric={selectedMetric}
              createdAt={activity.createdAt}
              accent={theme.strong}
              soft={theme.soft}
              muted={colors.mutedForeground}
              foreground={colors.foreground}
              selectedMonthDate={visibleMonthDate}
              onSelectMonthDate={handleYearBarMonthSelect}
              onVisibleYearChange={handleYearBarsYearChange}
              onPressYearTotal={handlePressYear}
            />
          </SectionCard>
          {shopSpendRows.length > 0 ? (
            <ActivityInsightShopSpendWidget
              rows={shopSpendRows}
              tint={theme.tint}
              accent={theme.strong}
              muted={colors.mutedForeground}
              foreground={colors.foreground}
              onPressShop={handlePressShopSpend}
            />
          ) : null}
          {reminderTiming != null ? (
            <ActivityInsightTimingWidget
              summary={reminderTiming}
              year={reminderTimingYear}
              tint={theme.tint}
              accent={theme.strong}
              muted={colors.mutedForeground}
              onPressKind={handlePressTiming}
            />
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    gap: 12,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  heroEmoji: {
    fontSize: 36,
    lineHeight: 44,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  heroText: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  heroTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  heroLastLogged: {
    fontSize: 12,
    fontWeight: '600',
  },
  intentChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  intentChipLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  section: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricSelectorWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricShadowWrap: {
    borderRadius: METRIC_BAR_RADIUS,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
    }),
  },
  metricSelectorGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    height: METRIC_BAR_HEIGHT,
    paddingHorizontal: METRIC_H_PADDING,
    borderRadius: METRIC_BAR_RADIUS,
    overflow: 'hidden',
  },
  metricActivePill: {
    position: 'absolute',
    top: (METRIC_BAR_HEIGHT - METRIC_ACTIVE_PILL_HEIGHT) / 2,
    height: METRIC_ACTIVE_PILL_HEIGHT,
    borderRadius: METRIC_PILL_RADIUS,
  },
  metricTab: {
    height: METRIC_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  metricTabLabel: {
    fontSize: 12,
    letterSpacing: 0.15,
    textAlign: 'center',
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
  emptyCard: {
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 36,
    alignItems: 'center',
    gap: 8,
  },
  emptyEmoji: {
    fontSize: 40,
    lineHeight: 48,
    marginBottom: 4,
    opacity: 0.55,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 260,
  },
});
