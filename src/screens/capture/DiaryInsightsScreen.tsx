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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, NotebookPen, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { AdaptiveGlassSurface } from '@/components/glass/AdaptiveGlassSurface';
import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import { Text } from '@/components/ui/text';
import { listNoteMoments, type MomentRow } from '@/db/repositories/moments';
import { useThemeColors } from '@/hooks/use-theme-colors';
import {
  buildInsightCalendarMonth,
  countLogsByDateKey,
  listMonthsInclusive,
  resolveInsightCalendarStartDate,
  summarizeLogTotals,
  type InsightCalendarCell,
  type InsightCalendarCellState,
  type LogTotals,
} from '@/lib/activities/activity-insights';
import { APP_COPY } from '@/lib/app-copy';
import {
  MAP_MOMENTS_BAR_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
} from '@/lib/app-constants';
import { ensureHistoryCalendarBounds } from '@/lib/history-calendar-bounds';
import type { RootStackParamList } from '@/navigation/types';
import { useClosesToMap } from '@/navigation/use-closes-to-map';
import { useAppStore } from '@/stores/app-store';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

const THEME = {
  tint: '#FFF7ED',
  strong: '#EA580C',
  chipBg: '#FFEDD5',
};

const CELL_FILL: Record<InsightCalendarCellState, string> = {
  success: '#34D399',
  miss: '#FCA5A5',
  relapse: '#FB923C',
  empty: 'transparent',
  future: '#E5E7EB',
  unscheduled: '#F3F4F6',
};

function WidgetCard({
  title,
  children,
  tint,
  accent,
}: {
  title: string;
  children: ReactNode;
  tint: string;
  accent: string;
}) {
  return (
    <Animated.View
      layout={LinearTransition.duration(220)}
      style={[styles.widget, { backgroundColor: tint }]}
    >
      <Text style={[styles.widgetTitle, { color: accent }]}>{title}</Text>
      {children}
    </Animated.View>
  );
}

function LogStatCell({
  label,
  value,
  muted,
  foreground,
}: {
  label: string;
  value: number;
  muted: string;
  foreground: string;
}) {
  return (
    <View style={styles.logStatCell}>
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
  muted,
  foreground,
}: {
  totals: LogTotals;
  muted: string;
  foreground: string;
}) {
  return (
    <WidgetCard title="Total logs" tint={THEME.tint} accent={THEME.strong}>
      <View style={styles.statsRowFive}>
        {(
          [
            ['Today', totals.today],
            ['Week', totals.week],
            ['Month', totals.month],
            ['Year', totals.year],
            ['All', totals.all],
          ] as const
        ).map(([label, value]) => (
          <LogStatCell
            key={label}
            label={label}
            value={value}
            muted={muted}
            foreground={foreground}
          />
        ))}
      </View>
    </WidgetCard>
  );
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const date = new Date(y!, (m ?? 1) - 1, 1);
  return date.toLocaleString(undefined, { month: 'long', year: 'numeric' });
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

function MonthCalendarPager({ moments }: { moments: readonly MomentRow[] }) {
  const pagerRef = useRef<ScrollView>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const didInitialScroll = useRef(false);
  const now = useMemo(() => new Date(), []);
  const historyEarliestDateKey = useAppStore(
    state => state.historyEarliestDateKey,
  );

  const loggedCounts = useMemo(() => countLogsByDateKey(moments), [moments]);

  const earliestCreatedAt = useMemo(() => {
    let earliest: Date | null = null;
    for (const moment of moments) {
      if (earliest == null || moment.timestamp.getTime() < earliest.getTime()) {
        earliest = moment.timestamp;
      }
    }
    return earliest ?? now;
  }, [moments, now]);

  const monthDates = useMemo(() => {
    const start = resolveInsightCalendarStartDate({
      moments,
      activityCreatedAt: earliestCreatedAt,
      historyEarliestDateKey,
      now,
    });
    return listMonthsInclusive(start, now);
  }, [earliestCreatedAt, historyEarliestDateKey, moments, now]);

  const pages = useMemo(
    () =>
      monthDates.map(monthDate =>
        buildInsightCalendarMonth({
          intent: 'track',
          reminderEnabled: false,
          reminderRepeat: 'daily',
          loggedCounts,
          monthDate,
          now,
        }),
      ),
    [loggedCounts, monthDates, now],
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
      <View style={styles.calendarLegend}>
        <View style={styles.legendItem}>
          <View
            style={[styles.legendDot, { backgroundColor: CELL_FILL.success }]}
          />
          <Text style={styles.legendLabel}>Logged</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * Diary insights — totals + monthly calendar (same widgets as activity v1).
 */
export function DiaryInsightsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const closesToMap = useClosesToMap();
  const { width: windowWidth } = useWindowDimensions();

  const [moments, setMoments] = useState<MomentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows] = await Promise.all([
        listNoteMoments(),
        ensureHistoryCalendarBounds(),
      ]);
      setMoments(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => summarizeLogTotals(moments), [moments]);

  const handleClose = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Map');
  }, [navigation]);

  const bottomPad =
    MAP_MOMENTS_BAR_HEIGHT + Math.max(insets.bottom, MAP_MOMENTS_BAR_GAP) + 16;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {loading ? (
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
          <View style={[styles.hero, { backgroundColor: THEME.tint }]}>
            <View style={[styles.heroIcon, { backgroundColor: THEME.chipBg }]}>
              <NotebookPen size={22} color={THEME.strong} strokeWidth={2.25} />
            </View>
            <View style={styles.heroText}>
              <RNText
                style={[styles.heroTitle, { color: colors.foreground }]}
                numberOfLines={1}
                allowFontScaling={false}
              >
                {APP_COPY.diary.insightsTitle}
              </RNText>
              <Text
                style={[styles.heroSubtitle, { color: colors.mutedForeground }]}
              >
                {APP_COPY.diary.insightsSubtitle}
              </Text>
            </View>
          </View>

          <TotalLogsWidget
            totals={totals}
            muted={colors.mutedForeground}
            foreground={colors.foreground}
          />

          <WidgetCard
            title="This month"
            tint={THEME.tint}
            accent={THEME.strong}
          >
            <MonthCalendarPager moments={moments} />
          </WidgetCard>

          {totals.all === 0 ? (
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              {APP_COPY.diary.insightsEmpty}
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
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  heroTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
  },
  heroSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  widget: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    overflow: 'hidden',
    gap: 8,
  },
  widgetTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statsRowFive: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  logStatCell: {
    flex: 1,
    minWidth: 0,
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
    marginTop: 4,
  },
  closeWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
});
