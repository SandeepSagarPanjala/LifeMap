import { Platform } from 'react-native';

import { releaseNativeVoiceRecordingSession } from '@/lib/native-voice-recorder';

/** Clears the iOS recording audio session after camera/video capture. */
export async function releaseVoiceRecordingSession(): Promise<void> {
  if (Platform.OS !== 'ios') {
    return;
  }
  await releaseNativeVoiceRecordingSession();
}
