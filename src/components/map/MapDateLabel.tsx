import {ChevronLeft, ChevronRight, X} from 'lucide-react-native';
import {StyleSheet, Text, View, type StyleProp, type ViewStyle} from 'react-native';

import {MapCircleButton} from '@/components/map/MapCircleButton';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {
  MAP_SETTINGS_SIZE,
  MAP_SETTINGS_TOP_GAP,
  MAP_STACK_BUTTON_SIZE,
} from '@/screens/map/map-screen-constants';

type MapDateLabelProps = {
  label: string;
  topInset: number;
  showNavigation?: boolean;
  /** When set, docks the navigation cluster above the history panel. */
  anchorBottom?: number;
  canGoPrev?: boolean;
  canGoNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onClose?: () => void;
};

const MAP_CLOSE_ICON_COLOR = '#E0352B';
const MAP_DATE_NAV_ROW_GAP = 10;

export function MapDateLabel({
  label,
  topInset,
  showNavigation = false,
  anchorBottom,
  canGoPrev = false,
  canGoNext = false,
  onPrev,
  onNext,
  onClose,
}: MapDateLabelProps) {
  const colors = useThemeColors();
  const top = topInset + MAP_SETTINGS_TOP_GAP;

  if (!showNavigation) {
    return (
      <View
        pointerEvents="none"
        accessibilityRole="text"
        accessibilityLabel={`Map showing ${label}`}
        style={[styles.wrap, {top, height: MAP_SETTINGS_SIZE}]}>
        <View style={styles.pill}>
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
        </View>
      </View>
    );
  }

  const positionStyle: StyleProp<ViewStyle> =
    anchorBottom != null ? {bottom: anchorBottom} : {top};

  return (
    <View
      pointerEvents="box-none"
      accessibilityRole="toolbar"
      accessibilityLabel={`Map showing ${label}`}
      style={[styles.navWrap, positionStyle]}>
      <MapCircleButton
        accessibilityLabel="Return to today"
        variant="softRed"
        onPress={() => onClose?.()}>
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
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
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
