import {
  GenderFemale,
  GenderMale,
  GenderNonbinary,
  Question,
  type Icon as PhosphorIcon,
} from 'phosphor-react-native';

import type { ProfileGender } from '@/lib/profile/types';

/** Classic gender symbols — use with Phosphor `weight="duotone"`. */
export const PROFILE_GENDER_ICONS: Record<
  ProfileGender,
  { Icon: PhosphorIcon; label: string }
> = {
  woman: { Icon: GenderFemale, label: 'Woman' },
  man: { Icon: GenderMale, label: 'Man' },
  nonbinary: { Icon: GenderNonbinary, label: 'Non-binary' },
  prefer_not: { Icon: Question, label: 'Prefer not to say' },
};
