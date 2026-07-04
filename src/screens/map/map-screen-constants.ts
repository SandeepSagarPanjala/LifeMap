import type {Region} from 'react-native-maps';

import {
  MAP_DATE_NAV_CLUSTER_HEIGHT,
  MAP_DATE_NAV_ROW_GAP,
  MAP_FALLBACK_REGION as MAP_FALLBACK_REGION_VALUES,
  MAP_HISTORY_ADDRESS_CARD_GAP,
  MAP_HISTORY_ADDRESS_CARD_HEIGHT,
  MAP_HISTORY_DATE_NAV_ABOVE_PANEL_GAP,
  MAP_HISTORY_EVENT_CARD_HEIGHT,
  MAP_HISTORY_EVENT_CARD_MOMENTS_EXTRA_HEIGHT,
  MAP_HISTORY_FLOATING_CONTROLS_GAP,
  MAP_HISTORY_PANEL_CLOSE_MS,
  MAP_HISTORY_PANEL_HEIGHT,
  MAP_HISTORY_TIMELINE_HEIGHT,
  MAP_LEFT_STACK_COUNT,
  MAP_LOCATE_BUTTON_BOTTOM_GAP,
  MAP_RIGHT_STACK_COUNT,
  MAP_SETTINGS_SIZE,
  MAP_SETTINGS_STACK_GAP,
  MAP_SETTINGS_TOP_GAP,
  MAP_STACK_BUTTON_GAP,
  MAP_STACK_BUTTON_SIZE,
} from '@/lib/app-constants';

export {
  MAP_DATE_NAV_CLUSTER_HEIGHT,
  MAP_DATE_NAV_ROW_GAP,
  MAP_HISTORY_ADDRESS_CARD_GAP,
  MAP_HISTORY_ADDRESS_CARD_HEIGHT,
  MAP_HISTORY_DATE_NAV_ABOVE_PANEL_GAP,
  MAP_HISTORY_EVENT_CARD_HEIGHT,
  MAP_HISTORY_EVENT_CARD_MOMENTS_EXTRA_HEIGHT,
  MAP_HISTORY_FLOATING_CONTROLS_GAP,
  MAP_HISTORY_PANEL_CLOSE_MS,
  MAP_HISTORY_PANEL_HEIGHT,
  MAP_HISTORY_TIMELINE_HEIGHT,
  MAP_LEFT_STACK_COUNT,
  MAP_LOCATE_BUTTON_BOTTOM_GAP,
  MAP_RIGHT_STACK_COUNT,
  MAP_SETTINGS_SIZE,
  MAP_SETTINGS_STACK_GAP,
  MAP_SETTINGS_TOP_GAP,
  MAP_STACK_BUTTON_GAP,
  MAP_STACK_BUTTON_SIZE,
};

export const MAP_FALLBACK_REGION: Region = {
  ...MAP_FALLBACK_REGION_VALUES,
};

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
  historyAddressCardVisible?: boolean;
  historyEventCardHasMoments?: boolean;
  /** Measured or estimated full history panel content height. */
  historyPanelContentHeight?: number;
}): number {
  const {
    insetBottom,
    historyPanelOpen,
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
  return insetBottom + MAP_LOCATE_BUTTON_BOTTOM_GAP;
}
