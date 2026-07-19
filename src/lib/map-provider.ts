import { Platform } from 'react-native';
import { PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';

/** In-app map tiles: Apple Maps on iOS, Google Maps on Android. */
export function mapProviderForPlatform() {
  return Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;
}
