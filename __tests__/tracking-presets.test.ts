import {
  DEFAULT_TRACKING_PRESET,
  getTrackingPresetConfig,
  isTrackingPresetId,
  normalizeTrackingPresetId,
  TRACKING_PRESETS,
} from '../src/lib/tracking-presets';

describe('tracking presets', () => {
  it('defaults to distance-only 25 m', () => {
    expect(DEFAULT_TRACKING_PRESET).toBe('d25_mov');
  });

  it('validates new preset ids', () => {
    expect(isTrackingPresetId('d25_s30')).toBe(true);
    expect(isTrackingPresetId('high')).toBe(false);
  });

  it('migrates legacy preset ids', () => {
    expect(normalizeTrackingPresetId('high')).toBe('d25_s30');
    expect(normalizeTrackingPresetId('balanced')).toBe('d25_mov');
    expect(normalizeTrackingPresetId('saver')).toBe('d75_mov');
    expect(normalizeTrackingPresetId(null)).toBe('d25_mov');
  });

  it('maps capped presets with heartbeat and elasticity off', () => {
    const capped = getTrackingPresetConfig('d25_s30');
    expect(capped.distanceFilter).toBe(25);
    expect(capped.disableElasticity).toBe(true);
    expect(capped.heartbeatInterval).toBe(60);
    expect(capped.preventSuspend).toBe(true);
  });

  it('maps distance-only presets without save cap', () => {
    const mov = getTrackingPresetConfig('d25_mov');
    expect(mov.disableElasticity).toBe(false);
    expect(mov.heartbeatInterval).toBeUndefined();
    expect(TRACKING_PRESETS.d25_mov.maxPersistIntervalMs).toBe(0);
  });
});
