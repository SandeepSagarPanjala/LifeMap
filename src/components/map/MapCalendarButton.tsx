import {CalendarDays} from 'lucide-react-native';
import {Pressable, StyleSheet} from 'react-native';

import {useThemeColors} from '@/hooks/use-theme-colors';

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
      style={[styles.button, {bottom}]}>
      <CalendarDays size={22} color={colors.primary} strokeWidth={2.25} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
});
