import {useColorScheme} from 'react-native';

import {ACCENT_THEMES} from '@/lib/app-constants';
import {themeTokensToColors, type ResolvedThemeColors} from '@/lib/color-themes';
import {useAppStore} from '@/stores/app-store';

export function useThemeColors(): ResolvedThemeColors {
  const colorScheme = useColorScheme();
  const accentTheme = useAppStore(state => state.accentTheme);
  const tokens =
    ACCENT_THEMES[accentTheme][colorScheme === 'dark' ? 'dark' : 'light'];

  return themeTokensToColors(tokens);
}
