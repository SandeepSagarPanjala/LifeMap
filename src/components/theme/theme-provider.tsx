import { View, useColorScheme } from 'react-native';
import { vars } from 'nativewind';
import { useMemo, type ReactNode } from 'react';

import { ACCENT_THEMES } from '@/lib/app-constants';
import { themeTokensToCssVars } from '@/lib/color-themes';
import { useAppStore } from '@/stores/app-store';

type ThemeProviderProps = {
  children: ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const colorScheme = useColorScheme();
  const accentTheme = useAppStore(state => state.accentTheme);
  const tokens =
    ACCENT_THEMES[accentTheme][colorScheme === 'dark' ? 'dark' : 'light'];

  // Rebuild CSS vars only when the resolved token set changes, not on every
  // parent re-render (this View wraps the whole app tree).
  const themeStyle = useMemo(() => vars(themeTokensToCssVars(tokens)), [tokens]);

  return (
    <View className="flex-1 bg-background" style={themeStyle}>
      {children}
    </View>
  );
}
