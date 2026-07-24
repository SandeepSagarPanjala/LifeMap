/** Max letters for first name / nickname. */
export const PROFILE_DISPLAY_NAME_MAX_LENGTH = 12;

/**
 * Keep letters only (Unicode letters), drop digits/emoji/punctuation/spaces,
 * then cap at 12 characters.
 */
export function sanitizeDisplayNameInput(raw: string): string {
  return raw.replace(/[^\p{L}]/gu, '').slice(0, PROFILE_DISPLAY_NAME_MAX_LENGTH);
}

export function isValidDisplayName(value: string): boolean {
  return /^\p{L}{1,12}$/u.test(value);
}
