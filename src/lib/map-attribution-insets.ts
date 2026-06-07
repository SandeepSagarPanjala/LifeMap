import {Platform} from 'react-native';

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
const ATTRIBUTION_LEFT = 10;

/**
 * Stack Apple Maps logo directly above the Legal link in the bottom-left.
 * iOS only — Android/Google attribution is separate.
 */
export function buildMapAttributionInsets(
  bottomClearance: number,
  options?: {left?: number},
): MapAttributionInsets {
  if (Platform.OS !== 'ios') {
    return {};
  }

  const left = options?.left ?? ATTRIBUTION_LEFT;

  return {
    legalLabelInsets: {
      top: 0,
      right: 0,
      left,
      bottom: bottomClearance,
    },
    appleLogoInsets: {
      top: 0,
      right: 0,
      left,
      bottom: bottomClearance + LEGAL_ROW_HEIGHT + LOGO_LEGAL_GAP,
    },
  };
}
