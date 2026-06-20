import {ChevronLeft, ChevronRight, X} from 'lucide-react-native';
import {StyleSheet, Text, View} from 'react-native';

import {MapCircleButton} from '@/components/map/MapCircleButton';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {
  MAP_DATE_NAV_ROW_GAP,
  MAP_SETTINGS_SIZE,
  MAP_STACK_BUTTON_SIZE,
} from '@/screens/map/map-screen-constants';

const MAP_CLOSE_ICON_COLOR = '#E0352B';

type HistoryPanelChromeProps = {
  viewingToday: boolean;
  label: string;
  canGoPrev?: boolean;
  canGoNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
};

export function HistoryPanelChrome({
  viewingToday,
  label,
  canGoPrev = false,
  canGoNext = false,
  onPrev,
  onNext,
  onClose,
}: HistoryPanelChromeProps) {
  const colors = useThemeColors();

  if (viewingToday) {
    return (
      <View
        pointerEvents="box-none"
        accessibilityRole="toolbar"
        accessibilityLabel="Close history"
        style={styles.wrap}>
        <MapCircleButton
          accessibilityLabel="Close history"
          variant="softRed"
          onPress={onClose}>
          <X size={20} color={MAP_CLOSE_ICON_COLOR} strokeWidth={2.5} />
        </MapCircleButton>
      </View>
    );
  }

  return (
    <View
      pointerEvents="box-none"
      accessibilityRole="toolbar"
      accessibilityLabel={`Map showing ${label}`}
      style={styles.wrap}>
      <MapCircleButton
        accessibilityLabel="Return to today"
        variant="softRed"
        onPress={onClose}>
        <X size={20} color={MAP_CLOSE_ICON_COLOR} strokeWidth={2.5} />
      </MapCircleButton>

      <View style={styles.dateRow} pointerEvents="box-none">
        <MapCircleButton
          accessibilityLabel="Previous day"
          disabled={!canGoPrev}
          onPress={() => onPrev?.()}>
          <ChevronLeft
            size={22}
            color={colors.primary}
            strokeWidth={2.5}
            opacity={canGoPrev ? 1 : 0.35}
          />
        </MapCircleButton>

        <View style={styles.pill}>
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
        </View>

        <MapCircleButton
          accessibilityLabel="Next day"
          disabled={!canGoNext}
          onPress={() => onNext?.()}>
          <ChevronRight
            size={22}
            color={colors.primary}
            strokeWidth={2.5}
            opacity={canGoNext ? 1 : 0.35}
          />
        </MapCircleButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: MAP_DATE_NAV_ROW_GAP,
  },
  pill: {
    minHeight: MAP_STACK_BUTTON_SIZE,
    maxWidth: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: MAP_STACK_BUTTON_SIZE / 2,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'center',
  },
});

export function historyPanelChromeHeight(viewingToday: boolean): number {
  return viewingToday
    ? MAP_SETTINGS_SIZE
    : MAP_SETTINGS_SIZE + MAP_DATE_NAV_ROW_GAP + MAP_STACK_BUTTON_SIZE;
}
