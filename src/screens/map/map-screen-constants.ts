import type {Region} from 'react-native-maps';

export const MAP_FALLBACK_REGION: Region = {
  latitude: 33.2148,
  longitude: -97.1331,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

export const MAP_SETTINGS_TOP_GAP = 8;
export const MAP_SETTINGS_SIZE = 44;
export const MAP_SETTINGS_STACK_GAP = 8;
export const MAP_LOCATE_BUTTON_BOTTOM_GAP = 20;
/** Full history panel (day nav + event card with moments + timeline bar). */
export const MAP_HISTORY_PANEL_HEIGHT = 208;
export const MAP_HISTORY_FLOATING_CONTROLS_GAP = 8;
/** Gap between history panel top and past-day date navigation cluster. */
export const MAP_HISTORY_DATE_NAV_GAP = 8;
/** Tighter gap when history panel is open (date nav sits just above the card). */
export const MAP_HISTORY_DATE_NAV_ABOVE_PANEL_GAP = 2;
/** Trim layout panel height so date nav hugs the visible history card top. */
export const MAP_HISTORY_DATE_NAV_PANEL_TRIM = 10;
export const MAP_STACK_BUTTON_SIZE = 44;
export const MAP_STACK_BUTTON_GAP = 8;
export const MAP_LEFT_STACK_COUNT = 4;
export const MAP_RIGHT_STACK_COUNT = 3;

/** Docked day-moment summary bar at the bottom of the map (non-history mode). */
export const DAY_MOMENT_SUMMARY_BOTTOM_GAP = 8;
export const DAY_MOMENT_SUMMARY_BAR_HEIGHT = 50;
export const DAY_MOMENT_SUMMARY_ABOVE_BAR_GAP = 12;

/** Index 0 = bottom-most button in a vertical stack. */
export function mapStackButtonBottom(baseBottom: number, indexFromBottom: number): number {
  return (
    baseBottom + indexFromBottom * (MAP_STACK_BUTTON_SIZE + MAP_STACK_BUTTON_GAP)
  );
}

export function mapStackTotalHeight(buttonCount: number, buttonSize: number, gap: number): number {
  if (buttonCount <= 0) {
    return 0;
  }
  return buttonCount * buttonSize + (buttonCount - 1) * gap;
}

export function mapDateNavAnchorBottom(params: {
  insetBottom: number;
  historyPanelOpen: boolean;
  showDayMomentSummary: boolean;
}): number {
  const {insetBottom, historyPanelOpen, showDayMomentSummary} = params;
  if (historyPanelOpen) {
    return (
      insetBottom +
      MAP_HISTORY_PANEL_HEIGHT -
      MAP_HISTORY_DATE_NAV_PANEL_TRIM +
      MAP_HISTORY_DATE_NAV_ABOVE_PANEL_GAP
    );
  }
  if (showDayMomentSummary) {
    return (
      insetBottom +
      DAY_MOMENT_SUMMARY_BOTTOM_GAP +
      DAY_MOMENT_SUMMARY_BAR_HEIGHT +
      MAP_HISTORY_DATE_NAV_GAP
    );
  }
  return insetBottom + MAP_LOCATE_BUTTON_BOTTOM_GAP + MAP_HISTORY_DATE_NAV_GAP;
}
