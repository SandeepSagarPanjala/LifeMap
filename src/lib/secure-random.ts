const CHARSET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function fillSecureRandomBytes(bytes: Uint8Array): void {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes as Uint8Array<ArrayBuffer>);
    return;
  }
  throw new Error('Secure random bytes are unavailable.');
}

export function generateSecureRandomKey(length = 64): string {
  const bytes = new Uint8Array(length);
  fillSecureRandomBytes(bytes);
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += CHARSET[bytes[i]! % CHARSET.length]!;
  }
  return result;
}
