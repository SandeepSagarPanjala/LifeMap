import { NativeModules } from 'react-native';

import { parseAmountFromOcrText } from '@/lib/activities/parse-amount-from-ocr';

type TextRecognizeNativeModule = {
  recognizeText(uri: string): Promise<string>;
};

const nativeModule = NativeModules.TextRecognizeModule as
  | TextRecognizeNativeModule
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

/** On-device OCR; returns raw text or empty string when unavailable. */
export async function recognizeImageText(imageUri: string): Promise<string> {
  if (!nativeModule?.recognizeText || !imageUri.trim()) {
    return '';
  }
  try {
    const text = await nativeModule.recognizeText(toFilePath(imageUri));
    return typeof text === 'string' ? text : '';
  } catch {
    return '';
  }
}

/** OCR image and heuristic-parse a money amount. */
export async function extractAmountFromImage(
  imageUri: string,
): Promise<number | null> {
  const text = await recognizeImageText(imageUri);
  return parseAmountFromOcrText(text);
}
