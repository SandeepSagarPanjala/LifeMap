import type { ActivityRow } from '@/db/repositories/activities';
import type { MomentRow } from '@/db/repositories/moments';
import {
  activityIntentLabel,
  type ActivityIntent,
} from '@/lib/activities/activity-intent';
import {
  buildOverviewStats,
  collectInsightCandidates,
  type ActivityInsightCandidate,
  type ActivityOverviewStats,
} from '@/lib/activities/insight-providers';

export type {
  ActivityInsightCandidate,
  ActivityOverviewStats,
  InsightCategory,
} from '@/lib/activities/insight-providers';

/** Hero copy aligned with Activity Experience (not settings labels). */
export function activityExperienceIntentLabel(intent: ActivityIntent): string {
  switch (intent) {
    case 'more':
      return 'Do more';
    case 'less':
      return 'Do less';
    case 'track':
      return 'Tracking';
  }
}

export type ActivityExperience = {
  intent: ActivityIntent;
  intentLabel: string;
  /** Settings-style label kept for chips that still say Good/Bad habit. */
  intentHabitLabel: string;
  overview: ActivityOverviewStats;
  /** Exactly one featured insight when possible. */
  patternOfTheDay: ActivityInsightCandidate | null;
  /** Frequency change card (may also be the featured pattern). */
  whatsChanging: ActivityInsightCandidate | null;
  /** Time / weekday behavior cards. */
  behaviorPatterns: ActivityInsightCandidate[];
  /** Field-driven dynamic insights (money, choice, duration). */
  dynamicInsights: ActivityInsightCandidate[];
  /** All ranked candidates (debug / future rotation). */
  rankedInsights: ActivityInsightCandidate[];
  emptyReason: 'no_logs' | 'not_enough' | null;
};

const CATEGORY_BOOST: Record<ActivityInsightCandidate['category'], number> = {
  change: 20,
  pattern: 12,
  trend: 6,
  reflection: 4,
  identity: 0,
  statistics: -10,
};

export function rankInsightCandidates(
  candidates: readonly ActivityInsightCandidate[],
): ActivityInsightCandidate[] {
  return [...candidates].sort((a, b) => {
    const scoreA = a.priority + CATEGORY_BOOST[a.category] + a.confidence * 10;
    const scoreB = b.priority + CATEGORY_BOOST[b.category] + b.confidence * 10;
    return scoreB - scoreA;
  });
}

/**
 * Build the Activity Experience v1 model from logs.
 * Pure / deterministic — no UI, no React.
 */
export function buildActivityExperience(input: {
  activity: ActivityRow;
  moments: readonly MomentRow[];
  now?: Date;
}): ActivityExperience {
  const now = input.now ?? new Date();
  const overview = buildOverviewStats({
    activity: input.activity,
    moments: input.moments,
    now,
  });
  const candidates = collectInsightCandidates({
    activity: input.activity,
    moments: input.moments,
    now,
  });
  const rankedInsights = rankInsightCandidates(candidates);
  const patternOfTheDay = rankedInsights[0] ?? null;
  const whatsChanging =
    rankedInsights.find(item => item.id.startsWith('change.frequency')) ?? null;
  const behaviorPatterns = rankedInsights.filter(
    item =>
      item.viz?.kind === 'hour_histogram' || item.viz?.kind === 'weekday_bars',
  );
  const dynamicInsights = rankedInsights.filter(
    item =>
      item.viz?.kind === 'money' ||
      item.viz?.kind === 'choice' ||
      item.viz?.kind === 'duration',
  );

  let emptyReason: ActivityExperience['emptyReason'] = null;
  if (input.moments.length === 0) {
    emptyReason = 'no_logs';
  } else if (patternOfTheDay == null && input.moments.length < 8) {
    emptyReason = 'not_enough';
  }

  return {
    intent: input.activity.intent,
    intentLabel: activityExperienceIntentLabel(input.activity.intent),
    intentHabitLabel: activityIntentLabel(input.activity.intent),
    overview,
    patternOfTheDay,
    whatsChanging,
    behaviorPatterns,
    dynamicInsights,
    rankedInsights,
    emptyReason,
  };
}
