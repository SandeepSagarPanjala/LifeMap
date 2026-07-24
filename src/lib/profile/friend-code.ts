/** 8-digit friend code — memorable short id derived from the UUID. */

export const FRIEND_CODE_DIGITS = 8;

/**
 * Deterministic 8-digit code from a UUID (or any string).
 * Not globally unique without a server — keep UUID as the real identity.
 * Collision risk stays low at personal/social scale until a server can mint codes.
 */
export function friendCodeFromUserId(userId: string): string {
  // FNV-1a 32-bit over the uuid string, then map into 0..99999999.
  let hash = 0x811c9dc5;
  for (let i = 0; i < userId.length; i += 1) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Mix a second pass with reversed bytes for a bit more avalanche.
  for (let i = userId.length - 1; i >= 0; i -= 1) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const unsigned = hash >>> 0;
  const mod = 10 ** FRIEND_CODE_DIGITS;
  return String(unsigned % mod).padStart(FRIEND_CODE_DIGITS, '0');
}

/** Display as "#2 6 8 2 8 6 9 3" — hash prefix, equal spacing between digits. */
export function formatFriendCode(code: string): string {
  const digits = code
    .replace(/\D/g, '')
    .padStart(FRIEND_CODE_DIGITS, '0')
    .slice(0, FRIEND_CODE_DIGITS);
  return `#${digits.split('').join(' ')}`;
}

export function isFriendCode(value: string): boolean {
  return /^\d{8}$/.test(value);
}
