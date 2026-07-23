import { LayoutGrid } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { MAP_STACK_BUTTON_RIGHT } from '@/lib/app-constants';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { mapStackButtonStyles } from './map-stack-button-styles';

type MapYouButtonProps = {
  bottom: number;
  onPress: () => void;
};

export function MapYouButton({ bottom, onPress }: MapYouButtonProps) {
  const colors = useThemeColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open You"
      onPress={onPress}
      style={[
        mapStackButtonStyles.button,
        styles.button,
        {
          bottom,
          right: MAP_STACK_BUTTON_RIGHT,
        },
      ]}
    >
      <LayoutGrid size={20} color={colors.primary} strokeWidth={2.25} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#FFFFFF',
  },
});
