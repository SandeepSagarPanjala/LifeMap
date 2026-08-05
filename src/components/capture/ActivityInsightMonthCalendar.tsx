import {
  useCallback,
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

import { AdaptiveGlassSurface } from '@/components/glass/AdaptiveGlassSurface';
import { Text } from '@/components/ui/text';
import type { MomentRow } from '@/db/repositories/moments';
import type { ActivityIntent } from '@/lib/activities/activity-intent';
import {
  buildInsightCalendarMonth,
  countLogsByDateKey,
  listMonthsInclusive,
  resolveInsightCalendarStartDate,
  type InsightCalendarCell,
  type InsightCalendarCellState,
} from '@/lib/activities/activity-insights';
import type { ReminderRepeat } from '@/lib/notifications/types';
import { APP_TIMEZONE } from '@/lib/timezone';
import { useAppStore } from '@/stores/app-store';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

const CELL_FILL: Record<InsightCalendarCellState, string> = {
  success: '#34D399',
  miss: '#FCA5A5',
  relapse: '#FB923C',
  today: '#60A5FA',
  empty: 'transparent',
  future: '#E5E7EB',
  unscheduled: '#F3F4F6',
};

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const date = new Date(y!, (m ?? 1) - 1, 1);
  return date.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

function monthStartInAppTz(date: Date): Date {
  return startOfMonth(new TZDate(date, APP_TIMEZONE));
}

function toMonthKey(date: Date): string {
  const z = new TZDate(date, APP_TIMEZONE);
  return `${z.getFullYear()}-${String(z.getMonth() + 1).padStart(2, '0')}`;
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

type LegendItem = {
  key: string;
  color: string;
  label: string;
};

function calendarLegendItems(intent: ActivityIntent): LegendItem[] {
  if (intent === 'less') {
    return [
      { key: 'clean', color: CELL_FILL.success, label: 'Clean' },
      { key: 'relapse', color: CELL_FILL.relapse, label: 'Relapsed' },
    ];
  }
  if (intent === 'more') {
    return [
      { key: 'logged', color: CELL_FILL.success, label: 'Logged' },
      { key: 'miss', color: CELL_FILL.miss, label: 'Missed' },
    ];
  }
  return [{ key: 'logged', color: CELL_FILL.success, label: 'Logged' }];
}

function CalendarLegend({ intent }: { intent: ActivityIntent }) {
  const items = calendarLegendItems(intent);
  return (
    <View style={styles.legendRow} accessibilityRole="text">
      {items.map(item => (
        <View key={item.key} style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: item.color }]} />
          <Text style={styles.legendLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function CalendarMonthGrid({
  cells,
  monthKey,
  monthTotalLabel,
  accent,
  intent,
  onDayPress,
  onPressMonthTotal,
}: {
  cells: InsightCalendarCell[];
  monthKey: string;
  monthTotalLabel?: string;
  accent?: string;
  intent: ActivityIntent;
  onDayPress?: (dateKey: string) => void;
  onPressMonthTotal?: () => void;
}) {
  return (
    <View>
      <View style={styles.calendarMonthRow}>
        <Text style={styles.calendarMonth} numberOfLines={1}>
          {formatMonthLabel(monthKey)}
        </Text>
        {monthTotalLabel != null && accent != null ? (
          onPressMonthTotal != null ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={monthTotalLabel}
              onPress={onPressMonthTotal}
              hitSlop={6}
              style={({ pressed }) => [
                styles.monthTotalHit,
                pressed ? { opacity: 0.72 } : null,
              ]}
            >
              <RNText
                style={[styles.monthLogsLabel, { color: accent }]}
                allowFontScaling={false}
                numberOfLines={1}
              >
                {monthTotalLabel}
              </RNText>
            </Pressable>
          ) : (
            <RNText
              style={[styles.monthLogsLabel, { color: accent }]}
              allowFontScaling={false}
              numberOfLines={1}
            >
              {monthTotalLabel}
            </RNText>
          )
        ) : null}
      </View>
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
            cell.state === 'relapse' ||
            cell.state === 'today';
          const body =
            cell.state !== 'empty' ? (
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
                {cell.isToday ? (
                  <RNText
                    style={[
                      styles.calendarTodayLabel,
                      onFill ? styles.calendarTodayLabelOnFill : null,
                    ]}
                    allowFontScaling={false}
                  >
                    Today
                  </RNText>
                ) : (
                  <CalendarLogCountMarker
                    logCount={cell.logCount}
                    onFill={onFill}
                  />
                )}
              </>
            ) : null;
          const cellStyle = [
            styles.calendarCell,
            {
              backgroundColor: CELL_FILL[cell.state],
              opacity: cell.state === 'empty' ? 0 : 1,
            },
          ];
          if (
            cell.state === 'empty' ||
            cell.state === 'future' ||
            onDayPress == null
          ) {
            return (
              <View key={cell.dateKey} style={styles.calendarCellWrap}>
                <View style={cellStyle}>{body}</View>
              </View>
            );
          }
          return (
            <Pressable
              key={cell.dateKey}
              style={styles.calendarCellWrap}
              onPress={() => onDayPress(cell.dateKey)}
              accessibilityRole="button"
              accessibilityLabel={cell.dateKey}
            >
              <View style={cellStyle}>{body}</View>
            </Pressable>
          );
        })}
      </View>
      <CalendarLegend intent={intent} />
    </View>
  );
}

/**
 * Swipeable month calendar. Day taps update the week summary via parent.
 * Works for activities and for plain log moments (mood / diary) with intent
 * `track` and reminders off.
 */
export function ActivityInsightMonthCalendar({
  moments,
  intent,
  createdAt,
  reminderEnabled = false,
  reminderRepeat = 'daily',
  monthTotalLabel,
  accent,
  selectedMonthDate,
  onVisibleMonthChange,
  onDayPress,
  onPressMonthTotal,
}: {
  moments: readonly MomentRow[];
  intent: ActivityIntent;
  /** Fallback earliest bound when there are no moments yet. */
  createdAt: Date;
  reminderEnabled?: boolean;
  reminderRepeat?: ReminderRepeat;
  monthTotalLabel?: string;
  accent?: string;
  selectedMonthDate: Date;
  onVisibleMonthChange?: (monthDate: Date) => void;
  onDayPress?: (dateKey: string) => void;
  /** Opens period drill-down for this month’s total. */
  onPressMonthTotal?: () => void;
}) {
  const pagerRef = useRef<ScrollView>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const suppressReportRef = useRef(false);
  const lastReportedKeyRef = useRef<string | null>(null);
  const onVisibleMonthChangeRef = useRef(onVisibleMonthChange);
  onVisibleMonthChangeRef.current = onVisibleMonthChange;

  const now = useMemo(() => new Date(), []);
  const historyEarliestDateKey = useAppStore(
    state => state.historyEarliestDateKey,
  );

  const earliestStart = useMemo(
    () =>
      resolveInsightCalendarStartDate({
        moments,
        activityCreatedAt: createdAt,
        historyEarliestDateKey,
        now,
      }),
    [createdAt, historyEarliestDateKey, moments, now],
  );

  const monthDates = useMemo(
    () => listMonthsInclusive(earliestStart, now),
    [earliestStart, now],
  );

  const loggedCounts = useMemo(() => countLogsByDateKey(moments), [moments]);

  const pages = useMemo(
    () =>
      monthDates.map(monthDate =>
        buildInsightCalendarMonth({
          intent,
          reminderEnabled,
          reminderRepeat,
          loggedCounts,
          monthDate,
          now,
        }),
      ),
    [intent, loggedCounts, monthDates, now, reminderEnabled, reminderRepeat],
  );

  const selectedKey = toMonthKey(monthStartInAppTz(selectedMonthDate));

  const indexForSelectedKey = useCallback(
    (key: string): number => {
      const exact = monthDates.findIndex(m => toMonthKey(m) === key);
      if (exact >= 0) {
        return exact;
      }
      // Outside range (e.g. future month) → nearest end of the pager.
      return monthDates.length > 0 ? monthDates.length - 1 : -1;
    },
    [monthDates],
  );

  // Always scroll the pager to the parent-selected month. Skipping when
  // lastReportedKey already matched left the UI stuck after a failed scroll
  // or a year-bar tap that raced with swipe settle.
  useLayoutEffect(() => {
    if (pageWidth <= 0) {
      return;
    }
    const index = indexForSelectedKey(selectedKey);
    if (index < 0) {
      return;
    }
    const key = toMonthKey(monthDates[index]!);
    suppressReportRef.current = true;
    pagerRef.current?.scrollTo({
      x: index * pageWidth,
      animated: false,
    });
    lastReportedKeyRef.current = key;
    const t = setTimeout(() => {
      suppressReportRef.current = false;
    }, 400);
    return () => clearTimeout(t);
  }, [indexForSelectedKey, monthDates, pageWidth, selectedKey]);

  const scrollToSelectedOrCurrent = useCallback(
    (width: number) => {
      if (width <= 0) {
        return;
      }
      const target = indexForSelectedKey(selectedKey);
      if (target < 0) {
        return;
      }
      suppressReportRef.current = true;
      lastReportedKeyRef.current = toMonthKey(monthDates[target]!);
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
    [indexForSelectedKey, monthDates, selectedKey],
  );

  const settleMonth = useCallback(
    (index: number) => {
      if (suppressReportRef.current) {
        return;
      }
      const clamped = Math.max(0, Math.min(index, monthDates.length - 1));
      const month = monthDates[clamped];
      if (month == null) {
        return;
      }
      const key = toMonthKey(month);
      if (lastReportedKeyRef.current === key) {
        return;
      }
      lastReportedKeyRef.current = key;
      onVisibleMonthChangeRef.current?.(month);
    },
    [monthDates],
  );

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pageWidth <= 0 || suppressReportRef.current) {
        return;
      }
      const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
      settleMonth(index);
    },
    [pageWidth, settleMonth],
  );

  return (
    <View style={styles.calendar}>
      <View
        style={styles.calendarPagerHost}
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
                key={page.monthKey}
                style={[styles.calendarPage, { width: pageWidth }]}
              >
                <CalendarMonthGrid
                  cells={page.cells}
                  monthKey={page.monthKey}
                  monthTotalLabel={
                    page.monthKey === selectedKey ? monthTotalLabel : undefined
                  }
                  accent={accent}
                  intent={intent}
                  onDayPress={onDayPress}
                  onPressMonthTotal={
                    page.monthKey === selectedKey
                      ? onPressMonthTotal
                      : undefined
                  }
                />
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.calendarPagePlaceholder} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  calendarMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  calendarMonth: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  monthLogsLabel: {
    flexShrink: 0,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'right',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  monthTotalHit: {
    flexShrink: 0,
    paddingVertical: 2,
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
  calendarTodayLabel: {
    fontSize: 8,
    lineHeight: 9,
    fontWeight: '700',
    color: '#4B5563',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  calendarTodayLabelOnFill: {
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
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  legendLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
});
