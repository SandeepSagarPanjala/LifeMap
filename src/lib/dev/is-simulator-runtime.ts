import { Platform } from 'react-native';

/**
 * Best-effort simulator/emulator detection without expo-device.
 * Android uses fingerprint heuristics. iOS has no reliable JS signal —
 * in __DEV__ we allow (Developer tools are already __DEV__-gated); release
 * builds always return false via the caller.
 */
export function isSimulatorRuntime(): boolean {
  if (Platform.OS === 'android') {
    return isAndroidEmulator();
  }
  if (Platform.OS === 'ios') {
    // Physical Debug devices can still run this temporary dump tool.
    // Prefer running on Simulator; there is no stable JS-only device check.
    return __DEV__;
  }
  return false;
}

function isAndroidEmulator(): boolean {
  const constants = Platform.constants as {
    Brand?: string;
    Fingerprint?: string;
    Model?: string;
    Manufacturer?: string;
    Product?: string;
    Hardware?: string;
    Serial?: string;
    ServerHost?: string;
  };
  const blob = [
    constants.Brand,
    constants.Fingerprint,
    constants.Model,
    constants.Manufacturer,
    constants.Product,
    constants.Hardware,
    constants.Serial,
    constants.ServerHost,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    blob.includes('generic') ||
    blob.includes('emulator') ||
    blob.includes('sdk_gphone') ||
    blob.includes('google_sdk') ||
    blob.includes('genymotion') ||
    blob.includes('ranchu') ||
    blob.includes('goldfish') ||
    blob.includes('vbox') ||
    /\bemulator\b/.test(blob) ||
    (constants.Brand ?? '').toLowerCase() === 'generic'
  );
}
