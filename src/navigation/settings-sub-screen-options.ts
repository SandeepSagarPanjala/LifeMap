import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { ACCENT_THEMES } from '@/lib/app-constants';
import { APP_COPY } from '@/lib/app-copy';

/** Headerless Settings stack screens — chrome lives in SettingsScreenLayout. */
export function settingsSubScreenOptions(
  _title?: string,
): NativeStackNavigationOptions {
  return {
    headerShown: false,
    presentation: 'card',
  };
}

export const DISTANCE_UNIT_LABELS = APP_COPY.settings.distanceUnits;

export function accentThemeLabel(themeId: keyof typeof ACCENT_THEMES): string {
  return ACCENT_THEMES[themeId].name;
}
