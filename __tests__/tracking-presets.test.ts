import {TRACKING_DISTANCE_FILTER_METERS} from '@/lib/app-constants';
import {
  getTrackingConfig,
  getTrackingPresetConfig,
} from '../src/lib/tracking-presets';

describe('tracking presets', () => {
  it('uses a 10 m distance filter', () => {
    expect(TRACKING_DISTANCE_FILTER_METERS).toBe(10);
  });

  it('returns v5 compound config with maximum reliability defaults', () => {
    const config = getTrackingConfig(true);
    expect(config.geolocation?.distanceFilter).toBe(10);
    expect(config.geolocation?.disableElasticity).toBe(true);
    expect(config.geolocation?.stopTimeout).toBe(1);
    expect(config.geolocation?.pausesLocationUpdatesAutomatically).toBe(false);
    expect(config.geolocation?.locationUpdateInterval).toBe(30_000);
    expect(config.activity?.disableStopDetection).toBe(true);
    expect(config.activity?.stopDetectionDelay).toBe(30_000);
    expect(config.activity?.minimumActivityRecognitionConfidence).toBe(55);
    expect(config.app?.heartbeatInterval).toBe(30);
    expect(config.app?.preventSuspend).toBe(true);
    expect(config.app?.enableHeadless).toBe(true);
    expect(config.logger?.debug).toBe(false);
  });

  it('returns balanced profile when maximum reliability is off', () => {
    const config = getTrackingConfig(false);
    expect(config.activity?.disableStopDetection).toBe(false);
    expect(config.geolocation?.pausesLocationUpdatesAutomatically).toBe(true);
    expect(config.app?.preventSuspend).toBe(false);
    expect(config.geolocation?.disableElasticity).toBe(false);
    expect(config.app?.heartbeatInterval).toBe(60);
    expect(config.logger?.debug).toBe(false);
  });

  it('keeps deprecated flat accessor working', () => {
    const config = getTrackingPresetConfig();
    expect((config as {geolocation?: {distanceFilter?: number}}).geolocation?.distanceFilter).toBe(10);
  });
});
