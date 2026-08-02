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

import { AdaptiveGlassSurface } from '@/components/glass/AdaptiveGlassSurface';
import { Text } from '@/components/ui/text';
import type { ActivityRow } from '@/db/repositories/activities';
import type { MomentRow } from '@/db/repositories/moments';
import type { ActivityIntent } from '@/lib/activities/activity-intent';
import {
  buildInsightCalendarMonth,
  countLogsByDateKey,
  resolveInsightCalendarStartDate,
  shiftMonth,
  type InsightCalendarCell,
  type InsightCalendarCellState,
} from '@/lib/activities/activity-insights';
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

function clampMonthToRange(
  monthDate: Date,
  earliestMonth: Date,
  currentMonth: Date,
): Date {
  const month = monthStartInAppTz(monthDate);
  if (month.getTime() < earliestMonth.getTime()) {
    return earliestMonth;
  }
  if (month.getTime() > currentMonth.getTime()) {
    return currentMonth;
  }
  return month;
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
  monthTotalLabel,
  accent,
  canGoPrev,
  canGoNext,
  onPrevMonth,
  onNextMonth,
  onDayPress,
}: {
  cells: InsightCalendarCell[];
  monthKey: string;
  monthTotalLabel?: string;
  accent?: string;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onDayPress?: (dateKey: string) => void;
}) {
  const chevronColor = accent ?? '#111827';
  return (
    <View>
      <View style={styles.calendarMonthRow}>
        <View style={styles.monthNav}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            disabled={!canGoPrev}
            onPress={onPrevMonth}
            hitSlop={8}
            style={styles.navBtn}
          >
            <ChevronLeft
              size={18}
              color={chevronColor}
              strokeWidth={2.5}
              opacity={canGoPrev ? 1 : 0.35}
            />
          </Pressable>
          <Text style={styles.calendarMonth} numberOfLines={1}>
            {formatMonthLabel(monthKey)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next month"
            disabled={!canGoNext}
            onPress={onNextMonth}
            hitSlop={8}
            style={styles.navBtn}
          >
            <ChevronRight
              size={18}
              color={chevronColor}
              strokeWidth={2.5}
              opacity={canGoNext ? 1 : 0.35}
            />
          </Pressable>
        </View>
        {monthTotalLabel != null && accent != null ? (
          <RNText
            style={[styles.monthLogsLabel, { color: accent }]}
            allowFontScaling={false}
            numberOfLines={1}
          >
            {monthTotalLabel}
          </RNText>
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
          if (cell.state === 'empty' || onDayPress == null) {
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
    </View>
  );
}

/**
 * Month calendar with prev/next arrows (no swipe).
 * Controlled by `selectedMonthDate`; reports arrow presses via `onVisibleMonthChange`.
 */
export function ActivityInsightMonthCalendar({
  activity,
  moments,
  intent,
  monthTotalLabel,
  accent,
  selectedMonthDate,
  onVisibleMonthChange,
  onDayPress,
}: {
  activity: ActivityRow;
  moments: readonly MomentRow[];
  intent: ActivityIntent;
  monthTotalLabel?: string;
  accent?: string;
  selectedMonthDate: Date;
  onVisibleMonthChange?: (monthDate: Date) => void;
  onDayPress?: (dateKey: string) => void;
}) {
  const now = useMemo(() => new Date(), []);
  const historyEarliestDateKey = useAppStore(
    state => state.historyEarliestDateKey,
  );

  const earliestStart = useMemo(
    () =>
      resolveInsightCalendarStartDate({
        moments,
        activityCreatedAt: activity.createdAt,
        historyEarliestDateKey,
        now,
      }),
    [activity.createdAt, historyEarliestDateKey, moments, now],
  );

  const earliestMonth = useMemo(
    () => monthStartInAppTz(earliestStart),
    [earliestStart],
  );
  const currentMonth = useMemo(() => monthStartInAppTz(now), [now]);

  const monthDate = useMemo(
    () => clampMonthToRange(selectedMonthDate, earliestMonth, currentMonth),
    [currentMonth, earliestMonth, selectedMonthDate],
  );

  const loggedCounts = useMemo(() => countLogsByDateKey(moments), [moments]);

  const page = useMemo(
    () =>
      buildInsightCalendarMonth({
        intent,
        reminderEnabled: activity.reminderEnabled,
        reminderRepeat: activity.reminderRepeat,
        loggedCounts,
        monthDate,
        now,
      }),
    [
      activity.reminderEnabled,
      activity.reminderRepeat,
      intent,
      loggedCounts,
      monthDate,
      now,
    ],
  );

  const canGoPrev = monthDate.getTime() > earliestMonth.getTime();
  const canGoNext = monthDate.getTime() < currentMonth.getTime();

  const goPrev = useCallback(() => {
    if (!canGoPrev) {
      return;
    }
    onVisibleMonthChange?.(
      clampMonthToRange(shiftMonth(monthDate, -1), earliestMonth, currentMonth),
    );
  }, [
    canGoPrev,
    currentMonth,
    earliestMonth,
    monthDate,
    onVisibleMonthChange,
  ]);

  const goNext = useCallback(() => {
    if (!canGoNext) {
      return;
    }
    onVisibleMonthChange?.(
      clampMonthToRange(shiftMonth(monthDate, 1), earliestMonth, currentMonth),
    );
  }, [
    canGoNext,
    currentMonth,
    earliestMonth,
    monthDate,
    onVisibleMonthChange,
  ]);

  return (
    <View style={styles.calendar}>
      <CalendarMonthGrid
        cells={page.cells}
        monthKey={toMonthKey(monthDate)}
        monthTotalLabel={monthTotalLabel}
        accent={accent}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        onPrevMonth={goPrev}
        onNextMonth={goNext}
        onDayPress={onDayPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: {
    gap: 8,
  },
  calendarMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 2,
    marginLeft: -4,
  },
  navBtn: {
    padding: 2,
  },
  calendarMonth: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  monthLogsLabel: {
    flexShrink: 1,
    maxWidth: '42%',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
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
});
