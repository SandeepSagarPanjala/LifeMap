import type {NativeStackNavigationOptions} from '@react-navigation/native-stack';

import {ACCENT_THEMES} from '@/lib/color-themes';

export function settingsSubScreenOptions(
  title: string,
): NativeStackNavigationOptions {
  return {
    title,
    headerBackTitle: 'Settings',
    presentation: 'card',
  };
}

export const DISTANCE_UNIT_LABELS = {
  km: 'Kilometers',
  mi: 'Miles',
} as const;

export const PREFERRED_MAP_APP_LABELS = {
  apple: 'Apple Maps',
  google: 'Google Maps',
} as const;

export function accentThemeLabel(themeId: keyof typeof ACCENT_THEMES): string {
  return ACCENT_THEMES[themeId].name;
}
