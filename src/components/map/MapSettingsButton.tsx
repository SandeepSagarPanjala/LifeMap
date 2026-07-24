import { Settings } from 'lucide-react-native';

import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import { useThemeColors } from '@/hooks/use-theme-colors';
import {
  MAP_SETTINGS_SIZE,
  MAP_STACK_BUTTON_RIGHT,
} from '@/lib/app-constants';

type MapSettingsButtonProps = {
  top: number;
  onPress: () => void;
};

export function MapSettingsButton({ top, onPress }: MapSettingsButtonProps) {
  const colors = useThemeColors();

  return (
    <MapGlassCircleButton
      accessibilityLabel="Settings"
      onPress={onPress}
      size={MAP_SETTINGS_SIZE}
      style={{ position: 'absolute', top, right: MAP_STACK_BUTTON_RIGHT }}
    >
      <Settings size={22} color={colors.primary} strokeWidth={2.25} />
    </MapGlassCircleButton>
  );
}
