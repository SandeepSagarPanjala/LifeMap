import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text as RNText,
  useWindowDimensions,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { AdaptiveGlassSurface } from '@/components/glass/AdaptiveGlassSurface';
import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import { Text } from '@/components/ui/text';
import {
  getActivityById,
  type ActivityRow,
} from '@/db/repositories/activities';
import {
  listMomentsForActivity,
  type MomentRow,
} from '@/db/repositories/moments';
import { useThemeColors } from '@/hooks/use-theme-colors';
import {
  ACTIVITY_ON_TIME_WINDOW_MINUTES,
  buildActivityInsightSnapshot,
  buildInsightCalendarMonth,
  countLogsByDateKey,
  listMonthsInclusive,
  resolveInsightCalendarStartDate,
  type AmountFieldSummary,
  type InsightCalendarCell,
  type InsightCalendarCellState,
  type LogTotals,
} from '@/lib/activities/activity-insights';
import type { ActivityIntent } from '@/lib/activities/activity-intent';
import {
  MAP_MOMENTS_BAR_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
} from '@/lib/app-constants';
import { ensureHistoryCalendarBounds } from '@/lib/history-calendar-bounds';
import type { RootStackParamList } from '@/navigation/types';
import { useClosesToMap } from '@/navigation/use-closes-to-map';
import { useAppStore } from '@/stores/app-store';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

const INTENT_THEME: Record<
  ActivityIntent,
  {
    tint: string;
    strong: string;
    soft: string;
    chipBg: string;
  }
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
    tint: '#F5F3FF',
    strong: '#7C3AED',
    soft: '#DDD6FE',
    chipBg: '#EDE9FE',
  },
};

const CELL_FILL: Record<InsightCalendarCellState, string> = {
  success: '#34D399',
  miss: '#FCA5A5',
  relapse: '#FB923C',
  empty: 'transparent',
  future: '#E5E7EB',
  unscheduled: '#F3F4F6',
};

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

