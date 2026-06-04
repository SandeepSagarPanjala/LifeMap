import {
  DEFAULT_TRACKING_PRESET,
  getTrackingPresetConfig,
  isTrackingPresetId,
  normalizeTrackingPresetId,
  TRACKING_PRESETS,
} from '../src/lib/tracking-presets';

describe('tracking presets', () => {
  it('defaults to balanced 25 m with save cap', () => {
    expect(DEFAULT_TRACKING_PRESET).toBe('d25_s30');
  });

  it('validates new preset ids', () => {
    expect(isTrackingPresetId('d25_s30')).toBe(true);
    expect(isTrackingPresetId('high')).toBe(false);
  });

  it('migrates legacy preset ids', () => {
    expect(normalizeTrackingPresetId('high')).toBe('d25_s30');
    expect(normalizeTrackingPresetId('balanced')).toBe('d25_mov');
    expect(normalizeTrackingPresetId('saver')).toBe('d75_mov');
    expect(normalizeTrackingPresetId(null)).toBe('d25_s30');
  });

  it('maps capped presets with heartbeat and elasticity off', () => {
    const capped = getTrackingPresetConfig('d25_s30');
    expect(capped.distanceFilter).toBe(25);
    expect(capped.disableElasticity).toBe(true);
    expect(capped.heartbeatInterval).toBe(60);
    expect(capped.preventSuspend).toBe(true);
    expect(capped.stopTimeout).toBe(5);
    expect(capped.disableStopDetection).toBe(false);
  });

  it('maps distance-only presets without save cap but with motion heartbeat', () => {
    const mov = getTrackingPresetConfig('d25_mov');
    expect(mov.disableElasticity).toBe(false);
    expect(mov.heartbeatInterval).toBe(60);
    expect(TRACKING_PRESETS.d25_mov.maxPersistIntervalMs).toBe(0);
  });
});
