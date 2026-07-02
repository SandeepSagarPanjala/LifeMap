import {NativeEventEmitter, NativeModules, Platform} from 'react-native';

type NativeVoiceRecorderModule = {
  requestPermission: () => Promise<boolean>;
  startRecording: (filePath: string) => Promise<string>;
  stopRecording: () => Promise<{filePath: string; durationMs: number}>;
  cancelRecording: () => Promise<boolean>;
  releaseSession: () => Promise<boolean>;
  getRecordingProgress?: () => Promise<NativeVoiceRecorderProgress & {isRecording: boolean}>;
};

export type NativeVoiceRecorderProgress = {
  currentPosition: number;
  currentMetering?: number;
};

const nativeModule = NativeModules.VoiceRecorderModule as
  | NativeVoiceRecorderModule
  | undefined;

function isNativeMethodAvailable(
  method: keyof NativeVoiceRecorderModule,
): boolean {
  return typeof nativeModule?.[method] === 'function';
}

export function isNativeIosVoiceRecorderAvailable(): boolean {
  if (Platform.OS !== 'ios') {
    return false;
  }
  return (
    isNativeMethodAvailable('startRecording') &&
    isNativeMethodAvailable('stopRecording') &&
    isNativeMethodAvailable('cancelRecording') &&
    isNativeMethodAvailable('requestPermission')
  );
}

export function canPollNativeVoiceProgress(): boolean {
  return isNativeMethodAvailable('getRecordingProgress');
}

export async function requestNativeVoiceRecorderPermission(): Promise<boolean> {
  if (!isNativeMethodAvailable('requestPermission')) {
    return false;
  }
  return nativeModule!.requestPermission();
}

export async function startNativeVoiceRecording(filePath: string): Promise<void> {
  if (!isNativeMethodAvailable('startRecording')) {
    throw new Error('Native voice recorder is not available.');
  }
  await nativeModule!.startRecording(filePath);
}

export async function stopNativeVoiceRecording(): Promise<{
  filePath: string;
  durationMs: number;
}> {
  if (!isNativeMethodAvailable('stopRecording')) {
    throw new Error('Native voice recorder is not available.');
  }
  return nativeModule!.stopRecording();
}

export async function cancelNativeVoiceRecording(): Promise<void> {
  if (!isNativeMethodAvailable('cancelRecording')) {
    return;
  }
  await nativeModule!.cancelRecording();
}

export async function releaseNativeVoiceRecordingSession(): Promise<void> {
  if (!isNativeMethodAvailable('releaseSession')) {
    return;
  }
  await nativeModule!.releaseSession();
}

export async function getNativeVoiceRecordingProgress(): Promise<
  NativeVoiceRecorderProgress & {isRecording: boolean}
> {
  if (!canPollNativeVoiceProgress()) {
    return {currentPosition: 0, currentMetering: -160, isRecording: false};
  }
  return nativeModule!.getRecordingProgress!();
}

export function subscribeNativeVoiceRecorderProgress(
  listener: (event: NativeVoiceRecorderProgress) => void,
): () => void {
  if (!isNativeIosVoiceRecorderAvailable()) {
    return () => undefined;
  }
  const emitter = new NativeEventEmitter(NativeModules.VoiceRecorderModule);
  const subscription = emitter.addListener('VoiceRecorderProgress', listener);
  return () => subscription.remove();
}
