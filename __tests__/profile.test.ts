import { generateUuidV4 } from '@/lib/secure-random';
import {
  DEFAULT_AVATAR_ID,
  getAvatar,
  isAvatarId,
} from '@/lib/profile/avatar-catalog';
import {
  isValidDisplayName,
  sanitizeDisplayNameInput,
} from '@/lib/profile/display-name';
import {
  formatFriendCode,
  friendCodeFromUserId,
  isFriendCode,
} from '@/lib/profile/friend-code';
import { isProfileGender } from '@/lib/profile/types';

describe('profile identity helpers', () => {
  it('generates RFC-looking UUID v4 strings', () => {
    const id = generateUuidV4();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('derives a stable 8-digit friend code from a user id', () => {
    const userId = '11111111-2222-4333-8444-555555555555';
    const code = friendCodeFromUserId(userId);
    expect(isFriendCode(code)).toBe(true);
    expect(friendCodeFromUserId(userId)).toBe(code);
    expect(formatFriendCode(code)).toBe(`#${code.split('').join(' ')}`);
  });

  it('sanitizes display names to letters only, max 12', () => {
    expect(sanitizeDisplayNameInput('Alex123! 😀')).toBe('Alex');
    expect(sanitizeDisplayNameInput('VeryLongNicknameHere')).toBe(
      'VeryLongNick',
    );
    expect(isValidDisplayName('Sandeep')).toBe(true);
    expect(isValidDisplayName('Al ex')).toBe(false);
    expect(isValidDisplayName('')).toBe(false);
  });

  it('resolves avatar catalog ids with a safe default', () => {
    expect(isAvatarId(DEFAULT_AVATAR_ID)).toBe(true);
    expect(isAvatarId('not-real')).toBe(false);
    expect(getAvatar('not-real').id).toBe(DEFAULT_AVATAR_ID);
    expect(getAvatar('cat').id).toBe('cat');
  });

  it('validates gender values', () => {
    expect(isProfileGender('woman')).toBe(true);
    expect(isProfileGender('alien')).toBe(false);
  });
});
