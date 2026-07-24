import { getSetting, setSetting } from '@/db/repositories/settings';
import {
  DEFAULT_AVATAR_ID,
  isAvatarId,
} from '@/lib/profile/avatar-catalog';
import {
  isValidDisplayName,
  sanitizeDisplayNameInput,
} from '@/lib/profile/display-name';
import {
  friendCodeFromUserId,
} from '@/lib/profile/friend-code';
import {
  PROFILE_SETTING_KEYS,
  isProfileGender,
  type ProfileGender,
  type UserProfile,
} from '@/lib/profile/types';
import { generateUuidV4 } from '@/lib/secure-random';

export async function ensureUserId(): Promise<string> {
  const existing = await getSetting(PROFILE_SETTING_KEYS.userId);
  if (existing && existing.length > 0) {
    return existing;
  }
  const userId = generateUuidV4();
  await setSetting(PROFILE_SETTING_KEYS.userId, userId);
  return userId;
}

export async function ensureFriendCode(userId: string): Promise<string> {
  const expected = friendCodeFromUserId(userId);
  const existing = await getSetting(PROFILE_SETTING_KEYS.friendCode);
  // Recompute when missing or out of sync with userId (derived-from-id contract).
  if (existing === expected) {
    return existing;
  }
  await setSetting(PROFILE_SETTING_KEYS.friendCode, expected);
  return expected;
}

export async function loadProfile(): Promise<UserProfile> {
  const userId = await ensureUserId();
  const friendCode = await ensureFriendCode(userId);
  const [displayNameRaw, genderRaw, avatarRaw] = await Promise.all([
    getSetting(PROFILE_SETTING_KEYS.displayName),
    getSetting(PROFILE_SETTING_KEYS.gender),
    getSetting(PROFILE_SETTING_KEYS.avatarId),
  ]);

  const displayName = displayNameRaw?.trim() ? displayNameRaw.trim() : null;
  const gender = genderRaw && isProfileGender(genderRaw) ? genderRaw : null;
  const avatarId =
    avatarRaw && isAvatarId(avatarRaw) ? avatarRaw : DEFAULT_AVATAR_ID;

  return { userId, friendCode, displayName, gender, avatarId };
}

export type ProfilePatch = {
  displayName?: string | null;
  gender?: ProfileGender | null;
  avatarId?: string;
};

export async function saveProfile(patch: ProfilePatch): Promise<UserProfile> {
  const current = await loadProfile();
  let { displayName, gender, avatarId } = current;

  if (patch.displayName !== undefined) {
    // Name can only be set once; letters only, max 12.
    if (!current.displayName) {
      const cleaned = sanitizeDisplayNameInput(patch.displayName ?? '');
      if (cleaned && isValidDisplayName(cleaned)) {
        await setSetting(PROFILE_SETTING_KEYS.displayName, cleaned);
        displayName = cleaned;
      }
    }
  }
  if (patch.gender !== undefined) {
    // Gender can only be set once.
    if (!current.gender && patch.gender) {
      await setSetting(PROFILE_SETTING_KEYS.gender, patch.gender);
      gender = patch.gender;
    }
  }
  if (patch.avatarId !== undefined) {
    const next = isAvatarId(patch.avatarId)
      ? patch.avatarId
      : DEFAULT_AVATAR_ID;
    await setSetting(PROFILE_SETTING_KEYS.avatarId, next);
    avatarId = next;
  }

  return {
    userId: current.userId,
    friendCode: current.friendCode,
    displayName,
    gender,
    avatarId,
  };
}
