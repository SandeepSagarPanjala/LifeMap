import type {NativeStackScreenProps} from '@react-navigation/native-stack';

export type RootStackParamList = {
  Map: {widgetAction?: string; focusPlaceId?: number} | undefined;
  Settings: undefined;
  ThemeSettings: undefined;
  DistanceUnitSettings: undefined;
  PreferredMapsSettings: undefined;
  StorageSettings: undefined;
  BackupSettings: undefined;
  DeveloperSettings: undefined;
  RestoreBackup:
    | {source?: 'install' | 'settings' | 'drive'; preview?: boolean}
    | undefined;
  CaptureNote: undefined;
  CapturePhoto: undefined;
  CaptureVoice: undefined;
  CaptureActivity: undefined;
  HistoryDatePicker: undefined;
  SavedPlaces: undefined;
  MomentPreview: undefined;
  Benchmark: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
