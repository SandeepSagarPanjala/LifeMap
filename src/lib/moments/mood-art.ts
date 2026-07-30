import type { ImageSourcePropType } from 'react-native';

import type { ProfileGender } from '@/lib/profile/types';
import { MOOD_ART_ASSETS } from '@/lib/moments/mood-art-assets';
import {
  EMOTION_TOKENS,
  getEmotionToken,
  getEmotionTokenByLabel,
  type EmotionToken,
  type EmotionTokenId,
} from '@/lib/moments/emotion-tokens';

export type MoodArtVariant = 'male' | 'female' | 'cat' | 'dog';

export const MOOD_ART_VARIANTS: MoodArtVariant[] = [
  'male',
  'female',
  'cat',
  'dog',
];

export const MOOD_ART_VARIANT_SETTING_KEY = 'mood.art_variant';

export const MAX_MOOD_REASON_LENGTH = 500;

const VARIANT_LABELS: Record<MoodArtVariant, string> = {
  male: 'Male',
  female: 'Female',
  cat: 'Cat',
  dog: 'Dog',
};

export function isMoodArtVariant(value: string): value is MoodArtVariant {
  return (
    value === 'male' || value === 'female' || value === 'cat' || value === 'dog'
  );
}

export function moodArtVariantLabel(variant: MoodArtVariant): string {
  return VARIANT_LABELS[variant];
}

/** All characters remain available; profile gender only chooses the default. */
export function getMoodArtVariantsForGender(
  _gender: ProfileGender | null | undefined,
): MoodArtVariant[] {
  return [...MOOD_ART_VARIANTS];
}

export function getDefaultMoodArtVariant(
  gender: ProfileGender | null | undefined,
): MoodArtVariant {
  if (gender === 'man') {
    return 'male';
  }
  if (gender === 'woman') {
    return 'female';
  }
  return 'cat';
}

/** Prefer a saved variant when still allowed for the current gender. */
export function resolveMoodArtVariant(
  gender: ProfileGender | null | undefined,
  preferred: string | null | undefined,
): MoodArtVariant {
  const allowed = getMoodArtVariantsForGender(gender);
  if (preferred && isMoodArtVariant(preferred) && allowed.includes(preferred)) {
    return preferred;
  }
  return getDefaultMoodArtVariant(gender);
}

export function getMoodArtPresentation(
  emotionId: EmotionTokenId,
  variant: MoodArtVariant,
): {
  emotion: EmotionToken;
  imageSource: ImageSourcePropType;
} {
  return {
    emotion: getEmotionToken(emotionId),
    imageSource: MOOD_ART_ASSETS[emotionId][variant],
  };
}

export function resolveEmotionFromMoodLabel(
  moodLabel: string | null | undefined,
): EmotionToken | null {
  if (!moodLabel?.trim()) {
    return null;
  }
  const separator = ' · ';
  const index = moodLabel.indexOf(separator);
  const emotionLabel =
    index === -1 ? moodLabel.trim() : moodLabel.slice(0, index).trim();
  return getEmotionTokenByLabel(emotionLabel);
}

export function resolveMoodVariantFromMoment(
  moodVariant: string | null | undefined,
  gender: ProfileGender | null | undefined = null,
): MoodArtVariant {
  return resolveMoodArtVariant(gender, moodVariant);
}

export function allEmotionTokens(): EmotionToken[] {
  return EMOTION_TOKENS;
}
