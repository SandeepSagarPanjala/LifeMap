import {Route} from 'lucide-react-native';
import {Pressable, StyleSheet} from 'react-native';

import {useThemeColors} from '@/hooks/use-theme-colors';

type MapTripsButtonProps = {
  bottom: number;
  active: boolean;
  onPress: () => void;
};

export function MapTripsButton({bottom, active, onPress}: MapTripsButtonProps) {
  const colors = useThemeColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={active ? 'Hide trips' : 'Show trips'}
      onPress={onPress}
      style={[styles.button, {bottom}, active && styles.buttonActive]}>
      <Route size={22} color={colors.primary} strokeWidth={2.25} />
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
  buttonActive: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
});
