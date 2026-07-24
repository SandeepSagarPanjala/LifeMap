import { MapPin } from 'lucide-react-native';

import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { MAP_STACK_BUTTON_LEFT } from '@/lib/app-constants';

type MapPlacesButtonProps = {
  bottom: number;
  onPress: () => void;
};

export function MapPlacesButton({ bottom, onPress }: MapPlacesButtonProps) {
  const colors = useThemeColors();

  return (
    <MapGlassCircleButton
      accessibilityLabel="Open saved places"
      onPress={onPress}
      style={{ position: 'absolute', bottom, left: MAP_STACK_BUTTON_LEFT }}
    >
      <MapPin size={22} color={colors.primary} strokeWidth={2.25} />
    </MapGlassCircleButton>
  );
}
