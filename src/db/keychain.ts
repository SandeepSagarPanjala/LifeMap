import * as Keychain from 'react-native-keychain';

import {generateSecureRandomKey} from '@/lib/secure-random';

const SERVICE_NAME = 'lifemap-db-key';

export async function getOrCreateDatabaseKey(): Promise<string> {
  const existing = await Keychain.getGenericPassword({ service: SERVICE_NAME });

  if (existing && existing.password) {
    return existing.password;
  }

  const key = generateSecureRandomKey();

  await Keychain.setGenericPassword('lifemap', key, {
    service: SERVICE_NAME,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });

  return key;
}