function formatAmount(summary: AmountFieldSummary, value: number): string {
  return summary.kind === 'money' ? formatMoney(value) : formatNumber(value);
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const date = new Date(y!, (m ?? 1) - 1, 1);
  return date.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

function WidgetCard({
  title,
  children,
  tint,
  accent,
  headerRight,
}: {
  title: string;
  children: ReactNode;
  tint: string;
  accent: string;
  headerRight?: ReactNode;
}) {
  return (
    <Animated.View
      layout={LinearTransition.duration(220)}
      style={[styles.widget, { backgroundColor: tint }]}
    >
      <View style={styles.widgetHeader}>
        <Text style={[styles.widgetTitle, { color: accent }]}>{title}</Text>
        {headerRight}
      </View>
      {children}
    </Animated.View>
  );
}

function LogStatCell({
  label,
  value,
  muted,
  foreground,
  style,
}: {
  label: string;
  value: number;
  muted: string;
  foreground: string;
  style?: object;
}) {
  return (
    <View style={[styles.logStatCell, style]}>
      <Text style={[styles.logStatLabel, { color: muted }]} numberOfLines={1}>
        {label}
      </Text>
      <RNText
        style={[styles.logStatValue, { color: foreground }]}
        allowFontScaling={false}
      >
        {value}
      </RNText>
    </View>
  );
}

function TotalLogsWidget({
  totals,
  tint,
  accent,
  muted,
  foreground,
}: {
  totals: LogTotals;
  tint: string;
  accent: string;
  muted: string;
  foreground: string;
}) {
  return (
    <WidgetCard title="Total logs" tint={tint} accent={accent}>
      <View style={styles.statsRowFive}>
        <LogStatCell
          label="Today"
          value={totals.today}
          muted={muted}
          foreground={foreground}
          style={styles.statCellFifth}
        />
        <LogStatCell
          label="Week"
          value={totals.week}
          muted={muted}
          foreground={foreground}
          style={styles.statCellFifth}
        />
        <LogStatCell
          label="Month"
          value={totals.month}
          muted={muted}
          foreground={foreground}
          style={styles.statCellFifth}
        />
        <LogStatCell
          label="Year"
          value={totals.year}
          muted={muted}
          foreground={foreground}
          style={styles.statCellFifth}
        />
        <LogStatCell
          label="All"
          value={totals.all}
          muted={muted}
          foreground={foreground}
          style={styles.statCellFifth}
        />
      </View>
    </WidgetCard>
  );
}

function CalendarLogCountMarker({
  logCount,
  onFill,
}: {
  logCount: number;
  onFill: boolean;
}) {
  if (logCount <= 1) {
    return null;
  }
  if (logCount <= 3) {
    return (
      <View style={styles.calendarDots}>
        {Array.from({ length: logCount }, (_, index) => (
          <View
            key={index}
            style={[
              styles.calendarDot,
              { backgroundColor: onFill ? '#FFFFFF' : '#4B5563' },
            ]}
          />
        ))}
      </View>
    );
  }
  return (
    <AdaptiveGlassSurface style={styles.calendarCountGlass} effect="regular">
      <RNText style={styles.calendarCountText} allowFontScaling={false}>
        {logCount}
      </RNText>
    </AdaptiveGlassSurface>
  );
}

function CalendarMonthGrid({
  cells,
  monthKey,
}: {
  cells: InsightCalendarCell[];
  monthKey: string;
}) {
  return (
    <View>
      <Text style={styles.calendarMonth}>{formatMonthLabel(monthKey)}</Text>
      <View style={styles.calendarWeekdays}>
        {WEEKDAY_LABELS.map((label, index) => (
          <Text key={`${label}-${index}`} style={styles.calendarWeekday}>
            {label}
          </Text>
        ))}
      </View>
      <View style={styles.calendarGrid}>
        {cells.map(cell => {
          const onFill =
            cell.state === 'success' ||
            cell.state === 'miss' ||
            cell.state === 'relapse';
          return (
            <View key={cell.dateKey} style={styles.calendarCellWrap}>
              <View
                style={[
                  styles.calendarCell,
                  {
                    backgroundColor: CELL_FILL[cell.state],
                    opacity: cell.state === 'empty' ? 0 : 1,
                  },
                ]}
              >
                {cell.state !== 'empty' ? (
                  <>
                    <RNText
                      style={[
                        styles.calendarDay,
                        onFill ? styles.calendarDayOnFill : null,
                      ]}
                      allowFontScaling={false}
                    >
                      {cell.dayOfMonth}
                    </RNText>
                    <CalendarLogCountMarker
                      logCount={cell.logCount}
                      onFill={onFill}
                    />
                  </>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function MonthCalendarPager({
  activity,
  moments,
  intent,
}: {
  activity: ActivityRow;
  moments: readonly MomentRow[];
  intent: ActivityIntent;
}) {
  const pagerRef = useRef<ScrollView>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const didInitialScroll = useRef(false);
  const now = useMemo(() => new Date(), []);
  const historyEarliestDateKey = useAppStore(
    state => state.historyEarliestDateKey,
  );

  const loggedCounts = useMemo(() => countLogsByDateKey(moments), [moments]);

  const monthDates = useMemo(() => {
    const start = resolveInsightCalendarStartDate({
      moments,
      activityCreatedAt: activity.createdAt,
      historyEarliestDateKey,
      now,
    });
    return listMonthsInclusive(start, now);
  }, [activity.createdAt, historyEarliestDateKey, moments, now]);

  const pages = useMemo(
    () =>
      monthDates.map(monthDate =>
        buildInsightCalendarMonth({
          intent: activity.intent,
          reminderEnabled: activity.reminderEnabled,
          reminderRepeat: activity.reminderRepeat,
          loggedCounts,
          monthDate,
          now,
        }),
      ),
    [
      activity.intent,
      activity.reminderEnabled,
      activity.reminderRepeat,
      loggedCounts,
      monthDates,
      now,
    ],
  );

  const legend =
    intent === 'less' ? (
      <>
        <LegendDot color={CELL_FILL.success} label="Clean" />
        <LegendDot color={CELL_FILL.relapse} label="Logged" />
      </>
    ) : intent === 'more' ? (
      <>
        <LegendDot color={CELL_FILL.success} label="Logged" />
        <LegendDot color={CELL_FILL.miss} label="Missed" />
      </>
    ) : (
      <LegendDot color={CELL_FILL.success} label="Logged" />
    );

  const scrollToCurrentMonth = useCallback(
    (width: number) => {
      if (width <= 0 || didInitialScroll.current) {
        return;
      }
      didInitialScroll.current = true;
      requestAnimationFrame(() => {
        pagerRef.current?.scrollTo({
          x: (monthDates.length - 1) * width,
          animated: false,
        });
      });
    },
    [monthDates.length],
  );

  return (
    <View style={styles.calendar}>
      <Text style={styles.calendarHint}>Swipe for other months</Text>
      <View
        style={styles.calendarPagerHost}
        onLayout={event => {
          const width = Math.round(event.nativeEvent.layout.width);
          if (width <= 0 || width === pageWidth) {
            return;
          }
          setPageWidth(width);
          scrollToCurrentMonth(width);
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
          >
            {pages.map(page => (
              <View
                key={page.monthKey}
                style={[styles.calendarPage, { width: pageWidth }]}
              >
                <CalendarMonthGrid
                  cells={page.cells}
                  monthKey={page.monthKey}
                />
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.calendarPagePlaceholder} />
        )}
      </View>
      <View style={styles.calendarLegend}>{legend}</View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

/**
 * Full insights for one activity — headerless, content from bottom,
 * colorful habit-aware widgets, liquid-glass close at bottom center.
 */
export function ActivityInsightDetailScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route =
    useRoute<RouteProp<RootStackParamList, 'ActivityInsightDetail'>>();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const closesToMap = useClosesToMap();
  const { width: windowWidth } = useWindowDimensions();
  const activityId = route.params.activityId;

  const [activity, setActivity] = useState<ActivityRow | null>(null);
  const [moments, setMoments] = useState<MomentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [row, logs] = await Promise.all([
        getActivityById(activityId),
        listMomentsForActivity(activityId),
        ensureHistoryCalendarBounds(),
      ]);
      setActivity(row);
      setMoments(logs);
    } finally {
      setLoading(false);
    }
  }, [activityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const snapshot = useMemo(() => {
    if (activity == null) {
      return null;
    }
    return buildActivityInsightSnapshot({
      activity,
      moments,
    });
  }, [activity, moments]);

  const handleClose = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Map');
  }, [navigation]);

  const bottomPad =
    MAP_MOMENTS_BAR_HEIGHT + Math.max(insets.bottom, MAP_MOMENTS_BAR_GAP) + 16;

  const theme =
    INTENT_THEME[snapshot?.intent ?? activity?.intent ?? 'track'];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {loading || snapshot == null || activity == null ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
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
              <View
                style={[styles.intentChip, { backgroundColor: theme.chipBg }]}
              >
                <Text style={[styles.intentChipLabel, { color: theme.strong }]}>
                  {snapshot.intentLabel}
                </Text>
              </View>
            </View>
          </View>

          <TotalLogsWidget
            totals={snapshot.logTotals}
            tint={theme.tint}
            accent={theme.strong}
            muted={colors.mutedForeground}
            foreground={colors.foreground}
          />

          {snapshot.widgets.showTiming && snapshot.timing != null ? (
            <WidgetCard
              title="Kept on schedule"
              tint="#EEF2FF"
              accent="#4F46E5"
            >
              <View style={styles.statsRowThree}>
                <LogStatCell
                  label="On time"
                  value={snapshot.timing.onTime}
                  muted={colors.mutedForeground}
                  foreground={colors.foreground}
                  style={styles.statCellThird}
                />
                <LogStatCell
                  label="Early"
                  value={snapshot.timing.early}
                  muted={colors.mutedForeground}
                  foreground={colors.foreground}
                  style={styles.statCellThird}
                />
                <LogStatCell
                  label="Late"
                  value={snapshot.timing.late}
                  muted={colors.mutedForeground}
                  foreground={colors.foreground}
                  style={styles.statCellThird}
                />
              </View>
              <Text
                style={[styles.metricCaption, { color: colors.mutedForeground }]}
              >
                ±{ACTIVITY_ON_TIME_WINDOW_MINUTES}m of reminder time
              </Text>
            </WidgetCard>
          ) : null}

          <WidgetCard title="This month" tint={theme.tint} accent={theme.strong}>
            <MonthCalendarPager
              activity={activity}
              moments={moments}
              intent={snapshot.intent}
            />
          </WidgetCard>

          {snapshot.amounts.map(amount => (
            <WidgetCard
              key={amount.fieldId}
              title={amount.label}
              tint="#ECFEFF"
              accent="#0891B2"
            >
              <View style={styles.amountGrid}>
                {(
                  [
                    ['Today', amount.today],
                    ['Week', amount.week],
                    ['Month', amount.month],
                    ['Year', amount.year],
                    ['All', amount.all],
                  ] as const
                ).map(([label, value]) => (
                  <View key={label} style={styles.amountGridCell}>
                    <Text
                      style={[
                        styles.amountLabel,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {label}
                    </Text>
                    <RNText
                      style={[styles.amountValue, { color: colors.foreground }]}
                      allowFontScaling={false}
                    >
                      {formatAmount(amount, value)}
                    </RNText>
                  </View>
                ))}
              </View>
            </WidgetCard>
          ))}

          {snapshot.logTotals.all === 0 && snapshot.amounts.length === 0 ? (
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              Log this activity to unlock insights.
            </Text>
          ) : null}
        </ScrollView>
      )}

      <View
        pointerEvents="box-none"
        style={[
          styles.closeWrap,
          { paddingBottom: Math.max(insets.bottom, MAP_MOMENTS_BAR_GAP) },
        ]}
      >
        <MapGlassCircleButton
          accessibilityLabel={closesToMap ? 'Close' : 'Back'}
          onPress={handleClose}
        >
          {closesToMap ? (
            <X size={20} color={colors.primary} strokeWidth={2.25} />
          ) : (
            <ChevronLeft size={22} color={colors.primary} strokeWidth={2.25} />
          )}
        </MapGlassCircleButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    overflow: 'visible',
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
  widget: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    overflow: 'hidden',
  },
  widgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  widgetTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  amountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  amountCell: {
    gap: 2,
  },
  amountGridCell: {
    width: '45%',
    minWidth: 120,
    gap: 2,
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  amountValue: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  statsRowFive: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  statCellFifth: {
    flex: 1,
    minWidth: 0,
  },
  statsRowThree: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  statCellThird: {
    flex: 1,
    minWidth: 0,
  },
  logStatCell: {
    gap: 2,
  },
  logStatLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  logStatValue: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  metricCaption: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  calendar: {
    gap: 8,
  },
  calendarPagerHost: {
    width: '100%',
    overflow: 'hidden',
  },
  calendarPage: {
    paddingBottom: 4,
  },
  calendarPagePlaceholder: {
    height: 280,
  },
  calendarMonth: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  calendarHint: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  calendarWeekdays: {
    flexDirection: 'row',
  },
  calendarWeekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCellWrap: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 2,
  },
  calendarCell: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    overflow: 'visible',
    paddingVertical: 2,
  },
  calendarDay: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: '#4B5563',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  calendarDayOnFill: {
    color: '#FFFFFF',
  },
  calendarDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minHeight: 6,
  },
  calendarDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  calendarCountGlass: {
    minWidth: 16,
    height: 14,
    paddingHorizontal: 4,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  calendarCountText: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
    color: '#111827',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  calendarLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  emptyHint: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 12,
  },
  closeWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
});
