import {useCallback, useEffect, useMemo, useState} from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import {ChevronLeft, ChevronRight} from 'lucide-react-native';
import {Pressable, StyleSheet, View} from 'react-native';

import {Text} from '@/components/ui/text';
import {AppBottomSheet} from '@/components/ui/app-bottom-sheet';
import {
  getTodayDateKey,
  parseDateKey,
  toDateKey,
} from '@/lib/day-utils';
import {HISTORY_COLORS} from '@/lib/history-timeline';
import {useAppStore} from '@/stores/app-store';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type HistoryDatePickerSheetProps = {
  visible: boolean;
  selectedDateKey: string;
  onSelectDate: (dateKey: string) => void;
  onClose: () => void;
  instantPresent?: boolean;
  onWillClose?: () => void;
};

export function HistoryDatePickerSheet({
  visible,
  selectedDateKey,
  onSelectDate,
  onClose,
  instantPresent = false,
  onWillClose,
}: HistoryDatePickerSheetProps) {
  const todayKey = getTodayDateKey();
  const today = useMemo(() => startOfDay(new Date()), []);
  const selectedDay = parseDateKey(selectedDateKey);
  const earliestDateKey = useAppStore(state => state.historyEarliestDateKey);
  const earliestDay = useMemo(
    () =>
      earliestDateKey != null
        ? startOfDay(parseDateKey(earliestDateKey))
        : today,
    [earliestDateKey, today],
  );
  const earliestMonth = useMemo(
    () => startOfMonth(earliestDay),
    [earliestDay],
  );
  const todayMonth = useMemo(() => startOfMonth(today), [today]);

  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(selectedDay),
  );

  const syncVisibleMonth = useCallback(() => {
    const month = startOfMonth(parseDateKey(selectedDateKey));
    setVisibleMonth(
      month < earliestMonth
        ? earliestMonth
        : month > todayMonth
          ? todayMonth
          : month,
    );
  }, [earliestMonth, selectedDateKey, todayMonth]);

  useEffect(() => {
    if (visible) {
      syncVisibleMonth();
    }
  }, [syncVisibleMonth, visible]);

  const monthLabel = format(visibleMonth, 'MMMM yyyy');
  const canGoPrevMonth = visibleMonth > earliestMonth;
  const canGoNextMonth = visibleMonth < todayMonth;

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth);
    const monthEnd = endOfMonth(visibleMonth);
    const gridStart = startOfWeek(monthStart, {weekStartsOn: 0});
    const gridEnd = endOfWeek(monthEnd, {weekStartsOn: 0});
    return eachDayOfInterval({start: gridStart, end: gridEnd});
  }, [visibleMonth]);

  const handleSelect = (day: Date) => {
    const dayStart = startOfDay(day);
    if (isAfter(dayStart, today) || isBefore(dayStart, earliestDay)) {
      return;
    }
    onSelectDate(toDateKey(day));
    onClose();
  };

  const goToToday = () => {
    onSelectDate(todayKey);
    onClose();
  };

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      enableDynamicSizing
      instantPresent={instantPresent}
      onClosing={onWillClose}
      releaseTouchesWhileClosing={instantPresent}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Jump to today"
        onPress={goToToday}
        style={styles.todayRow}>
        <Text style={styles.todayLabel}>Today</Text>
        <Text style={styles.todayHint}>{format(today, 'EEEE, MMM d')}</Text>
      </Pressable>

      <View style={styles.monthNav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          disabled={!canGoPrevMonth}
          onPress={() =>
            canGoPrevMonth && setVisibleMonth(month => subMonths(month, 1))
          }
          style={[
            styles.monthNavBtn,
            !canGoPrevMonth && styles.monthNavBtnDisabled,
          ]}>
          <ChevronLeft
            size={22}
            color={HISTORY_COLORS.playhead}
            opacity={canGoPrevMonth ? 1 : 0.35}
          />
        </Pressable>
        <Text style={styles.monthTitle}>{monthLabel}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          disabled={!canGoNextMonth}
          onPress={() =>
            canGoNextMonth && setVisibleMonth(month => addMonths(month, 1))
          }
          style={[
            styles.monthNavBtn,
            !canGoNextMonth && styles.monthNavBtnDisabled,
          ]}>
          <ChevronRight
            size={22}
            color={HISTORY_COLORS.playhead}
            opacity={canGoNextMonth ? 1 : 0.35}
          />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, index) => (
          <Text key={`${label}-${index}`} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {calendarDays.map(day => {
          const dateKey = toDateKey(day);
          const inMonth = isSameMonth(day, visibleMonth);
          const dayStart = startOfDay(day);
          const isFuture = isAfter(dayStart, today);
          const isBeforeEarliest = isBefore(dayStart, earliestDay);
          const isDisabled = isFuture || isBeforeEarliest;
          const isSelected = isSameDay(day, selectedDay);
          const isToday = dateKey === todayKey;

          return (
            <Pressable
              key={dateKey}
              accessibilityRole="button"
              accessibilityLabel={format(day, 'MMMM d, yyyy')}
              disabled={isDisabled}
              onPress={() => handleSelect(day)}
              style={styles.dayCell}>
              <View
                style={[
                  styles.dayInner,
                  isSelected && styles.dayInnerSelected,
                  isToday && !isSelected && styles.dayInnerToday,
                ]}>
                <Text
                  style={[
                    styles.dayText,
                    !inMonth && styles.dayTextOutside,
                    isDisabled && styles.dayTextDisabled,
                    isSelected && styles.dayTextSelected,
                  ]}>
                  {format(day, 'd')}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
    marginBottom: 12,
  },
  todayLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: HISTORY_COLORS.travel,
  },
  todayHint: {
    fontSize: 13,
    color: HISTORY_COLORS.tickLabel,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  monthNavBtn: {
    padding: 8,
    minWidth: 40,
    alignItems: 'center',
  },
  monthNavBtnDisabled: {
    opacity: 0.45,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: HISTORY_COLORS.playhead,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: HISTORY_COLORS.tickLabel,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayInnerSelected: {
    backgroundColor: HISTORY_COLORS.travel,
  },
  dayInnerToday: {
    borderWidth: 1.5,
    borderColor: HISTORY_COLORS.travel,
  },
  dayText: {
    fontSize: 15,
    fontWeight: '500',
    color: HISTORY_COLORS.playhead,
  },
  dayTextOutside: {
    color: '#C7C7CC',
  },
  dayTextDisabled: {
    color: '#D1D1D6',
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
