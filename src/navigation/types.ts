import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Map: { widgetAction?: string; focusPlaceId?: number } | undefined;
  MapInsights: undefined;
  MapOverviewDrillDown: {
    kind:
      | 'home_stays_all'
      | 'home_stays_full_day'
      | 'home_stay_longest'
      | 'home_stay_shortest'
      | 'work_stays_all'
      | 'work_stay_longest'
      | 'work_stay_shortest'
      | 'work_commute_fastest'
      | 'work_commute_slowest'
      | 'work_commute_speed_min'
      | 'work_commute_speed_max'
      | 'work_weekday';
    title: string;
    weekday?: number;
    placeId?: number;
  };
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
  DiaryInsights: undefined;
  CaptureNote: undefined;
  CaptureMood: undefined;
  MoodInsights: undefined;
  CapturePhoto: undefined;
  CameraInsights: undefined;
  CaptureVoice: undefined;
  VoiceInsights: undefined;
  CaptureActivity: undefined;
  ActivityManage: { openCreate?: boolean } | undefined;
  ActivityInsights: undefined;
  ActivityInsightDetail: { activityId: number };
  ActivityInsightPeriodDetail: {
    activityId: number;
    period: 'today' | 'week' | 'month' | 'year';
    periodTitle: string;
    startMs: number;
    endMs: number;
    metric:
      | { kind: 'logs' }
      | {
          kind: 'money' | 'number' | 'duration';
          fieldId: string;
          label: string;
        };
    /** When set, only logs in this notify timing bucket. */
    timingKind?: 'on_time' | 'early' | 'late';
    /**
     * When set, only logs for this shop key (lowercase name, or `__none__`
     * when the shop field is empty).
     */
    shopNameFilter?: string;
  };
  MomentInsightPeriodDetail: {
    momentKind: 'mood' | 'note' | 'voice' | 'photo' | 'video';
    period: 'today' | 'week' | 'month' | 'year';
    periodTitle: string;
    startMs: number;
    endMs: number;
  };
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
