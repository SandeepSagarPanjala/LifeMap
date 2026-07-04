/** Map, history timeline, route, and saved-place visual tokens. */

export const MAP_SOFT_BLUE_BUTTON_BG = '#E8F2FF';

export const HISTORY_ANCHOR_SIZE_PX = 20;
export const HISTORY_MIN_GAP_SEGMENT_PX = 2;

export const HISTORY_COLORS = {
  track: '#FFFFFF',
  trackEdge: '#E5E5EA',
  stay: '#FF9500',
  stayMuted: '#FFC56E',
  travel: '#007AFF',
  travelMuted: '#6EB0FF',
  gap: '#AEAEB2',
  gapMuted: '#D1D1D6',
  segmentSelectedBorder: '#FFFFFF',
  playhead: '#1C1C1E',
  anchor: '#FFFFFF',
  anchorBorder: '#1C1C1E',
  tickLabel: '#636366',
  tickMinor: '#C7C7CC',
  tickMajor: '#8E8E93',
  nowMarker: '#34C759',
} as const;

export const SAVED_PLACE_MAP_STYLE = {
  home: {
    fill: 'rgba(255, 149, 0, 0.07)',
    stroke: 'rgba(255, 149, 0, 0.22)',
    badgeBg: '#FFF8EE',
    icon: '#FF9500',
  },
  work: {
    fill: 'rgba(0, 122, 255, 0.07)',
    stroke: 'rgba(0, 122, 255, 0.22)',
    badgeBg: '#F2F8FF',
    icon: '#007AFF',
  },
  favorite: {
    fill: 'rgba(255, 55, 95, 0.07)',
    stroke: 'rgba(255, 55, 95, 0.22)',
    badgeBg: '#FFF5F7',
    icon: '#FF375F',
  },
} as const;

export const BOTTOM_SHEET_HANDLE = {
  width: 36,
  height: 4,
  borderRadius: 2,
  color: '#D1D1D6',
  rowHeight: 24,
} as const;

export const BOTTOM_SHEET_BACKDROP = {
  color: 'rgba(0, 0, 0, 0.32)',
} as const;

export const BOTTOM_SHEET_SURFACE = {
  backgroundColor: '#FFFFFF',
  cornerRadius: 20,
  contentPaddingHorizontal: 20,
  contentPaddingTop: 4,
} as const;

/** Life360-style journey path on the map (no dots along the line). */
export const ROUTE_PATH_OPACITY = 0.35;

export const ROUTE_PATH_FILL = `rgba(0, 122, 255, ${ROUTE_PATH_OPACITY})`;
export const ROUTE_PATH_BORDER = `rgba(255, 255, 255, ${ROUTE_PATH_OPACITY})`;

export const STAY_AREA_OPACITY = 0.28;
export const STAY_AREA_FILL = `rgba(255, 149, 0, ${STAY_AREA_OPACITY})`;
export const STAY_AREA_STROKE = `rgba(255, 149, 0, ${STAY_AREA_OPACITY + 0.12})`;
export const STAY_AREA_STROKE_WIDTH = 2;

export const STAY_AREA_EMPHASIS_OPACITY = 0.45;
export const STAY_AREA_FILL_EMPHASIS = `rgba(255, 149, 0, ${STAY_AREA_EMPHASIS_OPACITY})`;
export const STAY_AREA_STROKE_EMPHASIS = `rgba(255, 149, 0, ${STAY_AREA_EMPHASIS_OPACITY + 0.15})`;
export const ROUTE_PATH_FILL_SOLID = 'rgba(0, 122, 255, 1)';
export const ROUTE_PATH_BORDER_SOLID = 'rgba(255, 255, 255, 1)';
export const ROUTE_PATH_BORDER_WIDTH = 9;
export const ROUTE_PATH_FILL_WIDTH = 4.5;

export const VISIT_CONNECTOR_STROKE = 'rgba(0, 122, 255, 0.7)';
export const VISIT_CONNECTOR_STROKE_WIDTH = 2;
export const VISIT_CONNECTOR_DASH_PATTERN = [3, 5] as const;

export const HISTORY_PAST_ROUTE_FILL = 'rgba(142, 142, 147, 0.5)';
export const HISTORY_PAST_ROUTE_BORDER = 'rgba(255, 255, 255, 0.35)';
export const HISTORY_PAST_STAY_FILL = 'rgba(142, 142, 147, 0.28)';
export const HISTORY_PAST_STAY_STROKE = 'rgba(142, 142, 147, 0.45)';

export const HISTORY_FUTURE_ROUTE_FILL = ROUTE_PATH_FILL;
export const HISTORY_FUTURE_ROUTE_BORDER = ROUTE_PATH_BORDER;
export const HISTORY_FUTURE_STAY_FILL = 'rgba(0, 122, 255, 0.2)';
export const HISTORY_FUTURE_STAY_STROKE = 'rgba(0, 122, 255, 0.32)';

export const HISTORY_GHOST_ROUTE_BORDER_WIDTH = 7;
export const HISTORY_GHOST_ROUTE_FILL_WIDTH = 3.5;

/** Theme destructive token (HSL components). */
export const THEME_DESTRUCTIVE_HSL = '0 72% 51%';
export const THEME_DESTRUCTIVE_FOREGROUND_HSL = '0 0% 100%';
