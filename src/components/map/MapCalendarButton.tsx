import { CalendarDays } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { useThemeColors } from '@/hooks/use-theme-colors';

import { MAP_STACK_BUTTON_LEFT } from '@/lib/app-constants';
import { mapStackButtonStyles } from './map-stack-button-styles';

type MapCalendarButtonProps = {
  bottom: number;
  highlighted?: boolean;
  onPress: () => void;
};

export function MapCalendarButton({
  bottom,
  highlighted = false,
  onPress,
}: MapCalendarButtonProps) {
  const colors = useThemeColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Choose history date"
      onPress={onPress}
      style={[
        mapStackButtonStyles.button,
        { bottom, left: MAP_STACK_BUTTON_LEFT },
        highlighted && mapStackButtonStyles.buttonSoftBlue,
      ]}
    >
      <CalendarDays size={22} color={colors.primary} strokeWidth={2.25} />
    </Pressable>
  );
}
