/** Avatar id helpers without Phosphor icons — safe for DB/profile layer. */

export const DEFAULT_AVATAR_ID = 'user_circle';

export const AVATAR_IDS = [
  'user_circle',
  'smiley',
  'cat',
  'dog',
  'rocket',
  'star',
  'heart',
  'leaf',
  'sun',
  'moon',
  'coffee',
  'bicycle',
  'music',
  'sparkle',
  'ghost',
  'alien',
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

const ID_SET = new Set<string>(AVATAR_IDS);

export function isAvatarId(value: string): boolean {
  return ID_SET.has(value);
}
