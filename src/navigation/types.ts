import type {NativeStackScreenProps} from '@react-navigation/native-stack';

export type RootStackParamList = {
  Map: {widgetAction?: string; focusPlaceId?: number} | undefined;
  Settings: undefined;
  CaptureNote: undefined;
  CapturePhoto: undefined;
  CaptureVoice: undefined;
  CaptureActivity: undefined;
  SavedPlaces: undefined;
  MomentPreview: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
