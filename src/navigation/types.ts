import type {NativeStackScreenProps} from '@react-navigation/native-stack';

export type RootStackParamList = {
  Map: undefined;
  Settings: undefined;
  DayDetail: {date: string};
  CaptureNote: undefined;
  CapturePhoto: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
