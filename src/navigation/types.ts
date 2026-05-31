import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {CompositeScreenProps} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

export type RootTabParamList = {
  Home: undefined;
  Map: undefined;
  Timeline: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  DayDetail: {date: string};
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type RootTabScreenProps<T extends keyof RootTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<RootTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;
