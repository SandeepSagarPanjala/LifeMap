import {
  EMOTION_TOKENS,
  formatEmotionMoodLabel,
  getEmotionToken,
  getEmotionTokenByLabel,
  parseEmotionMoodLabel,
} from '../src/lib/moments/emotion-tokens';
import {
  getDefaultMoodArtVariant,
  getMoodArtVariantsForGender,
  resolveEmotionFromMoodLabel,
  resolveMoodArtVariant,
} from '../src/lib/moments/mood-art';

describe('emotion tokens', () => {
  it('defines all requested emotion stickers', () => {
    expect(EMOTION_TOKENS).toHaveLength(107);
    expect(EMOTION_TOKENS.map(token => token.label)).toEqual([
      'Achy',
      'Affectionate',
      'Amazed',
      'Amused',
      'Angry',
      'Annoyed',
      'Anxious',
      'Ashamed',
      'Bitter',
      'Bored',
      'Brave',
      'Breathless',
      'Burned out',
      'Calm',
      'Caring',
      'Clenched',
      'Cold',
      'Confident',
      'Confused',
      'Content',
      'Curious',
      'Daring',
      'Depressed',
      'Determined',
      'Disappointed',
      'Discouraged',
      'Disgusted',
      'Dizzy',
      'Drained',
      'Embarrassed',
      'Empty',
      'Empathy',
      'Energized',
      'Excited',
      'Frozen',
      'Frustrated',
      'Furious',
      'Grateful',
      'Grief',
      'Grounded',
      'Guilty',
      'Happy',
      'Heartbroken',
      'Heavy',
      'Helpless',
      'Hollow',
      'Hopeful',
      'Hot',
      'Impatient',
      'Indifferent',
      'Insecure',
      'Inspired',
      'Irritated',
      'Isolated',
      'Jealous',
      'Joyful',
      'Knotted',
      'Light',
      'Lonely',
      'Longing',
      'Loved',
      'Lucky',
      'Melancholy',
      'Moody',
      'Motivated',
      'Nauseous',
      'Nervous',
      'Nostalgic',
      'Numb',
      'Optimistic',
      'Overwhelmed',
      'Panic',
      'Passionate',
      'Peaceful',
      'Pissed',
      'Playful',
      'Present',
      'Proud',
      'Regret',
      'Relaxed',
      'Relieved',
      'Resentful',
      'Restless',
      'Sad',
      'Safe',
      'Satisfied',
      'Scared',
      'Settled',
      'Shaky',
      'Shocked',
      'Sorry',
      'Stressed',
      'Strong',
      'Suffocated',
      'Surprised',
      'Tense',
      'Terrified',
      'Thankful',
      'Thrilled',
      'Tingling',
      'Tired',
      'Trusting',
      'Unhappy',
      'Upset',
      'Vulnerable',
      'Worried',
      'Worthy',
    ]);
  });

  it('looks up tokens by id and label', () => {
    expect(getEmotionToken('joyful').sticker).toBe('😊');
    expect(getEmotionTokenByLabel('Joyful')?.id).toBe('joyful');
    expect(getEmotionTokenByLabel('Burned out')?.id).toBe('burnedout');
    expect(getEmotionTokenByLabel('Very Pleasant')).toBeNull();
  });

  it('formats emotion-only labels and still parses legacy context rows', () => {
    expect(formatEmotionMoodLabel('Amazed')).toBe('Amazed');
    expect(formatEmotionMoodLabel('Amazed', 'Work')).toBe('Amazed · Work');
    expect(parseEmotionMoodLabel('Amazed · Work')).toEqual({
      emotionLabel: 'Amazed',
      contextLabel: 'Work',
    });
    expect(resolveEmotionFromMoodLabel('Amazed · Work')?.id).toBe('amazed');
    expect(resolveEmotionFromMoodLabel('Joyful')?.id).toBe('joyful');
  });
});

describe('mood art variants', () => {
  it('keeps every character available for every profile gender', () => {
    const variants = ['male', 'female', 'cat', 'dog'];
    expect(getMoodArtVariantsForGender('man')).toEqual(variants);
    expect(getMoodArtVariantsForGender('woman')).toEqual(variants);
    expect(getMoodArtVariantsForGender('nonbinary')).toEqual(variants);
    expect(getMoodArtVariantsForGender('prefer_not')).toEqual(variants);
    expect(getMoodArtVariantsForGender(null)).toEqual(variants);
  });

  it('defaults and resolves preferred variants', () => {
    expect(getDefaultMoodArtVariant('man')).toBe('male');
    expect(getDefaultMoodArtVariant('woman')).toBe('female');
    expect(getDefaultMoodArtVariant(null)).toBe('cat');
    expect(resolveMoodArtVariant('man', 'dog')).toBe('dog');
    expect(resolveMoodArtVariant('man', 'female')).toBe('female');
    expect(resolveMoodArtVariant('nonbinary', 'male')).toBe('male');
  });
});
