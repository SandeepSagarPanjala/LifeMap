import type {EmotionContextToken} from '@/lib/moments/emotion-context-tokens';

export type EmotionTokenId =
  | 'amazed'
  | 'amused'
  | 'angry'
  | 'annoyed'
  | 'anxious'
  | 'ashamed'
  | 'brave'
  | 'calm'
  | 'confident'
  | 'content'
  | 'disappointed'
  | 'discouraged'
  | 'disgusted'
  | 'drained'
  | 'embarrassed'
  | 'indifferent'
  | 'irritated'
  | 'jealous'
  | 'joyful'
  | 'lonely'
  | 'overwhelmed'
  | 'passionate'
  | 'peaceful'
  | 'proud'
  | 'relieved'
  | 'sad'
  | 'satisfied'
  | 'scared'
  | 'stressed'
  | 'surprised'
  | 'worried';

export type EmotionToken = {
  id: EmotionTokenId;
  label: string;
  sticker: string;
  tint: string;
};

export const EMOTION_TOKENS: EmotionToken[] = [
  {id: 'amazed', label: 'Amazed', sticker: '🤩', tint: '#FFF4D6'},
  {id: 'amused', label: 'Amused', sticker: '😄', tint: '#FFF8E8'},
  {id: 'angry', label: 'Angry', sticker: '😠', tint: '#FFE8E8'},
  {id: 'annoyed', label: 'Annoyed', sticker: '😒', tint: '#FFF0E6'},
  {id: 'anxious', label: 'Anxious', sticker: '😰', tint: '#F3EEFF'},
  {id: 'ashamed', label: 'Ashamed', sticker: '😳', tint: '#FFEFF5'},
  {id: 'brave', label: 'Brave', sticker: '🦁', tint: '#FFF3DB'},
  {id: 'calm', label: 'Calm', sticker: '😌', tint: '#EAF7F1'},
  {id: 'confident', label: 'Confident', sticker: '😎', tint: '#E8F3FF'},
  {id: 'content', label: 'Content', sticker: '☺️', tint: '#EEF8EE'},
  {id: 'disappointed', label: 'Disappointed', sticker: '😞', tint: '#EEF0F4'},
  {id: 'discouraged', label: 'Discouraged', sticker: '😔', tint: '#ECEFF5'},
  {id: 'disgusted', label: 'Disgusted', sticker: '🤢', tint: '#EAF5EA'},
  {id: 'drained', label: 'Drained', sticker: '😫', tint: '#F0F0F5'},
  {id: 'embarrassed', label: 'Embarrassed', sticker: '🫣', tint: '#FFEDF3'},
  {id: 'indifferent', label: 'Indifferent', sticker: '😐', tint: '#F2F2F7'},
  {id: 'irritated', label: 'Irritated', sticker: '😤', tint: '#FFEDE8'},
  {id: 'jealous', label: 'Jealous', sticker: '💚', tint: '#E8F7EF'},
  {id: 'joyful', label: 'Joyful', sticker: '😊', tint: '#FFF7D6'},
  {id: 'lonely', label: 'Lonely', sticker: '🥺', tint: '#ECEFF8'},
  {id: 'overwhelmed', label: 'Overwhelmed', sticker: '🤯', tint: '#F2ECFF'},
  {id: 'passionate', label: 'Passionate', sticker: '❤️‍🔥', tint: '#FFECEF'},
  {id: 'peaceful', label: 'Peaceful', sticker: '🕊️', tint: '#EAF5FF'},
  {id: 'proud', label: 'Proud', sticker: '🏅', tint: '#FFF4DF'},
  {id: 'relieved', label: 'Relieved', sticker: '😮‍💨', tint: '#EAF7FB'},
  {id: 'sad', label: 'Sad', sticker: '😢', tint: '#E8EEF8'},
  {id: 'satisfied', label: 'Satisfied', sticker: '😌', tint: '#EEF6EA'},
  {id: 'scared', label: 'Scared', sticker: '😨', tint: '#F1EBFF'},
  {id: 'stressed', label: 'Stressed', sticker: '😣', tint: '#F5E9FF'},
  {id: 'surprised', label: 'Surprised', sticker: '😮', tint: '#FFF5DF'},
  {id: 'worried', label: 'Worried', sticker: '😟', tint: '#EDE9FF'},
];

const emotionTokenById = new Map(EMOTION_TOKENS.map(token => [token.id, token]));
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
  context: EmotionContextToken;
};

export function formatEmotionMoodLabel(emotionLabel: string, contextLabel: string): string {
  return `${emotionLabel} · ${contextLabel}`;
}

export function parseEmotionMoodLabel(label: string): {
  emotionLabel: string;
  contextLabel: string | null;
} {
  const separator = ' · ';
  const index = label.indexOf(separator);
  if (index === -1) {
    return {emotionLabel: label.trim(), contextLabel: null};
  }
  return {
    emotionLabel: label.slice(0, index).trim(),
    contextLabel: label.slice(index + separator.length).trim() || null,
  };
}
