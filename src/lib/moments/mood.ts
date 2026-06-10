export type MoodBucket = {
  label: string;
  minScore: number;
  maxScore: number;
  gradientStart: string;
  gradientEnd: string;
};

export const MOOD_BUCKETS: MoodBucket[] = [
  {
    label: 'Very Unpleasant',
    minScore: 0,
    maxScore: 0.14,
    gradientStart: '#4A1D96',
    gradientEnd: '#6B21A8',
  },
  {
    label: 'Unpleasant',
    minScore: 0.15,
    maxScore: 0.28,
    gradientStart: '#5B21B6',
    gradientEnd: '#7C3AED',
  },
  {
    label: 'Slightly Unpleasant',
    minScore: 0.29,
    maxScore: 0.42,
    gradientStart: '#7C3AED',
    gradientEnd: '#A78BFA',
  },
  {
    label: 'Neutral',
    minScore: 0.43,
    maxScore: 0.57,
    gradientStart: '#94A3B8',
    gradientEnd: '#CBD5E1',
  },
  {
    label: 'Slightly Pleasant',
    minScore: 0.58,
    maxScore: 0.71,
    gradientStart: '#86EFAC',
    gradientEnd: '#4ADE80',
  },
  {
    label: 'Pleasant',
    minScore: 0.72,
    maxScore: 0.85,
    gradientStart: '#34D399',
    gradientEnd: '#10B981',
  },
  {
    label: 'Very Pleasant',
    minScore: 0.86,
    maxScore: 1,
    gradientStart: '#059669',
    gradientEnd: '#047857',
  },
];

export function clampMoodScore(score: number): number {
  return Math.min(1, Math.max(0, score));
}

export function moodBucketForScore(score: number): MoodBucket {
  const clamped = clampMoodScore(score);
  const bucket =
    MOOD_BUCKETS.find(
      item => clamped >= item.minScore && clamped <= item.maxScore,
    ) ?? MOOD_BUCKETS[3]!;
  return bucket;
}

export function moodLabelForScore(score: number): string {
  return moodBucketForScore(score).label;
}
