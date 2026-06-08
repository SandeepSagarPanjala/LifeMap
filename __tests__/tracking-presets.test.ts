import {
  getTrackingPresetConfig,
  TRACKING_DISTANCE_FILTER_METERS,
} from '../src/lib/tracking-presets';

describe('tracking presets', () => {
  it('uses a fixed 25 m distance filter', () => {
    expect(TRACKING_DISTANCE_FILTER_METERS).toBe(25);
  });

  it('requests SDK updates with elasticity and heartbeat enabled', () => {
    const config = getTrackingPresetConfig();
    expect(config.distanceFilter).toBe(25);
    expect(config.disableElasticity).toBe(false);
    expect(config.heartbeatInterval).toBe(60);
    expect(config.preventSuspend).toBe(true);
    expect(config.pausesLocationUpdatesAutomatically).toBe(false);
    expect(config.stopTimeout).toBe(30);
    expect(config.disableStopDetection).toBe(false);
  });
});
