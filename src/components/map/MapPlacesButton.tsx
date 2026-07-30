import { MapPin } from 'lucide-react-native';

import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import { useThemeColors } from '@/hooks/use-theme-colors';
import {
  MAP_STACK_BUTTON_LEFT,
  MAP_STACK_BUTTON_RIGHT,
} from '@/lib/app-constants';

type MapPlacesButtonProps = {
  onPress: () => void;
} & (
  | { bottom: number; top?: never; placement?: 'left' }
  | { top: number; bottom?: never; placement: 'right' }
);

export function MapPlacesButton(props: MapPlacesButtonProps) {
  const colors = useThemeColors();
  const { onPress } = props;
  const style =
    props.placement === 'right'
      ? {
          position: 'absolute' as const,
          top: props.top,
          right: MAP_STACK_BUTTON_RIGHT,
        }
      : {
          position: 'absolute' as const,
          bottom: props.bottom,
          left: MAP_STACK_BUTTON_LEFT,
        };

  return (
    <MapGlassCircleButton
      accessibilityLabel="Open saved places"
      onPress={onPress}
      style={style}
    >
      <MapPin size={22} color={colors.primary} strokeWidth={2.25} />
    </MapGlassCircleButton>
  );
}
