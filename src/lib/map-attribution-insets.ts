import { Platform } from 'react-native';

type EdgeInsets = {
  top: number;
  left: number;
  bottom: number;
  right: number;
};

export type MapAttributionInsets = {
  legalLabelInsets?: EdgeInsets;
  appleLogoInsets?: EdgeInsets;
};

/** Visual height of the Legal link row (iOS). */
const LEGAL_ROW_HEIGHT = 16;
const LOGO_LEGAL_GAP = 2;
const LEGAL_WIDTH_ESTIMATE = 76;

export type BuildMapAttributionInsetsOptions = {
  screenWidth: number;
  /** Bottom offset of the date navigation cluster from the screen bottom. */
  dateNavBottom: number;
};

/**
 * Center Apple Maps Legal just below the date pill (iOS only).
 */
export function buildMapAttributionInsets(
  options: BuildMapAttributionInsetsOptions,
): MapAttributionInsets {
  if (Platform.OS !== 'ios') {
    return {};
  }

  const legalBottom = Math.max(8, options.dateNavBottom - 6);
  const legalLeft = Math.max(
    8,
    Math.round((options.screenWidth - LEGAL_WIDTH_ESTIMATE) / 2),
  );

  return {
    legalLabelInsets: {
      top: 0,
      right: 0,
      left: legalLeft,
      bottom: legalBottom,
    },
    appleLogoInsets: {
      top: 0,
      right: 0,
      left: legalLeft,
      bottom: legalBottom + LEGAL_ROW_HEIGHT + LOGO_LEGAL_GAP,
    },
  };
}
