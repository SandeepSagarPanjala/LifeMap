import {
  MOOD_BUCKETS,
  clampMoodScore,
  moodBucketForScore,
  moodLabelForScore,
} from '../src/lib/moments/mood';

describe('mood mapping', () => {
  it('clamps scores into 0..1', () => {
    expect(clampMoodScore(-0.2)).toBe(0);
    expect(clampMoodScore(1.5)).toBe(1);
  });

  it('maps scores to seven mood buckets', () => {
    expect(MOOD_BUCKETS).toHaveLength(7);
    expect(moodLabelForScore(0)).toBe('Very Unpleasant');
    expect(moodLabelForScore(0.5)).toBe('Neutral');
    expect(moodLabelForScore(1)).toBe('Very Pleasant');
  });

  it('returns gradient metadata for the active bucket', () => {
    const bucket = moodBucketForScore(0.9);
    expect(bucket.label).toBe('Very Pleasant');
    expect(bucket.gradientStart).toMatch(/^#/);
  });
});
