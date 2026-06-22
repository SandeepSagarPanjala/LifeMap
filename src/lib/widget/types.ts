export type WidgetPlaceKind = 'home' | 'work' | 'favorite' | 'nearby' | 'none';

export type WidgetSnapshot = {
  updatedAt: string;
  placeLabel: string;
  placeKind: WidgetPlaceKind;
  durationLabel: string | null;
  dateLabel: string;
  isOngoing: boolean;
};

export type WidgetCaptureAction = 'voice' | 'activity';

export type WidgetMapAction = WidgetCaptureAction | 'refresh';

export const WIDGET_DEEP_LINK_PREFIX = 'lifemap://';

export const WIDGET_CAPTURE_LINKS = {
  note: `${WIDGET_DEEP_LINK_PREFIX}capture/note`,
  photo: `${WIDGET_DEEP_LINK_PREFIX}capture/photo`,
  voice: `${WIDGET_DEEP_LINK_PREFIX}capture/voice`,
  activity: `${WIDGET_DEEP_LINK_PREFIX}capture/activity`,
  refresh: `${WIDGET_DEEP_LINK_PREFIX}map?widgetAction=refresh`,
} as const;
