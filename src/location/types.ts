export type LocationAuthorizationStatus =
  | 'not_determined'
  | 'restricted'
  | 'denied'
  | 'when_in_use'
  | 'always';

export type LocationServiceState = {
  enabled: boolean;
  authorizationStatus: LocationAuthorizationStatus;
};

export interface LocationService {
  configure(): Promise<void>;
  requestPermission(): Promise<LocationAuthorizationStatus>;
  getState(): Promise<LocationServiceState>;
  start(): Promise<void>;
  stop(): Promise<void>;
  setEnabled(enabled: boolean): Promise<void>;
}
