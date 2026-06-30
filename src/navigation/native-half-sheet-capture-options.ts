import type {NativeStackNavigationOptions} from '@react-navigation/native-stack';

/** Default half-sheet height — thumb-friendly. */
export const NATIVE_HALF_SHEET_HEIGHT_RATIO = 0.5;

/** History calendar — slightly taller than default for the day grid. */
export const HISTORY_DATE_PICKER_HEIGHT_RATIO = 0.55;

/** Full-width native half sheet: backdrop fades in, panel slides up. */
export const nativeHalfSheetCaptureScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  presentation: 'transparentModal',
  animation: 'none',
  contentStyle: {backgroundColor: 'transparent'},
  gestureEnabled: false,
};
