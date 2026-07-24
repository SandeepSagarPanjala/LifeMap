import { History } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import { useThemeColors } from '@/hooks/use-theme-colors';
import {
  MAP_STACK_BUTTON_LEFT,
  MAP_STACK_BUTTON_SIZE,
} from '@/lib/app-constants';

type MapHistoryButtonProps = {
  bottom: number;
  active: boolean;
  /** Red notification dot (no count) when there is history to notice. */
  showDot?: boolean;
  onPress: () => void;
};

export function MapHistoryButton({
  bottom,
  active,
  showDot = false,
  onPress,
}: MapHistoryButtonProps) {
  const colors = useThemeColors();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom, left: MAP_STACK_BUTTON_LEFT }]}
    >
      <MapGlassCircleButton
        accessibilityLabel="Show history"
        onPress={onPress}
        active={active}
      >
        <History size={22} color={colors.primary} strokeWidth={2.25} />
      </MapGlassCircleButton>
      {showDot ? <View pointerEvents="none" style={styles.dot} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    width: MAP_STACK_BUTTON_SIZE,
    height: MAP_STACK_BUTTON_SIZE,
  },
  dot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 10,
    height: 10,
    borderRadius: 6,
    backgroundColor: '#FF3B30',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    zIndex: 2,
  },
});
