import type { MomentRow } from '@/db/repositories/moments';
import {
  getMoodArtPresentation,
  resolveEmotionFromMoodLabel,
  resolveMoodVariantFromMoment,
  type MoodArtVariant,
} from '@/lib/moments/mood-art';
import type { EmotionToken } from '@/lib/moments/emotion-tokens';

export type RankedMoodInsight = {
  emotion: EmotionToken;
  count: number;
  /** Most common art variant among logs for this emotion. */
  variant: MoodArtVariant;
};

/**
 * Top moods by log count (emotion from `moodLabel`). Ties break A→Z by label.
 */
export function rankTopMoods(
  moments: readonly MomentRow[],
  limit = 6,
): RankedMoodInsight[] {
  type Acc = {
    emotion: EmotionToken;
    count: number;
    variantCounts: Map<MoodArtVariant, number>;
  };
  const tallies = new Map<string, Acc>();

  for (const moment of moments) {
    const emotion = resolveEmotionFromMoodLabel(moment.moodLabel);
    if (emotion == null) {
      continue;
    }
    let entry = tallies.get(emotion.id);
    if (entry == null) {
      entry = { emotion, count: 0, variantCounts: new Map() };
      tallies.set(emotion.id, entry);
    }
    entry.count += 1;
    const variant = resolveMoodVariantFromMoment(moment.moodVariant);
    entry.variantCounts.set(
      variant,
      (entry.variantCounts.get(variant) ?? 0) + 1,
    );
  }

  return [...tallies.values()]
    .sort(
      (a, b) =>
        b.count - a.count || a.emotion.label.localeCompare(b.emotion.label),
    )
    .slice(0, Math.max(0, limit))
    .map(({ emotion, count, variantCounts }) => {
      let bestVariant: MoodArtVariant = 'cat';
      let bestCount = -1;
      for (const [variant, n] of variantCounts) {
        if (n > bestCount) {
          bestCount = n;
          bestVariant = variant;
        }
      }
      return { emotion, count, variant: bestVariant };
    });
}

export function moodInsightImageSource(ranked: RankedMoodInsight) {
  return getMoodArtPresentation(ranked.emotion.id, ranked.variant).imageSource;
}
