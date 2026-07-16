import { locationPointRow } from '@/lib/location-point-row';
import { buildTravelModeLegs } from '@/lib/travel-mode-legs';

function pointAt(
  id: number,
  minutes: number,
  lat: number,
  lng: number,
  activityType: string | null,
) {
  return locationPointRow({
    id,
    timestamp: new Date(`2026-07-14T12:${String(minutes).padStart(2, '0')}:00.000Z`),
    lat,
    lng,
    activityType,
    activityConfidence: 80,
  });
}

describe('buildTravelModeLegs', () => {
  it('keeps missing activity as a single solid leg', () => {
    const legs = buildTravelModeLegs([
      pointAt(1, 0, 33.2, -97.13, null),
      pointAt(2, 2, 33.21, -97.13, null),
      pointAt(3, 4, 33.22, -97.13, null),
    ]);
    expect(legs).toHaveLength(1);
    expect(legs[0]?.style).toBe('solid');
  });

  it('dashes a long enough on-foot leg after vehicle travel', () => {
    // ~100 m north per 0.001° lat
    const legs = buildTravelModeLegs([
      pointAt(1, 0, 33.2, -97.13, 'in_vehicle'),
      pointAt(2, 2, 33.21, -97.13, 'in_vehicle'),
      pointAt(3, 4, 33.211, -97.13, 'walking'),
      pointAt(4, 6, 33.212, -97.13, 'walking'),
    ]);
    expect(legs.map(leg => leg.style)).toEqual(['solid', 'dashed']);
  });

  it('dashes a ~60 m / 1 min walk', () => {
    // ~0.00054° lat ≈ 60 m between the walking points
    const legs = buildTravelModeLegs([
      pointAt(1, 0, 33.19, -97.13, 'in_vehicle'),
      pointAt(2, 2, 33.2, -97.13, 'in_vehicle'),
      pointAt(3, 3, 33.2001, -97.13, 'walking'),
      pointAt(4, 4, 33.20064, -97.13, 'walking'),
    ]);
    expect(legs.map(leg => leg.style)).toEqual(['solid', 'dashed']);
  });

  it('keeps very short on-foot hops solid', () => {
    const legs = buildTravelModeLegs([
      pointAt(1, 0, 33.2, -97.13, 'in_vehicle'),
      pointAt(2, 1, 33.2001, -97.13, 'walking'),
      pointAt(3, 2, 33.2002, -97.13, 'walking'),
    ]);
    expect(legs).toHaveLength(1);
    expect(legs[0]?.style).toBe('solid');
  });

  it('renders all solid when on-foot detection is disabled', () => {
    const legs = buildTravelModeLegs(
      [
        pointAt(1, 0, 33.2, -97.13, 'in_vehicle'),
        pointAt(2, 2, 33.21, -97.13, 'in_vehicle'),
        pointAt(3, 4, 33.211, -97.13, 'walking'),
        pointAt(4, 6, 33.212, -97.13, 'walking'),
      ],
      { onFootDetection: false },
    );
    expect(legs).toHaveLength(1);
    expect(legs[0]?.style).toBe('solid');
    expect(legs[0]?.coordinates).toHaveLength(4);
  });
});
