import type {NativeStackNavigationOptions} from '@react-navigation/native-stack';

/** Full-width native half sheet: backdrop fades in, panel slides up. */
export const nativeHalfSheetCaptureScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  presentation: 'transparentModal',
  animation: 'none',
  contentStyle: {backgroundColor: 'transparent'},
  gestureEnabled: false,
};
