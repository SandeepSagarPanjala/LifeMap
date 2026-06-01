import BackgroundGeolocation from 'react-native-background-geolocation';

export type TrackingPresetId = 'high' | 'balanced' | 'saver';

export type TrackingPreset = {
  id: TrackingPresetId;
  label: string;
  description: string;
  distanceFilter: number;
  locationUpdateInterval: number;
  fastestLocationUpdateInterval: number;
};

export const TRACKING_PRESETS: Record<TrackingPresetId, TrackingPreset> = {
  high: {
    id: 'high',
    label: 'High',
    description: 'Densest path — about every 30s while moving (best for dogfooding)',
    distanceFilter: 0,
    locationUpdateInterval: 30_000,
    fastestLocationUpdateInterval: 30_000,
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    description: 'While moving only — roughly every ~25 m walked, not on a clock timer',
    distanceFilter: 25,
    locationUpdateInterval: 60_000,
    fastestLocationUpdateInterval: 60_000,
  },
  saver: {
    id: 'saver',
    label: 'Battery saver',
    description: 'While moving only — roughly every ~75 m walked',
    distanceFilter: 75,
    locationUpdateInterval: 300_000,
    fastestLocationUpdateInterval: 300_000,
  },
};

export const DEFAULT_TRACKING_PRESET: TrackingPresetId = 'balanced';

export const TRACKING_PRESET_ORDER: TrackingPresetId[] = ['high', 'balanced', 'saver'];

export const SETTINGS_KEY_TRACKING_ENABLED = 'tracking_enabled';
export const SETTINGS_KEY_TRACKING_PRESET = 'tracking_preset';

export function isTrackingPresetId(value: string | null): value is TrackingPresetId {
  return value === 'high' || value === 'balanced' || value === 'saver';
}

export function getTrackingPresetConfig(
  presetId: TrackingPresetId,
): Record<string, unknown> {
  const preset = TRACKING_PRESETS[presetId];

  return {
    desiredAccuracy: BackgroundGeolocation.DesiredAccuracy.High,
    distanceFilter: preset.distanceFilter,
    locationUpdateInterval: preset.locationUpdateInterval,
    fastestLocationUpdateInterval: preset.fastestLocationUpdateInterval,
    disableElasticity: preset.id === 'high',
  };
}
