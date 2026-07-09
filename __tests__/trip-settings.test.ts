import {
  buildTripDetectionConfigFromPreferences,
  normalizeTripDwellMinutes,
  normalizeTripRadiusMeters,
} from '../src/lib/trip-settings';
import { formatTripDwellLabel } from '../src/lib/app-copy';

describe('trip-settings', () => {
  it('normalizes dwell minutes to allowed choices', () => {
    expect(normalizeTripDwellMinutes(30)).toBe(30);
    expect(normalizeTripDwellMinutes(99)).toBe(5);
  });

  it('normalizes radius to allowed choices', () => {
    expect(normalizeTripRadiusMeters(50)).toBe(50);
    expect(normalizeTripRadiusMeters(200)).toBe(75);
  });

  it('builds detection config from preferences', () => {
    const config = buildTripDetectionConfigFromPreferences(40, 100);
    expect(config.dwellMinutes).toBe(40);
    expect(config.dwellRadiusMeters).toBe(100);
    expect(config.gapMinutes).toBe(10);
  });

  it('formats 60 minutes as 1 hr', () => {
    expect(formatTripDwellLabel(60)).toBe('1 hr');
    expect(formatTripDwellLabel(20)).toBe('20 min');
  });
});
