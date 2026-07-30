import { NativeModules } from 'react-native';

type SpeechTranscribeNativeModule = {
  transcribeFile(uri: string): Promise<string>;
};

const nativeModule = NativeModules.SpeechTranscribeModule as
  | SpeechTranscribeNativeModule
  | undefined;

function toFilePath(uri: string): string {
  if (!uri.startsWith('file://')) {
    return uri;
  }
  const withoutScheme = uri.slice('file://'.length);
  try {
    return decodeURIComponent(withoutScheme);
  } catch {
    return withoutScheme;
  }
}

/**
 * On-device speech-to-text for a local audio file.
 * Returns null when the native module is unavailable (e.g. Android) or STT fails.
 */
export async function transcribeAudioFile(
  audioUri: string,
): Promise<string | null> {
  if (!nativeModule?.transcribeFile || !audioUri.trim()) {
    return null;
  }
  try {
    const text = await nativeModule.transcribeFile(toFilePath(audioUri));
    const trimmed = typeof text === 'string' ? text.trim() : '';
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}
