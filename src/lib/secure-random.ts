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

/** RFC 4122 UUID v4 from secure random bytes (no server required). */
export function generateUuidV4(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  const bytes = new Uint8Array(16);
  fillSecureRandomBytes(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
