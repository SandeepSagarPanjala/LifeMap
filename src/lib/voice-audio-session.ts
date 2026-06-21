import {NativeModules, Platform} from 'react-native';

type VoiceAudioSessionModule = {
  prepareForRecording: () => Promise<boolean>;
};

const nativeModule = NativeModules.VoiceAudioSessionModule as
  | VoiceAudioSessionModule
  | undefined;

export async function prepareVoiceRecordingSession(): Promise<void> {
  if (Platform.OS !== 'ios' || nativeModule?.prepareForRecording == null) {
    return;
  }
  await nativeModule.prepareForRecording();
}
