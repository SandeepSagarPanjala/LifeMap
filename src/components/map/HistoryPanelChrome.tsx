import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '@/components/glass/GlassSurface';
import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import { useThemeColors } from '@/hooks/use-theme-colors';
import {
  MAP_DATE_NAV_ROW_GAP,
  MAP_SETTINGS_SIZE,
  MAP_STACK_BUTTON_SIZE,
} from '@/lib/app-constants';

const MAP_CLOSE_ICON_COLOR = '#E0352B';
const MAP_WARNING_CLOSE_ICON_COLOR = '#FF9500';

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
  const colors = useThemeColors();
  const accent = colors.primary;
  const closeTint = viewingToday ? 'danger' : 'warning';
  const closeIconColor = viewingToday
    ? MAP_CLOSE_ICON_COLOR
    : MAP_WARNING_CLOSE_ICON_COLOR;

  return (
    <View
      pointerEvents="box-none"
      accessibilityRole="toolbar"
      accessibilityLabel={
        viewingToday ? 'History controls' : `Map showing ${label}`
      }
      style={styles.wrap}
    >
      <MapGlassCircleButton
        accessibilityLabel={
          viewingToday ? 'Close history' : 'Close day history'
        }
        tint={closeTint}
        onPress={onClose}
      >
        <X size={20} color={closeIconColor} strokeWidth={2.5} />
      </MapGlassCircleButton>

      <View style={styles.dateRow} pointerEvents="box-none">
        <MapGlassCircleButton
          accessibilityLabel="Previous day"
          disabled={!canGoPrev}
          onPress={() => onPrev?.()}
        >
          <ChevronLeft
            size={22}
            color={accent}
            strokeWidth={2.5}
            opacity={canGoPrev ? 1 : 0.35}
          />
        </MapGlassCircleButton>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose date"
          onPress={onPressLabel}
        >
          <View style={styles.pillShadow}>
            <GlassSurface style={styles.pill}>
              <Text style={[styles.label, { color: accent }]} numberOfLines={1}>
                {label}
              </Text>
            </GlassSurface>
          </View>
        </Pressable>

        <MapGlassCircleButton
          accessibilityLabel="Next day"
          disabled={!canGoNext}
          onPress={() => onNext?.()}
        >
          <ChevronRight
            size={22}
            color={accent}
            strokeWidth={2.5}
            opacity={canGoNext ? 1 : 0.35}
          />
        </MapGlassCircleButton>
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
  pillShadow: {
    borderRadius: MAP_STACK_BUTTON_SIZE / 2,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.14,
        shadowRadius: 8,
      },
      android: { elevation: 5 },
    }),
  },
  pill: {
    height: MAP_STACK_BUTTON_SIZE,
    flexShrink: 0,
    borderRadius: MAP_STACK_BUTTON_SIZE / 2,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export function historyPanelChromeHeight(): number {
  return MAP_SETTINGS_SIZE + MAP_DATE_NAV_ROW_GAP + MAP_STACK_BUTTON_SIZE;
}
