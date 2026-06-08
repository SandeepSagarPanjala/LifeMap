import {useCallback, useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {ChevronLeft, ChevronRight} from 'lucide-react-native';

import {getTodayDateKey, shiftDateKey} from '@/lib/day-utils';
import {formatHistoryDayNavLabel, HISTORY_COLORS} from '@/lib/history-timeline';

const ICON_COLOR = HISTORY_COLORS.playhead;

type HistoryDayNavProps = {
  dateKey: string;
  onDateKeyChange: (dateKey: string) => void;
  onOpenDatePicker: () => void;
};

export function HistoryDayNav({
  dateKey,
  onDateKeyChange,
  onOpenDatePicker,
}: HistoryDayNavProps) {
  const now = useMemo(() => new Date(), []);
  const dayLabel = formatHistoryDayNavLabel(dateKey, now);
  const isToday = dateKey === getTodayDateKey();
  const canGoNextDay = !isToday;

  const goPrevDay = useCallback(() => {
    onDateKeyChange(shiftDateKey(dateKey, -1));
  }, [dateKey, onDateKeyChange]);

  const goNextDay = useCallback(() => {
    if (canGoNextDay) {
      onDateKeyChange(shiftDateKey(dateKey, 1));
    }
  }, [canGoNextDay, dateKey, onDateKeyChange]);

  return (
    <View style={styles.wrap}>
      <View style={styles.group}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous day"
          onPress={goPrevDay}
          style={({pressed}) => [
            styles.sideBtn,
            pressed ? styles.btnPressed : null,
          ]}>
          <ChevronLeft size={18} color={ICON_COLOR} strokeWidth={2.5} />
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${dayLabel}, choose date`}
          onPress={onOpenDatePicker}
          style={({pressed}) => [
            styles.centerBtn,
            pressed ? styles.btnPressed : null,
          ]}>
          <Text style={styles.centerLabel} numberOfLines={1}>
            {dayLabel}
          </Text>
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next day"
          disabled={!canGoNextDay}
          onPress={goNextDay}
          style={({pressed}) => [
            styles.sideBtn,
            !canGoNextDay && styles.sideBtnDisabled,
            pressed && canGoNextDay ? styles.btnPressed : null,
          ]}>
          <ChevronRight
            size={18}
            color={ICON_COLOR}
            strokeWidth={2.5}
            opacity={canGoNextDay ? 1 : 0.35}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 5,
  },
  sideBtn: {
    width: 44,
    height: 38,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideBtnDisabled: {
    opacity: 0.45,
  },
  centerBtn: {
    minWidth: 128,
    height: 38,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: ICON_COLOR,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: '#E5E5EA',
  },
  btnPressed: {
    backgroundColor: '#F2F2F7',
  },
});
