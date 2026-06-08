import {
  DEFAULT_TRACKING_PRESET,
  getTrackingPresetConfig,
  isTrackingPresetId,
  normalizeTrackingPresetId,
} from '../src/lib/tracking-presets';

describe('tracking presets', () => {
  it('defaults to full-fidelity save-every-fix preset', () => {
    expect(DEFAULT_TRACKING_PRESET).toBe('d10_s30');
  });

  it('validates preset ids', () => {
    expect(isTrackingPresetId('d10_all')).toBe(true);
    expect(isTrackingPresetId('d25_s30')).toBe(true);
    expect(isTrackingPresetId('high')).toBe(false);
  });

  it('migrates legacy preset ids', () => {
    expect(normalizeTrackingPresetId('high')).toBe('d10_all');
    expect(normalizeTrackingPresetId('balanced')).toBe('d25_mov');
    expect(normalizeTrackingPresetId('saver')).toBe('d75_mov');
    expect(normalizeTrackingPresetId(null)).toBe('d10_s30');
  });

  it('requests frequent SDK updates with elasticity enabled', () => {
    const config = getTrackingPresetConfig('d10_all');
    expect(config.distanceFilter).toBe(10);
    expect(config.disableElasticity).toBe(false);
    expect(config.heartbeatInterval).toBe(60);
    expect(config.preventSuspend).toBe(true);
    expect(config.pausesLocationUpdatesAutomatically).toBe(false);
    expect(config.stopTimeout).toBe(30);
    expect(config.disableStopDetection).toBe(false);
  });

  it('keeps short stop timeout for saver presets', () => {
    const config = getTrackingPresetConfig('d75_mov');
    expect(config.stopTimeout).toBe(5);
  });
});
