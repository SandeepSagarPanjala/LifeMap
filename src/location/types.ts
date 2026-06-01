import type {TrackingPresetId} from '@/lib/tracking-presets';

export type LocationAuthorizationStatus =
  | 'not_determined'
  | 'restricted'
  | 'denied'
  | 'when_in_use'
  | 'always';

export type LocationServiceState = {
  enabled: boolean;
  authorizationStatus: LocationAuthorizationStatus;
  presetId: TrackingPresetId;
};

export interface LocationService {
  configure(): Promise<void>;
  requestPermission(): Promise<LocationAuthorizationStatus>;
  getState(): Promise<LocationServiceState>;
  start(): Promise<void>;
  stop(): Promise<void>;
  setPreset(presetId: TrackingPresetId): Promise<void>;
  setEnabled(enabled: boolean): Promise<void>;
}
