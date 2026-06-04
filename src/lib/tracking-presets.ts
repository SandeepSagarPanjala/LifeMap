import BackgroundGeolocation from 'react-native-background-geolocation';

import {HEARTBEAT_CHECK_INTERVAL_SEC} from '@/lib/motion-tracking-policy';

/** Slug ids (stored in settings). */
export type TrackingPresetId =
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
  /** e.g. "25 m · max 1 save / 30 s" */
  label: string;
  /** What LifeMap guarantees in SQLite. */
  saveRule: string;
  /** Hints passed to TransistorSoft (actual GPS rate varies by OS). */
  sdkHint: string;
  distanceFilter: number;
  locationUpdateInterval: number;
  fastestLocationUpdateInterval: number;
  /** 0 = save every SDK callback. >0 = at most one save per window (latest in window). */
  maxPersistIntervalMs: number;
  /** Request periodic location while stationary-in-motion (iOS needs preventSuspend). */
  useHeartbeatFloor: boolean;
};

const LEGACY_PRESET_MAP: Record<string, TrackingPresetId> = {
  high: 'd25_s30',
  balanced: 'd25_mov',
  saver: 'd75_mov',
};

export const TRACKING_PRESETS: Record<TrackingPresetId, TrackingPreset> = {
  d10_s30: {
    id: 'd10_s30',
    label: '10 m · max 1 save / 30 s',
    saveRule:
      'While moving: at most one saved point every 30 s (latest GPS fix in each window). Heartbeat helps slow walks.',
    sdkHint: 'GPS ~every 10 m or ~30 s · heartbeat ~30 s',
    distanceFilter: 10,
    locationUpdateInterval: 30_000,
    fastestLocationUpdateInterval: 30_000,
    maxPersistIntervalMs: 30_000,
    useHeartbeatFloor: true,
  },
  d25_s30: {
    id: 'd25_s30',
    label: '25 m · max 1 save / 30 s',
    saveRule:
      'While moving: at most one saved point every 30 s (latest fix wins if the SDK sends many).',
    sdkHint: 'GPS ~every 25 m or ~30 s · heartbeat ~30 s',
    distanceFilter: 25,
    locationUpdateInterval: 30_000,
    fastestLocationUpdateInterval: 30_000,
    maxPersistIntervalMs: 30_000,
    useHeartbeatFloor: true,
  },
  d25_s60: {
    id: 'd25_s60',
    label: '25 m · max 1 save / 60 s',
    saveRule: 'While moving: at most one saved point every 60 s (latest in each window).',
    sdkHint: 'GPS ~every 25 m or ~60 s · heartbeat ~60 s',
    distanceFilter: 25,
    locationUpdateInterval: 60_000,
    fastestLocationUpdateInterval: 60_000,
    maxPersistIntervalMs: 60_000,
    useHeartbeatFloor: true,
  },
  d25_s120: {
    id: 'd25_s120',
    label: '25 m · max 1 save / 2 min',
    saveRule: 'While moving: at most one saved point every 2 minutes (latest in each window).',
    sdkHint: 'GPS ~every 25 m or ~2 min · heartbeat ~2 min',
    distanceFilter: 25,
    locationUpdateInterval: 120_000,
    fastestLocationUpdateInterval: 120_000,
    maxPersistIntervalMs: 120_000,
    useHeartbeatFloor: true,
  },
  d25_mov: {
    id: 'd25_mov',
    label: '25 m · distance only',
    saveRule:
      'Saves when you move ~25 m or when motion starts/stops. Stationary ping every 30 min. Sparse when still.',
    sdkHint: 'GPS while moving ~every 25 m · motion stop/start · heartbeat ping',
    distanceFilter: 25,
    locationUpdateInterval: 60_000,
    fastestLocationUpdateInterval: 60_000,
    maxPersistIntervalMs: 0,
    useHeartbeatFloor: false,
  },
  d50_s60: {
    id: 'd50_s60',
    label: '50 m · max 1 save / 60 s',
    saveRule: 'While moving: at most one saved point every 60 s (latest in each window).',
    sdkHint: 'GPS ~every 50 m or ~60 s · heartbeat ~60 s',
    distanceFilter: 50,
    locationUpdateInterval: 60_000,
    fastestLocationUpdateInterval: 60_000,
    maxPersistIntervalMs: 60_000,
    useHeartbeatFloor: true,
  },
  d75_s300: {
    id: 'd75_s300',
    label: '75 m · max 1 save / 5 min',
    saveRule: 'While moving: at most one saved point every 5 minutes (latest in each window).',
    sdkHint: 'GPS ~every 75 m or ~5 min · heartbeat ~5 min',
    distanceFilter: 75,
    locationUpdateInterval: 300_000,
    fastestLocationUpdateInterval: 300_000,
    maxPersistIntervalMs: 300_000,
    useHeartbeatFloor: true,
  },
  d75_mov: {
    id: 'd75_mov',
    label: '75 m · distance only',
    saveRule: 'Saves when you have moved ~75 m (no time cap). Sparse timeline.',
    sdkHint: 'GPS while moving ~every 75 m',
    distanceFilter: 75,
    locationUpdateInterval: 300_000,
    fastestLocationUpdateInterval: 300_000,
    maxPersistIntervalMs: 0,
    useHeartbeatFloor: false,
  },
  d100_s600: {
    id: 'd100_s600',
    label: '100 m · max 1 save / 10 min',
    saveRule: 'While moving: at most one saved point every 10 minutes (latest in each window).',
    sdkHint: 'GPS ~every 100 m or ~10 min · heartbeat ~10 min',
    distanceFilter: 100,
    locationUpdateInterval: 600_000,
    fastestLocationUpdateInterval: 600_000,
    maxPersistIntervalMs: 600_000,
    useHeartbeatFloor: true,
  },
};

export const DEFAULT_TRACKING_PRESET: TrackingPresetId = 'd25_s30';

export const TRACKING_PRESET_ORDER: TrackingPresetId[] = [
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
    disableElasticity: preset.maxPersistIntervalMs > 0,
    stopTimeout: 5,
    disableStopDetection: false,
    disableMotionActivityUpdates: false,
    heartbeatInterval: HEARTBEAT_CHECK_INTERVAL_SEC,
    preventSuspend: true,
  };
}
