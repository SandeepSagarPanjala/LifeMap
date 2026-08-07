import type { DistanceUnit } from '@/lib/location-geo';

export type AchievementPillar = 'traveler' | 'explorer' | 'rhythm';

export type AchievementBadgeId =
  | 'travel_10'
  | 'travel_50'
  | 'travel_100'
  | 'travel_250'
  | 'travel_500'
  | 'travel_1000'
  | 'travel_2500'
  | 'travel_5000'
  | 'travel_10000'
  | 'travel_25000'
  | 'places_5'
  | 'places_10'
  | 'places_25'
  | 'places_50'
  | 'places_100'
  | 'places_250'
  | 'places_500'
  | 'cat_cafe'
  | 'cat_restaurant'
  | 'cat_bakery'
  | 'cat_park'
  | 'cat_beach'
  | 'cat_airport'
  | 'cat_hotel'
  | 'cat_gym'
  | 'cat_store'
  | 'cat_gas'
  | 'cat_hospital'
  | 'cat_library'
  | 'days_7'
  | 'days_30'
  | 'days_100'
  | 'days_365'
  | 'nights_1'
  | 'moments_1'
  | 'moments_10'
  | 'moments_25'
  | 'moments_50'
  | 'moments_100'
  | 'moments_250'
  | 'moment_photo_1'
  | 'moment_video_1'
  | 'moment_note_1'
  | 'moment_voice_1'
  | 'moment_mood_1'
  | 'moment_activity_1'
  | 'activities_10'
  | 'activities_50'
  | 'home_set'
  | 'work_set'
  | 'home_fullday_1'
  | 'home_fullday_5'
  | 'home_fullday_10'
  | 'home_fullday_25';

export type AchievementMetricKind =
  | 'travel_distance'
  | 'unique_places'
  | 'poi_category'
  | 'days_tracked'
  | 'nights_away'
  | 'moments_total'
  | 'moments_kind'
  | 'activities_count'
  | 'home_set'
  | 'work_set'
  | 'home_fullday';

export type AchievementBadgeDefinition = {
  id: AchievementBadgeId;
  pillar: AchievementPillar;
  metric: AchievementMetricKind;
  /** Display name (also in APP_COPY). */
  name: string;
  /** For travel_distance: miles ladder threshold. */
  thresholdMi?: number;
  /** For travel_distance: km ladder threshold. */
  thresholdKm?: number;
  /** Count / boolean (≥1) thresholds for non-distance metrics. */
  threshold?: number;
  /** Moment kind for moments_kind metrics. */
  momentKind?: 'photo' | 'video' | 'note' | 'voice' | 'mood' | 'activity';
  /** Normalized camelCase MapKit keys; any match unlocks. */
  poiCategoryKeys?: readonly string[];
};

/** Snapshot of all-time counters used by pure evaluation. */
export type AchievementMetrics = {
  distanceUnit: DistanceUnit;
  /** Sum of sealed travel `distanceKm`. */
  travelDistanceKm: number;
  uniquePlaceCount: number;
  /** Normalized camelCase POI category keys seen on stays. */
  poiCategoryKeys: readonly string[];
  daysTracked: number;
  nightsAway: number;
  momentsTotal: number;
  photoCount: number;
  videoCount: number;
  noteCount: number;
  voiceCount: number;
  moodCount: number;
  activityCount: number;
  hasHome: boolean;
  hasWork: boolean;
  homeFullDayCount: number;
};

export type AchievementBadgeProgress = {
  id: AchievementBadgeId;
  unlocked: boolean;
  current: number;
  threshold: number;
  /** 0..1, capped. */
  progress: number;
};

export type AchievementUnlockRecord = {
  unlockedAt: string;
};

/** Persisted cache payload (settings_stats_cache). */
export type AchievementsProgressPayload = {
  unlocks: Partial<Record<AchievementBadgeId, AchievementUnlockRecord>>;
  /** Optional last-known progress for UI without recompute. */
  progress?: Partial<
    Record<
      AchievementBadgeId,
      { current: number; threshold: number; progress: number }
    >
  >;
};
