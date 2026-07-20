import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { ACCENT_THEMES } from '@/lib/app-constants';
import {
  themeTokensToColors,
  type ResolvedThemeColors,
} from '@/lib/color-themes';
import { useAppStore } from '@/stores/app-store';

export function useThemeColors(): ResolvedThemeColors {
  const colorScheme = useColorScheme();
  const accentTheme = useAppStore(state => state.accentTheme);
  const tokens =
    ACCENT_THEMES[accentTheme][colorScheme === 'dark' ? 'dark' : 'light'];

  // Stable reference across renders (tokens only change on theme/scheme change)
  // so the many consumers of `colors` don't get a fresh object every render,
  // which would defeat their memoization (deps, memo props, etc.).
  return useMemo(() => themeTokensToColors(tokens), [tokens]);
}
