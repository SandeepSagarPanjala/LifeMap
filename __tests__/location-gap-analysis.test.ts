import {findLocationSaveGaps} from '../src/lib/location-gap-analysis';
import type {LocationPointRow} from '../src/db/repositories/location-days';

function makePoints(
  specs: Array<{minutes: number}>,
): LocationPointRow[] {
  const start = new Date('2026-06-03T16:00:00');
  return specs.map((spec, index) => ({
    id: index + 1,
    timestamp: new Date(start.getTime() + spec.minutes * 60_000),
    lat: 33.21,
    lng: -97.13,
    accuracy: 10,
    altitude: null,
    speed: null,
    source: 'gps',
  }));
}

describe('location save gaps', () => {
  it('detects a 19 minute hole between saves', () => {
    const gaps = findLocationSaveGaps(
      makePoints([{minutes: 0}, {minutes: 19}]),
      2,
    );

    expect(gaps).toHaveLength(1);
    expect(Math.round(gaps[0]!.durationMs / 60_000)).toBe(19);
  });
});
