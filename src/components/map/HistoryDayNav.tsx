import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { AdaptiveGlassSurface } from '@/components/glass/AdaptiveGlassSurface';
import { getTodayDateKey, shiftDateKey } from '@/lib/day-utils';
import { HISTORY_COLORS } from '@/lib/app-constants';
import { formatHistoryDayNavLabel } from '@/lib/history-timeline';
import { useAppStore } from '@/stores/app-store';

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
  const todayKey = getTodayDateKey();
  const earliestDateKey = useAppStore(state => state.historyEarliestDateKey);
  const isToday = dateKey === todayKey;
  const canGoNextDay = !isToday;
  const canGoPrevDay = earliestDateKey == null || dateKey > earliestDateKey;

  const goPrevDay = useCallback(() => {
    if (!canGoPrevDay) {
      return;
    }
    const nextKey = shiftDateKey(dateKey, -1);
    if (earliestDateKey != null && nextKey < earliestDateKey) {
      onDateKeyChange(earliestDateKey);
      return;
    }
    onDateKeyChange(nextKey);
  }, [canGoPrevDay, dateKey, earliestDateKey, onDateKeyChange]);

  const goNextDay = useCallback(() => {
    if (canGoNextDay) {
      onDateKeyChange(shiftDateKey(dateKey, 1));
    }
  }, [canGoNextDay, dateKey, onDateKeyChange]);

  return (
    <View style={styles.wrap}>
      <View style={styles.groupShadow}>
        <AdaptiveGlassSurface effect="regular" style={styles.group}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous day"
            disabled={!canGoPrevDay}
            onPress={goPrevDay}
            style={({ pressed }) => [
              styles.sideBtn,
              pressed && canGoPrevDay ? styles.btnPressed : null,
            ]}
          >
            <ChevronLeft
              size={18}
              color={ICON_COLOR}
              strokeWidth={2.5}
              opacity={canGoPrevDay ? 1 : 0.35}
            />
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${dayLabel}, choose date`}
            onPress={onOpenDatePicker}
            style={({ pressed }) => [
              styles.centerBtn,
              pressed ? styles.btnPressed : null,
            ]}
          >
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
            style={({ pressed }) => [
              styles.sideBtn,
              pressed && canGoNextDay ? styles.btnPressed : null,
            ]}
          >
            <ChevronRight
              size={18}
              color={ICON_COLOR}
              strokeWidth={2.5}
              opacity={canGoNextDay ? 1 : 0.35}
            />
          </Pressable>
        </AdaptiveGlassSurface>
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
  groupShadow: {
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 5,
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    overflow: 'hidden',
  },
  sideBtn: {
    minWidth: 52,
    height: 40,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerBtn: {
    minWidth: 120,
    height: 40,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: ICON_COLOR,
    textAlign: 'center',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 22,
    alignSelf: 'center',
    backgroundColor: 'rgba(60,60,67,0.18)',
    marginHorizontal: 6,
  },
  btnPressed: {
    backgroundColor: 'rgba(120,120,128,0.12)',
  },
});
