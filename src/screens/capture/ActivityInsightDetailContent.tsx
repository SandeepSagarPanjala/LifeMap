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
import { endOfDay, startOfDay, startOfMonth } from 'date-fns';
import { TZDate } from '@date-fns/tz';

import { ActivityInsightMonthCalendar } from '@/components/capture/ActivityInsightMonthCalendar';
import {
  ActivityInsightYearBars,
  sameMonthInYear,
} from '@/components/capture/ActivityInsightYearBars';
import {
  ActivityInsightWeekPager,
  preferredMonthForWeek,
  preferredWeekForMonth,
  weekStartInAppTz,
} from '@/components/capture/ActivityInsightWeekPager';
import { AdaptiveGlassSurface } from '@/components/glass/AdaptiveGlassSurface';
import { Text } from '@/components/ui/text';
import type { ActivityRow } from '@/db/repositories/activities';
import type { MomentRow } from '@/db/repositories/moments';
import { useThemeColors } from '@/hooks/use-theme-colors';
import {
  buildActivityFieldWidgets,
  type ActivityFieldWidget,
  type RankedToken,
} from '@/lib/activities/activity-field-widgets';
import {
  activityExperienceIntentLabel,
} from '@/lib/activities/activity-intent';
import type { ActivityIntent } from '@/lib/activities/activity-intent';
import { resolveInsightCalendarStartDate } from '@/lib/activities/activity-insights';
import {
  formatMetricPeriodPhrase,
  formatMetricShortPhrase,
  metricFieldsFromDefinition,
  sumMetricInMonth,
  sumMetricInRange,
  type InsightPeriodMetric,
} from '@/lib/activities/insight-period-metric';
import { formatRelativeLoggedAt } from '@/lib/activities/insight-providers';
import {
  MAP_MOMENTS_BAR_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
} from '@/lib/app-constants';
import { parseDateKey } from '@/lib/day-utils';
import { APP_TIMEZONE } from '@/lib/timezone';
import { useAppStore } from '@/stores/app-store';

const LOGS_METRIC: InsightPeriodMetric = { id: 'logs', kind: 'logs' };
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

function formatDurationShort(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) {
    return '<1m';
  }
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `${hours}h` : `${hours}h ${rem}m`;
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

