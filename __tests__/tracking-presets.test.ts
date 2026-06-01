import {
  DEFAULT_TRACKING_PRESET,
  getTrackingPresetConfig,
  isTrackingPresetId,
  TRACKING_PRESETS,
} from '../src/lib/tracking-presets';

describe('tracking presets', () => {
  it('defaults to balanced', () => {
    expect(DEFAULT_TRACKING_PRESET).toBe('balanced');
  });

  it('validates preset ids', () => {
    expect(isTrackingPresetId('high')).toBe(true);
    expect(isTrackingPresetId('unknown')).toBe(false);
  });

  it('maps presets to geolocation config', () => {
    const high = getTrackingPresetConfig('high');
    const saver = getTrackingPresetConfig('saver');

    expect(high.distanceFilter).toBe(TRACKING_PRESETS.high.distanceFilter);
    expect(saver.locationUpdateInterval).toBe(TRACKING_PRESETS.saver.locationUpdateInterval);
  });
});
