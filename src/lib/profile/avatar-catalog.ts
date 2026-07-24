import { Alien } from 'phosphor-react-native/src/icons/Alien';
import { Bicycle } from 'phosphor-react-native/src/icons/Bicycle';
import { Cat } from 'phosphor-react-native/src/icons/Cat';
import { Coffee } from 'phosphor-react-native/src/icons/Coffee';
import { Dog } from 'phosphor-react-native/src/icons/Dog';
import { Ghost } from 'phosphor-react-native/src/icons/Ghost';
import { Heart } from 'phosphor-react-native/src/icons/Heart';
import { Leaf } from 'phosphor-react-native/src/icons/Leaf';
import { Moon } from 'phosphor-react-native/src/icons/Moon';
import { MusicNote } from 'phosphor-react-native/src/icons/MusicNote';
import { Rocket } from 'phosphor-react-native/src/icons/Rocket';
import { Smiley } from 'phosphor-react-native/src/icons/Smiley';
import { Sparkle } from 'phosphor-react-native/src/icons/Sparkle';
import { Star } from 'phosphor-react-native/src/icons/Star';
import { Sun } from 'phosphor-react-native/src/icons/Sun';
import { UserCircle } from 'phosphor-react-native/src/icons/UserCircle';
import type { PhosphorIcon } from '@/lib/profile/phosphor-icon';

import {
  DEFAULT_AVATAR_ID,
  isAvatarId,
} from '@/lib/profile/avatar-ids';

export { DEFAULT_AVATAR_ID, isAvatarId } from '@/lib/profile/avatar-ids';

export type AvatarCatalogEntry = {
  id: string;
  label: string;
  Icon: PhosphorIcon;
};

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

export function getAvatar(id: string | null | undefined): AvatarCatalogEntry {
  if (id && isAvatarId(id) && BY_ID.has(id)) {
    return BY_ID.get(id)!;
  }
  return BY_ID.get(DEFAULT_AVATAR_ID)!;
}
