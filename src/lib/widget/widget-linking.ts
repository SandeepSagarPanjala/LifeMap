import type { LinkingOptions } from '@react-navigation/native';

import type { RootStackParamList } from '@/navigation/types';

import { WIDGET_DEEP_LINK_PREFIX } from './types';

export const widgetLinking: LinkingOptions<RootStackParamList> = {
  prefixes: [WIDGET_DEEP_LINK_PREFIX],
  config: {
    screens: {
      Map: {
        path: 'map',
        parse: {
          widgetAction: (value: string) => value,
        },
      },
      CaptureNote: 'capture/note',
      CapturePhoto: 'capture/photo',
      CaptureVoice: 'capture/voice',
      CaptureActivity: 'capture/activity',
      SavedPlaces: 'saved-places',
      Settings: 'settings',
    },
  },
};

export function parseWidgetActionFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'lifemap:') {
      return null;
    }
    if (parsed.pathname === '/map' || parsed.hostname === 'map') {
      return parsed.searchParams.get('widgetAction');
    }
    return null;
  } catch {
    return null;
  }
}
