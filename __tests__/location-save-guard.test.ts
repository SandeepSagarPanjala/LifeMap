import {
  isExactDuplicatePersist,
  shouldSkipMotionPersist,
} from '../src/lib/location-save-guard';
import { isMotionLocationPointSource } from '../src/db/repositories/location-points';

describe('location-save-guard', () => {
  const last = {
    timestampMs: 1_000,
    lat: 33.25,
    lng: -97.15,
  };

  it('detects exact duplicate timestamps and coordinates', () => {
    expect(isExactDuplicatePersist(last, 1_000, 33.25, -97.15)).toBe(true);
    expect(isExactDuplicatePersist(last, 1_001, 33.25, -97.15)).toBe(false);
  });

  it('throttles motion saves that arrive faster than GPS', () => {
    expect(
      shouldSkipMotionPersist(last, { lat: 33.25001, lng: -97.15001 }, 3_000),
    ).toBe(true);
    expect(
      shouldSkipMotionPersist(last, { lat: 33.26, lng: -97.16 }, 3_000),
    ).toBe(false);
    expect(
      shouldSkipMotionPersist(last, { lat: 33.25001, lng: -97.15001 }, 8_000),
    ).toBe(false);
  });

  it('recognizes legacy motion row sources', () => {
    expect(isMotionLocationPointSource('motion')).toBe(true);
    expect(isMotionLocationPointSource('headless:motion')).toBe(true);
    expect(isMotionLocationPointSource('native_queue:motion')).toBe(true);
    expect(isMotionLocationPointSource('gps')).toBe(false);
    expect(isMotionLocationPointSource('headless:heartbeat')).toBe(false);
  });
});
