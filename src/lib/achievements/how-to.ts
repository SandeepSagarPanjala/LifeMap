import { APP_COPY } from '@/lib/app-copy';
import type { DistanceUnit } from '@/lib/location-geo';

import { ACHIEVEMENT_BADGE_BY_ID } from './catalog';
import type { AchievementBadgeDefinition, AchievementBadgeId } from './types';

function formatAmount(n: number): string {
  return n.toLocaleString();
}

/**
 * User-facing “what to do” copy for unlocking a badge.
 * Pure — uses catalog thresholds + distance unit preference.
 */
export function achievementUnlockInstruction(
  id: AchievementBadgeId,
  distanceUnit: DistanceUnit,
): string {
  const badge = ACHIEVEMENT_BADGE_BY_ID[id];
  return instructionForBadge(badge, distanceUnit);
}

export function instructionForBadge(
  badge: AchievementBadgeDefinition,
  distanceUnit: DistanceUnit,
): string {
  const copy = APP_COPY.achievements.howTo;
  switch (badge.metric) {
    case 'travel_distance': {
      const amount =
        distanceUnit === 'mi'
          ? (badge.thresholdMi ?? 0)
          : (badge.thresholdKm ?? 0);
      const unit =
        distanceUnit === 'mi' ? copy.unitMiles : copy.unitKilometers;
      return copy.travel(formatAmount(amount), unit);
    }
    case 'unique_places':
      return copy.places(formatAmount(badge.threshold ?? 0));
    case 'poi_category':
      return copy.category(copy.categoryPlaces[badge.id as keyof typeof copy.categoryPlaces]);
    case 'days_tracked':
      return copy.days(formatAmount(badge.threshold ?? 0));
    case 'nights_away':
      return copy.nightsAway;
    case 'moments_total':
      return copy.momentsTotal(formatAmount(badge.threshold ?? 0));
    case 'moments_kind':
      return copy.momentKind[
        badge.momentKind as keyof typeof copy.momentKind
      ];
    case 'activities_count':
      return copy.activities(formatAmount(badge.threshold ?? 0));
    case 'home_set':
      return copy.homeSet;
    case 'work_set':
      return copy.workSet;
    case 'home_fullday':
      return copy.homeFullDay(formatAmount(badge.threshold ?? 0));
    default:
      return copy.fallback;
  }
}
