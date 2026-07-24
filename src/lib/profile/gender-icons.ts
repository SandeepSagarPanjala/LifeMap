import { GenderFemale } from 'phosphor-react-native/src/icons/GenderFemale';
import { GenderMale } from 'phosphor-react-native/src/icons/GenderMale';
import { GenderNonbinary } from 'phosphor-react-native/src/icons/GenderNonbinary';
import { Question } from 'phosphor-react-native/src/icons/Question';

import type { PhosphorIcon } from '@/lib/profile/phosphor-icon';
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
