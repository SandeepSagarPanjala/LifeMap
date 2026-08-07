import { normalizePoiCategoryKey } from '@/lib/poi-category-icon';
import type { DistanceUnit } from '@/lib/location-geo';

import { ACHIEVEMENT_BADGES } from './catalog';
import type {
  AchievementBadgeDefinition,
  AchievementBadgeId,
  AchievementBadgeProgress,
  AchievementMetrics,
  AchievementUnlockRecord,
} from './types';

const KM_PER_MI = 1.609344;

/**
 * Normalize a stay `poiCategory` to the camelCase key used in badge `poiCategoryKeys`.
 * Aligns with MapKit strip + acronym-aware lower (NationalPark → nationalPark).
 */
export function normalizeAchievementPoiKey(
  category: string | null | undefined,
): string | null {
  const raw = normalizePoiCategoryKey(category);
  if (raw == null) {
    return null;
  }
  const firstLower = raw.charAt(0).toLowerCase() + raw.slice(1);
  const acronymLower = raw.replace(
    /^([A-Z]+)(?=[A-Z][a-z]|$)/,
    acronym => acronym.toLowerCase(),
  );
  // Only use acronym form when the regex actually rewrote leading caps
  // (ATM → atm, EVCharger → evCharger). Avoid Cafe → Cafe.
  if (acronymLower !== raw && acronymLower !== firstLower) {
    return acronymLower;
  }
  return firstLower;
}

export function travelDistanceInUnit(
  travelDistanceKm: number,
  unit: DistanceUnit,
): number {
  if (unit === 'mi') {
    return travelDistanceKm / KM_PER_MI;
  }
  return travelDistanceKm;
}

export function badgeThreshold(
  badge: AchievementBadgeDefinition,
  metrics: AchievementMetrics,
): number {
  if (badge.metric === 'travel_distance') {
    return metrics.distanceUnit === 'mi'
      ? (badge.thresholdMi ?? 0)
      : (badge.thresholdKm ?? 0);
  }
  return badge.threshold ?? 1;
}

export function badgeCurrent(
  badge: AchievementBadgeDefinition,
  metrics: AchievementMetrics,
): number {
  switch (badge.metric) {
    case 'travel_distance':
      return travelDistanceInUnit(
        metrics.travelDistanceKm,
        metrics.distanceUnit,
      );
    case 'unique_places':
      return metrics.uniquePlaceCount;
    case 'poi_category': {
      const keys = new Set(metrics.poiCategoryKeys);
      const match = badge.poiCategoryKeys ?? [];
      return match.some(key => keys.has(key)) ? 1 : 0;
    }
    case 'days_tracked':
      return metrics.daysTracked;
    case 'nights_away':
      return metrics.nightsAway;
    case 'moments_total':
      return metrics.momentsTotal;
    case 'moments_kind':
      switch (badge.momentKind) {
        case 'photo':
          return metrics.photoCount;
        case 'video':
          return metrics.videoCount;
        case 'note':
          return metrics.noteCount;
        case 'voice':
          return metrics.voiceCount;
        case 'mood':
          return metrics.moodCount;
        case 'activity':
          return metrics.activityCount;
        default:
          return 0;
      }
    case 'activities_count':
      return metrics.activityCount;
    case 'home_set':
      return metrics.hasHome ? 1 : 0;
    case 'work_set':
      return metrics.hasWork ? 1 : 0;
    case 'home_fullday':
      return metrics.homeFullDayCount;
    default:
      return 0;
  }
}

export function evaluateBadge(
  badge: AchievementBadgeDefinition,
  metrics: AchievementMetrics,
): AchievementBadgeProgress {
  const threshold = badgeThreshold(badge, metrics);
  const current = badgeCurrent(badge, metrics);
  const unlocked = threshold > 0 && current >= threshold;
  const progress =
    threshold <= 0 ? 1 : Math.max(0, Math.min(1, current / threshold));
  return {
    id: badge.id,
    unlocked,
    current,
    threshold,
    progress,
  };
}

/** Pure: metrics in → per-badge progress out. No I/O. */
export function evaluateAchievements(
  metrics: AchievementMetrics,
): AchievementBadgeProgress[] {
  return ACHIEVEMENT_BADGES.map(badge => evaluateBadge(badge, metrics));
}

/**
 * Merge newly unlocked badges into an unlocks map (first unlock wins).
 * Pure — caller persists. `nowIso` defaults to UTC now for tests.
 */
export function mergeAchievementUnlocks(
  previous: Partial<Record<AchievementBadgeId, AchievementUnlockRecord>>,
  evaluated: readonly AchievementBadgeProgress[],
  nowIso: string = new Date().toISOString(),
): {
  unlocks: Partial<Record<AchievementBadgeId, AchievementUnlockRecord>>;
  newlyUnlocked: AchievementBadgeId[];
} {
  const unlocks = { ...previous };
  const newlyUnlocked: AchievementBadgeId[] = [];
  for (const badge of evaluated) {
    if (!badge.unlocked) {
      continue;
    }
    if (unlocks[badge.id] != null) {
      continue;
    }
    unlocks[badge.id] = { unlockedAt: nowIso };
    newlyUnlocked.push(badge.id);
  }
  return { unlocks, newlyUnlocked };
}

export function emptyAchievementMetrics(
  distanceUnit: DistanceUnit = 'mi',
): AchievementMetrics {
  return {
    distanceUnit,
    travelDistanceKm: 0,
    uniquePlaceCount: 0,
    poiCategoryKeys: [],
    daysTracked: 0,
    nightsAway: 0,
    momentsTotal: 0,
    photoCount: 0,
    videoCount: 0,
    noteCount: 0,
    voiceCount: 0,
    moodCount: 0,
    activityCount: 0,
    hasHome: false,
    hasWork: false,
    homeFullDayCount: 0,
  };
}
