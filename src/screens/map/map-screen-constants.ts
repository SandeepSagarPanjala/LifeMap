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
export const MAP_HISTORY_PANEL_HEIGHT = 256;
export const MAP_HISTORY_FLOATING_CONTROLS_GAP = 8;
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
