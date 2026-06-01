import * as Keychain from 'react-native-keychain';

const SERVICE_NAME = 'lifemap-db-key';

export async function getOrCreateDatabaseKey(): Promise<string> {
  const existing = await Keychain.getGenericPassword({ service: SERVICE_NAME });

  if (existing && existing.password) {
    return existing.password;
  }

  const key = generateRandomKey();

  await Keychain.setGenericPassword('lifemap', key, {
    service: SERVICE_NAME,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });

  return key;
}

function generateRandomKey(length = 64): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';

  for (let i = 0; i < length; i += 1) {
    const idx = Math.floor(Math.random() * charset.length);
    result += charset[idx]!;
  }

  return result;
}

