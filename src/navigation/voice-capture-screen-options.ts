import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { nativeHalfSheetCaptureScreenOptions } from '@/navigation/native-half-sheet-capture-options';

/** Shorter than activity — recording UI only. */
export const VOICE_SHEET_HEIGHT_RATIO = 0.38;

export const voiceCaptureScreenOptions: NativeStackNavigationOptions =
  nativeHalfSheetCaptureScreenOptions;
