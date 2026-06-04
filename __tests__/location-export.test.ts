import {
  buildRawLocationExportCsv,
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

  it('exports raw CSV with header and ISO timestamps', () => {
    const csv = buildRawLocationExportCsv(sample);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('id,timestamp,lat,lng,accuracy,altitude,speed,source');
    expect(lines[1]).toContain('2026-06-03T10:00:00.000Z');
    expect(lines[2]).toContain('motion');
  });

  it('builds export file labels', () => {
    expect(exportFileLabel('json', 'today', '2026-06-03')).toBe(
      'lifemap-location-points-2026-06-03.json',
    );
    expect(exportFileLabel('csv', 'all', '2026-06-03')).toBe(
      'lifemap-location-points-all.csv',
    );
  });
});
