import {useEffect, useMemo, useState} from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import {ChevronLeft, ChevronRight} from 'lucide-react-native';
import {Modal, Pressable, StyleSheet, View} from 'react-native';

import {Text} from '@/components/ui/text';
import {
  getTodayDateKey,
  parseDateKey,
  toDateKey,
} from '@/lib/day-utils';
import {HISTORY_COLORS} from '@/lib/history-timeline';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type HistoryDatePickerSheetProps = {
  visible: boolean;
  selectedDateKey: string;
  dateKeysWithData: Set<string>;
  onSelectDate: (dateKey: string) => void;
  onClose: () => void;
};

export function HistoryDatePickerSheet({
  visible,
  selectedDateKey,
  dateKeysWithData,
  onSelectDate,
  onClose,
}: HistoryDatePickerSheetProps) {
  const todayKey = getTodayDateKey();
  const today = useMemo(() => startOfDay(new Date()), []);
  const selectedDay = parseDateKey(selectedDateKey);

  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(selectedDay),
  );

  useEffect(() => {
    if (visible) {
      setVisibleMonth(startOfMonth(parseDateKey(selectedDateKey)));
    }
  }, [visible, selectedDateKey]);

  const monthLabel = format(visibleMonth, 'MMMM yyyy');

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth);
    const monthEnd = endOfMonth(visibleMonth);
    const gridStart = startOfWeek(monthStart, {weekStartsOn: 0});
    const gridEnd = endOfWeek(monthEnd, {weekStartsOn: 0});
    return eachDayOfInterval({start: gridStart, end: gridEnd});
  }, [visibleMonth]);

  const handleSelect = (day: Date) => {
    const key = toDateKey(day);
    if (isAfter(startOfDay(day), today)) {
      return;
    }
    onSelectDate(key);
    onClose();
  };

  const goToToday = () => {
    onSelectDate(todayKey);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={event => event.stopPropagation()}>
          <View style={styles.handle} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Jump to today"
            onPress={goToToday}
            style={styles.todayRow}>
            <Text style={styles.todayLabel}>Today</Text>
            <Text style={styles.todayHint}>
              {format(today, 'EEEE, MMM d')}
            </Text>
          </Pressable>

          <View style={styles.monthNav}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              onPress={() => setVisibleMonth(month => subMonths(month, 1))}
              style={styles.monthNavBtn}>
              <ChevronLeft size={22} color={HISTORY_COLORS.playhead} />
            </Pressable>
            <Text style={styles.monthTitle}>{monthLabel}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next month"
              onPress={() => setVisibleMonth(month => addMonths(month, 1))}
              style={styles.monthNavBtn}>
              <ChevronRight size={22} color={HISTORY_COLORS.playhead} />
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
              const isFuture = isAfter(startOfDay(day), today);
              const isSelected = isSameDay(day, selectedDay);
              const isToday = dateKey === todayKey;
              const hasData = dateKeysWithData.has(dateKey);

              return (
                <Pressable
                  key={dateKey}
                  accessibilityRole="button"
                  accessibilityLabel={format(day, 'MMMM d, yyyy')}
                  disabled={isFuture}
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
                        isFuture && styles.dayTextDisabled,
                        isSelected && styles.dayTextSelected,
                        hasData && !isSelected && styles.dayTextHasData,
                      ]}>
                      {format(day, 'd')}
                    </Text>
                    {hasData ? (
                      <View
                        style={[
                          styles.dataDot,
                          isSelected && styles.dataDotSelected,
                        ]}
                      />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D1D6',
    marginBottom: 12,
  },
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
  dayTextHasData: {
    fontWeight: '700',
  },
  dataDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: HISTORY_COLORS.stay,
  },
  dataDotSelected: {
    backgroundColor: '#FFFFFF',
  },
});
