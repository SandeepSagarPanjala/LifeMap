import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Map: { widgetAction?: string; focusPlaceId?: number } | undefined;
  Settings: undefined;
  ThemeSettings: undefined;
  DistanceUnitSettings: undefined;
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
  ActivityManage: { openCreate?: boolean } | undefined;
  ActivityForm:
    | { kind: 'create' }
    | { kind: 'create-first' }
    | { kind: 'edit'; activityId: number };
  ActivityLogEntry: { activityId: number };
  HistoryDatePicker: undefined;
  SavedPlaces: undefined;
  MomentPreview: undefined;
  GalleryDayJourney: { dateKey: string };
  Benchmark: undefined;
  You: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
