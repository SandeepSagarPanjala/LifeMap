import {View, useColorScheme} from 'react-native';
import {vars} from 'nativewind';
import type {ReactNode} from 'react';

import {
  ACCENT_THEMES,
  themeTokensToCssVars,
  type AccentThemeId,
} from '@/lib/color-themes';
import {useAppStore} from '@/stores/app-store';

type ThemeProviderProps = {
  children: ReactNode;
};

export function ThemeProvider({children}: ThemeProviderProps) {
  const colorScheme = useColorScheme();
  const accentTheme = useAppStore(state => state.accentTheme);
  const tokens =
    ACCENT_THEMES[accentTheme][colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <View className="flex-1 bg-background" style={vars(themeTokensToCssVars(tokens))}>
      {children}
    </View>
  );
}

export function useAccentThemeId(): AccentThemeId {
  return useAppStore(state => state.accentTheme);
}
