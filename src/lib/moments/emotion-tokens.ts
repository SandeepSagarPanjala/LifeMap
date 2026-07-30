import type { MoodArtVariant } from '@/lib/moments/mood-art';

export type EmotionTokenId =
  | 'achy'
  | 'affectionate'
  | 'amazed'
  | 'amused'
  | 'angry'
  | 'annoyed'
  | 'anxious'
  | 'ashamed'
  | 'bitter'
  | 'bored'
  | 'brave'
  | 'breathless'
  | 'burnedout'
  | 'calm'
  | 'caring'
  | 'clenched'
  | 'cold'
  | 'confident'
  | 'confused'
  | 'content'
  | 'curious'
  | 'daring'
  | 'depressed'
  | 'determined'
  | 'disappointed'
  | 'discouraged'
  | 'disgusted'
  | 'dizzy'
  | 'drained'
  | 'embarrassed'
  | 'empty'
  | 'empathy'
  | 'energized'
  | 'excited'
  | 'frozen'
  | 'frustrated'
  | 'furious'
  | 'grateful'
  | 'grief'
  | 'grounded'
  | 'guilty'
  | 'happy'
  | 'heartbroken'
  | 'heavy'
  | 'helpless'
  | 'hollow'
  | 'hopeful'
  | 'hot'
  | 'impatient'
  | 'indifferent'
  | 'insecure'
  | 'inspired'
  | 'irritated'
  | 'isolated'
  | 'jealous'
  | 'joyful'
  | 'knotted'
  | 'light'
  | 'lonely'
  | 'longing'
  | 'loved'
  | 'lucky'
  | 'melancholy'
  | 'moody'
  | 'motivated'
  | 'nauseous'
  | 'nervous'
  | 'nostalgic'
  | 'numb'
  | 'optimistic'
  | 'overwhelmed'
  | 'panic'
  | 'passionate'
  | 'peaceful'
  | 'pissed'
  | 'playful'
  | 'present'
  | 'proud'
  | 'regret'
  | 'relaxed'
  | 'relieved'
  | 'resentful'
  | 'restless'
  | 'sad'
  | 'safe'
  | 'satisfied'
  | 'scared'
  | 'settled'
  | 'shaky'
  | 'shocked'
  | 'sorry'
  | 'stressed'
  | 'strong'
  | 'suffocated'
  | 'surprised'
  | 'tense'
  | 'terrified'
  | 'thankful'
  | 'thrilled'
  | 'tingling'
  | 'tired'
  | 'trusting'
  | 'unhappy'
  | 'upset'
  | 'vulnerable'
  | 'worried'
  | 'worthy';

export type EmotionToken = {
  id: EmotionTokenId;
  label: string;
  sticker: string;
  tint: string;
};

