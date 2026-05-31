import {useColorScheme} from 'react-native';

import {THEME, type ThemeColors} from '@/lib/constants';

export function useThemeColors(): ThemeColors {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark' ? THEME.dark : THEME.light;
}
