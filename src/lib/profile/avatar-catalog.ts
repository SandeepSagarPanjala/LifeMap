import {
  Alien,
  Bicycle,
  Cat,
  Coffee,
  Dog,
  Ghost,
  Heart,
  Leaf,
  Moon,
  MusicNote,
  Rocket,
  Smiley,
  Sparkle,
  Star,
  Sun,
  UserCircle,
  type Icon as PhosphorIcon,
} from 'phosphor-react-native';

export type AvatarCatalogEntry = {
  id: string;
  label: string;
  Icon: PhosphorIcon;
};

export const DEFAULT_AVATAR_ID = 'user_circle';

/** Starter pack — grow this list (or load remote packs) without schema changes. */
export const AVATAR_CATALOG: readonly AvatarCatalogEntry[] = [
  { id: 'user_circle', label: 'You', Icon: UserCircle },
  { id: 'smiley', label: 'Smile', Icon: Smiley },
  { id: 'cat', label: 'Cat', Icon: Cat },
  { id: 'dog', label: 'Dog', Icon: Dog },
  { id: 'rocket', label: 'Rocket', Icon: Rocket },
  { id: 'star', label: 'Star', Icon: Star },
  { id: 'heart', label: 'Heart', Icon: Heart },
  { id: 'leaf', label: 'Leaf', Icon: Leaf },
  { id: 'sun', label: 'Sun', Icon: Sun },
  { id: 'moon', label: 'Moon', Icon: Moon },
  { id: 'coffee', label: 'Coffee', Icon: Coffee },
  { id: 'bicycle', label: 'Bike', Icon: Bicycle },
  { id: 'music', label: 'Music', Icon: MusicNote },
  { id: 'sparkle', label: 'Sparkle', Icon: Sparkle },
  { id: 'ghost', label: 'Ghost', Icon: Ghost },
  { id: 'alien', label: 'Alien', Icon: Alien },
] as const;

const BY_ID = new Map(AVATAR_CATALOG.map(entry => [entry.id, entry]));

export function isAvatarId(value: string): boolean {
  return BY_ID.has(value);
}

export function getAvatar(id: string | null | undefined): AvatarCatalogEntry {
  if (id && BY_ID.has(id)) {
    return BY_ID.get(id)!;
  }
  return BY_ID.get(DEFAULT_AVATAR_ID)!;
}
