import {
  activeZoomPreset,
  buildCameraZoomRange,
  clampCameraZoom,
  formatZoomLabel,
  MAX_DISPLAY_ZOOM,
  toNativeZoom,
} from '../src/lib/moments/camera-zoom';

describe('buildCameraZoomRange', () => {
  it('treats the first lens switch factor as 1x when the ultra-wide is included', () => {
    const range = buildCameraZoomRange({
      minZoom: 1,
      maxZoom: 123,
      zoomLensSwitchFactors: [2, 6],
      hasUltraWideLens: true,
    });

    expect(range.baseZoom).toBe(2);
    expect(range.presets).toEqual([0.5, 1, 2, 3]);
    expect(range.maxZoom).toBe(2 * MAX_DISPLAY_ZOOM);
  });

  it('keeps 1x as the native base on a single-lens device', () => {
    const range = buildCameraZoomRange({
      minZoom: 1,
      maxZoom: 16,
      zoomLensSwitchFactors: [],
      hasUltraWideLens: false,
    });

    expect(range.baseZoom).toBe(1);
    expect(range.presets).toEqual([1, 2]);
    expect(range.maxZoom).toBe(MAX_DISPLAY_ZOOM);
  });

  it('offers only 1x when the device cannot zoom', () => {
    const range = buildCameraZoomRange({
      minZoom: 1,
      maxZoom: 1,
      zoomLensSwitchFactors: [],
      hasUltraWideLens: false,
    });

    expect(range.presets).toEqual([1]);
    expect(range.maxZoom).toBe(1);
  });

  it('includes the ultra-wide shortcut on a dual-lens device', () => {
    const range = buildCameraZoomRange({
      minZoom: 1,
      maxZoom: 60,
      zoomLensSwitchFactors: [2],
      hasUltraWideLens: true,
    });

    expect(range.presets).toEqual([0.5, 1, 2]);
  });
});

describe('zoom conversions', () => {
  const range = buildCameraZoomRange({
    minZoom: 1,
    maxZoom: 123,
    zoomLensSwitchFactors: [2, 6],
    hasUltraWideLens: true,
  });

  it('converts display factors to the factors the lens expects', () => {
    expect(toNativeZoom(1, range)).toBe(2);
    expect(toNativeZoom(0.5, range)).toBe(1);
    expect(toNativeZoom(3, range)).toBe(6);
  });

  it('clamps out-of-range values', () => {
    expect(clampCameraZoom(0.2, range)).toBe(range.minZoom);
    expect(clampCameraZoom(9_000, range)).toBe(range.maxZoom);
    expect(clampCameraZoom(Number.NaN, range)).toBe(range.baseZoom);
  });
});

describe('activeZoomPreset', () => {
  it('sticks to the widest preset at or below the current factor', () => {
    const presets = [0.5, 1, 2, 3];
    expect(activeZoomPreset(0.5, presets)).toBe(0.5);
    expect(activeZoomPreset(1.4, presets)).toBe(1);
    expect(activeZoomPreset(2.9, presets)).toBe(2);
    expect(activeZoomPreset(12, presets)).toBe(3);
  });

  it('has no active preset without presets', () => {
    expect(activeZoomPreset(1, [])).toBeNull();
  });
});

describe('formatZoomLabel', () => {
  it('drops the decimal for whole factors', () => {
    expect(formatZoomLabel(1)).toBe('1x');
    expect(formatZoomLabel(0.5)).toBe('0.5x');
    expect(formatZoomLabel(2.44)).toBe('2.4x');
    expect(formatZoomLabel(3.02)).toBe('3x');
  });
});
