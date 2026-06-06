import BackgroundGeolocation from 'react-native-background-geolocation';

import {HEARTBEAT_CHECK_INTERVAL_SEC} from '@/lib/motion-tracking-policy';

/** Slug ids (stored in settings). */
export type TrackingPresetId =
  | 'd10_all'
  | 'd10_s30'
  | 'd25_s30'
  | 'd25_s60'
  | 'd25_s120'
  | 'd25_mov'
  | 'd50_s60'
  | 'd75_s300'
  | 'd75_mov'
  | 'd100_s600';

export type TrackingPreset = {
  id: TrackingPresetId;
  /** e.g. "10 m · save every fix" */
  label: string;
  /** What LifeMap guarantees in SQLite. */
  saveRule: string;
  /** Hints passed to TransistorSoft (actual GPS rate varies by OS). */
  sdkHint: string;
  distanceFilter: number;
  locationUpdateInterval: number;
  fastestLocationUpdateInterval: number;
};

const SAVE_EVERY_FIX =
  'Every GPS fix the SDK sends is saved. Preset only changes how often the SDK requests location.';

const LEGACY_PRESET_MAP: Record<string, TrackingPresetId> = {
  high: 'd10_all',
  balanced: 'd25_mov',
  saver: 'd75_mov',
};

export const TRACKING_PRESETS: Record<TrackingPresetId, TrackingPreset> = {
  d10_all: {
    id: 'd10_all',
    label: '10 m · save every fix',
    saveRule: SAVE_EVERY_FIX,
    sdkHint: 'GPS ~every 10 m while moving · heartbeat ping every 30 min when still',
    distanceFilter: 10,
    locationUpdateInterval: 5_000,
    fastestLocationUpdateInterval: 1_000,
  },
  d10_s30: {
    id: 'd10_s30',
    label: '10 m · save every fix',
    saveRule: SAVE_EVERY_FIX,
    sdkHint: 'GPS ~every 10 m while moving · heartbeat ping every 30 min when still',
    distanceFilter: 10,
    locationUpdateInterval: 30_000,
    fastestLocationUpdateInterval: 30_000,
  },
  d25_s30: {
    id: 'd25_s30',
    label: '25 m · save every fix',
    saveRule: SAVE_EVERY_FIX,
    sdkHint: 'GPS ~every 25 m while moving · heartbeat ping every 30 min when still',
    distanceFilter: 25,
    locationUpdateInterval: 30_000,
    fastestLocationUpdateInterval: 30_000,
  },
  d25_s60: {
    id: 'd25_s60',
    label: '25 m · save every fix',
    saveRule: SAVE_EVERY_FIX,
    sdkHint: 'GPS ~every 25 m while moving · heartbeat ping every 30 min when still',
    distanceFilter: 25,
    locationUpdateInterval: 60_000,
    fastestLocationUpdateInterval: 60_000,
  },
  d25_s120: {
    id: 'd25_s120',
    label: '25 m · save every fix',
    saveRule: SAVE_EVERY_FIX,
    sdkHint: 'GPS ~every 25 m while moving · heartbeat ping every 30 min when still',
    distanceFilter: 25,
    locationUpdateInterval: 120_000,
    fastestLocationUpdateInterval: 120_000,
  },
  d25_mov: {
    id: 'd25_mov',
    label: '25 m · save every fix',
    saveRule: SAVE_EVERY_FIX,
    sdkHint: 'GPS ~every 25 m while moving · motion start/stop · heartbeat ping every 30 min',
    distanceFilter: 25,
    locationUpdateInterval: 60_000,
    fastestLocationUpdateInterval: 60_000,
  },
  d50_s60: {
    id: 'd50_s60',
    label: '50 m · save every fix',
    saveRule: SAVE_EVERY_FIX,
    sdkHint: 'GPS ~every 50 m while moving · heartbeat ping every 30 min when still',
    distanceFilter: 50,
    locationUpdateInterval: 60_000,
    fastestLocationUpdateInterval: 60_000,
  },
  d75_s300: {
    id: 'd75_s300',
    label: '75 m · save every fix',
    saveRule: SAVE_EVERY_FIX,
    sdkHint: 'GPS ~every 75 m while moving · heartbeat ping every 30 min when still',
    distanceFilter: 75,
    locationUpdateInterval: 300_000,
    fastestLocationUpdateInterval: 300_000,
  },
  d75_mov: {
    id: 'd75_mov',
    label: '75 m · save every fix',
    saveRule: SAVE_EVERY_FIX,
    sdkHint: 'GPS ~every 75 m while moving · heartbeat ping every 30 min when still',
    distanceFilter: 75,
    locationUpdateInterval: 300_000,
    fastestLocationUpdateInterval: 300_000,
  },
  d100_s600: {
    id: 'd100_s600',
    label: '100 m · save every fix',
    saveRule: SAVE_EVERY_FIX,
    sdkHint: 'GPS ~every 100 m while moving · heartbeat ping every 30 min when still',
    distanceFilter: 100,
    locationUpdateInterval: 600_000,
    fastestLocationUpdateInterval: 600_000,
  },
};

export const DEFAULT_TRACKING_PRESET: TrackingPresetId = 'd10_all';

export const TRACKING_PRESET_ORDER: TrackingPresetId[] = [
  'd10_all',
  'd10_s30',
  'd25_s30',
  'd25_s60',
  'd25_s120',
  'd25_mov',
  'd50_s60',
  'd75_s300',
  'd75_mov',
  'd100_s600',
];

export const SETTINGS_KEY_TRACKING_ENABLED = 'tracking_enabled';
export const SETTINGS_KEY_TRACKING_PRESET = 'tracking_preset';

const PRESET_IDS = new Set<string>(TRACKING_PRESET_ORDER);

export function isTrackingPresetId(value: string | null): value is TrackingPresetId {
  return value != null && PRESET_IDS.has(value);
}

export function normalizeTrackingPresetId(stored: string | null): TrackingPresetId {
  if (isTrackingPresetId(stored)) {
    return stored;
  }
  if (stored != null && stored in LEGACY_PRESET_MAP) {
    return LEGACY_PRESET_MAP[stored];
  }
  return DEFAULT_TRACKING_PRESET;
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
    disableElasticity: false,
    stopTimeout: 5,
    disableStopDetection: false,
    disableMotionActivityUpdates: false,
    heartbeatInterval: HEARTBEAT_CHECK_INTERVAL_SEC,
    preventSuspend: true,
    pausesLocationUpdatesAutomatically: false,
  };
}
