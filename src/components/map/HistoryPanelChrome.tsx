import {ChevronLeft, ChevronRight, X} from 'lucide-react-native';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {MapCircleButton} from '@/components/map/MapCircleButton';
import {CAPTURE_BUTTON_THEMES} from '@/components/map/map-capture-button-theme';
import {
  MAP_DATE_NAV_ROW_GAP,
  MAP_SETTINGS_SIZE,
  MAP_STACK_BUTTON_SIZE,
} from '@/lib/app-constants';

const MAP_CLOSE_ICON_COLOR = '#E0352B';
const HISTORY_NAV_ICON_COLOR = CAPTURE_BUTTON_THEMES.camera.icon;

type HistoryPanelChromeProps = {
  viewingToday: boolean;
  label: string;
  canGoPrev?: boolean;
  canGoNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
  onPressLabel?: () => void;
};

export function HistoryPanelChrome({
  viewingToday,
  label,
  canGoPrev = false,
  canGoNext = false,
  onPrev,
  onNext,
  onClose,
  onPressLabel,
}: HistoryPanelChromeProps) {
  return (
    <View
      pointerEvents="box-none"
      accessibilityRole="toolbar"
      accessibilityLabel={
        viewingToday ? 'History controls' : `Map showing ${label}`
      }
      style={styles.wrap}>
      <MapCircleButton
        accessibilityLabel={viewingToday ? 'Close history' : 'Return to today'}
        variant="softRed"
        onPress={onClose}>
        <X size={20} color={MAP_CLOSE_ICON_COLOR} strokeWidth={2.5} />
      </MapCircleButton>

      <View style={styles.dateRow} pointerEvents="box-none">
        <MapCircleButton
          accessibilityLabel="Previous day"
          disabled={!canGoPrev}
          variant="capture"
          onPress={() => onPrev?.()}>
          <ChevronLeft
            size={22}
            color={HISTORY_NAV_ICON_COLOR}
            strokeWidth={2.5}
            opacity={canGoPrev ? 1 : 0.35}
          />
        </MapCircleButton>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose date"
          onPress={onPressLabel}>
          <View style={styles.pill}>
            <Text style={styles.label} numberOfLines={1}>
              {label}
            </Text>
          </View>
        </Pressable>

        <MapCircleButton
          accessibilityLabel="Next day"
          disabled={!canGoNext}
          variant="capture"
          onPress={() => onNext?.()}>
          <ChevronRight
            size={22}
            color={HISTORY_NAV_ICON_COLOR}
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
    height: MAP_STACK_BUTTON_SIZE,
    flexShrink: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: MAP_STACK_BUTTON_SIZE / 2,
    paddingHorizontal: 16,
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

export function historyPanelChromeHeight(): number {
  return MAP_SETTINGS_SIZE + MAP_DATE_NAV_ROW_GAP + MAP_STACK_BUTTON_SIZE;
}
