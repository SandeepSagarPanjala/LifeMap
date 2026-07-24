import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Map: { widgetAction?: string; focusPlaceId?: number } | undefined;
  Settings: undefined;
  ThemeSettings: undefined;
  DistanceUnitSettings: undefined;
  DriveMapRefreshSettings: undefined;
  StorageSettings: undefined;
  CachedPlacesSettings: undefined;
  CachedPlaceMap: { cacheId: number };
  BackupSettings: undefined;
  DeveloperSettings: undefined;
  ExportTripDays: undefined;
  ExportTripDetail: { dateKey: string; tripIndex: number };
  RestoreBackup:
    | { source?: 'install' | 'settings' | 'drive'; preview?: boolean }
    | undefined;
  CaptureNote: undefined;
  CapturePhoto: undefined;
  CaptureVoice: undefined;
  CaptureActivity: undefined;
  HistoryDatePicker: undefined;
  SavedPlaces: undefined;
  MomentPreview: undefined;
  Benchmark: undefined;
  You: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
