import { rankTopMoods } from '@/lib/moments/mood-insights';
import type { MomentRow } from '@/db/repositories/moments';
import { makeMoment } from '../../../../__tests__/helpers/fixtures';

function moodMoment(
  id: number,
  moodLabel: string,
  moodVariant: string | null = 'cat',
): MomentRow {
  return makeMoment({
    id,
    type: 'mood',
    moodLabel,
    moodVariant,
    timestamp: new Date(`2026-06-0${(id % 9) + 1}T12:00:00Z`),
  });
}

describe('rankTopMoods', () => {
  it('returns top 6 by count with art variant majority', () => {
    const moments = [
      moodMoment(1, 'Happy · sunny', 'cat'),
      moodMoment(2, 'Happy · sunny', 'dog'),
      moodMoment(3, 'Happy · sunny', 'cat'),
      moodMoment(4, 'Calm', 'male'),
      moodMoment(5, 'Calm', 'male'),
      moodMoment(6, 'Anxious', 'female'),
      moodMoment(7, 'Tired', 'cat'),
      moodMoment(8, 'Content', 'cat'),
      moodMoment(9, 'Brave', 'cat'),
      moodMoment(10, 'Curious', 'cat'),
      moodMoment(11, 'Bored', 'cat'),
    ];
    const ranked = rankTopMoods(moments, 6);
    expect(ranked).toHaveLength(6);
    expect(ranked[0]?.emotion.label).toBe('Happy');
    expect(ranked[0]?.count).toBe(3);
    expect(ranked[0]?.variant).toBe('cat');
    expect(ranked[1]?.emotion.label).toBe('Calm');
    expect(ranked[1]?.count).toBe(2);
    // Remaining singles are A→Z; Tired is 7th overall and drops out.
    expect(ranked.map(r => r.emotion.label)).not.toContain('Tired');
  });

  it('skips moods with unknown labels', () => {
    const ranked = rankTopMoods([
      moodMoment(1, 'NotARealMood'),
      moodMoment(2, 'Happy'),
    ]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.emotion.label).toBe('Happy');
  });
});
