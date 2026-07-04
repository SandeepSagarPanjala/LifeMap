import type {NativeStackNavigationOptions} from '@react-navigation/native-stack';

export {
  HISTORY_DATE_PICKER_HEIGHT_RATIO,
  NATIVE_HALF_SHEET_HEIGHT_RATIO,
} from '@/lib/app-constants';

/** Full-width native half sheet: backdrop fades in, panel slides up. */
export const nativeHalfSheetCaptureScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  presentation: 'transparentModal',
  animation: 'none',
  contentStyle: {backgroundColor: 'transparent'},
  gestureEnabled: false,
};
