import {
  ACHIEVEMENT_BADGES,
  badgeCurrent,
  badgeThreshold,
  emptyAchievementMetrics,
  evaluateAchievements,
  evaluateBadge,
  mergeAchievementUnlocks,
  normalizeAchievementPoiKey,
  travelDistanceInUnit,
} from '@/lib/achievements';

describe('achievements catalog', () => {
  it('has 54 badges across three pillars', () => {
    expect(ACHIEVEMENT_BADGES).toHaveLength(54);
    expect(ACHIEVEMENT_BADGES.filter(b => b.pillar === 'traveler')).toHaveLength(
      10,
    );
    expect(ACHIEVEMENT_BADGES.filter(b => b.pillar === 'explorer')).toHaveLength(
      19,
    );
    expect(ACHIEVEMENT_BADGES.filter(b => b.pillar === 'rhythm')).toHaveLength(
      25,
    );
  });
});

describe('normalizeAchievementPoiKey', () => {
  it('strips MapKit prefix and camelCases', () => {
    expect(normalizeAchievementPoiKey('MKPOICategoryCafe')).toBe('cafe');
    expect(normalizeAchievementPoiKey('Restaurant')).toBe('restaurant');
    expect(normalizeAchievementPoiKey('NationalPark')).toBe('nationalPark');
    expect(normalizeAchievementPoiKey('FitnessCenter')).toBe('fitnessCenter');
  });
});

describe('evaluateAchievements', () => {
  it('unlocks travel ladder using mi thresholds', () => {
    const metrics = {
      ...emptyAchievementMetrics('mi'),
      travelDistanceKm: 160.9344, // 100 mi
    };
    const travel100 = evaluateBadge(
      ACHIEVEMENT_BADGES.find(b => b.id === 'travel_100')!,
      metrics,
    );
    expect(badgeThreshold(
      ACHIEVEMENT_BADGES.find(b => b.id === 'travel_100')!,
      metrics,
    )).toBe(100);
    expect(travelDistanceInUnit(metrics.travelDistanceKm, 'mi')).toBeCloseTo(
      100,
      5,
    );
    expect(travel100.unlocked).toBe(true);
    expect(
      evaluateBadge(
        ACHIEVEMENT_BADGES.find(b => b.id === 'travel_250')!,
        metrics,
      ).unlocked,
    ).toBe(false);
  });

  it('unlocks travel ladder using km thresholds', () => {
    const metrics = {
      ...emptyAchievementMetrics('km'),
      travelDistanceKm: 160,
    };
    expect(
      evaluateBadge(
        ACHIEVEMENT_BADGES.find(b => b.id === 'travel_100')!,
        metrics,
      ).unlocked,
    ).toBe(true);
    expect(
      evaluateBadge(
        ACHIEVEMENT_BADGES.find(b => b.id === 'travel_100')!,
        { ...metrics, travelDistanceKm: 159 },
      ).unlocked,
    ).toBe(false);
  });

  it('counts unique places and category firsts', () => {
    const metrics = {
      ...emptyAchievementMetrics('mi'),
      uniquePlaceCount: 10,
      poiCategoryKeys: ['cafe', 'park'],
    };
    expect(
      evaluateBadge(
        ACHIEVEMENT_BADGES.find(b => b.id === 'places_10')!,
        metrics,
      ).unlocked,
    ).toBe(true);
    expect(
      evaluateBadge(
        ACHIEVEMENT_BADGES.find(b => b.id === 'places_25')!,
        metrics,
      ).unlocked,
    ).toBe(false);
    expect(
      evaluateBadge(
        ACHIEVEMENT_BADGES.find(b => b.id === 'cat_cafe')!,
        metrics,
      ).unlocked,
    ).toBe(true);
    expect(
      evaluateBadge(
        ACHIEVEMENT_BADGES.find(b => b.id === 'cat_park')!,
        metrics,
      ).unlocked,
    ).toBe(true);
    expect(
      evaluateBadge(
        ACHIEVEMENT_BADGES.find(b => b.id === 'cat_park')!,
        { ...metrics, poiCategoryKeys: ['nationalPark'] },
      ).unlocked,
    ).toBe(true);
    expect(
      evaluateBadge(
        ACHIEVEMENT_BADGES.find(b => b.id === 'cat_restaurant')!,
        metrics,
      ).unlocked,
    ).toBe(false);
  });

  it('evaluates rhythm moments and home flags', () => {
    const metrics = {
      ...emptyAchievementMetrics('mi'),
      daysTracked: 30,
      nightsAway: 1,
      momentsTotal: 10,
      photoCount: 1,
      activityCount: 10,
      hasHome: true,
      hasWork: false,
      homeFullDayCount: 5,
    };
    const results = evaluateAchievements(metrics);
    const byId = Object.fromEntries(results.map(r => [r.id, r]));
    expect(byId.days_30.unlocked).toBe(true);
    expect(byId.days_100.unlocked).toBe(false);
    expect(byId.nights_1.unlocked).toBe(true);
    expect(byId.moments_10.unlocked).toBe(true);
    expect(byId.moment_photo_1.unlocked).toBe(true);
    expect(byId.moment_video_1.unlocked).toBe(false);
    expect(byId.activities_10.unlocked).toBe(true);
    expect(byId.activities_50.unlocked).toBe(false);
    expect(byId.home_set.unlocked).toBe(true);
    expect(byId.work_set.unlocked).toBe(false);
    expect(byId.home_fullday_5.unlocked).toBe(true);
    expect(byId.home_fullday_10.unlocked).toBe(false);
  });

  it('reports progress below threshold', () => {
    const metrics = {
      ...emptyAchievementMetrics('mi'),
      uniquePlaceCount: 3,
    };
    const badge = ACHIEVEMENT_BADGES.find(b => b.id === 'places_5')!;
    expect(badgeCurrent(badge, metrics)).toBe(3);
    const result = evaluateBadge(badge, metrics);
    expect(result.unlocked).toBe(false);
    expect(result.progress).toBeCloseTo(0.6);
  });
});

describe('mergeAchievementUnlocks', () => {
  it('records first unlock only and lists newly unlocked', () => {
    const evaluated = evaluateAchievements({
      ...emptyAchievementMetrics('mi'),
      hasHome: true,
      momentsTotal: 1,
    });
    const first = mergeAchievementUnlocks({}, evaluated, '2026-01-01T00:00:00.000Z');
    expect(first.newlyUnlocked).toEqual(
      expect.arrayContaining(['home_set', 'moments_1']),
    );
    expect(first.unlocks.home_set?.unlockedAt).toBe('2026-01-01T00:00:00.000Z');

    const second = mergeAchievementUnlocks(
      first.unlocks,
      evaluated,
      '2026-06-01T00:00:00.000Z',
    );
    expect(second.newlyUnlocked).toEqual([]);
    expect(second.unlocks.home_set?.unlockedAt).toBe(
      '2026-01-01T00:00:00.000Z',
    );
  });
});
