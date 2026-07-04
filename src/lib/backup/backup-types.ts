import {BACKUP_FORMAT_VERSION} from '@/lib/app-constants';

export type BackupTableName =
  | 'activities'
  | 'location_points'
  | 'saved_places'
  | 'place_lookup_cache'
  | 'moments'
  | 'settings'
  | 'trips';

export const BACKUP_TABLE_NAMES: BackupTableName[] = [
  'activities',
  'location_points',
  'saved_places',
  'place_lookup_cache',
  'moments',
  'settings',
  'trips',
];

export type BackupManifest = {
  format: 'lifemap-backup';
  formatVersion: typeof BACKUP_FORMAT_VERSION;
  schemaVersion: string;
  exportedAt: string;
  appVersion: string;
  tableCounts: Record<BackupTableName, number>;
  mediaFileCount: number;
  mediaBytes: number;
  totalBytes: number;
};

export type TripLabelOverride = {
  eventKey: string;
  savedPlaceLabel: string | null;
  selectedCandidateIndex: number | null;
  placeLookupCacheId: number | null;
  savedPlaceId: number | null;
};

export type CloudBackupMetadata = {
  exportedAt: string;
  totalBytes: number;
  formatVersion: number;
};

export type BackupProgressPhase =
  | 'exporting'
  | 'copying_media'
  | 'uploading'
  | 'downloading'
  | 'importing'
  | 'rebuilding_trips'
  | 'applying_overrides';

export type BackupProgress = {
  phase: BackupProgressPhase;
  message: string;
  completed?: number;
  total?: number;
};