function RankBars({
  items,
  accent,
  soft,
  muted,
  foreground,
}: {
  items: RankedToken[];
  accent: string;
  soft: string;
  muted: string;
  foreground: string;
}) {
  return (
    <View style={styles.rankList}>
      {items.map((item, index) => (
        <View key={item.label} style={styles.rankRow}>
          <View style={styles.rankMeta}>
            <Text
              style={[styles.rankLabel, { color: foreground }]}
              numberOfLines={1}
            >
              {item.label}
            </Text>
            <Text style={[styles.rankCount, { color: muted }]}>
              {item.count} · {Math.round(item.share * 100)}%
            </Text>
          </View>
          <View style={[styles.rankTrack, { backgroundColor: soft }]}>
            <View
              style={[
                styles.rankFill,
                {
                  width: `${Math.max(8, Math.round(item.share * 100))}%`,
                  backgroundColor: index === 0 ? accent : muted,
                  opacity: index === 0 ? 1 : 0.45,
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

function ToggleSplit({
  yesShare,
  accent,
  soft,
}: {
  yesShare: number;
  accent: string;
  soft: string;
}) {
  const yesPct = Math.round(yesShare * 100);
  const noPct = 100 - yesPct;
  return (
    <View style={styles.toggleTrack}>
      {yesPct > 0 ? (
        <View
          style={[
            styles.toggleYes,
            { flex: yesPct, backgroundColor: accent },
          ]}
        />
      ) : null}
      {noPct > 0 ? (
        <View
          style={[styles.toggleNo, { flex: noPct, backgroundColor: soft }]}
        />
      ) : null}
    </View>
  );
}

function FieldWidgetCard({
  widget,
  accent,
  soft,
  tint,
  muted,
  foreground,
}: {
  widget: ActivityFieldWidget;
  accent: string;
  soft: string;
  tint: string;
  muted: string;
  foreground: string;
}) {
  return (
    <SectionCard title={widget.title} tint={tint} accent={accent}>
      <Text style={[styles.sentence, { color: foreground }]}>
        {widget.sentence}
      </Text>
      <Text style={[styles.subtitle, { color: muted }]}>{widget.subtitle}</Text>

      {widget.kind === 'number' ? (
        <View style={styles.statRow}>
          <View style={styles.statCell}>
            <Text style={[styles.statLabel, { color: muted }]}>Average</Text>
            <RNText
              style={[styles.statValue, { color: foreground }]}
              allowFontScaling={false}
            >
              {widget.average.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
            </RNText>
          </View>
          <View style={styles.statCell}>
            <Text style={[styles.statLabel, { color: muted }]}>Latest</Text>
            <RNText
              style={[styles.statValue, { color: foreground }]}
              allowFontScaling={false}
            >
              {widget.latest.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
            </RNText>
          </View>
        </View>
      ) : null}

      {widget.kind === 'duration' ? (
        <View style={styles.statRow}>
          <View style={styles.statCell}>
            <Text style={[styles.statLabel, { color: muted }]}>Typical</Text>
            <RNText
              style={[styles.statValue, { color: foreground }]}
              allowFontScaling={false}
            >
              {formatDurationShort(widget.averageSeconds)}
            </RNText>
          </View>
          <View style={styles.statCell}>
            <Text style={[styles.statLabel, { color: muted }]}>Total</Text>
            <RNText
              style={[styles.statValue, { color: foreground }]}
              allowFontScaling={false}
            >
              {formatDurationShort(widget.totalSeconds)}
            </RNText>
          </View>
        </View>
      ) : null}

      {widget.kind === 'choice' || widget.kind === 'list' ? (
        <RankBars
          items={widget.kind === 'choice' ? widget.options : widget.topItems}
          accent={accent}
          soft={soft}
          muted={muted}
          foreground={foreground}
        />
      ) : null}

      {widget.kind === 'toggle' ? (
        <>
          <ToggleSplit
            yesShare={widget.yesShare}
            accent={accent}
            soft={soft}
          />
          <View style={styles.toggleLegend}>
            <Text style={[styles.subtitle, { color: muted }]}>
              Yes {Math.round(widget.yesShare * 100)}%
            </Text>
            <Text style={[styles.subtitle, { color: muted }]}>
              No {Math.round((1 - widget.yesShare) * 100)}%
            </Text>
          </View>
        </>
      ) : null}
    </SectionCard>
  );
}

/**
 * Activity insights v3 — calendar + year bars, plus field widgets for number /
 * list / choice / duration / toggle. Hidden when a field has no logged values.
 */
export function ActivityInsightDetailContent({
  activity,
  moments,
}: {
  activity: ActivityRow;
  moments: readonly MomentRow[];
}) {
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
  const [selectedMetric, setSelectedMetric] =
    useState<InsightPeriodMetric>(LOGS_METRIC);

  const metricOptions = useMemo((): InsightPeriodMetric[] => {
    const fields = metricFieldsFromDefinition(activity.fields);
    if (fields.length === 0) {
      return [LOGS_METRIC];
    }
    return [
      LOGS_METRIC,
      ...fields.map(field => ({
        id: field.fieldId,
        kind: field.kind,
        fieldId: field.fieldId,
        label: field.label,
      })),
    ];
  }, [activity.fields]);

  useEffect(() => {
    if (metricOptions.some(option => option.id === selectedMetric.id)) {
      return;
    }
    setSelectedMetric(LOGS_METRIC);
  }, [metricOptions, selectedMetric.id]);

  const widgets = useMemo(
    () =>
      buildActivityFieldWidgets({ activity, moments }).filter(
        widget => widget.kind !== 'money',
      ),
    [activity, moments],
  );

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

  const monthTotalLabel = useMemo(() => {
    const value = sumMetricInMonth(moments, selectedMetric, visibleMonthDate);
    return formatMetricPeriodPhrase(selectedMetric, value, 'Month');
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
      valueLabel: formatMetricShortPhrase(selectedMetric, value),
      dateLabel: today.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
    };
  }, [moments, selectedMetric]);

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

  /** User pressed month arrow / year month bar. */
  const handleVisibleMonthChange = useCallback(
    (monthDate: Date) => {
      setMonthAndWeek(monthDate);
    },
    [setMonthAndWeek],
  );

  /** User tapped year-chart month. */
  const handleYearBarMonthSelect = useCallback(
    (monthDate: Date) => {
      setMonthAndWeek(monthDate);
    },
    [setMonthAndWeek],
  );

  /** User pressed year arrow. */
  const handleYearBarsYearChange = useCallback(
    (year: number) => {
      const monthDate = sameMonthInYear(
        year,
        visibleMonthDateRef.current,
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

  /** User pressed week arrow → month that owns that week. */
  const handleVisibleWeekChange = useCallback((weekStart: Date) => {
    const nextWeek = new Date(weekStartInAppTz(weekStart).getTime());
    skipNextMonthToWeekSyncRef.current = true;
    setWeekAnchorDate(prev =>
      weekStartInAppTz(prev).getTime() === nextWeek.getTime()
        ? prev
        : nextWeek,
    );
    const month = preferredMonthForWeek(nextWeek);
    setVisibleMonthDate(prev =>
      prev.getTime() === month.getTime() ? prev : new Date(month.getTime()),
    );
  }, []);

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
              <Text style={[styles.intentChipLabel, { color: theme.strong }]}>
                {activityExperienceIntentLabel(activity.intent)}
              </Text>
            </View>
            <Text
              style={[styles.heroLastLogged, { color: colors.mutedForeground }]}
            >
              Last logged {lastLoggedLabel.toLowerCase()}
            </Text>
          </View>
        </View>
      </View>

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
              <Text
                style={[styles.periodLabel, { color: colors.mutedForeground }]}
              >
                Today
              </Text>
              <Text style={[styles.periodRange, { color: theme.strong }]}>
                {todayStats.dateLabel}
              </Text>
              <RNText
                style={[styles.periodValue, { color: colors.foreground }]}
                allowFontScaling={false}
                numberOfLines={1}
              >
                {todayStats.valueLabel}
              </RNText>
            </View>
            <ActivityInsightWeekPager
              moments={moments}
              metric={selectedMetric}
              accent={theme.strong}
              muted={colors.mutedForeground}
              foreground={colors.foreground}
              earliestDate={calendarBounds.earliestDate}
              weekAnchorDate={weekAnchorDate}
              onVisibleWeekChange={handleVisibleWeekChange}
            />
          </View>
        </View>
        <ActivityInsightMonthCalendar
          activity={activity}
          moments={moments}
          intent={activity.intent}
          monthTotalLabel={monthTotalLabel}
          accent={theme.strong}
          selectedMonthDate={visibleMonthDate}
          onVisibleMonthChange={handleVisibleMonthChange}
          onDayPress={handleCalendarDayPress}
        />
        <ActivityInsightYearBars
          activity={activity}
          moments={moments}
          metric={selectedMetric}
          accent={theme.strong}
          soft={theme.soft}
          muted={colors.mutedForeground}
          foreground={colors.foreground}
          selectedMonthDate={visibleMonthDate}
          onSelectMonthDate={handleYearBarMonthSelect}
          onVisibleYearChange={handleYearBarsYearChange}
        />
      </SectionCard>

      {widgets.map(widget => (
        <FieldWidgetCard
          key={`${widget.kind}.${widget.fieldId}`}
          widget={widget}
          accent={theme.strong}
          soft={theme.soft}
          tint={theme.tint}
          muted={colors.mutedForeground}
          foreground={colors.foreground}
        />
      ))}

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
  periodLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  periodRange: {
    fontSize: 12,
    fontWeight: '700',
  },
  periodValue: {
    fontSize: 18,
    fontWeight: '800',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  sentence: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  statRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  statCell: {
    flex: 1,
    gap: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  rankList: {
    gap: 10,
    marginTop: 4,
  },
  rankRow: {
    gap: 4,
  },
  rankMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  rankLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  rankCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  rankTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  rankFill: {
    height: '100%',
    borderRadius: 3,
  },
  toggleTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    flexDirection: 'row',
    marginTop: 4,
  },
  toggleYes: {
    height: '100%',
  },
  toggleNo: {
    height: '100%',
  },
  toggleLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
