import {CalendarDays} from 'lucide-react-native';
import {Pressable} from 'react-native';

import {useThemeColors} from '@/hooks/use-theme-colors';

import {
  MAP_STACK_BUTTON_LEFT,
  mapStackButtonStyles,
} from './map-stack-button-styles';

type MapCalendarButtonProps = {
  bottom: number;
  onPress: () => void;
};

export function MapCalendarButton({bottom, onPress}: MapCalendarButtonProps) {
  const colors = useThemeColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Choose history date"
      onPress={onPress}
      style={[mapStackButtonStyles.button, {bottom, left: MAP_STACK_BUTTON_LEFT}]}>
      <CalendarDays size={22} color={colors.primary} strokeWidth={2.25} />
    </Pressable>
  );
}
