import {
  buildRawLocationExportJson,
  exportFileLabel,
} from '../src/lib/location-export';
import type {LocationPointRow} from '../src/db/repositories/location-days';

const sample: LocationPointRow[] = [
  {
    id: 1,
    timestamp: new Date('2026-06-03T10:00:00Z'),
    lat: 33.21,
    lng: -97.13,
    accuracy: 12,
    altitude: 100,
    speed: 1.5,
    source: 'gps',
  },
  {
    id: 2,
    timestamp: new Date('2026-06-03T10:05:00Z'),
    lat: 33.22,
    lng: -97.12,
    accuracy: null,
    altitude: null,
    speed: null,
    source: 'motion',
  },
];

describe('location export', () => {
  it('exports raw JSON matching database columns', () => {
    const payload = JSON.parse(
      buildRawLocationExportJson(sample, {scope: 'today', dateKey: '2026-06-03'}),
    );

    expect(payload.table).toBe('location_points');
    expect(payload.rowCount).toBe(2);
    expect(payload.rows[0]).toEqual({
      id: 1,
      timestamp: '2026-06-03T10:00:00.000Z',
      lat: 33.21,
      lng: -97.13,
      accuracy: 12,
      altitude: 100,
      speed: 1.5,
      source: 'gps',
    });
    expect(payload.rows[1].source).toBe('motion');
  });

  it('builds export file labels', () => {
    expect(exportFileLabel('today', '2026-06-03')).toBe(
      'lifemap-location-points-2026-06-03.json',
    );
    expect(exportFileLabel('day', '2026-06-05')).toBe(
      'lifemap-location-points-2026-06-05.json',
    );
    expect(exportFileLabel('all', '2026-06-03')).toBe(
      'lifemap-location-points-all.json',
    );
  });
});
