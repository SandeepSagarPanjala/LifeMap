import type {NativeStackNavigationOptions} from '@react-navigation/native-stack';

import {APP_COPY} from '@/lib/app-copy';
import {ACCENT_THEMES} from '@/lib/app-constants';

export function settingsSubScreenOptions(
  title: string,
): NativeStackNavigationOptions {
  return {
    title,
    headerBackTitle: APP_COPY.common.settings,
    presentation: 'card',
  };
}

export const DISTANCE_UNIT_LABELS = APP_COPY.settings.distanceUnits;

export const PREFERRED_MAP_APP_LABELS = APP_COPY.settings.mapApps;

export function accentThemeLabel(themeId: keyof typeof ACCENT_THEMES): string {
  return ACCENT_THEMES[themeId].name;
}
