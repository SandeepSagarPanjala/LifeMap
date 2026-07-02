import {VisionCamera} from 'react-native-vision-camera';

import {
  isNativeIosVoiceRecorderAvailable,
  requestNativeVoiceRecorderPermission,
} from '@/lib/native-voice-recorder';

export function hasMicrophonePermission(): boolean {
  return VisionCamera.microphonePermissionStatus === 'authorized';
}

export async function ensureMicrophonePermission(): Promise<boolean> {
  if (hasMicrophonePermission()) {
    return true;
  }
  if (isNativeIosVoiceRecorderAvailable()) {
    return requestNativeVoiceRecorderPermission();
  }
  await VisionCamera.requestMicrophonePermission();
  return hasMicrophonePermission();
}
