import {ChevronLeft, ChevronRight, X} from 'lucide-react-native';
import {Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle} from 'react-native';

import {MapCircleButton} from '@/components/map/MapCircleButton';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {
  MAP_SETTINGS_SIZE,
  MAP_SETTINGS_TOP_GAP,
  MAP_STACK_BUTTON_SIZE,
  MAP_DATE_NAV_ROW_GAP,
} from '@/lib/app-constants';

type MapDateLabelProps = {
  label: string;
  topInset: number;
  showNavigation?: boolean;
  /** When set, docks the navigation cluster above the history panel. */
  anchorBottom?: number;
  /** Past-day resting map — red X returns to today. Hidden on today. */
  showCloseButton?: boolean;
  canGoPrev?: boolean;
  canGoNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onClose?: () => void;
  onPressLabel?: () => void;
};

const MAP_CLOSE_ICON_COLOR = '#E0352B';

export function MapDateLabel({
  label,
  topInset,
  showNavigation = false,
  anchorBottom,
  showCloseButton = true,
  canGoPrev = false,
  canGoNext = false,
  onPrev,
  onNext,
  onClose,
  onPressLabel,
}: MapDateLabelProps) {
  const colors = useThemeColors();
  const top = topInset + MAP_SETTINGS_TOP_GAP;

  if (!showNavigation) {
    const pill = (
      <View style={styles.pill}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </View>
    );

    return (
      <View
        pointerEvents="box-none"
        accessibilityRole="text"
        accessibilityLabel={`Map showing ${label}`}
        style={[styles.wrap, {top, height: MAP_SETTINGS_SIZE}]}>
        {onPressLabel ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose date"
            onPress={onPressLabel}>
            {pill}
          </Pressable>
        ) : (
          pill
        )}
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
      {showCloseButton ? (
        <MapCircleButton
          accessibilityLabel="Return to today"
          variant="softRed"
          onPress={() => onClose?.()}>
          <X size={20} color={MAP_CLOSE_ICON_COLOR} strokeWidth={2.5} />
        </MapCircleButton>
      ) : null}

      <View
        style={[
          styles.dateRow,
          !showCloseButton && styles.dateRowWithoutClose,
        ]}
        pointerEvents="box-none">
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
  dateRowWithoutClose: {
    marginTop: 0,
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
