/**
 * Zoom math for the capture camera.
 *
 * AVFoundation zoom factors are relative to the widest lens of the device: on a
 * phone whose camera includes the ultra-wide lens, factor `1` is what the user
 * calls "0.5x". Everything the UI shows is therefore a *display* factor, and
 * everything sent to the camera is a *native* factor.
 */

/** Beyond this display factor digital zoom is only noise, so we stop there. */
export const MAX_DISPLAY_ZOOM = 15;

const MAX_ZOOM_PRESETS = 4;
const WHOLE_NUMBER_TOLERANCE = 0.05;

/**
 * Resolution of the live zoom readout. The zoom itself is continuous - this
 * only decides how often the label is allowed to change.
 */
export const DISPLAY_ZOOM_STEP = 0.05;

export type CameraZoomLensInfo = {
  minZoom: number;
  maxZoom: number;
  /** Native factors at which a virtual device switches to another lens. */
  zoomLensSwitchFactors: number[];
  hasUltraWideLens: boolean;
};

export type CameraZoomRange = {
  /** Native factor that frames like the main ("1x") lens. */
  baseZoom: number;
  minZoom: number;
  maxZoom: number;
  /** Display factors offered as one-tap shortcuts, ascending. */
  presets: number[];
};

export const DEFAULT_CAMERA_ZOOM_RANGE: CameraZoomRange = {
  baseZoom: 1,
  minZoom: 1,
  maxZoom: MAX_DISPLAY_ZOOM,
  presets: [1],
};

function roundDisplayZoom(displayZoom: number): number {
  return Math.round(displayZoom * 10) / 10;
}

function isWholeNumber(value: number): boolean {
  return Math.abs(value - Math.round(value)) < WHOLE_NUMBER_TOLERANCE;
}

function sortedLensSwitchFactors(factors: number[]): number[] {
  return factors
    .filter(factor => Number.isFinite(factor) && factor > 0)
    .sort((left, right) => left - right);
}

export function buildCameraZoomRange(
  lens: CameraZoomLensInfo,
): CameraZoomRange {
  const switchFactors = sortedLensSwitchFactors(lens.zoomLensSwitchFactors);
  const baseZoom =
    lens.hasUltraWideLens && switchFactors.length > 0 ? switchFactors[0] : 1;
  const minZoom = Math.min(Math.max(lens.minZoom, 0.1), baseZoom);
  const maxZoom = Math.min(
    Math.max(lens.maxZoom, baseZoom),
    baseZoom * MAX_DISPLAY_ZOOM,
  );
  const maxDisplay = roundDisplayZoom(maxZoom / baseZoom);

  const minDisplay = roundDisplayZoom(minZoom / baseZoom);
  const lensDisplays = [
    ...(minDisplay < 1 ? [minDisplay] : []),
    1,
    ...switchFactors
      .map(factor => roundDisplayZoom(factor / baseZoom))
      .filter(display => display > 1),
  ];
  // Phones without a telephoto lens still crop to 2x usefully, and users expect
  // that shortcut, so fill the gap when there is room left in the row.
  if (
    lensDisplays.length < MAX_ZOOM_PRESETS &&
    !lensDisplays.includes(2) &&
    maxDisplay >= 2
  ) {
    lensDisplays.push(2);
  }

  const presets = Array.from(new Set(lensDisplays))
    .filter(display => display <= maxDisplay)
    .sort((left, right) => left - right)
    .slice(0, MAX_ZOOM_PRESETS);

  return { baseZoom, minZoom, maxZoom, presets };
}

export function clampCameraZoom(zoom: number, range: CameraZoomRange): number {
  if (!Number.isFinite(zoom)) {
    return range.baseZoom;
  }
  return Math.min(Math.max(zoom, range.minZoom), range.maxZoom);
}

export function toNativeZoom(
  displayZoom: number,
  range: CameraZoomRange,
): number {
  return clampCameraZoom(displayZoom * range.baseZoom, range);
}

/** The preset a display factor currently sits on, so the row can highlight it. */
export function activeZoomPreset(
  displayZoom: number,
  presets: number[],
): number | null {
  if (presets.length === 0) {
    return null;
  }
  let active = presets[0];
  for (const preset of presets) {
    if (displayZoom + WHOLE_NUMBER_TOLERANCE >= preset) {
      active = preset;
    }
  }
  return active;
}

export function formatZoomLabel(displayZoom: number): string {
  const rounded = roundDisplayZoom(displayZoom);
  if (isWholeNumber(rounded)) {
    return `${Math.round(rounded)}x`;
  }
  return `${rounded.toFixed(1)}x`;
}