export const EMOTION_TOKENS: EmotionToken[] = [
  { id: 'achy', label: 'Achy', sticker: '🤕', tint: '#F5EEE8' },
  { id: 'affectionate', label: 'Affectionate', sticker: '🤗', tint: '#FFEAF0' },
  { id: 'amazed', label: 'Amazed', sticker: '🤩', tint: '#FFF4D6' },
  { id: 'amused', label: 'Amused', sticker: '😄', tint: '#FFF8E8' },
  { id: 'angry', label: 'Angry', sticker: '😠', tint: '#FFE8E8' },
  { id: 'annoyed', label: 'Annoyed', sticker: '😒', tint: '#FFF0E6' },
  { id: 'anxious', label: 'Anxious', sticker: '😰', tint: '#F3EEFF' },
  { id: 'ashamed', label: 'Ashamed', sticker: '😳', tint: '#FFEFF5' },
  { id: 'bitter', label: 'Bitter', sticker: '😖', tint: '#F0EDE8' },
  { id: 'bored', label: 'Bored', sticker: '🥱', tint: '#F2F0EA' },
  { id: 'brave', label: 'Brave', sticker: '🦁', tint: '#FFF3DB' },
  { id: 'breathless', label: 'Breathless', sticker: '😮‍💨', tint: '#EAF5FB' },
  { id: 'burnedout', label: 'Burned out', sticker: '🔋', tint: '#F0EDE8' },
  { id: 'calm', label: 'Calm', sticker: '😌', tint: '#EAF7F1' },
  { id: 'caring', label: 'Caring', sticker: '💝', tint: '#FFEAF2' },
  { id: 'clenched', label: 'Clenched', sticker: '😬', tint: '#F5EDE8' },
  { id: 'cold', label: 'Cold', sticker: '🥶', tint: '#E8F4FF' },
  { id: 'confident', label: 'Confident', sticker: '😎', tint: '#E8F3FF' },
  { id: 'confused', label: 'Confused', sticker: '😕', tint: '#F2F0E8' },
  { id: 'content', label: 'Content', sticker: '☺️', tint: '#EEF8EE' },
  { id: 'curious', label: 'Curious', sticker: '🧐', tint: '#EDF5FF' },
  { id: 'daring', label: 'Daring', sticker: '🔥', tint: '#FFF0E0' },
  { id: 'depressed', label: 'Depressed', sticker: '😞', tint: '#E8ECF4' },
  { id: 'determined', label: 'Determined', sticker: '💪', tint: '#FFF1E0' },
  { id: 'disappointed', label: 'Disappointed', sticker: '😞', tint: '#EEF0F4' },
  { id: 'discouraged', label: 'Discouraged', sticker: '😔', tint: '#ECEFF5' },
  { id: 'disgusted', label: 'Disgusted', sticker: '🤢', tint: '#EAF5EA' },
  { id: 'dizzy', label: 'Dizzy', sticker: '💫', tint: '#F3EEFF' },
  { id: 'drained', label: 'Drained', sticker: '😫', tint: '#F0F0F5' },
  { id: 'embarrassed', label: 'Embarrassed', sticker: '🫣', tint: '#FFEDF3' },
  { id: 'empty', label: 'Empty', sticker: '😶', tint: '#F0F0F4' },
  { id: 'empathy', label: 'Empathy', sticker: '🫂', tint: '#EEF4FF' },
  { id: 'energized', label: 'Energized', sticker: '⚡', tint: '#FFF6D8' },
  { id: 'excited', label: 'Excited', sticker: '😆', tint: '#FFF3D0' },
  { id: 'frozen', label: 'Frozen', sticker: '❄️', tint: '#E8F6FF' },
  { id: 'frustrated', label: 'Frustrated', sticker: '😖', tint: '#FFECE6' },
  { id: 'furious', label: 'Furious', sticker: '🤬', tint: '#FFE4E4' },
  { id: 'grateful', label: 'Grateful', sticker: '🙏', tint: '#EEF8E8' },
  { id: 'grief', label: 'Grief', sticker: '🖤', tint: '#EAEBF0' },
  { id: 'grounded', label: 'Grounded', sticker: '🌳', tint: '#EEF6EA' },
  { id: 'guilty', label: 'Guilty', sticker: '😔', tint: '#F1EDF3' },
  { id: 'happy', label: 'Happy', sticker: '🙂', tint: '#FFF8E6' },
  { id: 'heartbroken', label: 'Heartbroken', sticker: '💔', tint: '#FFE8EE' },
  { id: 'heavy', label: 'Heavy', sticker: '🪨', tint: '#EEEBF0' },
  { id: 'helpless', label: 'Helpless', sticker: '🥺', tint: '#EEF0F6' },
  { id: 'hollow', label: 'Hollow', sticker: '🕳️', tint: '#F0EEF2' },
  { id: 'hopeful', label: 'Hopeful', sticker: '🌱', tint: '#EAF8F1' },
  { id: 'hot', label: 'Hot', sticker: '🥵', tint: '#FFECE6' },
  { id: 'impatient', label: 'Impatient', sticker: '⏳', tint: '#FFF3E8' },
  { id: 'indifferent', label: 'Indifferent', sticker: '😐', tint: '#F2F2F7' },
  { id: 'insecure', label: 'Insecure', sticker: '😟', tint: '#F3EEF4' },
  { id: 'inspired', label: 'Inspired', sticker: '💡', tint: '#FFF8E0' },
  { id: 'irritated', label: 'Irritated', sticker: '😤', tint: '#FFEDE8' },
  { id: 'isolated', label: 'Isolated', sticker: '🏝️', tint: '#ECEFF6' },
  { id: 'jealous', label: 'Jealous', sticker: '💚', tint: '#E8F7EF' },
  { id: 'joyful', label: 'Joyful', sticker: '😊', tint: '#FFF7D6' },
  { id: 'knotted', label: 'Knotted', sticker: '🪢', tint: '#F5EEE8' },
  { id: 'light', label: 'Light', sticker: '🪶', tint: '#F5FBFF' },
  { id: 'lonely', label: 'Lonely', sticker: '🥺', tint: '#ECEFF8' },
  { id: 'longing', label: 'Longing', sticker: '💭', tint: '#F0EEF6' },
  { id: 'loved', label: 'Loved', sticker: '🥰', tint: '#FFEAF2' },
  { id: 'lucky', label: 'Lucky', sticker: '🍀', tint: '#EEF8E8' },
  { id: 'melancholy', label: 'Melancholy', sticker: '🌧️', tint: '#EAEFF6' },
  { id: 'moody', label: 'Moody', sticker: '😶‍🌫️', tint: '#F0EEF4' },
  { id: 'motivated', label: 'Motivated', sticker: '🚀', tint: '#FFF3E0' },
  { id: 'nauseous', label: 'Nauseous', sticker: '🤢', tint: '#EEF6EA' },
  { id: 'nervous', label: 'Nervous', sticker: '😅', tint: '#F5F0FF' },
  { id: 'nostalgic', label: 'Nostalgic', sticker: '🖼️', tint: '#F5EEE5' },
  { id: 'numb', label: 'Numb', sticker: '😑', tint: '#F2F2F5' },
  { id: 'optimistic', label: 'Optimistic', sticker: '☀️', tint: '#FFF6E0' },
  { id: 'overwhelmed', label: 'Overwhelmed', sticker: '🤯', tint: '#F2ECFF' },
  { id: 'panic', label: 'Panic', sticker: '😱', tint: '#FFE8F0' },
  { id: 'passionate', label: 'Passionate', sticker: '❤️‍🔥', tint: '#FFECEF' },
  { id: 'peaceful', label: 'Peaceful', sticker: '🕊️', tint: '#EAF5FF' },
  { id: 'pissed', label: 'Pissed', sticker: '👿', tint: '#FFE6E6' },
  { id: 'playful', label: 'Playful', sticker: '😛', tint: '#FFF4E0' },
  { id: 'present', label: 'Present', sticker: '🧘', tint: '#EAF6F2' },
  { id: 'proud', label: 'Proud', sticker: '🏅', tint: '#FFF4DF' },
  { id: 'regret', label: 'Regret', sticker: '😣', tint: '#F0EEF3' },
  { id: 'relaxed', label: 'Relaxed', sticker: '😎', tint: '#EAF8F4' },
  { id: 'relieved', label: 'Relieved', sticker: '😮‍💨', tint: '#EAF7FB' },
  { id: 'resentful', label: 'Resentful', sticker: '😒', tint: '#FFECE8' },
  { id: 'restless', label: 'Restless', sticker: '😣', tint: '#F5F0E8' },
  { id: 'sad', label: 'Sad', sticker: '😢', tint: '#E8EEF8' },
  { id: 'safe', label: 'Safe', sticker: '🛡️', tint: '#EAF4F0' },
  { id: 'satisfied', label: 'Satisfied', sticker: '😌', tint: '#EEF6EA' },
  { id: 'scared', label: 'Scared', sticker: '😨', tint: '#F1EBFF' },
  { id: 'settled', label: 'Settled', sticker: '🌿', tint: '#EEF6F0' },
  { id: 'shaky', label: 'Shaky', sticker: '🫨', tint: '#F5F0FF' },
  { id: 'shocked', label: 'Shocked', sticker: '😲', tint: '#FFF5E0' },
  { id: 'sorry', label: 'Sorry', sticker: '🙏', tint: '#F3EEF4' },
  { id: 'stressed', label: 'Stressed', sticker: '😣', tint: '#F5E9FF' },
  { id: 'strong', label: 'Strong', sticker: '💪', tint: '#FFF1E6' },
  { id: 'suffocated', label: 'Suffocated', sticker: '😷', tint: '#EEF0F5' },
  { id: 'surprised', label: 'Surprised', sticker: '😮', tint: '#FFF5DF' },
  { id: 'tense', label: 'Tense', sticker: '😫', tint: '#F5EDE8' },
  { id: 'terrified', label: 'Terrified', sticker: '😨', tint: '#F0E8FF' },
  { id: 'thankful', label: 'Thankful', sticker: '🙏', tint: '#EEF7EA' },
  { id: 'thrilled', label: 'Thrilled', sticker: '🤩', tint: '#FFF0D0' },
  { id: 'tingling', label: 'Tingling', sticker: '✨', tint: '#FFF5EE' },
  { id: 'tired', label: 'Tired', sticker: '😴', tint: '#EEF0F5' },
  { id: 'trusting', label: 'Trusting', sticker: '🤝', tint: '#EEF6F0' },
  { id: 'unhappy', label: 'Unhappy', sticker: '🙁', tint: '#EAEFF5' },
  { id: 'upset', label: 'Upset', sticker: '😟', tint: '#F0EEF5' },
  { id: 'vulnerable', label: 'Vulnerable', sticker: '🫧', tint: '#F5EEF4' },
  { id: 'worried', label: 'Worried', sticker: '😟', tint: '#EDE9FF' },
  { id: 'worthy', label: 'Worthy', sticker: '⭐', tint: '#FFF6E0' },
];

