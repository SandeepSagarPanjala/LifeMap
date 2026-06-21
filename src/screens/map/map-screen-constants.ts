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
/** Full history panel when address + event + timeline are visible. */
export const MAP_HISTORY_PANEL_HEIGHT = 308;
export const MAP_HISTORY_TIMELINE_HEIGHT = 72;
export const MAP_HISTORY_EVENT_CARD_HEIGHT = 100;
/** Extra height when the event card shows a moment counts row. */
export const MAP_HISTORY_EVENT_CARD_MOMENTS_EXTRA_HEIGHT = 44;
/** Height of the address-selection card (pager + action row). */
export const MAP_HISTORY_ADDRESS_CARD_HEIGHT = 128;
export const MAP_HISTORY_ADDRESS_CARD_GAP = 8;
export const MAP_HISTORY_FLOATING_CONTROLS_GAP = 8;
/** Gap between history panel top and past-day date navigation cluster. */
export const MAP_HISTORY_DATE_NAV_GAP = 8;
/** Gap between date navigation and the panel content below it. */
export const MAP_HISTORY_DATE_NAV_ABOVE_PANEL_GAP = 8;
export const MAP_STACK_BUTTON_SIZE = 44;
export const MAP_STACK_BUTTON_GAP = 8;
/** Close button + gap + date row in MapDateLabel navigation mode. */
export const MAP_DATE_NAV_ROW_GAP = 10;
export const MAP_DATE_NAV_CLUSTER_HEIGHT =
  MAP_SETTINGS_SIZE + MAP_DATE_NAV_ROW_GAP + MAP_STACK_BUTTON_SIZE;
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

export function mapHistoryPanelContentHeight(
  historyAddressCardVisible: boolean,
  historyEventCardHasMoments = false,
): number {
  return (
    MAP_HISTORY_TIMELINE_HEIGHT +
    MAP_HISTORY_EVENT_CARD_HEIGHT +
    (historyEventCardHasMoments
      ? MAP_HISTORY_EVENT_CARD_MOMENTS_EXTRA_HEIGHT
      : 0) +
    (historyAddressCardVisible
      ? MAP_HISTORY_ADDRESS_CARD_GAP + MAP_HISTORY_ADDRESS_CARD_HEIGHT
      : 0)
  );
}

export function mapDateNavAnchorBottom(params: {
  insetBottom: number;
  historyPanelOpen: boolean;
  showDayMomentSummary: boolean;
  historyAddressCardVisible?: boolean;
  historyEventCardHasMoments?: boolean;
  /** Measured or estimated full history panel content height. */
  historyPanelContentHeight?: number;
}): number {
  const {
    insetBottom,
    historyPanelOpen,
    showDayMomentSummary,
    historyAddressCardVisible = false,
    historyEventCardHasMoments = false,
    historyPanelContentHeight,
  } = params;
  if (historyPanelOpen) {
    const panelTopFromBottom =
      historyPanelContentHeight ??
      mapHistoryPanelContentHeight(
        historyAddressCardVisible,
        historyEventCardHasMoments,
      );
    return (
      insetBottom + panelTopFromBottom + MAP_HISTORY_DATE_NAV_ABOVE_PANEL_GAP
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
