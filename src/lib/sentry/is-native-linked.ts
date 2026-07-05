import { NativeModules } from 'react-native';

export function isSentryNativeLinked(): boolean {
  return Boolean(NativeModules.RNSentry);
}
