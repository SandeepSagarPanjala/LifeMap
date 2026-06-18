import {
  EMOTION_TOKENS,
  formatEmotionMoodLabel,
  getEmotionToken,
  getEmotionTokenByLabel,
  parseEmotionMoodLabel,
} from '../src/lib/moments/emotion-tokens';
import {emotionContextPrompt} from '../src/lib/moments/emotion-context-tokens';

describe('emotion tokens', () => {
  it('defines all requested emotion stickers', () => {
    expect(EMOTION_TOKENS).toHaveLength(31);
    expect(EMOTION_TOKENS.map(token => token.label)).toEqual([
      'Amazed',
      'Amused',
      'Angry',
      'Annoyed',
      'Anxious',
      'Ashamed',
      'Brave',
      'Calm',
      'Confident',
      'Content',
      'Disappointed',
      'Discouraged',
      'Disgusted',
      'Drained',
      'Embarrassed',
      'Indifferent',
      'Irritated',
      'Jealous',
      'Joyful',
      'Lonely',
      'Overwhelmed',
      'Passionate',
      'Peaceful',
      'Proud',
      'Relieved',
      'Sad',
      'Satisfied',
      'Scared',
      'Stressed',
      'Surprised',
      'Worried',
    ]);
  });

  it('looks up tokens by id and label', () => {
    expect(getEmotionToken('joyful').sticker).toBe('😊');
    expect(getEmotionTokenByLabel('Joyful')?.id).toBe('joyful');
    expect(getEmotionTokenByLabel('Very Pleasant')).toBeNull();
  });

  it('formats and parses emotion plus context labels', () => {
    expect(formatEmotionMoodLabel('Amazed', 'Work')).toBe('Amazed · Work');
    expect(parseEmotionMoodLabel('Amazed · Work')).toEqual({
      emotionLabel: 'Amazed',
      contextLabel: 'Work',
    });
    expect(emotionContextPrompt('Amazed')).toBe(
      'Why are you feeling amazed because of?',
    );
  });
});
