export const PROFILE_SETTING_KEYS = {
  userId: 'profile.user_id',
  friendCode: 'profile.friend_code',
  displayName: 'profile.display_name',
  gender: 'profile.gender',
  avatarId: 'profile.avatar_id',
} as const;

export type ProfileGender =
  | 'woman'
  | 'man'
  | 'nonbinary'
  | 'prefer_not';

export const PROFILE_GENDER_OPTIONS: {
  value: ProfileGender;
  label: string;
}[] = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'nonbinary', label: 'Non-binary' },
  { value: 'prefer_not', label: 'Prefer not to say' },
];

export type UserProfile = {
  /** Canonical UUID — real unique identity. */
  userId: string;
  /** Memorable 8-digit share code (derived from userId). */
  friendCode: string;
  displayName: string | null;
  gender: ProfileGender | null;
  avatarId: string;
};

export function isProfileGender(value: string): value is ProfileGender {
  return (
    value === 'woman' ||
    value === 'man' ||
    value === 'nonbinary' ||
    value === 'prefer_not'
  );
}

export function genderLabel(gender: ProfileGender | null): string | null {
  if (!gender) {
    return null;
  }
  return (
    PROFILE_GENDER_OPTIONS.find(option => option.value === gender)?.label ??
    null
  );
}
