import { Platform } from 'react-native';

const READ_TYPES = [
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKQuantityTypeIdentifierStepCount',
  'HKWorkoutTypeIdentifier',
] as const;

export function isHealthKitSupported(): boolean {
  return Platform.OS === 'ios';
}

export async function isHealthDataAvailableSafe(): Promise<boolean> {
  if (!isHealthKitSupported()) {
    return false;
  }
  try {
    const {
      isHealthDataAvailableAsync,
    } = require('@kingstinct/react-native-healthkit') as typeof import('@kingstinct/react-native-healthkit');
    return await isHealthDataAvailableAsync();
  } catch {
    return false;
  }
}

/** Request read access for Sleep / Workouts / Steps. Returns false if denied or unavailable. */
export async function ensureHealthKitPermission(): Promise<boolean> {
  if (!(await isHealthDataAvailableSafe())) {
    return false;
  }
  try {
    const {
      requestAuthorization,
    } = require('@kingstinct/react-native-healthkit') as typeof import('@kingstinct/react-native-healthkit');
    return await requestAuthorization({
      toRead: [...READ_TYPES],
    });
  } catch {
    return false;
  }
}
