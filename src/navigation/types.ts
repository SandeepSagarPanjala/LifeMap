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
  NotificationsSettings: undefined;
  HealthSettings: undefined;
  SleepDetail: { dateKey: string };
  StepsDetail: { dateKey: string };
  DeveloperSettings: undefined;
  ExportTripDays: undefined;
  ExportTripDetail: { dateKey: string; tripIndex: number };
  RestoreBackup:
    | { source?: 'install' | 'settings' | 'drive'; preview?: boolean }
    | undefined;
  Diary: undefined;
  CaptureNote: undefined;
  CaptureMood: undefined;
  CapturePhoto: undefined;
  CaptureVoice: undefined;
  CaptureActivity: undefined;
  ActivityManage: { openCreate?: boolean } | undefined;
  ActivityInsights: undefined;
  ActivityInsightDetail: { activityId: number };
  ActivityForm:
    | { kind: 'create' }
    | { kind: 'create-first' }
    | { kind: 'edit'; activityId: number };
  ActivityLogEntry: { activityId: number };
  HistoryDatePicker: { selectedDateKey: string } | undefined;
  SavedPlaces: undefined;
  MomentPreview: undefined;
  GalleryDayJourney: { dateKey: string };
  Benchmark: undefined;
  You: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
