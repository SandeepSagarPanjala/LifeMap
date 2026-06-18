export type EmotionContextTokenId =
  | 'health'
  | 'fitness'
  | 'self-care'
  | 'hobbies'
  | 'identity'
  | 'spirituality'
  | 'community'
  | 'family'
  | 'friends'
  | 'partner'
  | 'dating'
  | 'tasks'
  | 'work'
  | 'education'
  | 'travel'
  | 'weather'
  | 'current-events'
  | 'money';

export type EmotionContextToken = {
  id: EmotionContextTokenId;
  label: string;
  sticker: string;
  tint: string;
};

export const EMOTION_CONTEXT_TOKENS: EmotionContextToken[] = [
  {id: 'health', label: 'Health', sticker: '🩺', tint: '#E8F5F0'},
  {id: 'fitness', label: 'Fitness', sticker: '💪', tint: '#FFE8E8'},
  {id: 'self-care', label: 'Self-Care', sticker: '🧘', tint: '#EAF7F1'},
  {id: 'hobbies', label: 'Hobbies', sticker: '🎨', tint: '#FFF4E8'},
  {id: 'identity', label: 'Identity', sticker: '🪞', tint: '#F0EEF8'},
  {id: 'spirituality', label: 'Spirituality', sticker: '✨', tint: '#F3EEFF'},
  {id: 'community', label: 'Community', sticker: '🏘️', tint: '#E8F0FF'},
  {id: 'family', label: 'Family', sticker: '👨‍👩‍👧', tint: '#FFF0E6'},
  {id: 'friends', label: 'Friends', sticker: '👥', tint: '#EAF5FF'},
  {id: 'partner', label: 'Partner', sticker: '💑', tint: '#FFEDF3'},
  {id: 'dating', label: 'Dating', sticker: '💕', tint: '#FFECEF'},
  {id: 'tasks', label: 'Tasks', sticker: '✅', tint: '#EEF8EE'},
  {id: 'work', label: 'Work', sticker: '💼', tint: '#EEF0F4'},
  {id: 'education', label: 'Education', sticker: '📚', tint: '#FFF7D6'},
  {id: 'travel', label: 'Travel', sticker: '✈️', tint: '#EAF7FB'},
  {id: 'weather', label: 'Weather', sticker: '🌤️', tint: '#FFF8E8'},
  {id: 'current-events', label: 'Current Events', sticker: '📰', tint: '#F2F2F7'},
  {id: 'money', label: 'Money', sticker: '💰', tint: '#FFF4DF'},
];

const contextTokenById = new Map(
  EMOTION_CONTEXT_TOKENS.map(token => [token.id, token]),
);
const contextTokenByLabel = new Map(
  EMOTION_CONTEXT_TOKENS.map(token => [token.label.toLowerCase(), token]),
);

export function getEmotionContextToken(id: EmotionContextTokenId): EmotionContextToken {
  return contextTokenById.get(id)!;
}

export function getEmotionContextTokenByLabel(label: string): EmotionContextToken | null {
  return contextTokenByLabel.get(label.trim().toLowerCase()) ?? null;
}

export function emotionContextPrompt(emotionLabel: string): string {
  return `Why are you feeling ${emotionLabel.toLowerCase()} because of?`;
}