const emotionTokenById = new Map(
  EMOTION_TOKENS.map(token => [token.id, token]),
);
const emotionTokenByLabel = new Map(
  EMOTION_TOKENS.map(token => [token.label.toLowerCase(), token]),
);

export function getEmotionToken(id: EmotionTokenId): EmotionToken {
  return emotionTokenById.get(id)!;
}

export function getEmotionTokenByLabel(label: string): EmotionToken | null {
  return emotionTokenByLabel.get(label.trim().toLowerCase()) ?? null;
}

export function isEmotionTokenId(value: string): value is EmotionTokenId {
  return emotionTokenById.has(value as EmotionTokenId);
}

export type EmotionSelection = {
  emotion: EmotionToken;
  variant: MoodArtVariant;
};

/** @deprecated Prefer emotion label only — kept for reading legacy rows. */
export function formatEmotionMoodLabel(
  emotionLabel: string,
  contextLabel?: string | null,
): string {
  if (contextLabel?.trim()) {
    return `${emotionLabel} · ${contextLabel.trim()}`;
  }
  return emotionLabel;
}

export function parseEmotionMoodLabel(label: string): {
  emotionLabel: string;
  contextLabel: string | null;
} {
  const separator = ' · ';
  const index = label.indexOf(separator);
  if (index === -1) {
    return { emotionLabel: label.trim(), contextLabel: null };
  }
  return {
    emotionLabel: label.slice(0, index).trim(),
    contextLabel: label.slice(index + separator.length).trim() || null,
  };
}
